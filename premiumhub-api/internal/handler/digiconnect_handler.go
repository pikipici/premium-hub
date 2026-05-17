package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DigiConnectHandler struct {
	svc *service.DigiConnectService
}

func NewDigiConnectHandler(svc *service.DigiConnectService) *DigiConnectHandler {
	return &DigiConnectHandler{svc: svc}
}

func (h *DigiConnectHandler) PublicPlans(c *gin.Context) {
	response.Success(c, "OK", h.svc.PublicPlansView())
}

func (h *DigiConnectHandler) Summary(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.Summary(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) Dashboard(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.Dashboard(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) ListAPIKeys(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.ListAPIKeys(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) CreateAPIKey(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.DigiConnectCreateAPIKeyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	res, err := h.svc.CreateAPIKey(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "API key DigiConnect dibuat", res)
}

func (h *DigiConnectHandler) RevokeAPIKey(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	keyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID API key tidak valid")
		return
	}
	res, err := h.svc.RevokeAPIKey(userID, keyID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "API key tidak ditemukan")
			return
		}
		response.InternalError(c)
		return
	}
	response.Success(c, "API key DigiConnect dicabut", res)
}

func (h *DigiConnectHandler) CreateAPIRequest(c *gin.Context) {
	apiKey := bearerToken(c.GetHeader("Authorization"))
	var input service.DigiConnectAPIRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		publicErr := service.MapDigiConnectPublicError("INVALID_PAYLOAD")
		writeDigiConnectError(c, publicErr)
		return
	}
	res, publicErr := h.svc.CreateAPIRequest(c.Request.Context(), apiKey, input, c.GetHeader("Idempotency-Key"))
	if publicErr.Code != "" {
		writeDigiConnectError(c, publicErr)
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) OpenAICompatibleModels(c *gin.Context) {
	apiKey := bearerToken(c.GetHeader("Authorization"))
	models, publicErr := h.svc.OpenAICompatibleModels(apiKey)
	if publicErr.Code != "" {
		writeDigiConnectError(c, publicErr)
		return
	}
	data := make([]map[string]interface{}, 0, len(models))
	now := time.Now().Unix()
	for _, modelID := range models {
		data = append(data, map[string]interface{}{"id": modelID, "object": "model", "created": now, "owned_by": "digiconnect"})
	}
	c.JSON(http.StatusOK, gin.H{"object": "list", "data": data})
}

func (h *DigiConnectHandler) OpenAICompatibleResponses(c *gin.Context) {
	apiKey := bearerToken(c.GetHeader("Authorization"))
	var input service.OpenAICompatibleResponseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		writeDigiConnectError(c, service.MapDigiConnectPublicError("INVALID_PAYLOAD"))
		return
	}
	if input.Stream {
		streamOpenAIResponse(c, h.svc, apiKey, input)
		return
	}
	res, publicErr := h.svc.CreateOpenAICompatibleResponse(c.Request.Context(), apiKey, input, c.GetHeader("Idempotency-Key"))
	if publicErr.Code != "" {
		writeDigiConnectError(c, publicErr)
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *DigiConnectHandler) OpenAICompatibleChatCompletions(c *gin.Context) {
	apiKey := bearerToken(c.GetHeader("Authorization"))
	var input service.OpenAICompatibleChatInput
	if err := c.ShouldBindJSON(&input); err != nil {
		writeDigiConnectError(c, service.MapDigiConnectPublicError("INVALID_PAYLOAD"))
		return
	}
	if input.Stream {
		streamOpenAIChatCompletion(c, h.svc, apiKey, input)
		return
	}
	res, publicErr := h.svc.CreateOpenAICompatibleChatCompletion(c.Request.Context(), apiKey, input, c.GetHeader("Idempotency-Key"))
	if publicErr.Code != "" {
		writeDigiConnectError(c, publicErr)
		return
	}
	c.JSON(http.StatusOK, res)
}

func streamOpenAIChatCompletion(c *gin.Context, svc *service.DigiConnectService, apiKey string, input service.OpenAICompatibleChatInput) {
	headerWritten := false
	chunkID := ""
	created := time.Now().Unix()
	publicErr := svc.StreamOpenAICompatibleChatCompletion(c.Request.Context(), apiKey, input, c.GetHeader("Idempotency-Key"), func(chunk service.DigiConnectStreamChunk) {
		if chunkID == "" && chunk.RequestID != "" {
			chunkID = chunk.RequestID
		}
		switch chunk.Type {
		case "delta":
			if !headerWritten {
				writeOpenAIStreamHeaders(c)
				headerWritten = true
				// Initial role chunk per OpenAI spec.
				writeSSEData(c, map[string]interface{}{
					"id":      chunkID,
					"object":  "chat.completion.chunk",
					"created": created,
					"model":   chunk.Model,
					"choices": []map[string]interface{}{{
						"index":         0,
						"delta":         map[string]interface{}{"role": "assistant"},
						"finish_reason": nil,
					}},
				})
			}
			writeSSEData(c, map[string]interface{}{
				"id":      chunkID,
				"object":  "chat.completion.chunk",
				"created": created,
				"model":   chunk.Model,
				"choices": []map[string]interface{}{{
					"index":         0,
					"delta":         map[string]interface{}{"content": chunk.Delta},
					"finish_reason": nil,
				}},
			})
		case "raw_chat_chunk":
			// Tool-aware passthrough: forward upstream chat.completion.chunk
			// payload verbatim so tool_calls deltas / finish_reason:tool_calls
			// reach the client untouched.
			if !headerWritten {
				writeOpenAIStreamHeaders(c)
				headerWritten = true
			}
			if strings.TrimSpace(chunk.Delta) != "" {
				writeSSERaw(c, chunk.Delta)
			}
		case "completed":
			if !headerWritten {
				// No deltas streamed (e.g. upstream returned single body fallback)
				// — emit role + full text + stop in one go.
				writeOpenAIStreamHeaders(c)
				headerWritten = true
				writeSSEData(c, map[string]interface{}{
					"id":      chunkID,
					"object":  "chat.completion.chunk",
					"created": created,
					"model":   chunk.Model,
					"choices": []map[string]interface{}{{
						"index":         0,
						"delta":         map[string]interface{}{"role": "assistant"},
						"finish_reason": nil,
					}},
				})
				if chunk.Text != "" {
					writeSSEData(c, map[string]interface{}{
						"id":      chunkID,
						"object":  "chat.completion.chunk",
						"created": created,
						"model":   chunk.Model,
						"choices": []map[string]interface{}{{
							"index":         0,
							"delta":         map[string]interface{}{"content": chunk.Text},
							"finish_reason": nil,
						}},
					})
				}
			}
			writeSSEData(c, map[string]interface{}{
				"id":      chunkID,
				"object":  "chat.completion.chunk",
				"created": created,
				"model":   chunk.Model,
				"choices": []map[string]interface{}{{
					"index":         0,
					"delta":         map[string]interface{}{},
					"finish_reason": chunk.FinishReason,
				}},
			})
			writeSSEDone(c)
		case "error":
			if !headerWritten {
				writeDigiConnectError(c, chunk.Error)
				return
			}
			// Already streaming — emit error event then [DONE].
			writeSSEData(c, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    chunk.Error.Code,
					"message": chunk.Error.Message,
				},
			})
			writeSSEDone(c)
		}
	})
	if publicErr.Code != "" && !headerWritten {
		writeDigiConnectError(c, publicErr)
	}
}

func streamOpenAIResponse(c *gin.Context, svc *service.DigiConnectService, apiKey string, input service.OpenAICompatibleResponseInput) {
	headerWritten := false
	publicErr := svc.StreamOpenAICompatibleResponse(c.Request.Context(), apiKey, input, c.GetHeader("Idempotency-Key"), func(chunk service.DigiConnectStreamChunk) {
		switch chunk.Type {
		case "completed":
			if !headerWritten {
				writeOpenAIStreamHeaders(c)
				headerWritten = true
				if chunk.Text != "" {
					writeSSEData(c, map[string]interface{}{
						"type":          "response.output_text.delta",
						"item_id":       "msg_0",
						"output_index":  0,
						"content_index": 0,
						"delta":         chunk.Text,
					})
				}
			}
			writeSSEData(c, map[string]interface{}{
				"type": "response.completed",
				"response": map[string]interface{}{
					"id":     chunk.RequestID,
					"object": "response",
					"status": "completed",
					"model":  chunk.Model,
				},
			})
			writeSSEDone(c)
		case "error":
			if !headerWritten {
				writeDigiConnectError(c, chunk.Error)
				return
			}
			writeSSEData(c, map[string]interface{}{
				"type":  "error",
				"error": map[string]interface{}{"code": chunk.Error.Code, "message": chunk.Error.Message},
			})
			writeSSEDone(c)
		default:
			// passthrough:<event_name> — write the upstream payload verbatim.
			if !strings.HasPrefix(chunk.Type, "passthrough:") {
				return
			}
			eventName := strings.TrimPrefix(chunk.Type, "passthrough:")
			if !headerWritten {
				writeOpenAIStreamHeaders(c)
				headerWritten = true
			}
			writeSSEEvent(c, eventName, chunk.Delta)
		}
	})
	if publicErr.Code != "" && !headerWritten {
		writeDigiConnectError(c, publicErr)
	}
}

func writeSSEEvent(c *gin.Context, eventName string, rawData string) {
	if eventName != "" {
		_, _ = fmt.Fprintf(c.Writer, "event: %s\n", eventName)
	}
	_, _ = fmt.Fprintf(c.Writer, "data: %s\n\n", rawData)
	if flusher, ok := c.Writer.(http.Flusher); ok {
		flusher.Flush()
	}
}

func writeOpenAIStreamHeaders(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Status(http.StatusOK)
}

func writeSSEData(c *gin.Context, payload interface{}) {
	encoded, _ := json.Marshal(payload)
	_, _ = fmt.Fprintf(c.Writer, "data: %s\n\n", encoded)
	if flusher, ok := c.Writer.(http.Flusher); ok {
		flusher.Flush()
	}
}

func writeSSEDone(c *gin.Context) {
	_, _ = fmt.Fprint(c.Writer, "data: [DONE]\n\n")
	if flusher, ok := c.Writer.(http.Flusher); ok {
		flusher.Flush()
	}
}

// writeSSERaw forwards an upstream SSE data payload verbatim. Used for
// chat.completions tool-aware passthrough where we must preserve exact
// upstream structure (incremental tool_calls deltas + finish_reason:tool_calls).
func writeSSERaw(c *gin.Context, raw string) {
	_, _ = fmt.Fprintf(c.Writer, "data: %s\n\n", raw)
	if flusher, ok := c.Writer.(http.Flusher); ok {
		flusher.Flush()
	}
}

func extractChatCompletionText(res map[string]interface{}) string {
	choices, ok := res["choices"].([]map[string]interface{})
	if !ok || len(choices) == 0 {
		return ""
	}
	message, ok := choices[0]["message"].(map[string]interface{})
	if !ok {
		return ""
	}
	text, _ := message["content"].(string)
	return strings.TrimSpace(text)
}

func extractResponseText(res map[string]interface{}) string {
	output, ok := res["output"].([]map[string]interface{})
	if !ok || len(output) == 0 {
		return ""
	}
	content, ok := output[0]["content"].([]map[string]interface{})
	if !ok || len(content) == 0 {
		return ""
	}
	text, _ := content[0]["text"].(string)
	return strings.TrimSpace(text)
}

func (h *DigiConnectHandler) ListRequests(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	rows, total, err := h.svc.ListRequests(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", rows, response.Meta{Page: page, Limit: limit, Total: total, TotalPages: int(math.Ceil(float64(total) / float64(limit)))})
}

func (h *DigiConnectHandler) ListEntitlements(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.ListEntitlements(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) CheckoutWithWallet(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.DigiConnectCheckoutInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	entitlement, err := h.svc.CheckoutWithWallet(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Paket DigiConnect aktif", entitlement)
}

func (h *DigiConnectHandler) RouterHealth(c *gin.Context) {
	response.Success(c, "OK", h.svc.RouterHealth())
}

func (h *DigiConnectHandler) AdminOverview(c *gin.Context) {
	res, err := h.svc.AdminOverview()
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) AdminListRequests(c *gin.Context) {
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	filter := repository.DigiConnectAdminRequestFilter{
		Status:            c.Query("status"),
		BillingDecision:   c.Query("billing_decision"),
		PublicErrorCode:   c.Query("public_error_code"),
		InternalErrorCode: c.Query("internal_error_code"),
		ServiceAlias:      c.Query("service"),
		Page:              page,
		Limit:             limit,
	}
	if rawUserID := strings.TrimSpace(c.Query("user_id")); rawUserID != "" {
		if userID, err := uuid.Parse(rawUserID); err == nil {
			filter.UserID = userID
		}
	}
	rows, total, err := h.svc.AdminListRequests(filter)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", rows, response.Meta{Page: page, Limit: limit, Total: total, TotalPages: int(math.Ceil(float64(total) / float64(limit)))})
}

func (h *DigiConnectHandler) AdminListEntitlements(c *gin.Context) {
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	var userID uuid.UUID
	if rawUserID := strings.TrimSpace(c.Query("user_id")); rawUserID != "" {
		parsed, err := uuid.Parse(rawUserID)
		if err != nil {
			response.BadRequest(c, "user_id tidak valid")
			return
		}
		userID = parsed
	}
	rows, total, err := h.svc.AdminListEntitlements(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", rows, response.Meta{Page: page, Limit: limit, Total: total, TotalPages: int(math.Ceil(float64(total) / float64(limit)))})
}

func (h *DigiConnectHandler) AdminProvisionEntitlement(c *gin.Context) {
	var input service.DigiConnectProvisionEntitlementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	res, err := h.svc.AdminProvisionEntitlement(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Entitlement DigiConnect dibuat", res)
}

func bearerToken(header string) string {
	parts := strings.Fields(strings.TrimSpace(header))
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return ""
}

func writeDigiConnectError(c *gin.Context, publicErr service.DigiConnectPublicError) {
	status := publicErr.HTTPStatus
	if status == 0 {
		status = http.StatusInternalServerError
	}
	c.JSON(status, gin.H{
		"success": false,
		"status":  "rejected",
		"billing": gin.H{"billable": false, "charged": false, "amount": 0, "currency": "IDR", "source": "none", "decision": "rejected"},
		"error":   gin.H{"code": publicErr.Code, "message": publicErr.Message},
	})
}
