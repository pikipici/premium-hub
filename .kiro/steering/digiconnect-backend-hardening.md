# DigiConnect Backend Hardening Roadmap

> **For Hermes:** Use subagent-driven-development atau eksekusi sequential per round. Stop and ask user `gas live` before promoting to production after each round's workspace deploy.

**Goal:** Tutup gap antara skema/policy yang sudah ada dengan enforcement runtime yang sebenarnya untuk DigiConnect API. Paritas behavior antara native endpoint (`/api/v1/digiconnect/requests`) dan OpenAI-compat endpoints (`/v1/responses`, `/v1/chat/completions`).

**Architecture:** 4-round incremental hardening. Round 1 = security/billing leak, Round 2 = enforcement gaps di field schema yang sudah ada, Round 3 = reliability/observability, Round 4 = polish. Setiap round = workspace deploy + smoke + await user `gas live` sebelum promote production.

**Tech Stack:** Go (Gin + GORM), PostgreSQL (live/workspace), SQLite (local Windows test stub no-CGO).

**Baseline:** Workspace `4465a818`. Live `413f7b23`.

---

## Round 1: SKIPPED / FOLDED INTO ROUND 2

**Audit revision:** Setelah re-read teliti, `CreateOpenAICompatibleResponse` (line 655) dan `CreateOpenAICompatibleChatCompletion` (line 710) **sudah** delegate ke `CreateAPIRequest`, jadi billing + audit + idempotency udah jalan. Bukan bypass.

Yang sisa dari Round 1: **F1.3 (rate limiter compat routes)** dan **F1.4 (failure shape consistency)**. Dilipat ke Round 2 biar satu deploy = banyak fix.

---

## Round 2: High — Enforcement Gaps + Compat Hardening (HIGH)

**Objective:** Wire field schema yang sudah ada ke runtime path. Schema bilang ada limit/audit; bikin beneran enforced.

### Findings yang ditangani

- **F2.1** `DigiConnectUsageCounter` model + `IncrementUsageCounter` repo ada → zero caller. Wire ke `executeDigiConnectPipeline` post-success dengan scope `user_daily` + `api_key_daily`.
- **F2.2** `fairUseExceeded` di `DecideDigiConnectBilling` selalu hardcoded `false` (line 948). Compute beneran dari `UsageCounter` count vs `entitlement.DailyFairUseLimit`.
- **F2.3** `DigiConnectAPIKey.LastUsedAt` never written. Update setelah request sukses.
- **F2.4** `DigiConnectRequest.WalletReference` never written. Set dari `chargeWalletAfterRouterSuccess` reference string.

### Task 2.1: Repo helper untuk usage count read

**Files:**
- Modify: `premiumhub-api/internal/repository/digiconnect_repo.go`

Tambah `GetUsageCounter(userID uuid.UUID, apiKeyID *uuid.UUID, scope, window string) (*model.DigiConnectUsageCounter, error)`. Window format = `"daily:2026-05-17"` (ISO date) untuk daily fair use.

### Task 2.2: Wire fair-use check di pipeline

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go`

Sebelum `DecideDigiConnectBilling`, query `GetUsageCounter` scope `user_daily` window `daily:<today>`. Compute `fairUseExceeded := entitlement.DailyFairUseLimit > 0 && counter.Count >= int64(entitlement.DailyFairUseLimit)`. Pass ke `DecideDigiConnectBilling`.

### Task 2.3: Increment counter post-success

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go`

Setelah `request.Status = "completed"` dan `SaveRequest` sukses, panggil 2x `IncrementUsageCounter`:
- `{Scope: "user_daily", Window: "daily:" + today, ResetAt: tomorrow midnight, UserID: key.UserID, APIKeyID: nil}`
- `{Scope: "api_key_daily", Window: "daily:" + today, ResetAt: tomorrow midnight, UserID: key.UserID, APIKeyID: &key.ID}`

Wrap di `defer` atau separate goroutine? **Pilih sync** biar konsisten dengan request row state (kalau goroutine fail, counter drift).

### Task 2.4: Update LastUsedAt + WalletReference

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go`

Setelah upstream sukses:
- `key.LastUsedAt = &completedAt; repo.SaveAPIKey(key)`
- `request.WalletReference = "digiconnect:" + request.ID.String() + ":charge"` (sebelum SaveRequest final)

### Round 2 Verification

- [ ] Test request dengan entitlement `DailyFairUseLimit: 2`, kirim 3 request → request ke-3 dapet `FAIR_USE_LIMIT_REACHED` 429
- [ ] Setelah request sukses, `digiconnect_api_keys.last_used_at` populated
- [ ] `digiconnect_requests.wallet_reference` populated untuk billing_source=wallet rows
- [ ] `digiconnect_usage_counters` table grow per success request

---

## Round 3: Medium — Reliability + Observability (MEDIUM)

**Objective:** Tutup gap reliability: stuck pending_verification, charge-save race, fake health probe.

### Findings yang ditangani

- **F3.1** Tidak ada reconciler buat `pending_verification`. Stuck forever.
- **F3.2** Charge tx + SaveRequest beda transaction → race window kalo crash di antara.
- **F3.3** `RouterHealth` cuma return `{"status": "not_checked"}` — fake probe.
- **F3.4** `callRouter` no retry/no circuit breaker.

### Task 3.1: Pending-verification reconciler worker

**Files:**
- Create: `premiumhub-api/internal/worker/digiconnect_reconciler.go`
- Modify: `premiumhub-api/cmd/api/main.go` (or wherever workers start)

Worker yang setiap 60 detik:
1. Load `DigiConnectRequest` where `status = 'pending_verification' AND created_at < now - 2m AND created_at > now - 24h`
2. Per row: re-call router dengan `ExternalID` atau `RouterCorrelationID` (kalau ada), atau finalize ke `failed` setelah `created_at < now - 30m`
3. Update billing_status accordingly

### Task 3.2: Bundle charge + save dalam satu wallet tx

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go`

Refactor `chargeWalletAfterRouterSuccess` jadi `chargeAndFinalize(ctx, request, amount)` yang dalam satu `walletRepo.Transaction`:
1. Lock user
2. Cek ledger reference (idempotency)
3. Debit user balance
4. Create ledger entry
5. **Save request** dengan `BillingStatus = charged`, `WalletReference = reference`, `Status = completed`

### Task 3.3: Real RouterHealth probe

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` line 589-595

Cache 30 detik. HTTP HEAD/GET ke `cfg.DigiConnectRouterBaseURL + "/health"` atau `/v1/models`. Return `{"status": "ok"|"degraded"|"down", "checked_at": ts, "latency_ms": X}`.

### Task 3.4: callRouter retry policy

**Files:**
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` line 1052

Wrap `httpClient.Do` dengan max 2 retry untuk network-level error (tidak untuk 5xx body). Backoff 200ms.

### Round 3 Verification

- [ ] Manual: bikin request pending_verification (matikan router) → setelah 2 menit reconciler finalize
- [ ] Concurrency test: 5 request paralel → ledger entries match request count, no double-debit
- [ ] `/admin/digiconnect/router/health` real HTTP probe
- [ ] Network blip simulation: restart router → request retry sukses

---

## Round 4: Low — Polish + Cleanup (LOW)

**Objective:** Distinguish 404/500, add indexes, decide fate of dead schema fields.

### Findings yang ditangani

- **F4.1** `RevokeAPIKey` handler return generic 404 untuk semua repo error.
- **F4.2** Composite index `(user_id, status, expires_at)` di entitlement bisa improve hot query.
- **F4.3** Dead fields: `AbuseScore`, `AbuseReason`, `RateLimitResult`, `RateLimitRule`, `ConcurrencySlotAcquired`. Decision: keep + wire OR drop.

### Task 4.1: Distinguish error di RevokeAPIKey

**Files:**
- Modify: `premiumhub-api/internal/handler/digiconnect_handler.go` line 76

```go
if err != nil {
    if errors.Is(err, gorm.ErrRecordNotFound) {
        response.NotFound(c, "API key tidak ditemukan")
        return
    }
    response.InternalError(c, "Gagal cabut API key")
    return
}
```

### Task 4.2: Add composite index

**Files:**
- Modify: `premiumhub-api/internal/model/digiconnect.go` (struct tags) atau migration file

Field-level tag: `gorm:"index:idx_digiconnect_entitlement_active,priority:1"` di UserID, Status, ExpiresAt.

### Task 4.3: Dead schema decision

User decision: keep stub (Round 4.5 implement) atau drop. Default rekomendasi gue: **keep AbuseScore + RateLimitResult, drop ConcurrencySlotAcquired**. Reason: abuse + rate-limit punya path implementation yang straightforward dari middleware result; concurrency slot butuh redis lock infrastructure yang gak ada baseline-nya.

---

## Status Legend

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked / decision needed

## Current Status

| Round | Status | Workspace Baseline | Live Baseline |
|-------|--------|--------------------|---------------|
| Round 1 | `[x]` (folded into Round 2) | — | — |
| Round 2 | `[x]` deployed | `14d400eb` | `413f7b23` |
| Round 3 | `[x]` deployed | `9bcf7fa4` | `413f7b23` |
| Round 4 | `[x]` deployed | `dfe7eb60` | `413f7b23` |

## Current Next Step

Awaiting user smoke test workspace + `gas live` approval untuk promote Round 2+3+4 ke production via `bash ./deploy.sh`.

## Notes

- Local Windows = no CGO, sqlite-backed Go test harus di rdpkhorur
- Workspace push pake relay flow `agent-relay-<sha>` kalo direct push reject
- Workspace cherry-pick pattern untuk CRLF-tainted Windows commits
- Test command rdpkhorur: `cd /tmp/<copy> && CGO_ENABLED=1 go test ./internal/service -run TestDigiConnect`
