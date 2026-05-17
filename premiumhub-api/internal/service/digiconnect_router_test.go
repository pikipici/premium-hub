package service

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"premiumhub-api/config"
)

// TestCallRouterOnceForcesStreamFalseInBody asserts the backend always sends
// `stream: false` to the upstream 9router on the non-stream path, regardless
// of caller options. This prevents 9router from defaulting to text/event-stream
// which the JSON unmarshaller cannot parse, leaking raw_preview to users.
func TestCallRouterOnceForcesStreamFalseInBody(t *testing.T) {
	var capturedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/responses" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &capturedBody); err != nil {
			t.Fatalf("body not valid JSON: %v (%s)", err, string(raw))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chatcmpl_x","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}]}`))
	}))
	defer server.Close()

	svc := &DigiConnectService{
		cfg: &config.Config{
			DigiConnectRouterBaseURL:       server.URL,
			DigiConnectRouterResponsesPath: "/v1/responses",
		},
		httpClient: server.Client(),
	}
	input := DigiConnectAPIRequestInput{
		Service: "digiconnect-smart",
		Type:    "text",
		Input:   "user: hi",
		Options: map[string]interface{}{"model": "kr/claude-haiku-4.5", "stream": true}, // caller tries to opt in
	}
	route := digiConnectResolvedRouterRoute{Provider: "kiro", ModelID: "kr/claude-haiku-4.5"}
	res, callErr := svc.callRouterOnce(t.Context(), input, route)
	if callErr != nil {
		t.Fatalf("callRouterOnce returned error: %+v", callErr)
	}
	if res == nil || res.StatusCode != 200 {
		t.Fatalf("unexpected response: %+v", res)
	}
	gotStream, ok := capturedBody["stream"].(bool)
	if !ok {
		t.Fatalf("body missing stream bool field: %+v", capturedBody)
	}
	if gotStream != false {
		t.Fatalf("expected stream=false in upstream body, got stream=%v", gotStream)
	}
	// Sanity: model and input should still be forwarded.
	if capturedBody["model"] != "kr/claude-haiku-4.5" {
		t.Fatalf("expected model forwarded, got %+v", capturedBody["model"])
	}
	if capturedBody["input"] != "user: hi" {
		t.Fatalf("expected input forwarded, got %+v", capturedBody["input"])
	}
}

// TestCallRouterOnceParsesChatCompletionResponse confirms the body is decoded
// into router_response shape so extractDigiConnectText can find the content.
func TestCallRouterOnceParsesChatCompletionResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chatcmpl_x","object":"chat.completion","model":"kr/claude-haiku-4.5","choices":[{"index":0,"message":{"role":"assistant","content":"halo dari upstream"},"finish_reason":"stop"}],"usage":{}}`))
	}))
	defer server.Close()

	svc := &DigiConnectService{
		cfg: &config.Config{
			DigiConnectRouterBaseURL:       server.URL,
			DigiConnectRouterResponsesPath: "/v1/responses",
		},
		httpClient: server.Client(),
	}
	res, callErr := svc.callRouterOnce(t.Context(),
		DigiConnectAPIRequestInput{Service: "digiconnect-smart", Type: "text", Input: "user: hi", Options: map[string]interface{}{"model": "kr/claude-haiku-4.5"}},
		digiConnectResolvedRouterRoute{Provider: "kiro", ModelID: "kr/claude-haiku-4.5"},
	)
	if callErr != nil {
		t.Fatalf("callRouterOnce returned error: %+v", callErr)
	}
	got := extractDigiConnectText(map[string]interface{}{"router_response": res.Body})
	if got != "halo dari upstream" {
		t.Fatalf("expected text extracted from chat.completion, got %q", got)
	}
}

// TestCallRouterOnceParsesSSEResponseDefensively asserts that even if 9router
// surprises us with text/event-stream on the non-stream path (defensive),
// the parser aggregates output_text deltas into router_response so users still
// see real content, not raw bytes.
func TestCallRouterOnceParsesSSEResponseDefensively(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(realSSESample))
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer server.Close()

	svc := &DigiConnectService{
		cfg: &config.Config{
			DigiConnectRouterBaseURL:       server.URL,
			DigiConnectRouterResponsesPath: "/v1/responses",
		},
		httpClient: server.Client(),
	}
	res, callErr := svc.callRouterOnce(t.Context(),
		DigiConnectAPIRequestInput{Service: "digiconnect-smart", Type: "text", Input: "user: hi", Options: map[string]interface{}{"model": "kr/claude-haiku-4.5"}},
		digiConnectResolvedRouterRoute{Provider: "kiro", ModelID: "kr/claude-haiku-4.5"},
	)
	if callErr != nil {
		t.Fatalf("callRouterOnce returned error: %+v", callErr)
	}
	if res == nil || res.Body == nil {
		t.Fatalf("expected non-nil router response body, got %+v", res)
	}
	if _, hasRawPreview := res.Body["raw_preview"]; hasRawPreview {
		t.Fatalf("router body must not contain raw_preview leak: %+v", res.Body)
	}
	got := extractDigiConnectText(map[string]interface{}{"router_response": res.Body})
	if !strings.Contains(got, "Hello there!") {
		t.Fatalf("expected aggregated SSE text, got %q", got)
	}
}

// TestExtractDigiConnectTextEmptyFallbackReturnsEmpty asserts the extractor
// never dumps the internal router_response struct as the user-visible content.
func TestExtractDigiConnectTextEmptyFallbackReturnsEmpty(t *testing.T) {
	cases := []map[string]interface{}{
		{"router_response": map[string]interface{}{}},
		{"router_response": map[string]interface{}{"unknown_shape": map[string]interface{}{"x": 1}}},
		{"router_response": map[string]interface{}{"raw_preview": "event: response.created\ndata: {...}"}},
	}
	for i, res := range cases {
		got := extractDigiConnectText(res)
		if got != "" {
			t.Fatalf("case %d: expected empty fallback, got %q", i, got)
		}
	}
}
