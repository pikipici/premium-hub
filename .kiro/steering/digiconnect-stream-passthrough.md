# DigiConnect Real Streaming Passthrough Implementation Plan

> **Status**: WORKSPACE PHASE — In Progress
> **Date Started**: 2026-05-17
> **Owner**: Apis (workspace dev)
> **Trigger**: User reported Hermes Agent receiving literal `{"raw_preview":"event: response.created\ndata: ..."}` as model reply when calling DigiConnect via `OPENAI_BASE_URL=...api/v1/digiconnect`.

## Goal

End-to-end proper handling of upstream 9router responses in the DigiConnect compat pipeline:

1. **Non-stream path**: backend talks `stream:false` to 9router, gets `application/json`, extracts text properly. Drop the `raw_preview` fallback that leaks internal SSE bytes to user-visible content.
2. **Stream path**: when client sends `stream:true` (Hermes/Mercury/AI SDK), backend forces `stream:true` to 9router, parses SSE event-by-event, pipes translated chunks to client in real time (chat.completion.chunk for `/chat/completions`, response events for `/responses`). Replaces the current pseudo-stream that emits a single full message wrapped in fake SSE.
3. **Billing/audit correctness**: streaming path still creates `processing` request, charges wallet via `chargeWalletAndFinalize` only after full text aggregate received, falls into `pending_verification` on mid-stream failure (reconcile worker handles), and writes proper `WalletReference` + usage counters + last_used_at on success.
4. **Defense in depth**: `extractDigiConnectText` fallback no longer dumps internal struct as JSON. Empty extraction → empty text + internal error code, never user-visible internal data.

## Evidence (Phase 1 root cause)

Confirmed by direct probes against `http://127.0.0.1:20128`:

| 9router request | Response |
|---|---|
| `POST /v1/responses` body = `{model, input}` (no stream key) | `Content-Type: text/event-stream`, SSE stream of `response.*` events |
| `POST /v1/responses` body = `{..., "stream": false}` | `Content-Type: application/json`, single `chat.completion` shape with `choices[0].message.content` |
| `POST /v1/responses` body = `{..., "stream": true}` | `Content-Type: text/event-stream`, SSE stream of `response.created` → `response.output_text.delta` × N → `response.completed` |

Current backend (`callRouterOnce` in `internal/service/digiconnect_service.go:1198`) sends body with `model`, `input`, plus optional `temperature`/`max_tokens`/`max_output_tokens` — never sets `stream`. So 9router returns SSE → `json.Unmarshal` fails → fallback writes `{"raw_preview": "event: response.created..."}` into `router_response` → `extractDigiConnectText` final fallback at line 887 (`encoded, _ := json.Marshal(router); return string(encoded)`) marshals that map and returns it as the user content.

Streaming path (`writeOpenAICompatibleChatStream` in `internal/handler/digiconnect_handler.go:166`) is also broken: it builds 3 fake SSE events from the full single response and flushes once. Not real streaming.

## Non-goals

- Adding new entitlement types or plan codes
- Touching 9router itself
- Changing FE Integrasi panel snippets (already correct)
- Refactoring billing decision logic (Phase 1 R2/R3/R4 already handles it)
- Phase 2 (Idempotency-Key dedupe, per-key rate limit, refund flow, etc) — separate plan

## Architecture

### Non-stream path (existing, repaired)

```
Client POST /api/v1/digiconnect/chat/completions  {messages, stream:false|absent}
  → handler.OpenAICompatibleChatCompletions
  → svc.CreateOpenAICompatibleChatCompletion
  → svc.CreateAPIRequest
  → svc.callRouter (3-attempt retry)
  → svc.callRouterOnce
       body = {model, input, ...options, "stream": false}  ← FORCED
       parse JSON application/json → digiConnectRouterResponse
  → res["router_response"] = body
  → extractDigiConnectText → choices[0].message.content
  → response 200 application/json chat.completion
```

### Stream path (new)

```
Client POST /api/v1/digiconnect/chat/completions  {messages, stream:true}
  → handler.OpenAICompatibleChatCompletions
  → svc.StreamOpenAICompatibleChatCompletion(ctx, apiKey, input, idempotencyKey, emit func(chunk))
       validate access + entitlement + model
       create model.DigiConnectRequest (status=processing, billing reserved)
       persist
       svc.streamRouter (new)
            body = {model, input, ...options, "stream": true}  ← FORCED
            POST → text/event-stream
            bufio.Scanner over res.Body, chunked SSE parser:
               on event with type response.output_text.delta → emit chunk to handler
               on response.completed → capture final aggregate
               on error event → return error
       on stream end:
            chargeWalletAndFinalize(ctx, userID, request, amount, completedAt)
            recordDigiConnectSuccessSideEffects
       on mid-stream error/timeout:
            request.Status = pending_verification, persist, reconcile worker recovers
  → handler writes SSE chunks to client as chat.completion.chunk format
  → handler writes [DONE] terminator
```

`/responses` endpoint stream path: same plumbing but emits SSE events in OpenAI Responses event format (`response.created`, `response.output_text.delta`, `response.completed`) — easier translation since 9router already speaks that format.

### Components to create or modify

- **NEW** `internal/service/digiconnect_sse_parser.go` — `parseSSEStream(reader, emit) error` — line-buffered SSE parser that yields `(event, data)` tuples to a callback. Independent of router transport so it's pure-unit testable.
- **NEW** `internal/service/digiconnect_stream.go` — `StreamOpenAICompatibleChatCompletion`, `StreamOpenAICompatibleResponse`, `streamRouterCall`. Wraps existing validation + persistence + billing, plus invokes parser.
- **MODIFY** `internal/service/digiconnect_service.go`:
  - `callRouterOnce` → force `body["stream"] = false` before encode
  - `callRouterOnce` → on SSE response (defensive content-type check), still parse via SSE parser and accumulate, never `raw_preview`
  - `extractDigiConnectText` → empty fallback returns `""` (not `json.Marshal(router)`)
- **MODIFY** `internal/handler/digiconnect_handler.go`:
  - `OpenAICompatibleChatCompletions` → if `input.Stream` → call new `StreamOpenAICompatibleChatCompletion` with handler-provided emit function that writes proper `chat.completion.chunk` SSE
  - `OpenAICompatibleResponses` → same shape but emit Responses event format
  - Delete the broken `writeOpenAICompatibleChatStream` / `writeOpenAICompatibleResponseStream` helpers (replaced by real streaming)
- **MODIFY** `internal/service/digiconnect_openai_compat_test.go` — add unit tests for SSE parser, stream:false body assertion, extractor empty fallback
- **NEW** focused test file `internal/service/digiconnect_stream_test.go` — integration test using `httptest` mocking 9router, asserting full pipeline

## Task breakdown (TDD)

Status legend: `[ ]` pending · `[~]` in-progress · `[x]` done · `[!]` blocked/skipped

### Stage 0 — Setup

- [x] Phase 1 systematic-debugging: confirmed 9router behavior via direct curl probes
- [x] Read full file: `digiconnect_service.go`, `digiconnect_handler.go`, `digiconnect_openai_compat_test.go`
- [x] Plan file (this document) written

### Stage 1 — SSE parser (pure unit, no transport)

- [ ] **Task 1.1 (RED)** Add test `TestParseSSEStream_AccumulatesResponseTextDeltas` to new file `internal/service/digiconnect_sse_parser_test.go`. Feed real 9router SSE bytes captured from probe (`response.created` → 5x `response.output_text.delta` → `response.completed`). Assert callback receives `delta` strings in order, plus 1 final aggregate. Compile fails on missing `parseSSEStream` function. RED confirmed by `go test -run TestParseSSEStream`.
- [ ] **Task 1.2 (GREEN)** Implement `internal/service/digiconnect_sse_parser.go`:
  - `type sseEvent struct { Event string; Data string }`
  - `parseSSEStream(r io.Reader, onEvent func(sseEvent) error) error` — bufio.Scanner ScanLines, accumulates `event: X` + multi-line `data: Y` until blank line, calls `onEvent`, exits on `[DONE]` data marker or `response.completed`.
  - Run `go test ./internal/service -run TestParseSSEStream -v` → GREEN.
- [ ] **Task 1.3 (RED)** Add test `TestParseSSEStream_HandlesChatCompletionsChunkFormat` — feed SSE chunks shaped like `chat.completion.chunk` (some upstreams might return that even on `/responses` if they translate). Assert callback parses each event with `data: {json}` proper.
- [ ] **Task 1.4 (GREEN)** Already-passing or minor parser fix. Verify.
- [ ] **Task 1.5 (RED+GREEN)** `TestParseSSEStream_PropagatesContextCancellation` — assert parser stops cleanly when context done mid-stream.

### Stage 2 — Non-stream path repair

- [ ] **Task 2.1 (RED)** Add test `TestCallRouterOnceForcesStreamFalseInBody` to new file `internal/service/digiconnect_router_test.go`. Use `httptest.NewServer` mocking 9router; assert request body unmarshalled has `stream == false` regardless of input options. Confirm RED before fix (current code never sets `stream`).
- [ ] **Task 2.2 (GREEN)** Modify `callRouterOnce`: after building `body` map, set `body["stream"] = false`. Also defensive: detect `Content-Type: text/event-stream` on non-2xx unexpected response and parse via SSE parser, but for normal `stream:false` the JSON path returns first. Verify GREEN.
- [ ] **Task 2.3 (RED)** Add test `TestExtractDigiConnectTextEmptyFallbackReturnsEmpty` — feed `router_response = {}` or unparseable shape. Assert returns `""` not JSON dump. Confirm RED.
- [ ] **Task 2.4 (GREEN)** Modify `extractDigiConnectText`: drop `encoded, _ := json.Marshal(router); return string(encoded)` fallbacks; replace with `return ""`. Verify GREEN.
- [ ] **Task 2.5 (RED+GREEN)** `TestCallRouterOnceParsesChatCompletionResponse` — mock 9router returning real `chat.completion` JSON (from probe sample), assert `digiConnectRouterResponse.Body["choices"]` populated and `extractDigiConnectText` returns the content text.

### Stage 3 — Stream path implementation

- [ ] **Task 3.1 (RED)** Add test `TestStreamOpenAICompatibleChatCompletion_PipesDeltasAndChargesAfterCompletion` to `internal/service/digiconnect_stream_test.go`. Mock 9router via `httptest` returning real SSE deltas. Use real DB (sqlite via existing test helper). Drive `StreamOpenAICompatibleChatCompletion` with collector emit func. Assert: emit called N times in delta order, final aggregate non-empty, wallet ledger debit row exists with reference `digiconnect:<request_id>:charge`, request status=`completed`, BillingStatus=`charged`, usage counters incremented, key.LastUsedAt set. Confirm RED on missing function.
- [ ] **Task 3.2 (GREEN)** Implement `streamRouterCall(ctx, input, route, onChunk, onCompleted) error` — POST with `stream:true`, read SSE via parser, dispatch deltas to onChunk, capture `response.completed` payload to onCompleted.
- [ ] **Task 3.3 (GREEN)** Implement `StreamOpenAICompatibleChatCompletion(ctx, apiKey, input, idempotencyKey, emit func(chunk StreamChunk)) (StreamSummary, DigiConnectPublicError)`:
  - validateOpenAICompatibleAccess
  - re-use billing decide flow via DigiConnectAPIRequestInput (set `Service=digiconnect-smart`, `Type=text`)
  - persist `model.DigiConnectRequest{Status: "processing", BillingStatus: "reserved", ...}`
  - call `streamRouterCall`, on each delta: emit `StreamChunk{Type: "chat.delta", Text: delta}` to handler emit
  - on completed: aggregate full text, run `chargeWalletAndFinalize` + `recordDigiConnectSuccessSideEffects`, emit `StreamChunk{Type: "chat.done", FinishReason: "stop"}`
  - on stream error/ctx cancel: persist `pending_verification`, return error envelope
- [ ] **Task 3.4 (GREEN)** Implement `StreamOpenAICompatibleResponse` mirror. Verify both tests pass.
- [ ] **Task 3.5 (RED+GREEN)** `TestStreamOpenAICompatibleChatCompletion_FailsToPendingOnUpstreamMidStreamError` — mock 9router that closes connection after 2 deltas. Assert request status=`pending_verification`, no wallet debit, no usage counter increment.

### Stage 4 — Handler wiring

- [ ] **Task 4.1 (RED)** Add E2E-ish test `TestOpenAICompatibleChatCompletions_StreamsRealChunksWhenStreamTrue` using gin testserver + service. Assert response Content-Type=`text/event-stream`, body contains 5+ `data: {...chat.completion.chunk}` events with proper JSON, terminates with `data: [DONE]`. Confirm RED on current pseudo-stream.
- [ ] **Task 4.2 (GREEN)** Modify `OpenAICompatibleChatCompletions` handler: if `input.Stream`, call `svc.StreamOpenAICompatibleChatCompletion` with emit closure that writes each chunk as `chat.completion.chunk` SSE line. Delete `writeOpenAICompatibleChatStream`. Same for `/responses`.
- [ ] **Task 4.3 (REFACTOR)** Extract `writeChatCompletionChunkSSE(c, id, model, content, finishReason)` helper. Same for responses event format.

### Stage 5 — Verify build + cross-cutting

- [ ] **Task 5.1** `CGO_ENABLED=1 go build ./...` clean on rdpkhorur (synced workspace copy).
- [ ] **Task 5.2** Focused tests: `go test ./internal/service -run "TestParseSSEStream|TestCallRouterOnce|TestExtractDigiConnect|TestStreamOpenAICompatible" -count=1 -v` all pass.
- [ ] **Task 5.3** Full backend service compile sweep: `go build ./internal/...` clean.

### Stage 6 — Commit + relay + workspace deploy

- [ ] **Task 6.1** Local commits per stage (Stage 1 → 1 commit, Stage 2 → 1 commit, Stage 3 → 1 commit, Stage 4 → 1 commit). 4 commits total.
- [ ] **Task 6.2** Direct push attempt (origin = workspace repo); on rejection, relay-push via `git format-patch --stdout HEAD~4..HEAD | ssh rdpkhorur 'cd <ws> && git am'`.
- [ ] **Task 6.3** Workspace `git push origin main` to GitHub.
- [ ] **Task 6.4** `.\workspace-deploy.ps1` from local PowerShell.
- [ ] **Task 6.5** Smoke checks:
  - `/healthz` 200 ✓
  - `/api/v1/digiconnect/models` with valid key 200 ✓
  - `/api/v1/digiconnect/chat/completions` non-stream {messages: [{role:user, content:"ping"}]} → 200 with `choices[0].message.content` ≠ empty/raw_preview
  - `/api/v1/digiconnect/chat/completions` stream:true → real SSE chunks observed via `curl -N`
  - DB: new row in `digiconnect_requests` with `status=completed`, `billing_status=charged`, `wallet_reference=digiconnect:...:charge`, `usage_counters` row incremented
- [ ] **Task 6.6** Real Hermes Agent test: `OPENAI_BASE_URL=http://127.0.0.1:17005/api/v1/digiconnect` + active key. Send "test" message. Assert reply is real LLM text, no `raw_preview`.

### Stage 7 — Document + handover

- [ ] **Task 7.1** Update `LOCAL_AI_CONTEXT.md`: Current State row + new Recent Development Log entry at top.
- [ ] **Task 7.2** Update this plan file: mark all tasks done, status → `WORKSPACE DEPLOYED — awaiting gas live`.
- [ ] **Task 7.3** Notify user: workspace baseline new SHA, summary of what changed, ask for `gas live` approval.

## Verification Commands Reference

```bash
# Local Windows: build skipped (CGO=0). Tests run on rdpkhorur.

# Sync local working tree to workspace temp dir for tests
ssh rdpkhorur 'mkdir -p /tmp/premium-hub-test && rsync ...'  # actual flow uses git relay

# Focused service tests at workspace
ssh rdpkhorur 'cd /home/ubuntu/openclaw-vcp/profiles/openai-codex/shared/workspace/premium-hub/premiumhub-api && CGO_ENABLED=1 go test ./internal/service -run "TestParseSSEStream|TestCallRouterOnce|TestExtractDigiConnect|TestStreamOpenAICompatible" -count=1 -v'

# Full build sweep at workspace
ssh rdpkhorur 'cd /home/ubuntu/openclaw-vcp/profiles/openai-codex/shared/workspace/premium-hub/premiumhub-api && CGO_ENABLED=1 go build ./...'

# Workspace deploy from local Windows PowerShell
.\workspace-deploy.ps1

# Smoke from local
$key = "dc_live_aWTn2_..."
curl http://127.0.0.1:17005/api/v1/digiconnect/models -H "Authorization: Bearer $key"
curl http://127.0.0.1:17005/api/v1/digiconnect/chat/completions -X POST -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d '{"model":"kr/claude-haiku-4.5","messages":[{"role":"user","content":"ping"}]}'
curl -N http://127.0.0.1:17005/api/v1/digiconnect/chat/completions -X POST -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d '{"model":"kr/claude-haiku-4.5","messages":[{"role":"user","content":"ping"}],"stream":true}'
```

## Risk register

| Risk | Mitigation |
|---|---|
| Mid-stream client disconnect leaves request in `processing` forever | Use ctx done detection in stream loop → on cancel, persist `pending_verification` so reconcile worker (Phase 1 R3) handles |
| Wallet debited but client never received completion event (network blip after final chunk) | Charge happens BEFORE final SSE flush; if charge fails request stays `pending_verification` not `completed` |
| 9router occasionally returns 200 SSE with no `response.completed` event (unclean stream end) | Treat as upstream error → `pending_verification` |
| Concurrent identical Idempotency-Key streaming calls | Out of scope for this round; Phase 2 R5 handles |
| New goroutine leak from stream handler | Use bufio.Scanner with ctx-aware reader; defer body close; emit channel buffered or sync-only callback |
| HTTP/1.1 response writer doesn't flush per chunk | Cast `c.Writer` to `http.Flusher`, call `Flush()` after each `data: ...\n\n` write (already done in current code) |
| 9router future protocol drift | SSE parser is generic; only delta extraction is format-aware. Adding new event types is additive |

## Open questions

- None blocking. Decision: keep `extractOpenAIResponseText` and `extractOpenAIChatText` as-is for non-stream path since they already work on real `chat.completion`/`responses` JSON when transport is fixed.

## Current Next Step

→ **Task 1.1** Write RED test for SSE parser at `internal/service/digiconnect_sse_parser_test.go`.
