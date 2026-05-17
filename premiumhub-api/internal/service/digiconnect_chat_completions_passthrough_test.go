package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

// setupChatCompletionsPassthroughSmoke builds an in-memory sqlite-backed
// DigiConnectService with: a user with wallet balance, an active premium
// entitlement, and an active API key. Returns the service, db, user, and
// the active API key (plain — caller passes via Authorization).
func setupChatCompletionsPassthroughSmoke(t *testing.T, walletBalance int64, routerURL string) (*DigiConnectService, *gorm.DB, *model.User, *model.DigiConnectAPIKey, string) {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.WalletLedger{},
		&model.DigiConnectEntitlement{},
		&model.DigiConnectAPIKey{},
		&model.DigiConnectRequest{},
		&model.DigiConnectUsageCounter{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	user := &model.User{
		ID:            uuid.New(),
		Name:          "DigiConnect Tools Smoke",
		Email:         fmt.Sprintf("dc-tools-%s@example.com", uuid.NewString()),
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: walletBalance,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	ent := &model.DigiConnectEntitlement{
		ID:                          uuid.New(),
		UserID:                      user.ID,
		PlanCode:                    "digiconnect_ppr_premium",
		BillingModel:                "pay_per_request",
		Status:                      "active",
		Price:                       200,
		StartsAt:                    time.Now(),
		PayPerRequestEnabled:        true,
		OveragePayPerRequestEnabled: false,
		ExpiresAt:                   nil, // PPR plans have no expiry; presence triggers duration_package billing path
	}
	if err := db.Create(ent).Error; err != nil {
		t.Fatalf("create entitlement: %v", err)
	}
	plain := "dc_test_" + uuid.NewString()
	apiKey := &model.DigiConnectAPIKey{
		ID:        uuid.New(),
		UserID:    user.ID,
		Name:      "test key",
		KeyPrefix: plain[:6],
		KeyHash:   HashDigiConnectSecret(plain),
		Status:    "active",
		CreatedAt: time.Now(),
	}
	if err := db.Create(apiKey).Error; err != nil {
		t.Fatalf("create api key: %v", err)
	}
	cfg := &config.Config{
		DigiConnectEnabled:                   true,
		DigiConnectRouterBaseURL:             routerURL,
		DigiConnectRouterChatCompletionsPath: "/v1/chat/completions",
		DigiConnectRouterTimeoutMS:           "60000",
	}
	svc := NewDigiConnectService(cfg, repository.NewDigiConnectRepo(db)).SetWalletRepo(repository.NewWalletRepo(db))
	return svc, db, user, apiKey, plain
}

// TestChatCompletionsPassthroughPreservesToolCalls is the headline test for
// Task 4: a request with `tools` returns upstream `tool_calls` verbatim,
// the digi_connect_requests row reaches Status=completed BillingStatus=charged,
// and the wallet ledger has a debit row with the proper reference.
func TestChatCompletionsPassthroughPreservesToolCalls(t *testing.T) {
	var capturedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &capturedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
            "id":"chatcmpl_upstream",
            "object":"chat.completion",
            "model":"auto",
            "choices":[{
                "index":0,
                "message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\"city\":\"Tokyo\"}"}}]},
                "finish_reason":"tool_calls"
            }],
            "usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}
        }`))
	}))
	defer server.Close()

	svc, db, user, _, plainAPIKey := setupChatCompletionsPassthroughSmoke(t, 10000, server.URL)

	temperature := 0.7
	maxTokens := 64
	input := OpenAICompatibleChatInput{
		Model: "kr/claude-haiku-4.5",
		Messages: []OpenAICompatibleChatMessage{
			{Role: "user", Content: "weather in Tokyo?"},
		},
		Temperature: &temperature,
		MaxTokens:   &maxTokens,
		Tools: []map[string]interface{}{
			{
				"type": "function",
				"function": map[string]interface{}{
					"name":        "get_weather",
					"description": "Get weather",
					"parameters":  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"city": map[string]interface{}{"type": "string"}}},
				},
			},
		},
		ToolChoice: "auto",
	}

	res, publicErr := svc.CreateOpenAICompatibleChatCompletion(context.Background(), plainAPIKey, input, "")
	if publicErr.Code != "" {
		t.Fatalf("CreateOpenAICompatibleChatCompletion error: %+v", publicErr)
	}

	// 1. Forwarded body shape: model, messages, tools, tool_choice, temperature, max_tokens preserved.
	if capturedBody["model"] != "kr/claude-haiku-4.5" {
		t.Errorf("expected model forwarded as kr/claude-haiku-4.5, got %v", capturedBody["model"])
	}
	if msgs, _ := capturedBody["messages"].([]interface{}); len(msgs) != 1 {
		t.Errorf("expected 1 message forwarded, got %+v", capturedBody["messages"])
	}
	if tools, _ := capturedBody["tools"].([]interface{}); len(tools) != 1 {
		t.Errorf("expected tools array forwarded, got %+v", capturedBody["tools"])
	}
	if capturedBody["tool_choice"] != "auto" {
		t.Errorf("expected tool_choice=auto forwarded, got %+v", capturedBody["tool_choice"])
	}
	if v, _ := capturedBody["temperature"].(float64); v != 0.7 {
		t.Errorf("expected temperature=0.7 forwarded, got %+v", capturedBody["temperature"])
	}
	if v, _ := capturedBody["max_tokens"].(float64); v != 64 {
		t.Errorf("expected max_tokens=64 forwarded, got %+v", capturedBody["max_tokens"])
	}
	if v, _ := capturedBody["stream"].(bool); v != false {
		t.Errorf("expected stream forced to false, got %+v", capturedBody["stream"])
	}

	// 2. Returned body preserves tool_calls verbatim.
	choices, _ := res["choices"].([]interface{})
	if len(choices) != 1 {
		t.Fatalf("expected 1 choice in response, got %+v", res["choices"])
	}
	choice, _ := choices[0].(map[string]interface{})
	msg, _ := choice["message"].(map[string]interface{})
	toolCalls, _ := msg["tool_calls"].([]interface{})
	if len(toolCalls) != 1 {
		t.Fatalf("expected tool_calls preserved in response, got %+v", msg)
	}
	tc, _ := toolCalls[0].(map[string]interface{})
	fn, _ := tc["function"].(map[string]interface{})
	if name, _ := fn["name"].(string); name != "get_weather" {
		t.Errorf("expected tool function.name=get_weather, got %q", name)
	}
	if args, _ := fn["arguments"].(string); !strings.Contains(args, "Tokyo") {
		t.Errorf("expected tool arguments to contain Tokyo, got %q", args)
	}
	if fr, _ := choice["finish_reason"].(string); fr != "tool_calls" {
		t.Errorf("expected finish_reason=tool_calls, got %q", fr)
	}

	// 3. digi_connect_requests row reached completed/charged.
	var req model.DigiConnectRequest
	if err := db.First(&req, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("load request: %v", err)
	}
	if req.Status != "completed" {
		t.Errorf("expected request.Status=completed, got %q (err_code=%q msg=%q)", req.Status, req.InternalErrorCode, req.InternalErrorMessage)
	}
	if req.BillingStatus != "charged" {
		t.Errorf("expected billing_status=charged, got %q", req.BillingStatus)
	}
	if req.Amount != 200 {
		t.Errorf("expected amount=200, got %d", req.Amount)
	}
	if !strings.HasPrefix(req.WalletReference, "digiconnect:") {
		t.Errorf("expected wallet_reference set, got %q", req.WalletReference)
	}

	// 4. Wallet debit ledger row exists.
	var ledger model.WalletLedger
	if err := db.First(&ledger, "user_id = ? AND reference = ?", user.ID, req.WalletReference).Error; err != nil {
		t.Fatalf("load ledger: %v", err)
	}
	if ledger.Type != "debit" || ledger.Amount != 200 {
		t.Errorf("unexpected ledger row: %+v", ledger)
	}

	// 5. User wallet balance decremented.
	var u model.User
	if err := db.First(&u, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if u.WalletBalance != 9800 {
		t.Errorf("expected wallet balance 9800, got %d", u.WalletBalance)
	}
}

// TestChatCompletionsPassthroughIdempotentReplayPreservesToolCalls asserts that
// reusing an Idempotency-Key returns the stored response (with tool_calls) and
// does not double-charge the wallet.
func TestChatCompletionsPassthroughIdempotentReplayPreservesToolCalls(t *testing.T) {
	upstreamCalls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
            "id":"chatcmpl_upstream",
            "object":"chat.completion",
            "model":"auto",
            "choices":[{
                "index":0,
                "message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":"f","arguments":"{}"}}]},
                "finish_reason":"tool_calls"
            }]
        }`))
	}))
	defer server.Close()

	svc, db, user, _, plainAPIKey := setupChatCompletionsPassthroughSmoke(t, 10000, server.URL)

	input := OpenAICompatibleChatInput{
		Model:    "kr/claude-haiku-4.5",
		Messages: []OpenAICompatibleChatMessage{{Role: "user", Content: "x"}},
		Tools: []map[string]interface{}{
			{"type": "function", "function": map[string]interface{}{"name": "f", "parameters": map[string]interface{}{"type": "object"}}},
		},
		ToolChoice: "auto",
	}

	idemKey := "test-idem-" + uuid.NewString()
	res1, err1 := svc.CreateOpenAICompatibleChatCompletion(context.Background(), plainAPIKey, input, idemKey)
	if err1.Code != "" {
		t.Fatalf("first call error: %+v", err1)
	}
	if upstreamCalls != 1 {
		t.Fatalf("expected upstream called 1 time after first request, got %d", upstreamCalls)
	}

	res2, err2 := svc.CreateOpenAICompatibleChatCompletion(context.Background(), plainAPIKey, input, idemKey)
	if err2.Code != "" {
		t.Fatalf("second call error: %+v", err2)
	}
	if upstreamCalls != 1 {
		t.Fatalf("expected upstream NOT called twice on idempotent replay, got %d", upstreamCalls)
	}

	// Both responses must preserve tool_calls.
	for label, res := range map[string]map[string]interface{}{"first": res1, "replay": res2} {
		choices, _ := res["choices"].([]interface{})
		if len(choices) != 1 {
			t.Errorf("[%s] expected 1 choice, got %+v", label, res["choices"])
			continue
		}
		choice, _ := choices[0].(map[string]interface{})
		msg, _ := choice["message"].(map[string]interface{})
		if tc, _ := msg["tool_calls"].([]interface{}); len(tc) != 1 {
			t.Errorf("[%s] expected tool_calls preserved, got %+v", label, msg)
		}
	}

	// Wallet must be charged exactly once.
	var u model.User
	if err := db.First(&u, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if u.WalletBalance != 9800 {
		t.Errorf("expected wallet balance 9800 (charged once), got %d", u.WalletBalance)
	}
}

// TestChatCompletionsPassthroughUpstream5xxLeavesPendingVerification asserts
// that on upstream failure (502) the request row goes to pending_verification
// and no wallet debit happens.
func TestChatCompletionsPassthroughUpstream5xxLeavesPendingVerification(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(502)
		_, _ = w.Write([]byte(`{"error":"bad gateway"}`))
	}))
	defer server.Close()

	svc, db, user, _, plainAPIKey := setupChatCompletionsPassthroughSmoke(t, 10000, server.URL)

	input := OpenAICompatibleChatInput{
		Model:    "kr/claude-haiku-4.5",
		Messages: []OpenAICompatibleChatMessage{{Role: "user", Content: "x"}},
	}
	_, publicErr := svc.CreateOpenAICompatibleChatCompletion(context.Background(), plainAPIKey, input, "")
	if publicErr.Code == "" {
		t.Fatal("expected public error on upstream 502, got none")
	}

	var req model.DigiConnectRequest
	if err := db.First(&req, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("load request: %v", err)
	}
	if req.Status == "completed" {
		t.Errorf("expected request status NOT completed on 502, got %q", req.Status)
	}
	if req.BillingStatus == "charged" {
		t.Errorf("expected billing_status NOT charged on 502, got %q", req.BillingStatus)
	}

	var u model.User
	if err := db.First(&u, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if u.WalletBalance != 10000 {
		t.Errorf("expected wallet balance unchanged at 10000 on upstream failure, got %d", u.WalletBalance)
	}
}
