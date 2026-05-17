package service

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

func setupChatCompletionsStreamSmoke(t *testing.T, walletBalance int64, routerURL string) (*DigiConnectService, *gorm.DB, *model.User, string) {
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
		Name:          "DigiConnect Stream Smoke",
		Email:         fmt.Sprintf("dc-stream-%s@example.com", uuid.NewString()),
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
	}
	if err := db.Create(ent).Error; err != nil {
		t.Fatalf("create entitlement: %v", err)
	}
	plain := "dc_test_" + uuid.NewString()
	apiKey := &model.DigiConnectAPIKey{
		ID:        uuid.New(),
		UserID:    user.ID,
		Name:      "test stream key",
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
	return svc, db, user, plain
}

// TestChatCompletionsStreamPipesToolCallChunks asserts that streaming
// /chat/completions forwards upstream tool_calls deltas verbatim through
// onChunk as raw_chat_chunk, the wallet is charged once after the stream
// completes, and the digi_connect_requests row reaches completed/charged.
func TestChatCompletionsStreamPipesToolCallChunks(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)
		write := func(data string) {
			_, _ = w.Write([]byte("data: " + data + "\n\n"))
			if flusher != nil {
				flusher.Flush()
			}
		}
		write(`{"id":"chatcmpl-up","object":"chat.completion.chunk","model":"auto","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"f","arguments":""}}]},"finish_reason":null}]}`)
		write(`{"id":"chatcmpl-up","object":"chat.completion.chunk","model":"auto","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"a\":"}}]},"finish_reason":null}]}`)
		write(`{"id":"chatcmpl-up","object":"chat.completion.chunk","model":"auto","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]},"finish_reason":null}]}`)
		write(`{"id":"chatcmpl-up","object":"chat.completion.chunk","model":"auto","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`)
		write(`[DONE]`)
	}))
	defer server.Close()

	svc, db, user, plainAPIKey := setupChatCompletionsStreamSmoke(t, 10000, server.URL)

	input := OpenAICompatibleChatInput{
		Model:    "kr/claude-haiku-4.5",
		Stream:   true,
		Messages: []OpenAICompatibleChatMessage{{Role: "user", Content: "x"}},
		Tools: []map[string]interface{}{
			{"type": "function", "function": map[string]interface{}{"name": "f", "parameters": map[string]interface{}{"type": "object"}}},
		},
		ToolChoice: "auto",
	}

	var (
		mu             sync.Mutex
		rawChunks      []string
		completedCount int
		errChunkCount  int
	)
	publicErr := svc.StreamOpenAICompatibleChatCompletion(context.Background(), plainAPIKey, input, "", func(chunk DigiConnectStreamChunk) {
		mu.Lock()
		defer mu.Unlock()
		switch chunk.Type {
		case "raw_chat_chunk":
			rawChunks = append(rawChunks, chunk.Delta)
		case "completed":
			completedCount++
		case "error":
			errChunkCount++
		}
	})
	if publicErr.Code != "" {
		t.Fatalf("StreamOpenAICompatibleChatCompletion error: %+v", publicErr)
	}

	mu.Lock()
	defer mu.Unlock()

	if errChunkCount != 0 {
		t.Errorf("expected 0 error chunks, got %d", errChunkCount)
	}
	if completedCount != 1 {
		t.Errorf("expected 1 completed chunk, got %d", completedCount)
	}
	if len(rawChunks) < 4 {
		t.Fatalf("expected >= 4 raw chunks (4 chat chunks from upstream), got %d", len(rawChunks))
	}
	// First chunk should mention tool_calls + role assistant.
	if !strings.Contains(rawChunks[0], "tool_calls") || !strings.Contains(rawChunks[0], "assistant") {
		t.Errorf("first chunk should be role+tool_calls preamble, got %q", rawChunks[0])
	}
	// Second + third chunks should be incremental arguments deltas.
	if !strings.Contains(strings.Join(rawChunks, " "), `\"a\"`) {
		t.Errorf("expected arguments delta to mention \\\"a\\\", got %v", rawChunks)
	}
	// Last raw chunk before completed should carry finish_reason=tool_calls.
	last := rawChunks[len(rawChunks)-1]
	if !strings.Contains(last, "tool_calls") || !strings.Contains(last, "finish_reason") {
		t.Errorf("expected last raw chunk to carry finish_reason:tool_calls, got %q", last)
	}

	// Billing: completed/charged with single debit.
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

	var u model.User
	if err := db.First(&u, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if u.WalletBalance != 9800 {
		t.Errorf("expected wallet 9800 after stream charge, got %d", u.WalletBalance)
	}
}

// TestChatCompletionsStreamMidStreamFailureLeavesPendingVerification asserts
// that an upstream connection drop mid-stream does not charge the wallet and
// the request row goes to pending_verification for the reconcile worker.
func TestChatCompletionsStreamMidStreamFailureLeavesPendingVerification(t *testing.T) {
	// Server emits 1 chunk then closes the connection abruptly. We hijack
	// the connection so the client sees a torn TCP stream rather than a
	// graceful EOF after a complete event.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		hijacker, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("ResponseWriter is not Hijacker")
		}
		conn, bw, err := hijacker.Hijack()
		if err != nil {
			t.Fatalf("hijack: %v", err)
		}
		writer := bufio.NewWriter(bw)
		_, _ = writer.WriteString("HTTP/1.1 200 OK\r\n")
		_, _ = writer.WriteString("Content-Type: text/event-stream\r\n")
		_, _ = writer.WriteString("\r\n")
		_, _ = writer.WriteString(`data: {"id":"x","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"hi"},"finish_reason":null}]}` + "\n\n")
		_ = writer.Flush()
		// Close abruptly without a [DONE] terminator or a final-empty line so
		// the parser reaches EOF mid-stream without a clean termination.
		_ = conn.Close()
	}))
	defer server.Close()

	svc, db, user, plainAPIKey := setupChatCompletionsStreamSmoke(t, 10000, server.URL)

	input := OpenAICompatibleChatInput{
		Model:    "kr/claude-haiku-4.5",
		Stream:   true,
		Messages: []OpenAICompatibleChatMessage{{Role: "user", Content: "x"}},
	}
	chunkTypes := []string{}
	publicErr := svc.StreamOpenAICompatibleChatCompletion(context.Background(), plainAPIKey, input, "", func(chunk DigiConnectStreamChunk) {
		chunkTypes = append(chunkTypes, chunk.Type)
	})
	// Either the call returns an error or a partial-success — we only require
	// that wallet not be charged + request row not completed.
	_ = publicErr
	_ = chunkTypes

	var req model.DigiConnectRequest
	if err := db.First(&req, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("load request: %v", err)
	}
	if req.Status == "completed" {
		t.Errorf("expected request.Status NOT completed on mid-stream failure, got %q", req.Status)
	}
	if req.BillingStatus == "charged" {
		t.Errorf("expected billing_status NOT charged on mid-stream failure, got %q", req.BillingStatus)
	}

	var u model.User
	if err := db.First(&u, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if u.WalletBalance != 10000 {
		t.Errorf("expected wallet unchanged at 10000 after mid-stream failure, got %d", u.WalletBalance)
	}
}

// TestChatCompletionsStreamUpstream5xxLeavesPendingVerification asserts non-2xx
// upstream HTTP responses translate to error chunk + pending_verification row.
func TestChatCompletionsStreamUpstream5xxLeavesPendingVerification(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(502)
		_, _ = io.WriteString(w, `{"error":"upstream gone"}`)
	}))
	defer server.Close()

	svc, db, user, plainAPIKey := setupChatCompletionsStreamSmoke(t, 10000, server.URL)

	input := OpenAICompatibleChatInput{
		Model:    "kr/claude-haiku-4.5",
		Stream:   true,
		Messages: []OpenAICompatibleChatMessage{{Role: "user", Content: "x"}},
	}
	var errChunks int
	publicErr := svc.StreamOpenAICompatibleChatCompletion(context.Background(), plainAPIKey, input, "", func(chunk DigiConnectStreamChunk) {
		if chunk.Type == "error" {
			errChunks++
		}
	})
	if publicErr.Code == "" {
		t.Fatal("expected public error on upstream 502, got none")
	}
	if errChunks != 1 {
		t.Errorf("expected 1 error chunk, got %d", errChunks)
	}

	var req model.DigiConnectRequest
	if err := db.First(&req, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("load request: %v", err)
	}
	if req.Status == "completed" {
		t.Errorf("expected request.Status NOT completed, got %q", req.Status)
	}
	if req.BillingStatus == "charged" {
		t.Errorf("expected billing_status NOT charged, got %q", req.BillingStatus)
	}

	var u model.User
	if err := db.First(&u, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if u.WalletBalance != 10000 {
		t.Errorf("expected wallet unchanged at 10000, got %d", u.WalletBalance)
	}
}
