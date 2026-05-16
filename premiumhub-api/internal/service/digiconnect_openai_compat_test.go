package service

import "testing"

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
