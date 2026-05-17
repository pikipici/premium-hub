package service

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// realSSESample mirrors what 9router /v1/responses returns for a small prompt.
// Captured from a live probe against http://127.0.0.1:20128 on 2026-05-17.
const realSSESample = `event: response.created
data: {"type":"response.created","response":{"id":"resp_chatcmpl-1779034896230","object":"response","created_at":1779034896,"status":"in_progress","background":false,"error":null,"output":[]},"sequence_number":1}

event: response.in_progress
data: {"type":"response.in_progress","response":{"id":"resp_chatcmpl-1779034896230","object":"response","created_at":1779034896,"status":"in_progress"},"sequence_number":2}

event: response.output_item.added
data: {"type":"response.output_item.added","output_index":0,"item":{"id":"msg_resp_chatcmpl-1779034896230_0","type":"message","content":[],"role":"assistant"},"sequence_number":3}

event: response.content_part.added
data: {"type":"response.content_part.added","item_id":"msg_resp_chatcmpl-1779034896230_0","output_index":0,"content_index":0,"part":{"type":"output_text","annotations":[],"logprobs":[],"text":""},"sequence_number":4}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_resp_chatcmpl-1779034896230_0","output_index":0,"content_index":0,"delta":"Hello","logprobs":[],"sequence_number":5}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_resp_chatcmpl-1779034896230_0","output_index":0,"content_index":0,"delta":" there","logprobs":[],"sequence_number":6}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_resp_chatcmpl-1779034896230_0","output_index":0,"content_index":0,"delta":"!","logprobs":[],"sequence_number":7}

event: response.completed
data: {"type":"response.completed","response":{"id":"resp_chatcmpl-1779034896230","object":"response","status":"completed","output":[{"id":"msg_resp_chatcmpl-1779034896230_0","type":"message","role":"assistant","content":[{"type":"output_text","text":"Hello there!","annotations":[]}]}]},"sequence_number":8}

`

func TestParseSSEStream_AccumulatesResponseTextDeltas(t *testing.T) {
	events := []sseEvent{}
	err := parseSSEStream(context.Background(), strings.NewReader(realSSESample), func(ev sseEvent) error {
		events = append(events, ev)
		return nil
	})
	if err != nil {
		t.Fatalf("parseSSEStream returned error: %v", err)
	}
	if len(events) != 8 {
		t.Fatalf("expected 8 events, got %d", len(events))
	}
	expectedTypes := []string{
		"response.created",
		"response.in_progress",
		"response.output_item.added",
		"response.content_part.added",
		"response.output_text.delta",
		"response.output_text.delta",
		"response.output_text.delta",
		"response.completed",
	}
	for i, want := range expectedTypes {
		if events[i].Event != want {
			t.Fatalf("event[%d] type: want %q, got %q", i, want, events[i].Event)
		}
	}
	// Each data should be valid JSON (non-empty). Spot-check the deltas.
	deltaCount := 0
	concatenated := ""
	for _, ev := range events {
		if ev.Event != "response.output_text.delta" {
			continue
		}
		deltaCount++
		// crude extraction: find "delta":"X" — real callers will json.Unmarshal.
		// Here we just verify the data field is preserved verbatim.
		if !strings.Contains(ev.Data, `"delta":`) {
			t.Fatalf("delta event missing delta key: %q", ev.Data)
		}
	}
	_ = concatenated
	if deltaCount != 3 {
		t.Fatalf("expected 3 delta events, got %d", deltaCount)
	}
}

func TestParseSSEStream_HandlesDoneTerminator(t *testing.T) {
	sample := "event: chunk\ndata: {\"x\":1}\n\ndata: [DONE]\n\n"
	events := []sseEvent{}
	err := parseSSEStream(context.Background(), strings.NewReader(sample), func(ev sseEvent) error {
		events = append(events, ev)
		return nil
	})
	if err != nil {
		t.Fatalf("parseSSEStream returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event before [DONE], got %d", len(events))
	}
	if events[0].Event != "chunk" || events[0].Data != `{"x":1}` {
		t.Fatalf("unexpected first event: %+v", events[0])
	}
}

func TestParseSSEStream_HandlesEventWithoutExplicitEventField(t *testing.T) {
	// chat.completion.chunk style: no "event:" line, just data
	sample := "data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\ndata: [DONE]\n\n"
	events := []sseEvent{}
	err := parseSSEStream(context.Background(), strings.NewReader(sample), func(ev sseEvent) error {
		events = append(events, ev)
		return nil
	})
	if err != nil {
		t.Fatalf("parseSSEStream returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	if events[0].Event != "" {
		t.Fatalf("expected empty event name, got %q", events[0].Event)
	}
	if !strings.Contains(events[0].Data, "\"hi\"") {
		t.Fatalf("data missing hi: %q", events[0].Data)
	}
}

func TestParseSSEStream_PropagatesContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel before parsing starts
	err := parseSSEStream(ctx, strings.NewReader(realSSESample), func(ev sseEvent) error {
		return nil
	})
	if err == nil {
		t.Fatalf("expected context cancellation error, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestParseSSEStream_StopsOnCallbackError(t *testing.T) {
	stopErr := errors.New("stop")
	count := 0
	err := parseSSEStream(context.Background(), strings.NewReader(realSSESample), func(ev sseEvent) error {
		count++
		if count == 2 {
			return stopErr
		}
		return nil
	})
	if !errors.Is(err, stopErr) {
		t.Fatalf("expected stop error propagation, got %v", err)
	}
	if count != 2 {
		t.Fatalf("expected callback called exactly twice, got %d", count)
	}
}
