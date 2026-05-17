# DigiConnect Backend Hardening — Phase 2 Roadmap (DRAFT)

> **Status:** DRAFT — awaiting user review and explicit `gas` per-round before execution.
> **Pre-req:** Phase 1 (Round 2 + 3 + 4) sudah deployed di workspace `dfe7eb60`, awaiting `gas live` untuk promote.
> **Phase 1 plan:** `.kiro/steering/digiconnect-backend-hardening.md`
> **For Hermes:** Use `subagent-driven-development` + `external-api-pipeline-audit-and-harden` skills if executing.

## Context

Phase 1 nutup gap "production-ready untuk traffic skala saat ini". Phase 2 cover gap "production-ready untuk scale + multi-tenant + enterprise". Tujuannya bukan ngebut — tiap round di sini cuma layak dieksekusi kalo ada use-case nyata yang butuh. Premature scaling = waste.

Phase 2 dibagi 4 round (5 → 8). Sama format kayak Phase 1: Critical/High/Medium/Low severity, satu round per deploy, workspace-first.

## Severity Categorization

| Round | Severity | Theme | Trigger to start |
|-------|----------|-------|------------------|
| Round 5 | HIGH | Idempotency-Key header + per-API-key rate limit | Klien retry-on-network-error mulai bikin double-charge complaint, atau enterprise klien minta deterministic retry |
| Round 6 | MEDIUM | Refund flow + provider failover | Beneran ada incident "9router down 30m → request abandoned tapi wallet ke-debit", atau ada provider B yang siap dipake |
| Round 7 | MEDIUM | Concurrency slot per-API-key + abuse score | Ada klien fire 100+ req paralel via 1 key, atau ada attack pattern (geo anomali, prompt injection burst) |
| Round 8 | LOW | Webhook completion + per-tenant config + immutable audit log | Klien enterprise minta async result delivery atau custom limit, atau audit/compliance requirement masuk |

## Status Tracker

| Round | Status | Workspace Baseline | Live Baseline |
|-------|--------|--------------------|---------------|
| Round 5 | `[ ]` not started | — | — |
| Round 6 | `[ ]` not started | — | — |
| Round 7 | `[ ]` not started | — | — |
| Round 8 | `[ ]` not started | — | — |

## Current Next Step

User review draft → pilih round mana dulu (atau skip ke priority lain) → kasih `gas R5` / `gas R6` / dst untuk start eksekusi per round.

---

## Round 5 — Idempotency-Key + Per-API-Key Rate Limit (HIGH)

**Goal:** Klien bisa kirim `Idempotency-Key: <uuid>` header standar (Stripe/Square style) untuk deterministic retry, dan rate limit di-scope per-key bukan per-IP.

**Why now:** Per-IP rate limit hari ini saling kena untuk klien share IP (NAT/VPN/corporate office). Klien dengan IP rotating gak ke-throttle. Idempotency-Key field standard di industri proxy API — gak ada = klien gak bisa safely retry network errors.

### F5.1 Idempotency-Key request dedupe (1 deploy)

**Scope:**
- New table `digiconnect_idempotency_keys`:
  ```sql
  CREATE TABLE digiconnect_idempotency_keys (
      key VARCHAR(255) PRIMARY KEY,           -- header value, scoped by api_key_id
      api_key_id UUID NOT NULL,
      request_id UUID NOT NULL,                -- FK to digiconnect_requests
      response_snapshot JSONB,                 -- full response body
      response_status INT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL          -- TTL 24h
  );
  CREATE INDEX idx_idempotency_expiry ON digiconnect_idempotency_keys(expires_at);
  ```
- Middleware `IdempotencyKeyMiddleware`:
  - Read `Idempotency-Key` header (optional, alphanumeric+dash, max 255 char)
  - Hash key with `api_key_id` to prevent cross-tenant leak: `SHA256(api_key_id + key)`
  - If exists in table → return cached `response_snapshot` + `response_status` immediately (no upstream call, no charge)
  - If not exists → process request, on success store snapshot
- Cleanup worker: delete expired rows (TTL 24h) — reuse reconcile worker or new sweeper

**Files:**
- Create: `premiumhub-api/internal/model/digiconnect_idempotency.go`
- Create: `premiumhub-api/internal/repository/digiconnect_idempotency_repo.go`
- Modify: `premiumhub-api/internal/middleware/digiconnect_idempotency.go` (new)
- Modify: `premiumhub-api/internal/routes/router.go` (wire middleware before billing)
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (store response after `chargeWalletAndFinalize`)

**Verification:**
- POST 2x identik dengan same `Idempotency-Key` → second response sama persis dengan first, wallet cuma kena debit 1x
- POST 2x identik tanpa header → 2 charge (current behavior)
- POST identik dengan beda Idempotency-Key → 2 charge

### F5.2 Per-API-key rate limit (1 deploy)

**Scope:**
- Reuse data dari `digiconnect_usage_counters` (sudah ada Round 2) atau extend dengan window minute/hour
- New middleware `APIKeyRateLimitMiddleware` after auth:
  - Compute window key per-minute (`minute:<UTC YYYY-MM-DD-HH-MM>`)
  - Increment + check vs `entitlement.PerKeyRateLimitPerMinute` (new field)
  - If exceeded → 429 with `Retry-After` header
- Add fields to `DigiConnectEntitlementPlan`:
  - `PerKeyRateLimitPerMinute INT DEFAULT 60`
  - `PerKeyRateLimitPerHour INT DEFAULT 1000`
- Headers in response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Files:**
- Modify: `premiumhub-api/internal/model/digiconnect.go` (add 2 fields ke entitlement plan)
- Modify: `premiumhub-api/internal/repository/digiconnect_repo.go` (add `GetUsageCounterMinute` helper or generic with window param)
- Create: `premiumhub-api/internal/middleware/digiconnect_apikey_ratelimit.go`
- Modify: `premiumhub-api/internal/routes/router.go` (chain after auth, before fair-use)

**Verification:**
- Burst 100 request dalam 1 menit pake 1 key → setelah ke-60 dapet 429
- Burst dari 2 key beda → keduanya independent (gak saling block)
- Header `X-RateLimit-Remaining` count down per request

**Risk:** Counter increment sebelum upstream call → kalo upstream fail user tetep "kena charge" budget rate. Mitigation: increment atomic, decrement di UPSTREAM_ERROR branch. Atau accept (industry standard: rate limit count semua request, sukses/gagal).

---

## Round 6 — Refund Flow + Provider Failover (MEDIUM)

**Goal:** Auto-refund untuk request yang `PENDING_VERIFICATION_ABANDONED` setelah wallet ke-debit, dan multi-provider routing dengan failover otomatis.

**Why now:** Reconcile worker Phase 1 cuma flip status ke `failed`, gak refund. Edge case: callback ilang → reconcile abandoned → user bayar tanpa hasil. Provider failover butuh kalo 9router beneran down 30m+, gak ada fallback = full outage.

### F6.1 Auto-refund untuk abandoned request (1 deploy)

**Scope:**
- Refund hanya kalo `request.BillingStatus == "charged" && status == "failed"` setelah reconcile
- New service method `RefundRequest(ctx, requestID, reason)`:
  ```go
  // dalam wallet tx:
  // 1. lock user
  // 2. find ledger entry by reference (digiconnect:<request_id>)
  // 3. if exists, create reverse ledger entry (credit user)
  // 4. update request: BillingStatus="refunded", RefundedAt=now, RefundReason=reason
  // 5. idempotent: check if reverse ledger already exists → skip
  ```
- Wire ke reconcile worker: setelah mark `PENDING_VERIFICATION_ABANDONED`, call `RefundRequest`
- Admin endpoint `POST /api/admin/digiconnect/requests/:id/refund` untuk manual refund (incident response)
- New field `digiconnect_requests.refund_reference` (text, links ke reverse ledger entry)

**Files:**
- Modify: `premiumhub-api/internal/model/digiconnect.go` (add `RefundedAt`, `RefundReason`, `RefundReference`)
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (`RefundRequest` method)
- Modify: `premiumhub-api/internal/service/digiconnect_reconcile_worker.go` (call RefundRequest pada abandoned branch)
- Modify: `premiumhub-api/internal/handler/digiconnect_admin_handler.go` (admin refund endpoint, new file or extend existing)
- Modify: `premiumhub-api/internal/routes/router.go`

**Verification:**
- Force 1 request ke abandoned (set CompletedAt manual lebih dari 30m, status pending) → reconcile run → wallet balance restored, ledger ada 2 entry (debit + reverse credit), request status `failed` BillingStatus `refunded`
- Run reconcile 2x untuk request yang sama → cuma 1 refund (idempotent)

### F6.2 Provider failover (1 deploy)

**Scope:**
- New table `digiconnect_providers`:
  ```sql
  CREATE TABLE digiconnect_providers (
      id UUID PRIMARY KEY,
      name VARCHAR(64),                    -- '9router-primary', '9router-eu', etc
      base_url TEXT,
      health_path TEXT DEFAULT '/api/health',
      priority INT DEFAULT 100,            -- lower = preferred
      is_active BOOLEAN DEFAULT true,
      health_status VARCHAR(16) DEFAULT 'unknown',
      last_health_check TIMESTAMPTZ,
      consecutive_failures INT DEFAULT 0,
      created_at TIMESTAMPTZ
  );
  ```
- Service `ProviderRouter`:
  - Read active providers ordered by priority
  - Skip providers with `health_status='down'` and `consecutive_failures > 3`
  - Try first → on retryable error → try next
  - Update `consecutive_failures` on each call result
  - Health worker (separate from RouterHealth probe) sweeps every 30s
- Migrate existing single 9router config ke provider row (seed migration)
- Admin UI/API untuk add/disable provider (out of scope this round, do via SQL for now)

**Files:**
- Create: `premiumhub-api/internal/model/digiconnect_provider.go`
- Create: `premiumhub-api/internal/repository/digiconnect_provider_repo.go`
- Create: `premiumhub-api/internal/service/digiconnect_provider_router.go`
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (`callRouter` use ProviderRouter)
- Migration: seed initial provider row dari env config
- Modify: `premiumhub-api/internal/service/digiconnect_reconcile_worker.go` (extend to also probe all providers)

**Verification:**
- Add provider B (test endpoint), set primary to bad URL → request auto-route ke B
- Primary recover → next request prefer primary again (priority order)
- Both down → request fail dengan error code `ALL_PROVIDERS_UNAVAILABLE`

**Risk:** Multi-provider berarti response shape harus normalized (kalo provider B punya schema beda). Untuk Phase 2 asumsi provider B juga 9router-compatible (geo replicas). Cross-vendor adapter = Round 8+ scope.

---

## Round 7 — Concurrency Slot + Abuse Score (MEDIUM)

**Goal:** Cap konkurensi per-API-key (klien gak bisa fire 100 paralel pake 1 key) dan deteksi pattern abuse (sudden spike, geo anomali, prompt injection burst).

**Why now:** Klien malicious bisa multiplex 1 key ke ribuan parallel call → cost balloon untuk operator. Abuse detection = early warning sebelum bill shock.

**Pre-req:** Redis di production. Premium Hub belum jalanin Redis untuk DigiConnect (cuma fb-bot pake Redis 6382). Round ini block sampe redis-for-digiconnect ready.

### F7.1 Concurrency slot per-API-key (1 deploy, post-redis)

**Scope:**
- Redis-backed semaphore: key `digiconnect:slot:<api_key_id>`, value = current concurrent count, TTL per-slot 60s (auto-release if request hang)
- Middleware `ConcurrencySlotMiddleware` after rate limit:
  - `INCR digiconnect:slot:<api_key_id>` → if > `entitlement.MaxConcurrentRequests` (default 10) → 429 with code `CONCURRENCY_LIMIT_EXCEEDED`
  - On request finalize (defer in handler): `DECR digiconnect:slot:<api_key_id>`
- Wire `ConcurrencySlotAcquired` field in request model (Phase 1 dead schema, finally used)
- Failure mode: redis down → fail-open (skip check, log warning)

**Files:**
- Add: `premiumhub-api/internal/middleware/digiconnect_concurrency.go`
- Modify: `premiumhub-api/internal/model/digiconnect.go` (entitlement: `MaxConcurrentRequests INT DEFAULT 10`)
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (set `ConcurrencySlotAcquired=true` on success)
- Modify: `premiumhub-api/config/config.go` (`DIGICONNECT_REDIS_URL`, `DIGICONNECT_CONCURRENCY_FAIL_OPEN`)

**Verification:**
- Bench: 20 paralel request via 1 key, MaxConcurrentRequests=10 → 10 sukses, 10 dapet 429
- Redis stop mid-test → fail-open: semua request lewat (warning log)

### F7.2 Abuse score baseline (1 deploy)

**Scope:**
- Abuse score = simple weighted sum:
  - +10 per 5xx upstream response (klien retry storm)
  - +5 per req dari new IP (haven't seen in 24h)
  - +3 per req dengan prompt > 50K chars (potential prompt injection)
  - +1 per req dengan token output > expected (cost burner)
- Stored di `digiconnect_api_keys.abuse_score INT` (decay 10% per hour via worker)
- If `abuse_score > 1000` → auto-revoke key + alert admin (email/log)
- Wire field `AbuseScore` (Phase 1 dead schema)

**Files:**
- Modify: `premiumhub-api/internal/model/digiconnect.go`
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (compute increment in success/error path)
- Modify: `premiumhub-api/internal/service/digiconnect_reconcile_worker.go` (decay job)
- Add: `premiumhub-api/internal/handler/digiconnect_admin_abuse_handler.go` (admin endpoint untuk override/clear score)

**Verification:**
- Simulate 100 5xx response in row → abuse_score crosses threshold → key auto-revoked, alert log emitted
- Wait 1 hour → decay 10%

**Risk:** False-positive auto-revoke = user complaint. Mitigation: dry-run mode 1-2 minggu (log only, no auto-revoke), tune threshold based on real data, kemudian enable auto-action.

---

## Round 8 — Webhook + Per-Tenant Config + Immutable Audit (LOW)

**Goal:** Async webhook callback untuk klien yang gak mau polling, custom limit per-enterprise-customer, dan append-only audit log untuk compliance.

**Why now:** Cuma kalo enterprise klien minta. LOW priority kecuali ada B2B/compliance requirement.

### F8.1 Webhook completion delivery (1 deploy)

**Scope:**
- New field `digiconnect_api_keys.webhook_url TEXT` (per-key callback URL, optional)
- Webhook signature: HMAC-SHA256 dengan `webhook_secret` (per-key, generate on key create)
- On request finalize → enqueue webhook job: POST `webhook_url` dengan headers `X-DigiConnect-Signature`, `X-DigiConnect-Event`, body = full request response
- Retry 3x dengan exponential backoff, dead-letter ke DB after exhausted
- New table `digiconnect_webhook_deliveries` (id, request_id, attempt, status_code, last_attempted_at, last_error, delivered_at)

**Files:**
- Modify: `premiumhub-api/internal/model/digiconnect.go` (add `webhook_url`, `webhook_secret` ke api_key)
- Create: `premiumhub-api/internal/model/digiconnect_webhook.go`
- Create: `premiumhub-api/internal/service/digiconnect_webhook_dispatcher.go`
- Create: `premiumhub-api/internal/service/digiconnect_webhook_worker.go`
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (enqueue di success path)

**Verification:**
- Set webhook_url ke httpbin.org/post → trigger request → webhook delivered, signature valid (verify HMAC)
- Set webhook_url ke unreachable → 3 attempt, dead-letter row created

### F8.2 Per-tenant config override (1 deploy)

**Scope:**
- New table `digiconnect_tenant_overrides`:
  ```sql
  CREATE TABLE digiconnect_tenant_overrides (
      user_id UUID PRIMARY KEY,
      max_concurrent_requests INT,
      per_key_rate_limit_per_minute INT,
      daily_fair_use_limit INT,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
  );
  ```
- Service `ResolveEntitlementWithOverrides(userID)`:
  - Start dari plan default
  - Merge override (NULL = no override, value = replace)
  - Cache 60s in-memory (no redis dep)
- Admin endpoint `PUT /api/admin/digiconnect/tenant-overrides/:user_id`

**Files:**
- Create: `premiumhub-api/internal/model/digiconnect_tenant_override.go`
- Create: `premiumhub-api/internal/repository/digiconnect_tenant_override_repo.go`
- Modify: `premiumhub-api/internal/service/digiconnect_service.go`
- Add admin handler

### F8.3 Immutable audit log (1 deploy)

**Scope:**
- New table `digiconnect_audit_log` (append-only, no UPDATE/DELETE permission for app user):
  ```sql
  CREATE TABLE digiconnect_audit_log (
      id BIGSERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      event_type VARCHAR(64),              -- 'request.created', 'request.charged', 'key.revoked', etc
      user_id UUID,
      api_key_id UUID,
      request_id UUID,
      payload JSONB,
      prev_hash CHAR(64),                  -- SHA256 of previous row
      hash CHAR(64)                        -- SHA256(prev_hash + event_type + payload + timestamp)
  );
  GRANT INSERT, SELECT ON digiconnect_audit_log TO app_user;
  REVOKE UPDATE, DELETE ON digiconnect_audit_log FROM app_user;
  ```
- Hash chain: tiap row reference hash row sebelumnya → tampering detectable
- Service `EmitAuditEvent(eventType, payload)` dipanggil di pivot points: request created, charged, refunded, key created/revoked, override changed
- Admin endpoint `GET /api/admin/digiconnect/audit?from=...&to=...&event_type=...`
- Verify-chain script untuk compliance audit

**Files:**
- Create: `premiumhub-api/internal/model/digiconnect_audit.go`
- Create: `premiumhub-api/internal/repository/digiconnect_audit_repo.go`
- Create: `premiumhub-api/internal/service/digiconnect_audit_service.go`
- Modify: pivot points di service layer panggil EmitAuditEvent
- Migration: REVOKE UPDATE/DELETE setelah table created

**Verification:**
- Run 100 request → audit log punya 100+ rows dengan hash chain valid
- Manually UPDATE row di psql sebagai app_user → permission denied
- Verify-chain script run → all hashes match

---

## Cross-Round Concerns

### Skill catatan untuk eksekusi

Pake skill yang udah ada:
- `external-api-pipeline-audit-and-harden` — pattern catalog & pitfall list
- `subagent-driven-development` — dispatch fresh subagent per round
- `premium-hub-workspace-deploy` — workspace-first deploy flow
- `external-api-request-pipeline` — reference architecture

### Risk register

| Risk | Mitigation |
|------|------------|
| Round 5 idempotency table grow unbounded | TTL 24h via reconcile worker sweep |
| Round 5 per-key rate limit blocks legit burst (batch processing klien) | Tunable per-plan + admin override Round 8.2 |
| Round 6 refund double-credit | Idempotent via reverse-ledger reference check |
| Round 6 provider B response shape diff | Constrain to 9router-compatible providers only this phase |
| Round 7 redis dep adds infra surface | Fail-open mode + monitoring |
| Round 7 abuse score false-positive | Dry-run period sebelum auto-revoke |
| Round 8 webhook deliver to attacker URL | HMAC signature, validate webhook_url at set time, no internal addresses (IMDS, localhost) |
| Round 8 audit table size | Partition by month, archive ke S3 quarterly (out of scope phase 2) |

### Blocked / Pre-req

- Round 7 → blocked sampe Redis di-provision untuk DigiConnect
- Round 8.1 webhook → require outbound HTTP from Premium Hub server (firewall check)
- Round 8.3 audit → require GRANT/REVOKE migration script di prod (DBA review)

### Open Questions for User

1. **Round priority**: User mau eksekusi serial (5 → 6 → 7 → 8) atau pick-and-choose berdasarkan use case?
2. **Round 5 Idempotency-Key TTL**: 24h cukup, atau perlu lebih lama (klien mungkin retry hari berikutnya)?
3. **Round 6 provider failover**: ada provider B beneran (geo replica 9router) atau cuma teoritis untuk sekarang?
4. **Round 7 Redis**: provision dedicated instance untuk DigiConnect (port 6383?) atau share dengan fb-bot 6382?
5. **Round 8.1 webhook**: target klien siapa? Kalo cuma internal, mungkin pubsub/queue lebih cocok daripada HTTP webhook
6. **Round 8.3 audit**: ada compliance requirement spesifik (PCI? SOC 2? PSE Kominfo?), atau internal best-practice aja?
7. **Skip mana**: ada round yang user gak butuh sama sekali? Lebih baik prune sekarang daripada commit ke 4 round semua

### Acceptance Criteria untuk "Phase 2 done"

- [ ] All chosen rounds deployed ke workspace + smoke pass
- [ ] All chosen rounds deployed ke live + 7 hari observability tanpa incident
- [ ] LOCAL_AI_CONTEXT.md updated per round
- [ ] Roadmap status table di file ini updated
- [ ] Pattern dari setiap round masuk ke skill `external-api-pipeline-audit-and-harden`

---

## Notes

- Phase 2 BUKAN auto-execute. Tiap round butuh `gas R5` / `gas R6` / dst dari user.
- Estimate effort: R5 ~2 deploys (1-2 hari), R6 ~2 deploys (1-2 hari), R7 ~2 deploys (2 hari incl Redis setup), R8 ~3 deploys (2-3 hari). Total Phase 2 lengkap ~7-10 hari kerja.
- Kalo cuma butuh 1-2 round → bisa cherry-pick (e.g. R5 only kalo cuma butuh idempotency-key).
- Phase 1 belum live; Phase 2 baru layak start setelah Phase 1 promoted + observasi minimal 1 minggu di prod.
