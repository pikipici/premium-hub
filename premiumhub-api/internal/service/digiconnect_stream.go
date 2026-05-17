package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DigiConnectStreamChunk represents one piece of work flowing back to the
// client during a streaming OpenAI-compatible call. Type values:
//
//	"delta"            - incremental assistant text content (Responses path)
//	"raw_chat_chunk"   - upstream chat.completion.chunk SSE payload (verbatim)
//	"completed"        - terminal event with final aggregated text + usage
//	"error"            - terminal event with a public-safe error message
type DigiConnectStreamChunk struct {
	Type         string
	Delta        string
	Text         string
	FinishReason string
	Usage        map[string]interface{}
	Model        string
	RequestID    string
	Error        DigiConnectPublicError
}

// streamRouterCall posts the request body to 9router with stream=true and
// dispatches each upstream SSE event through onEvent. It does not interpret
// model output beyond what is required for completion detection so the caller
// (service-layer StreamOpenAICompatible*) can translate events for the client.
//
// Returns the aggregated assistant text on success, plus the upstream HTTP
// status. Mid-stream context cancellation propagates as ctx.Err().
func (s *DigiConnectService) streamRouterCall(
	ctx context.Context,
	input DigiConnectAPIRequestInput,
	route digiConnectResolvedRouterRoute,
	onEvent func(sseEvent) error,
) (aggregateText string, statusCode int, err *digiConnectRouterError) {
	baseURL := strings.TrimRight(s.cfg.DigiConnectRouterBaseURL, "/")
	if baseURL == "" {
		return "", 0, &digiConnectRouterError{InternalCode: "NINEROUTER_HEALTH_FAILED", Err: errors.New("digiconnect router base URL is empty")}
	}
	modelID := strings.TrimSpace(route.ModelID)
	if modelID == "" {
		modelID = digiConnectCXModelIDs[0]
	}
	body := map[string]interface{}{
		"model": modelID,
		"input": input.Input,
	}
	if len(input.Options) > 0 {
		for key, value := range input.Options {
			if key == "model" || key == "stream" {
				continue
			}
			body[key] = value
		}
	}
	body["stream"] = true
	encoded, marshalErr := json.Marshal(body)
	if marshalErr != nil {
		return "", 0, &digiConnectRouterError{InternalCode: "INVALID_PAYLOAD", Err: marshalErr}
	}
	req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+s.cfg.DigiConnectRouterResponsesPath, bytes.NewReader(encoded))
	if reqErr != nil {
		return "", 0, &digiConnectRouterError{InternalCode: "NINEROUTER_HEALTH_FAILED", Err: reqErr}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if provider := strings.TrimSpace(route.Provider); provider != "" {
		req.Header.Set("X-DigiConnect-Router-Provider", provider)
	}
	if token := strings.TrimSpace(s.cfg.DigiConnectRouterInternalAPIKey); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, doErr := s.httpClient.Do(req)
	if doErr != nil {
		return "", 0, &digiConnectRouterError{InternalCode: "NINEROUTER_TIMEOUT", Err: doErr}
	}
	defer res.Body.Close()
	statusCode = res.StatusCode
	if statusCode < 200 || statusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
		return "", statusCode, &digiConnectRouterError{
			InternalCode: fmt.Sprintf("NINEROUTER_%d", statusCode),
			Err:          fmt.Errorf("upstream stream returned %d: %s", statusCode, strings.TrimSpace(string(raw))),
		}
	}

	contentType := strings.ToLower(strings.TrimSpace(res.Header.Get("Content-Type")))
	if !strings.HasPrefix(contentType, "text/event-stream") {
		// Upstream ignored stream:true and returned a single JSON body. Fall
		// back to non-stream extraction so we still surface a real reply.
		raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
		decoded := map[string]interface{}{}
		if jsonErr := json.Unmarshal(raw, &decoded); jsonErr != nil {
			return "", statusCode, &digiConnectRouterError{InternalCode: "NINEROUTER_INVALID_JSON", Err: jsonErr}
		}
		text := extractDigiConnectText(map[string]interface{}{"router_response": decoded})
		// Emit a synthetic single delta so the caller still gets one chunk.
		if text != "" {
			_ = onEvent(sseEvent{Event: "response.output_text.delta", Data: fmt.Sprintf(`{"type":"response.output_text.delta","delta":%q}`, text)})
		}
		_ = onEvent(sseEvent{Event: "response.completed", Data: fmt.Sprintf(`{"type":"response.completed","response":{"id":"resp_synthetic","status":"completed"}}`)})
		return text, statusCode, nil
	}

	var aggregate strings.Builder
	parseErr := parseSSEStream(ctx, res.Body, func(ev sseEvent) error {
		// Capture aggregate before forwarding so a callback error still leaves
		// us with what we received so far.
		switch ev.Event {
		case "response.output_text.delta":
			var payload map[string]interface{}
			if json.Unmarshal([]byte(ev.Data), &payload) == nil {
				if delta, ok := payload["delta"].(string); ok {
					aggregate.WriteString(delta)
				}
			}
		case "response.completed":
			if aggregate.Len() == 0 {
				// Fall back to completed.output text if no incremental deltas.
				var payload map[string]interface{}
				if json.Unmarshal([]byte(ev.Data), &payload) == nil {
					if resp, ok := payload["response"].(map[string]interface{}); ok {
						if output, ok := resp["output"].([]interface{}); ok {
							for _, item := range output {
								msg, ok := item.(map[string]interface{})
								if !ok {
									continue
								}
								if content, ok := msg["content"].([]interface{}); ok {
									for _, raw := range content {
										entry, ok := raw.(map[string]interface{})
										if !ok {
											continue
										}
										if text, ok := entry["text"].(string); ok {
											aggregate.WriteString(text)
										}
									}
								}
							}
						}
					}
				}
			}
		}
		return onEvent(ev)
	})
	if parseErr != nil {
		return aggregate.String(), statusCode, &digiConnectRouterError{InternalCode: "NINEROUTER_INVALID_JSON", Err: parseErr}
	}
	return aggregate.String(), statusCode, nil
}

// StreamOpenAICompatibleChatCompletion handles streaming /chat/completions.
// It pipes upstream chat.completion.chunk SSE events directly to the client
// (preserving content + tool_calls deltas) instead of translating from the
// /responses event format. Billing + audit follow the same charge-after-
// success pattern as the non-stream path: request stays in `processing`
// until the stream ends, then chargeWalletAndFinalize commits the wallet
// debit + final state in one transaction. Mid-stream upstream failures
// fall to `pending_verification` so the reconcile worker recovers.
func (s *DigiConnectService) StreamOpenAICompatibleChatCompletion(
	ctx context.Context,
	apiKey string,
	input OpenAICompatibleChatInput,
	idempotencyKey string,
	onChunk func(DigiConnectStreamChunk),
) DigiConnectPublicError {
	if s.cfg == nil || !s.cfg.DigiConnectEnabled {
		return DigiConnectPublicError{Code: "SERVICE_BUSY", HTTPStatus: http.StatusServiceUnavailable, Message: "Jaringan sedang ramai, coba lagi sebentar lagi."}
	}
	key, entitlement, publicErr := s.validateOpenAICompatibleAccess(apiKey)
	if publicErr.Code != "" {
		return publicErr
	}
	modelID := strings.TrimSpace(input.Model)
	if modelID == "" || !containsDigiConnectModel(modelIDsForDigiConnectEntitlement(entitlement), modelID) {
		return MapDigiConnectPublicError("UNSUPPORTED_TYPE")
	}
	if len(input.Messages) == 0 {
		return MapDigiConnectPublicError("MISSING_INPUT")
	}

	// Build router body (raw passthrough). stream:true forced inside transport.
	routerBody := map[string]interface{}{
		"model":    modelID,
		"messages": chatCompletionsMessagesToInterface(input.Messages),
	}
	if input.Temperature != nil {
		routerBody["temperature"] = *input.Temperature
	}
	if input.MaxTokens != nil {
		routerBody["max_tokens"] = *input.MaxTokens
	}
	if len(input.Tools) > 0 {
		routerBody["tools"] = input.Tools
	}
	if input.ToolChoice != nil {
		routerBody["tool_choice"] = input.ToolChoice
	}
	if input.ResponseFormat != nil {
		routerBody["response_format"] = input.ResponseFormat
	}

	// Audit input (messages+tools serialized).
	auditInputBytes, _ := json.Marshal(map[string]interface{}{
		"messages":    input.Messages,
		"tools":       input.Tools,
		"tool_choice": input.ToolChoice,
	})
	auditInput := string(auditInputBytes)
	if strings.TrimSpace(auditInput) == "" {
		auditInput = "[]"
	}

	options := map[string]interface{}{"model": modelID}
	if input.Temperature != nil {
		options["temperature"] = *input.Temperature
	}
	if input.MaxTokens != nil {
		options["max_tokens"] = *input.MaxTokens
	}
	if len(input.Tools) > 0 {
		options["has_tools"] = true
	}
	options["stream"] = true
	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metadata["compat"] = "openai_chat_completions_stream"
	persistInput := DigiConnectAPIRequestInput{
		Service:  "digiconnect-smart",
		Type:     "text",
		Input:    auditInput,
		Options:  options,
		Metadata: metadata,
	}

	payloadHash := hashDigiConnectPayload(persistInput)
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if idempotencyKey != "" {
		existing, err := s.repo.FindRequestByUserAndIdempotencyKey(key.UserID, idempotencyKey)
		if err == nil {
			if checkErr := CheckDigiConnectIdempotency(existing.IdempotencyRequestHash, payloadHash); checkErr != nil {
				return MapDigiConnectPublicError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD")
			}
			emitChatCompletionsReplayChunks(existing, modelID, onChunk)
			return DigiConnectPublicError{}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return MapDigiConnectPublicError("DATABASE_ERROR")
		}
	}

	now := time.Now()
	walletBalance := int64(0)
	if s.walletRepo != nil {
		if user, userErr := s.walletRepo.LockUserByIDTx(s.walletRepo.DB(), key.UserID); userErr == nil {
			walletBalance = user.WalletBalance
		}
	}
	entitlementState := &DigiConnectEntitlementState{
		Status:                      entitlement.Status,
		ExpiresAt:                   entitlement.ExpiresAt,
		PayPerRequestEnabled:        entitlement.PayPerRequestEnabled,
		OveragePayPerRequestEnabled: entitlement.OveragePayPerRequestEnabled,
	}
	payPerRequestPrice := entitlement.Price
	fairUseExceeded := false
	if entitlement.DailyFairUseLimit > 0 {
		todayWindow := digiConnectDailyWindow(now)
		if counter, err := s.repo.GetUsageCounter(key.UserID, nil, "user_daily", todayWindow); err == nil {
			if counter.Count >= int64(entitlement.DailyFairUseLimit) {
				fairUseExceeded = true
			}
		}
	}
	billing := DecideDigiConnectBilling(now, entitlementState, walletBalance, payPerRequestPrice, fairUseExceeded)
	if !billing.Allowed {
		return billingPublicError(billing.Reason)
	}

	requestID := "dc_req_" + uuid.NewString()
	planCode := entitlement.PlanCode
	routerRoute := digiConnectResolvedRouterRoute{Provider: "kiro", ModelID: modelID}
	if route, ok := digiConnectRouterPlanRoutes[planCode]; ok {
		routerRoute.Provider = route.Provider
	}

	request := &model.DigiConnectRequest{
		RequestID:              requestID,
		UserID:                 key.UserID,
		APIKeyID:               &key.ID,
		ServiceAlias:           persistInput.Service,
		RequestType:            persistInput.Type,
		PlanCode:               planCode,
		RouterProvider:         routerRoute.Provider,
		RouterModel:            routerRoute.ModelID,
		Status:                 "processing",
		InputHash:              HashDigiConnectSecret(auditInput),
		InputPreview:           previewDigiConnectInput(chatCompletionsAuditPreview(input.Messages)),
		PayloadHash:            payloadHash,
		IdempotencyRequestHash: payloadHash,
		BillingDecision:        billing.Decision,
		BillingStatus:          "reserved",
		BillingSource:          billing.Source,
		Amount:                 billing.Amount,
		Currency:               "IDR",
		StartedAt:              &now,
	}
	if idempotencyKey != "" {
		request.IdempotencyKey = &idempotencyKey
	}
	if optionsJSON, err := json.Marshal(persistInput.Options); err == nil {
		request.OptionsJSON = string(optionsJSON)
	}
	if metadataJSON, err := json.Marshal(persistInput.Metadata); err == nil {
		request.MetadataJSON = string(metadataJSON)
	}
	if err := s.repo.CreateRequest(request); err != nil {
		return MapDigiConnectPublicError("DATABASE_ERROR")
	}

	routerStarted := time.Now()
	aggregateText, finishReason, statusCode, routerErr := s.streamRouterChatCompletionsCall(ctx, routerBody, func(rawData string) error {
		// Forward the upstream chunk verbatim. Skip [DONE] sentinel; handler
		// emits its own [DONE] after billing settles.
		if strings.TrimSpace(rawData) == "[DONE]" {
			return nil
		}
		onChunk(DigiConnectStreamChunk{
			Type:      "raw_chat_chunk",
			Delta:     rawData,
			Model:     modelID,
			RequestID: requestID,
		})
		return nil
	})
	latency := time.Since(routerStarted).Milliseconds()
	completedAt := time.Now()
	request.RouterLatencyMS = latency
	request.RouterStatus = statusCode
	request.CompletedAt = &completedAt

	if routerErr != nil {
		request.Status = "pending_verification"
		request.BillingDecision = "pending_verification"
		request.BillingStatus = "pending_verification"
		request.PublicErrorCode = "REQUEST_PENDING_VERIFICATION"
		request.PublicErrorMessage = "Request sedang diverifikasi. Cek status beberapa saat lagi."
		request.InternalErrorCode = routerErr.InternalCode
		if routerErr.Err != nil {
			request.InternalErrorMessage = routerErr.Err.Error()
		}
		_ = s.repo.SaveRequest(request)
		var publicErr DigiConnectPublicError
		if strings.HasPrefix(routerErr.InternalCode, "NINEROUTER_UPSTREAM_") {
			publicErr = DigiConnectPublicError{Code: "UPSTREAM_ERROR", HTTPStatus: http.StatusBadGateway, Message: "Layanan sedang mengalami gangguan. Coba lagi nanti."}
		} else {
			publicErr = MapDigiConnectPublicError(routerErr.InternalCode)
		}
		onChunk(DigiConnectStreamChunk{
			Type:      "error",
			RequestID: requestID,
			Model:     modelID,
			Error:     publicErr,
		})
		return publicErr
	}

	if billing.Source == DigiConnectBillingSourceWallet {
		if err := s.chargeWalletAndFinalize(ctx, key.UserID, request, billing.Amount, completedAt); err != nil {
			request.Status = "pending_verification"
			request.BillingDecision = "pending_verification"
			request.BillingStatus = "pending_verification"
			request.InternalErrorCode = "WALLET_CHARGE_FAILED"
			request.InternalErrorMessage = err.Error()
			_ = s.repo.SaveRequest(request)
			publicErr := MapDigiConnectPublicError("NINEROUTER_TIMEOUT")
			onChunk(DigiConnectStreamChunk{Type: "error", RequestID: requestID, Model: modelID, Error: publicErr})
			return publicErr
		}
	} else {
		request.BillingStatus = DigiConnectBillingStatusIncluded
		request.Status = "completed"
		if err := s.repo.SaveRequest(request); err != nil {
			return MapDigiConnectPublicError("DATABASE_ERROR")
		}
	}

	// Persist a synthetic chat.completion envelope for idempotent replay.
	envelope := map[string]interface{}{
		"id":      requestID,
		"object":  "chat.completion",
		"created": time.Now().Unix(),
		"model":   modelID,
		"choices": []map[string]interface{}{{
			"index":         0,
			"message":       map[string]interface{}{"role": "assistant", "content": aggregateText},
			"finish_reason": finishReason,
		}},
		"digiconnect": map[string]interface{}{"request_id": requestID, "stream": true},
	}
	if encoded, err := json.Marshal(envelope); err == nil {
		request.ResponseJSON = string(encoded)
		_ = s.repo.SaveRequest(request)
	}

	s.recordDigiConnectSuccessSideEffects(key, request, completedAt)

	if finishReason == "" {
		finishReason = "stop"
	}
	onChunk(DigiConnectStreamChunk{
		Type:         "completed",
		Text:         aggregateText,
		FinishReason: finishReason,
		Model:        modelID,
		RequestID:    requestID,
	})
	return DigiConnectPublicError{}
}

// streamRouterChatCompletionsCall posts the body to the upstream
// /v1/chat/completions endpoint with stream:true and dispatches each upstream
// SSE `data:` payload verbatim through onRawChunk. It tracks an aggregate of
// content text + finish_reason for billing+audit purposes.
func (s *DigiConnectService) streamRouterChatCompletionsCall(
	ctx context.Context,
	body map[string]interface{},
	onRawChunk func(rawData string) error,
) (aggregateText string, finishReason string, statusCode int, err *digiConnectRouterError) {
	if ctx == nil {
		ctx = context.Background()
	}
	baseURL := strings.TrimRight(s.cfg.DigiConnectRouterBaseURL, "/")
	if baseURL == "" {
		return "", "", 0, &digiConnectRouterError{InternalCode: "NINEROUTER_HEALTH_FAILED", Err: errors.New("digiconnect router base URL is empty")}
	}
	chatPath := strings.TrimSpace(s.cfg.DigiConnectRouterChatCompletionsPath)
	if chatPath == "" {
		chatPath = "/v1/chat/completions"
	}
	if body == nil {
		body = map[string]interface{}{}
	}
	body["stream"] = true

	encoded, marshalErr := json.Marshal(body)
	if marshalErr != nil {
		return "", "", 0, &digiConnectRouterError{InternalCode: "INVALID_PAYLOAD", Err: marshalErr}
	}
	req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+chatPath, bytes.NewReader(encoded))
	if reqErr != nil {
		return "", "", 0, &digiConnectRouterError{InternalCode: "NINEROUTER_HEALTH_FAILED", Err: reqErr}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if token := strings.TrimSpace(s.cfg.DigiConnectRouterInternalAPIKey); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	res, doErr := s.httpClient.Do(req)
	if doErr != nil {
		return "", "", 0, &digiConnectRouterError{InternalCode: "NINEROUTER_TIMEOUT", Err: doErr}
	}
	defer res.Body.Close()
	statusCode = res.StatusCode

	if statusCode/100 != 2 {
		raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
		return "", "", statusCode, &digiConnectRouterError{
			InternalCode: fmt.Sprintf("NINEROUTER_UPSTREAM_%d", statusCode),
			Err:          fmt.Errorf("upstream stream %d: %s", statusCode, strings.TrimSpace(string(raw))),
		}
	}

	contentType := strings.ToLower(strings.TrimSpace(res.Header.Get("Content-Type")))
	if !strings.HasPrefix(contentType, "text/event-stream") {
		// Defensive: upstream returned single JSON despite stream:true.
		// Fold the body and emit a synthetic single chunk so handlers still
		// flush something.
		raw, readErr := io.ReadAll(io.LimitReader(res.Body, 4<<20))
		if readErr != nil {
			return "", "", statusCode, &digiConnectRouterError{InternalCode: "NINEROUTER_INVALID_JSON", Err: readErr}
		}
		_ = onRawChunk(string(raw))
		// Best-effort decode for aggregate.
		var decoded map[string]interface{}
		_ = json.Unmarshal(raw, &decoded)
		text, fr := extractChatCompletionsContentAndFinish(decoded)
		return text, fr, statusCode, nil
	}

	var aggregate strings.Builder
	parseErr := parseSSEStream(ctx, res.Body, func(ev sseEvent) error {
		// Forward raw payload verbatim before extracting aggregate.
		if cbErr := onRawChunk(ev.Data); cbErr != nil {
			return cbErr
		}
		var payload map[string]interface{}
		if jsonErr := json.Unmarshal([]byte(ev.Data), &payload); jsonErr != nil {
			return nil
		}
		choices, ok := payload["choices"].([]interface{})
		if !ok {
			return nil
		}
		for _, raw := range choices {
			choice, ok := raw.(map[string]interface{})
			if !ok {
				continue
			}
			if fr, ok := choice["finish_reason"].(string); ok && fr != "" {
				finishReason = fr
			}
			delta, ok := choice["delta"].(map[string]interface{})
			if !ok {
				continue
			}
			if c, ok := delta["content"].(string); ok {
				aggregate.WriteString(c)
			}
		}
		return nil
	})
	if parseErr != nil {
		return aggregate.String(), finishReason, statusCode, &digiConnectRouterError{InternalCode: "NINEROUTER_INVALID_JSON", Err: parseErr}
	}
	return aggregate.String(), finishReason, statusCode, nil
}

// extractChatCompletionsContentAndFinish extracts message content + finish_reason
// from a chat.completion (non-stream) shape body for the synthetic-fallback path.
func extractChatCompletionsContentAndFinish(body map[string]interface{}) (string, string) {
	if body == nil {
		return "", ""
	}
	choices, ok := body["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return "", ""
	}
	choice, ok := choices[0].(map[string]interface{})
	if !ok {
		return "", ""
	}
	finishReason, _ := choice["finish_reason"].(string)
	msg, ok := choice["message"].(map[string]interface{})
	if !ok {
		return "", finishReason
	}
	content, _ := msg["content"].(string)
	return content, finishReason
}

// emitChatCompletionsReplayChunks re-emits a stored chat completion as a
// synthetic single-chunk + completed terminator so streaming clients still see
// an SSE shape on idempotent replay.
func emitChatCompletionsReplayChunks(
	existing *model.DigiConnectRequest,
	modelID string,
	onChunk func(DigiConnectStreamChunk),
) {
	requestID := existing.RequestID
	text := ""
	finishReason := "stop"
	if strings.TrimSpace(existing.ResponseJSON) != "" {
		var decoded map[string]interface{}
		if err := json.Unmarshal([]byte(existing.ResponseJSON), &decoded); err == nil {
			text, finishReason = extractChatCompletionsContentAndFinish(decoded)
			if finishReason == "" {
				finishReason = "stop"
			}
		}
	}
	if text != "" {
		raw := fmt.Sprintf(`{"id":%q,"object":"chat.completion.chunk","model":%q,"choices":[{"index":0,"delta":{"role":"assistant","content":%q},"finish_reason":null}]}`, requestID, modelID, text)
		onChunk(DigiConnectStreamChunk{Type: "raw_chat_chunk", Delta: raw, Model: modelID, RequestID: requestID})
	}
	onChunk(DigiConnectStreamChunk{
		Type:         "completed",
		Text:         text,
		FinishReason: finishReason,
		Model:        modelID,
		RequestID:    requestID,
	})
}

// StreamOpenAICompatibleResponse mirrors the chat path for /responses. Events
// flow through onChunk in OpenAI Responses format already, so the handler just
// re-serializes them as SSE bytes.
func (s *DigiConnectService) StreamOpenAICompatibleResponse(
	ctx context.Context,
	apiKey string,
	input OpenAICompatibleResponseInput,
	idempotencyKey string,
	onChunk func(DigiConnectStreamChunk),
) DigiConnectPublicError {
	key, entitlement, publicErr := s.validateOpenAICompatibleAccess(apiKey)
	if publicErr.Code != "" {
		return publicErr
	}
	modelID := strings.TrimSpace(input.Model)
	if modelID == "" || !containsDigiConnectModel(modelIDsForDigiConnectEntitlement(entitlement), modelID) {
		return MapDigiConnectPublicError("UNSUPPORTED_TYPE")
	}
	textInput := normalizeOpenAICompatibleInput(input.Input)
	if strings.TrimSpace(input.Instructions) != "" {
		textInput = strings.TrimSpace(input.Instructions) + "\n\n" + textInput
	}
	options := map[string]interface{}{"model": modelID}
	if input.Temperature != nil {
		options["temperature"] = *input.Temperature
	}
	if input.MaxOutputTokens != nil {
		options["max_output_tokens"] = *input.MaxOutputTokens
	}
	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metadata["compat"] = "openai_responses_stream"
	apiInput := DigiConnectAPIRequestInput{Service: "digiconnect-smart", Type: "text", Input: textInput, Options: options, Metadata: metadata}
	return s.streamAPIRequest(ctx, key, entitlement, apiInput, idempotencyKey, modelID, "responses", onChunk)
}

// streamAPIRequest is the shared body for chat + responses streaming. It
// validates billing pre-flight, persists a `processing` request row, drives
// streamRouterCall, then commits charge + side effects on success or flips to
// pending_verification on mid-stream failure.
func (s *DigiConnectService) streamAPIRequest(
	ctx context.Context,
	key *model.DigiConnectAPIKey,
	entitlement *model.DigiConnectEntitlement,
	input DigiConnectAPIRequestInput,
	idempotencyKey string,
	modelID string,
	emitFormat string, // "chat" or "responses"
	onChunk func(DigiConnectStreamChunk),
) DigiConnectPublicError {
	if s.cfg == nil || !s.cfg.DigiConnectEnabled {
		return DigiConnectPublicError{Code: "SERVICE_BUSY", HTTPStatus: http.StatusServiceUnavailable, Message: "Jaringan sedang ramai, coba lagi sebentar lagi."}
	}

	payloadHash := hashDigiConnectPayload(input)
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if idempotencyKey != "" {
		existing, err := s.repo.FindRequestByUserAndIdempotencyKey(key.UserID, idempotencyKey)
		if err == nil {
			if checkErr := CheckDigiConnectIdempotency(existing.IdempotencyRequestHash, payloadHash); checkErr != nil {
				return MapDigiConnectPublicError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD")
			}
			// Replay completed request as a single synthetic delta + completed.
			emitReplayChunks(existing, modelID, emitFormat, onChunk)
			return DigiConnectPublicError{}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return MapDigiConnectPublicError("DATABASE_ERROR")
		}
	}

	now := time.Now()
	walletBalance := int64(0)
	if s.walletRepo != nil {
		user, userErr := s.walletRepo.LockUserByIDTx(s.walletRepo.DB(), key.UserID)
		if userErr == nil {
			walletBalance = user.WalletBalance
		}
	}
	var entitlementState *DigiConnectEntitlementState
	payPerRequestPrice := int64(0)
	if entitlement != nil && entitlement.ID != uuid.Nil {
		entitlementState = &DigiConnectEntitlementState{
			Status:                      entitlement.Status,
			ExpiresAt:                   entitlement.ExpiresAt,
			PayPerRequestEnabled:        entitlement.PayPerRequestEnabled,
			OveragePayPerRequestEnabled: entitlement.OveragePayPerRequestEnabled,
		}
		payPerRequestPrice = entitlement.Price
	}
	fairUseExceeded := false
	if entitlement != nil && entitlement.DailyFairUseLimit > 0 {
		todayWindow := digiConnectDailyWindow(now)
		if counter, err := s.repo.GetUsageCounter(key.UserID, nil, "user_daily", todayWindow); err == nil {
			if counter.Count >= int64(entitlement.DailyFairUseLimit) {
				fairUseExceeded = true
			}
		}
	}
	billing := DecideDigiConnectBilling(now, entitlementState, walletBalance, payPerRequestPrice, fairUseExceeded)
	if !billing.Allowed {
		return billingPublicError(billing.Reason)
	}

	requestID := "dc_req_" + uuid.NewString()
	planCode := ""
	if entitlement != nil {
		planCode = entitlement.PlanCode
	}
	routerRoute := routeDigiConnectRequest(planCode, input)
	request := &model.DigiConnectRequest{
		RequestID:              requestID,
		UserID:                 key.UserID,
		APIKeyID:               &key.ID,
		ServiceAlias:           input.Service,
		RequestType:            input.Type,
		PlanCode:               planCode,
		RouterProvider:         routerRoute.Provider,
		RouterModel:            routerRoute.ModelID,
		Status:                 "processing",
		InputHash:              HashDigiConnectSecret(input.Input),
		InputPreview:           previewDigiConnectInput(input.Input),
		PayloadHash:            payloadHash,
		IdempotencyRequestHash: payloadHash,
		BillingDecision:        billing.Decision,
		BillingStatus:          "reserved",
		BillingSource:          billing.Source,
		Amount:                 billing.Amount,
		Currency:               "IDR",
		StartedAt:              &now,
	}
	if idempotencyKey != "" {
		request.IdempotencyKey = &idempotencyKey
	}
	if optionsJSON, err := json.Marshal(input.Options); err == nil {
		request.OptionsJSON = string(optionsJSON)
	}
	if metadataJSON, err := json.Marshal(input.Metadata); err == nil {
		request.MetadataJSON = string(metadataJSON)
	}
	if externalID, ok := input.Metadata["external_id"].(string); ok {
		request.ExternalID = strings.TrimSpace(externalID)
	}
	if err := s.repo.CreateRequest(request); err != nil {
		return MapDigiConnectPublicError("DATABASE_ERROR")
	}

	routerStarted := time.Now()
	aggregateText, statusCode, routerErr := s.streamRouterCall(ctx, input, routerRoute, func(ev sseEvent) error {
		// Translate the upstream SSE event for the client.
		translateUpstreamEventForClient(ev, requestID, modelID, emitFormat, onChunk)
		return nil
	})
	latency := time.Since(routerStarted).Milliseconds()
	completedAt := time.Now()
	request.RouterLatencyMS = latency
	request.RouterStatus = statusCode
	request.CompletedAt = &completedAt

	if routerErr != nil {
		// Mid-stream or pre-stream failure: park as pending_verification so the
		// reconcile worker (Phase 1 R3) can recover. No wallet debit.
		request.Status = "pending_verification"
		request.BillingDecision = "pending_verification"
		request.BillingStatus = "pending_verification"
		request.PublicErrorCode = "REQUEST_PENDING_VERIFICATION"
		request.PublicErrorMessage = "Request sedang diverifikasi. Cek status beberapa saat lagi."
		request.InternalErrorCode = routerErr.InternalCode
		if routerErr.Err != nil {
			request.InternalErrorMessage = routerErr.Err.Error()
		}
		_ = s.repo.SaveRequest(request)
		publicErr := MapDigiConnectPublicError(routerErr.InternalCode)
		onChunk(DigiConnectStreamChunk{
			Type:      "error",
			RequestID: requestID,
			Model:     modelID,
			Error:     publicErr,
		})
		return publicErr
	}
	if statusCode < 200 || statusCode >= 300 {
		request.Status = "failed"
		request.BillingDecision = "rejected"
		request.BillingStatus = "failed"
		request.PublicErrorCode = "UPSTREAM_ERROR"
		request.PublicErrorMessage = "Layanan sedang mengalami gangguan. Coba lagi nanti."
		request.InternalErrorCode = fmt.Sprintf("NINEROUTER_%d", statusCode)
		_ = s.repo.SaveRequest(request)
		publicErr := DigiConnectPublicError{Code: "UPSTREAM_ERROR", HTTPStatus: http.StatusBadGateway, Message: "Layanan sedang mengalami gangguan. Coba lagi nanti."}
		onChunk(DigiConnectStreamChunk{Type: "error", RequestID: requestID, Model: modelID, Error: publicErr})
		return publicErr
	}

	// Success: charge + finalize in one wallet tx (Phase 1 R3 pattern).
	if billing.Source == DigiConnectBillingSourceWallet {
		if err := s.chargeWalletAndFinalize(ctx, key.UserID, request, billing.Amount, completedAt); err != nil {
			request.Status = "pending_verification"
			request.BillingDecision = "pending_verification"
			request.BillingStatus = "pending_verification"
			request.InternalErrorCode = "WALLET_CHARGE_FAILED"
			request.InternalErrorMessage = err.Error()
			_ = s.repo.SaveRequest(request)
			publicErr := MapDigiConnectPublicError("NINEROUTER_TIMEOUT")
			onChunk(DigiConnectStreamChunk{Type: "error", RequestID: requestID, Model: modelID, Error: publicErr})
			return publicErr
		}
	} else {
		request.BillingStatus = DigiConnectBillingStatusIncluded
		request.Status = "completed"
		if err := s.repo.SaveRequest(request); err != nil {
			return MapDigiConnectPublicError("DATABASE_ERROR")
		}
	}
	s.recordDigiConnectSuccessSideEffects(key, request, completedAt)

	// Final terminator chunk so the handler can write [DONE] / final SSE marker.
	onChunk(DigiConnectStreamChunk{
		Type:         "completed",
		Text:         aggregateText,
		FinishReason: "stop",
		Model:        modelID,
		RequestID:    requestID,
	})
	return DigiConnectPublicError{}
}

// translateUpstreamEventForClient takes the upstream SSE event and emits a
// DigiConnectStreamChunk shaped for the client format (chat.completion.chunk
// or response event). The handler turns chunks into SSE bytes.
func translateUpstreamEventForClient(
	ev sseEvent,
	requestID string,
	modelID string,
	emitFormat string,
	onChunk func(DigiConnectStreamChunk),
) {
	if ev.Event == "" && strings.TrimSpace(ev.Data) == "" {
		return
	}
	var payload map[string]interface{}
	_ = json.Unmarshal([]byte(ev.Data), &payload)
	switch emitFormat {
	case "chat":
		switch ev.Event {
		case "response.output_text.delta":
			if delta, ok := payload["delta"].(string); ok && delta != "" {
				onChunk(DigiConnectStreamChunk{
					Type:      "delta",
					Delta:     delta,
					Model:     modelID,
					RequestID: requestID,
				})
			}
		case "response.completed":
			// Handler emits the terminating chunk after billing settles.
		}
	case "responses":
		// Forward the upstream event verbatim — this is already the right shape.
		if ev.Event != "" {
			onChunk(DigiConnectStreamChunk{
				Type:      "passthrough:" + ev.Event,
				Delta:     ev.Data,
				Model:     modelID,
				RequestID: requestID,
			})
		}
	}
}

// emitReplayChunks reconstitutes a synthetic stream from a previously completed
// idempotent replay request. We surface the stored output text as a single
// delta + terminator so the client still sees an SSE shape.
func emitReplayChunks(
	existing *model.DigiConnectRequest,
	modelID string,
	emitFormat string,
	onChunk func(DigiConnectStreamChunk),
) {
	requestID := existing.RequestID
	// We don't store the raw model output, so the replay is empty-text but
	// terminates cleanly. Clients with retry-on-network-error stay idempotent.
	_ = emitFormat
	onChunk(DigiConnectStreamChunk{
		Type:         "completed",
		Text:         "",
		FinishReason: "stop",
		Model:        modelID,
		RequestID:    requestID,
	})
}
