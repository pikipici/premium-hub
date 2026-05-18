package service

import (
	"encoding/json"
	"testing"

	"premiumhub-api/internal/model"
)

// TestChatCompletionsStreamAggregate_ApplyDelta verifies the aggregator folds
// streamed `delta.tool_calls` fragments back into a single OpenAI-shaped
// tool_calls slice, including by-index slot growth, function name once,
// and arguments concatenation across many fragments.
func TestChatCompletionsStreamAggregate_ApplyDelta(t *testing.T) {
	a := &chatCompletionsStreamAggregate{}

	// Chunk 1 — first delta carries role + tool call slot 0 with id+name.
	a.applyDelta(map[string]interface{}{
		"role": "assistant",
		"tool_calls": []interface{}{
			map[string]interface{}{
				"index": float64(0),
				"id":    "call_1",
				"type":  "function",
				"function": map[string]interface{}{
					"name":      "read_file",
					"arguments": "",
				},
			},
		},
	})

	// Chunk 2 — first arg fragment.
	a.applyDelta(map[string]interface{}{
		"tool_calls": []interface{}{
			map[string]interface{}{
				"index": float64(0),
				"function": map[string]interface{}{
					"arguments": `{"path":`,
				},
			},
		},
	})

	// Chunk 3 — second arg fragment.
	a.applyDelta(map[string]interface{}{
		"tool_calls": []interface{}{
			map[string]interface{}{
				"index": float64(0),
				"function": map[string]interface{}{
					"arguments": `"/tmp/x"}`,
				},
			},
		},
	})

	if len(a.ToolCalls) != 1 {
		t.Fatalf("expected 1 tool_call, got %d", len(a.ToolCalls))
	}
	tc := a.ToolCalls[0]
	if tc["id"] != "call_1" {
		t.Errorf("id mismatch: %v", tc["id"])
	}
	if tc["type"] != "function" {
		t.Errorf("type mismatch: %v", tc["type"])
	}
	fn, ok := tc["function"].(map[string]interface{})
	if !ok {
		t.Fatalf("function field missing")
	}
	if fn["name"] != "read_file" {
		t.Errorf("name mismatch: %v", fn["name"])
	}
	if fn["arguments"] != `{"path":"/tmp/x"}` {
		t.Errorf("arguments not concatenated: %v", fn["arguments"])
	}
}

// TestChatCompletionsStreamAggregate_MultipleToolCalls verifies that
// concurrent tool_call slots (index 0 and 1) accumulate independently.
func TestChatCompletionsStreamAggregate_MultipleToolCalls(t *testing.T) {
	a := &chatCompletionsStreamAggregate{}

	// Slot 0 init.
	a.applyDelta(map[string]interface{}{
		"tool_calls": []interface{}{
			map[string]interface{}{
				"index":    float64(0),
				"id":       "call_a",
				"type":     "function",
				"function": map[string]interface{}{"name": "fa", "arguments": `{"x":`},
			},
		},
	})
	// Slot 1 init.
	a.applyDelta(map[string]interface{}{
		"tool_calls": []interface{}{
			map[string]interface{}{
				"index":    float64(1),
				"id":       "call_b",
				"type":     "function",
				"function": map[string]interface{}{"name": "fb", "arguments": `{"y":`},
			},
		},
	})
	// Slot 0 finish.
	a.applyDelta(map[string]interface{}{
		"tool_calls": []interface{}{
			map[string]interface{}{
				"index":    float64(0),
				"function": map[string]interface{}{"arguments": `1}`},
			},
		},
	})
	// Slot 1 finish.
	a.applyDelta(map[string]interface{}{
		"tool_calls": []interface{}{
			map[string]interface{}{
				"index":    float64(1),
				"function": map[string]interface{}{"arguments": `2}`},
			},
		},
	})

	if len(a.ToolCalls) != 2 {
		t.Fatalf("expected 2 tool_calls, got %d", len(a.ToolCalls))
	}
	tc0 := a.ToolCalls[0]
	tc1 := a.ToolCalls[1]
	if tc0["id"] != "call_a" || tc1["id"] != "call_b" {
		t.Errorf("tool_call ids: %v %v", tc0["id"], tc1["id"])
	}
	fn0 := tc0["function"].(map[string]interface{})
	fn1 := tc1["function"].(map[string]interface{})
	if fn0["arguments"] != `{"x":1}` {
		t.Errorf("slot 0 args: %v", fn0["arguments"])
	}
	if fn1["arguments"] != `{"y":2}` {
		t.Errorf("slot 1 args: %v", fn1["arguments"])
	}
}

// TestChatCompletionsStreamAggregate_ContentOnly verifies the existing
// content-only path still works (no tool_calls in delta).
func TestChatCompletionsStreamAggregate_ContentOnly(t *testing.T) {
	a := &chatCompletionsStreamAggregate{}
	a.applyDelta(map[string]interface{}{"content": "Hello "})
	a.applyDelta(map[string]interface{}{"content": "world"})
	if a.Content != "Hello world" {
		t.Errorf("content: %q", a.Content)
	}
	if len(a.ToolCalls) != 0 {
		t.Errorf("expected no tool_calls, got %d", len(a.ToolCalls))
	}
}

// TestExtractChatCompletionsMessageFields_ToolCalls verifies the non-stream
// extractor pulls tool_calls from a chat.completion (message.tool_calls).
func TestExtractChatCompletionsMessageFields_ToolCalls(t *testing.T) {
	body := map[string]interface{}{
		"choices": []interface{}{
			map[string]interface{}{
				"finish_reason": "tool_calls",
				"message": map[string]interface{}{
					"role":    "assistant",
					"content": "",
					"tool_calls": []interface{}{
						map[string]interface{}{
							"id":   "call_1",
							"type": "function",
							"function": map[string]interface{}{
								"name":      "read_file",
								"arguments": `{"path":"/x"}`,
							},
						},
					},
				},
			},
		},
	}
	content, fr, tcs := extractChatCompletionsMessageFields(body)
	if content != "" {
		t.Errorf("content: %q", content)
	}
	if fr != "tool_calls" {
		t.Errorf("finish_reason: %q", fr)
	}
	if len(tcs) != 1 {
		t.Fatalf("tool_calls: %d", len(tcs))
	}
	if tcs[0]["id"] != "call_1" {
		t.Errorf("tool_call id: %v", tcs[0]["id"])
	}
}

// TestEmitChatCompletionsReplayChunks_ToolCalls verifies replay path emits
// raw_chat_chunk with tool_calls preserved (the Hermes-visible shape).
func TestEmitChatCompletionsReplayChunks_ToolCalls(t *testing.T) {
	envelope := map[string]interface{}{
		"id":     "dc_req_replay_xyz",
		"object": "chat.completion",
		"model":  "kr/auto",
		"choices": []map[string]interface{}{{
			"index": 0,
			"message": map[string]interface{}{
				"role":    "assistant",
				"content": "",
				"tool_calls": []map[string]interface{}{
					{
						"id":   "call_1",
						"type": "function",
						"function": map[string]interface{}{
							"name":      "read_file",
							"arguments": `{"path":"/x"}`,
						},
					},
				},
			},
			"finish_reason": "tool_calls",
		}},
	}
	encoded, _ := json.Marshal(envelope)
	existing := &model.DigiConnectRequest{
		RequestID:    "dc_req_replay_xyz",
		ResponseJSON: string(encoded),
	}

	var chunks []DigiConnectStreamChunk
	emitChatCompletionsReplayChunks(existing, "kr/auto", func(c DigiConnectStreamChunk) {
		chunks = append(chunks, c)
	})

	if len(chunks) < 2 {
		t.Fatalf("expected at least 2 chunks (raw + completed), got %d", len(chunks))
	}
	// First raw chunk must contain tool_calls and the upstream id.
	first := chunks[0]
	if first.Type != "raw_chat_chunk" {
		t.Errorf("first chunk type: %q", first.Type)
	}
	if !contains(first.Delta, `"tool_calls"`) {
		t.Errorf("replay raw chunk missing tool_calls: %s", first.Delta)
	}
	if !contains(first.Delta, `"call_1"`) {
		t.Errorf("replay raw chunk missing call id: %s", first.Delta)
	}
	if !contains(first.Delta, `"read_file"`) {
		t.Errorf("replay raw chunk missing function name: %s", first.Delta)
	}
	// Final chunk must be a completed terminator with finish_reason=tool_calls.
	last := chunks[len(chunks)-1]
	if last.Type != "completed" {
		t.Errorf("last chunk type: %q", last.Type)
	}
	if last.FinishReason != "tool_calls" {
		t.Errorf("final finish_reason: %q", last.FinishReason)
	}
}

// TestEmitChatCompletionsReplayChunks_ContentOnly verifies the legacy text-only
// replay path still emits a single raw chunk + completed terminator.
func TestEmitChatCompletionsReplayChunks_ContentOnly(t *testing.T) {
	envelope := map[string]interface{}{
		"id":     "dc_req_text",
		"object": "chat.completion",
		"choices": []map[string]interface{}{{
			"index": 0,
			"message": map[string]interface{}{
				"role":    "assistant",
				"content": "hello world",
			},
			"finish_reason": "stop",
		}},
	}
	encoded, _ := json.Marshal(envelope)
	existing := &model.DigiConnectRequest{
		RequestID:    "dc_req_text",
		ResponseJSON: string(encoded),
	}
	var chunks []DigiConnectStreamChunk
	emitChatCompletionsReplayChunks(existing, "kr/auto", func(c DigiConnectStreamChunk) {
		chunks = append(chunks, c)
	})
	if len(chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d", len(chunks))
	}
	if chunks[0].Type != "raw_chat_chunk" || !contains(chunks[0].Delta, `"hello world"`) {
		t.Errorf("first chunk wrong: %+v", chunks[0])
	}
	if chunks[1].Type != "completed" || chunks[1].Text != "hello world" || chunks[1].FinishReason != "stop" {
		t.Errorf("final chunk wrong: %+v", chunks[1])
	}
}

func contains(haystack, needle string) bool {
	return len(needle) == 0 || (len(haystack) >= len(needle) && indexOf(haystack, needle) >= 0)
}

func indexOf(haystack, needle string) int {
	n := len(needle)
	if n == 0 {
		return 0
	}
	for i := 0; i+n <= len(haystack); i++ {
		if haystack[i:i+n] == needle {
			return i
		}
	}
	return -1
}
