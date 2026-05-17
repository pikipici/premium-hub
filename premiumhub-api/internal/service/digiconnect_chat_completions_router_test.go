package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"premiumhub-api/config"
)

// TestCallRouterChatCompletionsForwardsToolsVerbatim asserts that the new
// raw-passthrough router call forwards the client's `tools` array, `tool_choice`,
// and message structure to the upstream `/v1/chat/completions` endpoint without
// flattening or rewriting them.
func TestCallRouterChatCompletionsForwardsToolsVerbatim(t *testing.T) {
	var capturedPath string
	var capturedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &capturedBody); err != nil {
			t.Fatalf("upstream body not valid JSON: %v (%s)", err, string(raw))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
            "id":"chatcmpl_test",
            "object":"chat.completion",
            "model":"auto",
            "choices":[{
                "index":0,
                "message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\"city\":\"Tokyo\"}"}}]},
                "finish_reason":"tool_calls"
            }]
        }`))
	}))
	defer server.Close()

	svc := &DigiConnectService{
		cfg: &config.Config{
			DigiConnectRouterBaseURL:             server.URL,
			DigiConnectRouterChatCompletionsPath: "/v1/chat/completions",
		},
		httpClient: server.Client(),
	}

	body := map[string]interface{}{
		"model": "kr/auto",
		"messages": []interface{}{
			map[string]interface{}{"role": "user", "content": "weather Tokyo?"},
		},
		"tools": []interface{}{
			map[string]interface{}{
				"type": "function",
				"function": map[string]interface{}{
					"name":        "get_weather",
					"description": "Get weather",
					"parameters":  map[string]interface{}{"type": "object"},
				},
			},
		},
		"tool_choice": "auto",
		"stream":      true, // caller tries to opt in — must be overridden to false
	}

	res, status, callErr := svc.callRouterChatCompletions(context.Background(), body)
	if callErr != nil {
		t.Fatalf("callRouterChatCompletions error: %+v", callErr)
	}
	if status != 200 {
		t.Fatalf("unexpected status %d", status)
	}

	if capturedPath != "/v1/chat/completions" {
		t.Fatalf("expected upstream /v1/chat/completions, got %q", capturedPath)
	}
	gotStream, _ := capturedBody["stream"].(bool)
	if gotStream != false {
		t.Fatalf("expected stream forced to false on non-stream path, got %v", capturedBody["stream"])
	}
	gotTools, _ := capturedBody["tools"].([]interface{})
	if len(gotTools) != 1 {
		t.Fatalf("expected tools array forwarded, got %+v", capturedBody["tools"])
	}
	if capturedBody["tool_choice"] != "auto" {
		t.Fatalf("expected tool_choice=auto forwarded, got %+v", capturedBody["tool_choice"])
	}
	gotMessages, _ := capturedBody["messages"].([]interface{})
	if len(gotMessages) != 1 {
		t.Fatalf("expected 1 message forwarded, got %+v", capturedBody["messages"])
	}

	choices, _ := res["choices"].([]interface{})
	if len(choices) != 1 {
		t.Fatalf("expected 1 choice in result, got %+v", res["choices"])
	}
	choice, _ := choices[0].(map[string]interface{})
	msg, _ := choice["message"].(map[string]interface{})
	toolCalls, _ := msg["tool_calls"].([]interface{})
	if len(toolCalls) != 1 {
		t.Fatalf("expected tool_calls preserved in result, got %+v", msg)
	}
	tc, _ := toolCalls[0].(map[string]interface{})
	fn, _ := tc["function"].(map[string]interface{})
	if name, _ := fn["name"].(string); name != "get_weather" {
		t.Fatalf("expected tool function.name=get_weather, got %q", name)
	}
	if args, _ := fn["arguments"].(string); !strings.Contains(args, "Tokyo") {
		t.Fatalf("expected tool arguments to contain Tokyo, got %q", args)
	}
	if fr, _ := choice["finish_reason"].(string); fr != "tool_calls" {
		t.Fatalf("expected finish_reason=tool_calls, got %q", fr)
	}
}

// TestCallRouterChatCompletionsAggregatesUpstreamSSE asserts the defensive
// SSE aggregator branch when upstream ignores stream:false and returns
// text/event-stream chat.completion.chunk events.
func TestCallRouterChatCompletionsAggregatesUpstreamSSE(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)
		writeChunk := func(data string) {
			_, _ = w.Write([]byte("data: " + data + "\n\n"))
			if flusher != nil {
				flusher.Flush()
			}
		}
		writeChunk(`{"id":"chatcmpl_test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"ha"},"finish_reason":null}]}`)
		writeChunk(`{"id":"chatcmpl_test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}`)
		writeChunk(`{"id":"chatcmpl_test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`)
		writeChunk(`[DONE]`)
	}))
	defer server.Close()

	svc := &DigiConnectService{
		cfg: &config.Config{
			DigiConnectRouterBaseURL:             server.URL,
			DigiConnectRouterChatCompletionsPath: "/v1/chat/completions",
		},
		httpClient: server.Client(),
	}

	res, status, callErr := svc.callRouterChatCompletions(context.Background(), map[string]interface{}{
		"model":    "kr/auto",
		"messages": []interface{}{map[string]interface{}{"role": "user", "content": "hi"}},
	})
	if callErr != nil {
		t.Fatalf("callRouterChatCompletions error: %+v", callErr)
	}
	if status != 200 {
		t.Fatalf("unexpected status %d", status)
	}
	choices, _ := res["choices"].([]interface{})
	if len(choices) != 1 {
		t.Fatalf("expected aggregated 1 choice, got %+v", res["choices"])
	}
	choice, _ := choices[0].(map[string]interface{})
	msg, _ := choice["message"].(map[string]interface{})
	if content, _ := msg["content"].(string); content != "halo" {
		t.Fatalf("expected aggregated content=halo, got %q", content)
	}
}

// TestCallRouterChatCompletionsAggregatesUpstreamSSEWithToolCalls asserts the
// defensive SSE aggregator preserves tool_calls deltas streamed by upstream.
func TestCallRouterChatCompletionsAggregatesUpstreamSSEWithToolCalls(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)
		writeChunk := func(data string) {
			_, _ = w.Write([]byte("data: " + data + "\n\n"))
			if flusher != nil {
				flusher.Flush()
			}
		}
		writeChunk(`{"id":"x","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"f","arguments":""}}]},"finish_reason":null}]}`)
		writeChunk(`{"id":"x","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"a\":"}}]},"finish_reason":null}]}`)
		writeChunk(`{"id":"x","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]},"finish_reason":null}]}`)
		writeChunk(`{"id":"x","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`)
		writeChunk(`[DONE]`)
	}))
	defer server.Close()

	svc := &DigiConnectService{
		cfg: &config.Config{
			DigiConnectRouterBaseURL:             server.URL,
			DigiConnectRouterChatCompletionsPath: "/v1/chat/completions",
		},
		httpClient: server.Client(),
	}

	res, status, callErr := svc.callRouterChatCompletions(context.Background(), map[string]interface{}{
		"model":    "kr/auto",
		"messages": []interface{}{map[string]interface{}{"role": "user", "content": "x"}},
	})
	if callErr != nil {
		t.Fatalf("callRouterChatCompletions error: %+v", callErr)
	}
	if status != 200 {
		t.Fatalf("unexpected status %d", status)
	}
	choices, _ := res["choices"].([]interface{})
	choice, _ := choices[0].(map[string]interface{})
	msg, _ := choice["message"].(map[string]interface{})
	toolCalls, _ := msg["tool_calls"].([]interface{})
	if len(toolCalls) != 1 {
		t.Fatalf("expected aggregated tool_calls, got %+v", msg)
	}
	tc, _ := toolCalls[0].(map[string]interface{})
	if id, _ := tc["id"].(string); id != "call_1" {
		t.Fatalf("expected tool_calls[0].id=call_1, got %q", id)
	}
	fn, _ := tc["function"].(map[string]interface{})
	if name, _ := fn["name"].(string); name != "f" {
		t.Fatalf("expected tool_calls[0].function.name=f, got %q", name)
	}
	if args, _ := fn["arguments"].(string); args != `{"a":1}` {
		t.Fatalf(`expected tool_calls[0].function.arguments={"a":1}, got %q`, args)
	}
	if fr, _ := choice["finish_reason"].(string); fr != "tool_calls" {
		t.Fatalf("expected finish_reason=tool_calls, got %q", fr)
	}
}

// TestCallRouterChatCompletionsMaps502ToUpstreamError asserts non-2xx
// upstream responses propagate as digiConnectRouterError with the right
// internal code envelope.
func TestCallRouterChatCompletionsMaps502ToUpstreamError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(502)
		_, _ = w.Write([]byte(`{"error":"upstream gone"}`))
	}))
	defer server.Close()

	svc := &DigiConnectService{
		cfg: &config.Config{
			DigiConnectRouterBaseURL:             server.URL,
			DigiConnectRouterChatCompletionsPath: "/v1/chat/completions",
		},
		httpClient: server.Client(),
	}
	_, status, callErr := svc.callRouterChatCompletions(context.Background(), map[string]interface{}{
		"model":    "kr/auto",
		"messages": []interface{}{map[string]interface{}{"role": "user", "content": "x"}},
	})
	if callErr == nil {
		t.Fatal("expected error on 502")
	}
	if status != 502 {
		t.Fatalf("expected status 502 propagated, got %d", status)
	}
	if !strings.HasPrefix(callErr.InternalCode, "NINEROUTER_UPSTREAM_") {
		t.Fatalf("expected NINEROUTER_UPSTREAM_<code>, got %q", callErr.InternalCode)
	}
}
