package service

import (
	"encoding/json"
	"testing"
)

func TestExtractDigiConnectTextReadsChatCompletionsChoices(t *testing.T) {
	res := map[string]interface{}{
		"router_response": map[string]interface{}{
			"id": "chatcmpl_test",
			"choices": []interface{}{
				map[string]interface{}{
					"index": 0,
					"message": map[string]interface{}{
						"role":    "assistant",
						"content": "halo dari router",
					},
				},
			},
		},
	}

	if got := extractDigiConnectText(res); got != "halo dari router" {
		t.Fatalf("expected chat completion content, got %q", got)
	}
}

func TestExtractDigiConnectTextReadsStreamingDeltaChoices(t *testing.T) {
	res := map[string]interface{}{
		"router_response": map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{"delta": map[string]interface{}{"content": "ha"}},
				map[string]interface{}{"delta": map[string]interface{}{"content": "lo"}},
			},
		},
	}

	if got := extractDigiConnectText(res); got != "ha\nlo" {
		t.Fatalf("expected joined delta content, got %q", got)
	}
}

func TestOpenAICompatibleChatInputParsesToolsField(t *testing.T) {
	body := []byte(`{
        "model":"kr/auto",
        "messages":[
            {"role":"user","content":"x"},
            {"role":"tool","content":"r","tool_call_id":"call_1","name":"f"}
        ],
        "tools":[{"type":"function","function":{"name":"f","parameters":{"type":"object"}}}],
        "tool_choice":"auto",
        "response_format":{"type":"json_object"}
    }`)
	var in OpenAICompatibleChatInput
	if err := json.Unmarshal(body, &in); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(in.Tools) != 1 {
		t.Fatalf("want 1 tool, got %d", len(in.Tools))
	}
	if in.ToolChoice == nil {
		t.Fatal("tool_choice nil")
	}
	if in.ResponseFormat == nil {
		t.Fatal("response_format nil")
	}
	if len(in.Messages) != 2 {
		t.Fatalf("want 2 messages, got %d", len(in.Messages))
	}
	if in.Messages[1].ToolCallID != "call_1" {
		t.Fatalf("want tool_call_id=call_1, got %q", in.Messages[1].ToolCallID)
	}
	if in.Messages[1].Name != "f" {
		t.Fatalf("want name=f, got %q", in.Messages[1].Name)
	}
}
