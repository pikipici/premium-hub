# DigiConnect Tool-Calling Passthrough Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make DigiConnect's OpenAI-compatible endpoints faithfully proxy `tools` / `tool_choice` / `tool_calls` so OpenAI-shaped clients (Hermes Agent, Cursor, Continue, AI SDK, etc.) can use function-calling end-to-end through `https://digimarket.id/api/v1/digiconnect/...`.

**Architecture:** Replace the existing "flatten messages to plain text → POST to `/v1/responses`" compat shim for `/chat/completions` with a **raw passthrough** to upstream `/v1/chat/completions` on 9router. 9router already speaks proper OpenAI chat-completions including `tools`/`tool_calls` for both stream and non-stream — confirmed via direct curl. Keep billing/idempotency/audit/charge-on-success contract intact.

**Tech Stack:** Go 1.21+, Gin, GORM/Postgres, 9router upstream (`http://127.0.0.1:20128`), bufio.Scanner SSE parser.

**Out of scope (Phase 2 / deferred):**
- `/responses` path tool-calling — deferred. Responses API tool-calling event shape (`response.function_call_arguments.delta`) is materially different. Hermes/most clients use `/chat/completions`. Park as F-future.
- Multi-modal `image_url` / vision parts — deferred until user reports symptom.

**Workspace-only first.** LIVE promote nungguin `gas live`.

---

## Root Cause (confirmed)

1. `OpenAICompatibleChatInput` struct (`internal/service/digiconnect_service.go:663-672`) ga punya field `Tools` / `ToolChoice` / `ResponseFormat`. JSON unmarshaler buang field itu silent.
2. `normalizeOpenAICompatibleMessages` flatten semua messages jadi plain text `"role: content\n..."`, lost structure.
3. `CreateAPIRequest` forward ke `/v1/responses` (config default `DIGICONNECT_ROUTER_RESPONSES_PATH=/v1/responses`) sebagai `{model, input: <flat-text>, options}`. Tools-aware client → server channel hilang total.
4. Model di kr/auto liat tool definition di system prompt context (Hermes inject ke system text juga sebagai backup), generate tool call sebagai raw JSON di assistant content karena `tools` array protocol channel ga ada.
5. Hermes terima `choices[0].message.content` = `{"name":"read_file","input":{...}}` literal, render apa adanya.

**Verified upstream behavior** (curl on rdpkhorur):
- `POST http://127.0.0.1:20128/v1/chat/completions` dengan `tools` + `tool_choice`:
  - non-stream → `{message: {content:null, tool_calls:[{id, type:"function", function:{name, arguments:"<json>"}}]}, finish_reason:"tool_calls"}`
  - stream → SSE chunks dengan `delta.tool_calls[].function.arguments` incremental + `finish_reason:"tool_calls"` di chunk terakhir + `[DONE]`
- 9router fully OpenAI-compat. Cuma butuh proxy tipis di sisi DigiConnect.

---

## Acceptance Criteria

- [ ] `POST /api/v1/digiconnect/chat/completions` dengan body `{messages, tools, tool_choice, stream:false}` → DigiConnect forward apa adanya ke 9router `/v1/chat/completions`, return upstream JSON response apa adanya (envelope di-augment cuma kalo perlu, tapi `choices[].message.tool_calls` muncul utuh).
- [ ] `POST /api/v1/digiconnect/chat/completions` dengan `stream:true` + `tools` → SSE pipe-through, client terima `delta.tool_calls[].function.arguments` per-chunk + final `finish_reason:"tool_calls"` + `[DONE]`.
- [ ] Billing tetep: 1 request charge IDR amount sesuai plan, `digi_connect_requests` row `Status=completed` `BillingStatus=charged` `WalletReference="digiconnect:<id>:charge"`, ledger debit row exists, idempotency replay aman.
- [ ] Mid-stream upstream failure → request `Status=pending_verification`, NO wallet debit, reconcile worker handle. Sama kayak existing.
- [ ] Hermes Agent end-to-end di workspace (`OPENAI_BASE_URL=https://workspace-host/api/v1/digiconnect`) bisa execute task tool call (e.g. `read_file`, `terminal`). Bukti: tool result kembali ke chat lewat `tool` role, lalu model lanjut response.
- [ ] Existing non-tool flows (plain "halo" → "halo bos") tetep work tanpa regresi.
- [ ] Existing `/v1/chat/completions` (non-DigiConnect path, kalau ada user lain selain Hermes via DigiConnect compat) tidak rusak.
- [ ] All targeted Go tests pass (`go test ./internal/service`), `go build ./...` clean.
- [ ] `/responses` non-tool flow tidak regres (existing SSE + non-stream tetep work).

---

## Task Status Legend
- `[ ]` pending
- `[~]` in progress
- `[x]` done
- `[!]` blocked / needs decision

---

## Tasks

### Task 1: Add config for chat-completions upstream path  `[ ]`

**Objective:** Bikin config field `DigiConnectRouterChatCompletionsPath` dengan default `/v1/chat/completions`. Minimal blast radius.

**Files:**
- Modify: `premiumhub-api/config/config.go` (struct + parser)

**Step 1:** Tambah field di struct `Config`:
```go
DigiConnectRouterChatCompletionsPath  string
```
sejajar dengan `DigiConnectRouterResponsesPath`.

**Step 2:** Tambah loader di build-config function:
```go
DigiConnectRouterChatCompletionsPath: e("DIGICONNECT_ROUTER_CHAT_COMPLETIONS_PATH", "/v1/chat/completions"),
```

**Step 3:** Verify: `cd premiumhub-api && CGO_ENABLED=1 go build ./...` (di rdpkhorur) clean.

**Step 4:** Commit:
```
feat(digiconnect): add chat-completions upstream path config
```

---

### Task 2: Add `tools`, `tool_choice`, `response_format` to chat input struct  `[ ]`

**Objective:** Field-level pre-req. Tanpa ini, downstream forward jadi mustahil — JSON unmarshaler buang.

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (struct `OpenAICompatibleChatInput`)
- Modify: `premiumhub-api/internal/service/digiconnect_openai_compat_test.go` (add RED test confirming fields parsed)

**Step 1: RED test**
```go
func TestOpenAICompatibleChatInput_ParsesToolsField(t *testing.T) {
    body := []byte(`{
        "model":"kr/auto",
        "messages":[{"role":"user","content":"x"}],
        "tools":[{"type":"function","function":{"name":"f","parameters":{}}}],
        "tool_choice":"auto",
        "response_format":{"type":"json_object"}
    }`)
    var in OpenAICompatibleChatInput
    if err := json.Unmarshal(body, &in); err != nil { t.Fatal(err) }
    if len(in.Tools) != 1 { t.Fatalf("want 1 tool, got %d", len(in.Tools)) }
    if in.ToolChoice == nil { t.Fatal("tool_choice nil") }
    if in.ResponseFormat == nil { t.Fatal("response_format nil") }
}
```
Run: `go test ./internal/service -run TestOpenAICompatibleChatInput_ParsesToolsField -count=1 -v` → FAIL (compile error: undefined fields).

**Step 2: GREEN** — extend struct:
```go
type OpenAICompatibleChatInput struct {
    Model          string                        `json:"model"`
    Messages       []OpenAICompatibleChatMessage `json:"messages"`
    Temperature    *float64                      `json:"temperature,omitempty"`
    MaxTokens      *int                          `json:"max_tokens,omitempty"`
    Stream         bool                          `json:"stream,omitempty"`
    Metadata       map[string]interface{}        `json:"metadata,omitempty"`
    Tools          []map[string]interface{}      `json:"tools,omitempty"`
    ToolChoice     interface{}                   `json:"tool_choice,omitempty"`
    ResponseFormat map[string]interface{}        `json:"response_format,omitempty"`
}
```
Note `OpenAICompatibleChatMessage.Content` already `interface{}` — fine. Tambah optional `ToolCallID string \`json:"tool_call_id,omitempty"\`` + `ToolCalls []map[string]interface{} \`json:"tool_calls,omitempty"\`` + `Name string \`json:"name,omitempty"\`` ke message struct buat tool-result roundtrip messages dari client.

**Step 3:** Verify test pass: `go test ./internal/service -run TestOpenAICompatibleChatInput_ParsesToolsField -count=1 -v` → PASS.

**Step 4:** Run full `go test ./internal/service -count=1` → no regression.

**Step 5:** Commit:
```
feat(digiconnect): add tools/tool_choice/response_format fields to chat input
```

---

### Task 3: Add `callRouterChatCompletions` non-stream raw passthrough  `[ ]`

**Objective:** New transport function — POST raw body ke 9router `/v1/chat/completions`, return parsed map plus router status code. Mirror retry policy + error envelope dari `callRouter`/`callRouterOnce`. Defensive: handle upstream `text/event-stream` content-type by reusing `aggregateSSEResponseBody` (chat.completion shape since upstream itu emang chat-completion chunks).

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go`
- Modify: `premiumhub-api/internal/service/digiconnect_router_test.go` (or new test file)

**Step 1: RED test** — `httptest.NewServer` mock 9router yang return:
- (a) JSON `{"choices":[{"message":{"role":"assistant","content":"hi"}}]}` → assert returned map equal.
- (b) `text/event-stream` SSE with chat.completion.chunk deltas → assert aggregated map has `choices[0].message.content == "concatenated"`.
- (c) 502 with body → assert `routerError.InternalCode == "UPSTREAM_502"`.

Run → FAIL (function not defined).

**Step 2: GREEN** — implement:
```go
func (s *DigiConnectService) callRouterChatCompletions(ctx context.Context, body map[string]any) (map[string]any, int, *digiConnectRouterError) {
    // serialize body, set stream:false explicitly (caller never overrides)
    // POST to baseURL + s.cfg.DigiConnectRouterChatCompletionsPath
    // 5x retry policy reuse digiConnectRetryableInternalCodes
    // content-type sniff: if SSE, fold via aggregateChatCompletionsSSE (new helper, similar to aggregateSSEResponseBody but for chat.completion.chunk shape)
    // return parsed map + status + nil-or-routerError
}
```
Plus helper `aggregateChatCompletionsSSE(ctx, r io.Reader) (map[string]any, error)` — collects deltas (`delta.content` strings AND `delta.tool_calls[]` merged by index) into a single chat.completion-shaped map.

**Step 3:** Tests pass. Full service tests pass.

**Step 4:** Commit:
```
feat(digiconnect): add raw passthrough router call for chat completions
```

---

### Task 4: Rewrite `CreateOpenAICompatibleChatCompletion` to use raw passthrough  `[ ]`

**Objective:** Stop flattening. Forward client body apa adanya (model whitelisted, options merged from plan policy) ke `callRouterChatCompletions`. Persist `digi_connect_requests` row + billing on success. Idempotency replay tetep ada.

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (function `CreateOpenAICompatibleChatCompletion` ~line 736)
- Modify/Add: `premiumhub-api/internal/service/digiconnect_openai_compat_test.go`

**Step 1: RED test** — `httptest` mock upstream returns chat.completion with tool_calls. Call `CreateOpenAICompatibleChatCompletion` with input containing `tools`. Assert returned map has `choices[0].message.tool_calls[]` with proper structure. Assert `digi_connect_requests` row created with `Status=completed BillingStatus=charged`. Assert wallet ledger debit row exists.

Run → FAIL (returned map flat, no tool_calls).

**Step 2: GREEN** — refactor:
1. Validate access (existing `validateOpenAICompatibleAccess`).
2. Validate model in entitlement model_ids whitelist.
3. **Build router body verbatim** from input: `{model, messages, stream:false, ...optional(temperature,max_tokens,tools,tool_choice,response_format,metadata)}` — preserve client structure.
4. Pre-flight billing decide (wallet balance check vs plan unit price). Reuse existing `DecideDigiConnectBilling` flow but adapted: build minimal `DigiConnectAPIRequestInput` only for the persistence layer (`Service: "digiconnect-smart"`, `Type: "chat"`, `Input: <messages json>`, `Options: <pruned>`, `Metadata: {compat: "openai_chat_completions"}`).
5. Persist request row `Status=processing BillingStatus=reserved` BEFORE upstream call so idempotency + reconcile work.
6. Call `callRouterChatCompletions(ctx, routerBody)`.
7. On success: charge wallet via `chargeWalletAndFinalize` (existing Phase 1 R3 helper), update side effects (`recordDigiConnectSuccessSideEffects`).
8. Return upstream `chat.completion` map verbatim (re-bind `id` to our `request_id` for traceability, but DO NOT strip `tool_calls`/`finish_reason`). Optionally augment with `digiconnect: {request_id, billing}` field — but ONLY in a way OpenAI clients ignore (extra fields are tolerated).
9. On router error: return mapped public error; request row stays `processing` until reconcile flips it (existing behavior).

Critical: **drop** `extractDigiConnectText` + `normalizeOpenAICompatibleMessages` from this code path entirely. Those funcs may stay (used by `/responses`) but no longer called from chat completions.

**Step 3:** Idempotency replay test — second call with same `Idempotency-Key` returns stored response without re-charging. Existing `idempotency_repo` should already store full response JSON (verify); if it strips fields, fix at storage layer too.

**Step 4:** Tests pass. Full service tests pass.

**Step 5:** Commit:
```
feat(digiconnect): chat completions raw passthrough preserves tool_calls
```

---

### Task 5: Stream chat completions tool-aware passthrough  `[ ]`

**Objective:** Pipe upstream `/v1/chat/completions` SSE chunks to client tanpa translation. Tool_calls deltas just flow through. Billing-after-aggregate.

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_stream.go`
- Modify: `premiumhub-api/internal/handler/digiconnect_handler.go` (stream branch in chat completions handler)
- Modify/Add: `premiumhub-api/internal/service/digiconnect_sse_parser_test.go` or new test

**Step 1: RED test** — mock upstream serves chat.completion.chunk SSE with tool_calls deltas. `StreamOpenAICompatibleChatCompletion(ctx, key, input{Stream:true,Tools:[...]}, idempotencyKey, onChunk)`. Assert:
- `onChunk` invoked per upstream event with `Type=passthrough_chat_chunk` carrying raw chunk bytes/data.
- Aggregate captured includes both content text AND tool_calls structure (for billing audit + idempotency replay).
- Final `completed` chunk emitted after `[DONE]`.

Run → FAIL.

**Step 2: GREEN** — add `streamRouterChatCompletionsCall(ctx, body, onEvent)` parallel to existing `streamRouterCall` but POSTs to `DigiConnectRouterChatCompletionsPath`. Reuse `parseSSEStream`. Aggregate by:
- `delta.content` string → append to text aggregate.
- `delta.tool_calls[].function.arguments` → append to per-index args aggregate, capture id/name/type when first seen.
- `finish_reason` → capture.

Add `StreamOpenAICompatibleChatCompletionsTools(ctx, ...)` (or refactor `StreamOpenAICompatibleChatCompletion` to support both old responses-derived and new chat-completions-derived modes — pick simplest). Emit chunks to handler closure as `passthrough_chat_chunk` type carrying the original SSE `data:` payload bytes; handler writes them out verbatim.

In `digiconnect_handler.go`, route stream chat-completions request to the new function. Headers/flush per `openai-compat-real-streaming-passthrough` skill.

**Step 3:** Mid-stream-failure test — upstream closes after 2 chunks. Assert request row → `pending_verification`, NO ledger debit, error chunk emitted to client.

**Step 4:** Tests pass.

**Step 5:** Commit:
```
feat(digiconnect): stream chat completions tool-aware SSE passthrough
```

---

### Task 6: Idempotency stored-response shape verification  `[ ]`

**Objective:** Pastikan idempotency replay return body identical (tool_calls preserved). Kalau current storage strip atau truncate, fix.

**Files:**
- Inspect: `premiumhub-api/internal/repository/digiconnect_idempotency_repo.go` (or wherever `IdempotencyKey` records hit)
- Modify if needed: store full response JSON without filtering.

**Step 1: Inspect & RED test** — call non-stream chat with `Idempotency-Key: test-1` + tools → tool_calls returned. Call again with same key → assert response identical (tool_calls present, same arguments).

**Step 2: GREEN** — if storage strips fields, fix to store full JSON blob. If already fine, skip.

**Step 3:** Commit (only if changed):
```
fix(digiconnect): preserve tool_calls in idempotent replay
```

---

### Task 7: Verify `/responses` non-tool path tidak regres  `[ ]`

**Objective:** Existing `/responses` flow (workspace baseline `0ce61fbb` — real SSE pipe-through) tidak rusak gara-gara perubahan. Smoke test only.

**Files:** none.

**Step 1:** Backend `go test ./internal/service -count=1` → all pass.

**Step 2:** Curl smoke (post-deploy): plain text Q via `/api/v1/digiconnect/responses` non-stream + stream → text reply proper. No tool_calls field expected.

**Step 3:** Commit: none (verification only).

---

### Task 8: Build + workspace deploy  `[ ]`

**Objective:** Land workspace, smoke check end-to-end via Hermes.

**Files:** none (deploy).

**Step 1:** Local Windows: `git status` — pastikan clean / uncommitted file di tempatnya.

**Step 2:** Cherry-pick / relay flow via `premium-hub-workspace-deploy` skill:
- Local commit chain (Task 1-6 commits).
- Relay push: `git format-patch -<N> --stdout HEAD~N..HEAD | ssh rdpkhorur 'cd <workspace> && git am --3way'`.
- Workspace push: `ssh rdpkhorur 'cd <workspace> && git push origin main'`.
- Local fetch + ff to keep in sync.

**Step 3:** `.\workspace-deploy.ps1` — should rebuild BE only (FE untouched).

**Step 4:** Healthcheck:
- `curl https://<workspace-origin>/api/v1/digiconnect/models` 200 (auth via dc_live key).
- `curl /healthz` 200.

**Step 5:** Real Hermes Agent test:
- Set `OPENAI_BASE_URL=https://<workspace-origin>/api/v1/digiconnect`, `OPENAI_API_KEY=dc_live_aWTn2_…`.
- Prompt: `baca LOCAL_AI_CONTEXT di folder premium-hub`.
- Expected: Hermes invoke `read_file` tool **as actual tool call** (terlihat di TUI sebagai tool execution, bukan literal JSON), file ke-baca, summary balik.
- Prompt simple: `halo` → reply normal `halo bos`.

**Step 6:** DB verify: `digi_connect_requests` row 2 entries, both `completed`/`charged`. Ledger debit rows present.

**Step 7:** Update `LOCAL_AI_CONTEXT.md` Current State & Recent Development Log.

**Step 8:** Tunggu user `gas live` sebelum promote production.

---

## Implementation Notes (updated as we go)

_Awal kosong. Update tiap task selesai._

---

## Current Next Step

Task 1 — add config field for chat completions upstream path.

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Upstream 9router error format beda dari existing assumption | Reuse existing `digiConnectRouterError` mapping; verify via test mock |
| Hermes ngirim `tool` role messages dengan `tool_call_id` (multi-turn agentic loop) yg ga di-validate | Tambah `ToolCallID`/`ToolCalls`/`Name` ke message struct (Task 2) |
| Stream client disconnect mid-stream charge race | Existing pattern: persist `pending_verification`, reconcile worker flips. Diuji di Task 5 step 3 |
| Idempotency storage strip tool_calls | Task 6 verifies/fixes |
| Plan model whitelist contoh `kr/claude-opus-4.7` ga ada di entitlement model_ids tertentu | Existing `containsDigiConnectModel` check dipertahankan; behavior same as today |
| Billing amount harusnya based on units (input/output tokens?) atau per-request flat? | Existing `DecideDigiConnectBilling` flat-per-request logic dipertahankan; tool calls = same flat charge |
| Removing `normalizeOpenAICompatibleMessages` from chat path may break audit log readability | Audit `Input` field stores serialized messages JSON instead of flat text — readable via admin DigiConnect request detail page |

---

## Open Questions

_(none right now — flow clear. Add here kalau ada decision selama implementasi.)_
