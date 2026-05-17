package service

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
)

// sseEvent represents a single Server-Sent Event with its event name and data
// payload. Multi-line `data:` fields are joined with `\n` per the SSE spec.
type sseEvent struct {
	Event string
	Data  string
}

// parseSSEStream reads an SSE stream from r, dispatching each fully-formed
// event (terminated by a blank line) to onEvent. It honors ctx cancellation
// and propagates callback errors. A `data: [DONE]` event terminates parsing
// cleanly without invoking the callback for that sentinel.
//
// The parser is upstream-agnostic: it does not interpret event payloads. The
// caller is responsible for json.Unmarshalling Data when needed.
func parseSSEStream(ctx context.Context, r io.Reader, onEvent func(sseEvent) error) error {
	if ctx == nil {
		ctx = context.Background()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	scanner := bufio.NewScanner(r)
	// 9router emits long single-line JSON payloads inside data: lines. Bump
	// scanner buffer to 1 MiB to avoid bufio.ErrTooLong on big completion events.
	scanner.Buffer(make([]byte, 0, 64*1024), 1<<20)

	var (
		eventName    string
		dataLines    []string
	)
	flush := func() error {
		if eventName == "" && len(dataLines) == 0 {
			return nil
		}
		data := strings.Join(dataLines, "\n")
		ev := sseEvent{Event: eventName, Data: data}
		eventName, dataLines = "", nil
		if strings.TrimSpace(data) == "[DONE]" {
			return errSSEDone
		}
		return onEvent(ev)
	}

	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		if !scanner.Scan() {
			if err := scanner.Err(); err != nil {
				return fmt.Errorf("sse scan: %w", err)
			}
			// EOF — flush any pending event.
			if err := flushLast(eventName, dataLines, onEvent); err != nil {
				if errors.Is(err, errSSEDone) {
					return nil
				}
				return err
			}
			return nil
		}
		line := scanner.Text()
		if line == "" {
			// Dispatch the accumulated event.
			if err := flush(); err != nil {
				if errors.Is(err, errSSEDone) {
					return nil
				}
				return err
			}
			continue
		}
		// Comment line per SSE spec — ignore.
		if strings.HasPrefix(line, ":") {
			continue
		}
		if strings.HasPrefix(line, "event:") {
			eventName = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataLines = append(dataLines, strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
			continue
		}
		// Other SSE fields (id, retry) are not used by 9router payloads.
	}
}

func flushLast(eventName string, dataLines []string, onEvent func(sseEvent) error) error {
	if eventName == "" && len(dataLines) == 0 {
		return nil
	}
	data := strings.Join(dataLines, "\n")
	if strings.TrimSpace(data) == "[DONE]" {
		return errSSEDone
	}
	return onEvent(sseEvent{Event: eventName, Data: data})
}

var errSSEDone = errors.New("sse stream done")

// aggregateSSEResponseBody reads an SSE stream from r (typically a 9router
// response body returning text/event-stream) and folds the events into a
// single chat.completion-shaped map. The aggregated text comes from
// `response.output_text.delta` events when present, falling back to the
// `response.completed` payload's output_text or to choice deltas for
// chat.completion.chunk style streams.
//
// Used by:
//   - callRouterOnce defensive branch (when upstream ignores stream:false)
//   - tests that mock 9router with SSE on the non-stream path
func aggregateSSEResponseBody(ctx context.Context, r io.Reader) (map[string]interface{}, error) {
	var (
		deltaText strings.Builder
		completed map[string]interface{}
		modelID   string
		respID    string
		usage     map[string]interface{}
		errPayload string
	)
	parseErr := parseSSEStream(ctx, r, func(ev sseEvent) error {
		// Try OpenAI Responses event format first.
		var payload map[string]interface{}
		_ = json.Unmarshal([]byte(ev.Data), &payload)
		switch ev.Event {
		case "response.output_text.delta":
			if delta, ok := payload["delta"].(string); ok {
				deltaText.WriteString(delta)
			}
		case "response.completed":
			if resp, ok := payload["response"].(map[string]interface{}); ok {
				completed = resp
				if id, ok := resp["id"].(string); ok && id != "" {
					respID = id
				}
				if m, ok := resp["model"].(string); ok && m != "" {
					modelID = m
				}
				if u, ok := resp["usage"].(map[string]interface{}); ok {
					usage = u
				}
			}
		case "response.created", "response.in_progress":
			if resp, ok := payload["response"].(map[string]interface{}); ok {
				if id, ok := resp["id"].(string); ok && respID == "" {
					respID = id
				}
				if m, ok := resp["model"].(string); ok && modelID == "" {
					modelID = m
				}
			}
		case "error":
			if msg, ok := payload["message"].(string); ok && errPayload == "" {
				errPayload = msg
			}
		default:
			// chat.completion.chunk style or unknown: best effort delta extraction.
			if choices, ok := payload["choices"].([]interface{}); ok {
				for _, raw := range choices {
					choice, ok := raw.(map[string]interface{})
					if !ok {
						continue
					}
					if delta, ok := choice["delta"].(map[string]interface{}); ok {
						if content, ok := delta["content"].(string); ok {
							deltaText.WriteString(content)
						}
					}
				}
			}
		}
		return nil
	})
	if parseErr != nil {
		return nil, parseErr
	}
	if errPayload != "" && deltaText.Len() == 0 && completed == nil {
		return nil, errors.New(errPayload)
	}
	// Fallback: pull text from completed.output if no deltas were emitted.
	if deltaText.Len() == 0 && completed != nil {
		if output, ok := completed["output"].([]interface{}); ok {
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
							deltaText.WriteString(text)
						}
					}
				}
			}
		}
	}
	body := map[string]interface{}{
		"id":     respID,
		"object": "chat.completion",
		"model":  modelID,
		"choices": []interface{}{
			map[string]interface{}{
				"index":         0,
				"message":       map[string]interface{}{"role": "assistant", "content": deltaText.String()},
				"finish_reason": "stop",
			},
		},
	}
	if usage != nil {
		body["usage"] = usage
	}
	return body, nil
}
