# Gmail Marketplace — Production Runbook

**Status:** Production-ready (R6)
**Last updated:** 2026-05-20
**Owner:** Backend / Operations
**Plan reference:** `.kiro/steering/gmail-marketplace.md`

> Marketplace internal akun gmail: user setor akun fresh untuk dapat
> komisi (sell-side), user lain bisa beli untuk dipakai (buy-side).
> Backend: `premiumhub-api`. Frontend: `premiumhub-web`.

---

## 1. Pre-Promote Checklist

Jalankan checklist ini sebelum push ke production / sandbox-ubuntu.
Setiap item harus PASS untuk lanjut promote.

### 1.1 Database — schema

```sql
-- Verifikasi 5 tabel gmail ter-create dgn AutoMigrate:
\d+ gmail_accounts;
\d+ gmail_orders;
\d+ gmail_order_items;
\d+ gmail_claims;
\d+ gmail_pricing;
\d+ gmail_strikes;
```

Expected:
- `gmail_accounts`: 24+ kolom termasuk `password_enc`, `status`, `submitted_at`,
  `verified_at`, `sold_at`, `sold_price`, `disposed_reason`, `version` (optimistic lock)
- `gmail_orders`: `qty`, `unit_price`, `discount_pct`, `total_amount`,
  `warranty_deadline`, `status`
- `gmail_order_items`: snapshot `email_snapshot`, `password_snapshot_enc`,
  `gmail_account_id`, `replaced_by_account_id`
- `gmail_claims`: `reason`, `status`, `resolved_at`, `replacement_account_id`,
  `refund_amount`
- `gmail_pricing`: 1 row default seed (cek `ensureDefaultGmailPricing`)
- `gmail_strikes`: `user_id`, `gmail_id`, `created_at` index

### 1.2 Database — backfill safety

```sql
-- Wajib zero rows BEFORE first promote (gmail belum live):
SELECT
  (SELECT COUNT(*) FROM gmail_accounts) AS accounts,
  (SELECT COUNT(*) FROM gmail_orders) AS orders,
  (SELECT COUNT(*) FROM gmail_claims) AS claims;
-- Expected: 0, 0, 0

-- Pricing seed (otomatis dari ensureDefaultGmailPricing):
SELECT id, buy_price, sell_price, low_inventory_threshold, updated_at
FROM gmail_pricing;
-- Expected: 1 row dgn buy=10000, sell=15000, threshold=20 (defaults)
```

Kalau ada row sebelum first promote, **STOP** — investigate dulu. Bisa jadi
prior dev/staging deploy bocor data ke prod DB.

### 1.3 Encryption key

```bash
# Verify ENCRYPTION_KEY ada di env (32-byte hex untuk AES-256-GCM):
echo "${ENCRYPTION_KEY}" | wc -c
# Expected: 65 (64 hex chars + newline)

# Wajib SAMA di semua API instance kalau multi-replica.
# Loss/rotate key = SEMUA password_enc unreadable. Backup ke pengelola
# rahasia (1Password, Vault) sebelum deploy.
```

⚠️ **Critical:** Kalau ENCRYPTION_KEY hilang di production, password lama
TIDAK BISA di-decrypt. Schema migration tidak menyelamatkan ini.
Backup dulu di vault before promote.

### 1.4 Environment variables

```bash
# Required dgn defaults (cek config/config.go):
GMAIL_BUY_MAX_QTY_PER_ORDER=50          # max qty per buy order
GMAIL_WARRANTY_HOURS=24                 # warranty window
GMAIL_LOW_INV_CHECK_MINUTES=30          # worker tick interval
GMAIL_LOW_INV_COOLDOWN_HOURS=6          # alert cooldown
GMAIL_SELL_RATE_LIMIT_PER_MIN=10        # sell-side write rate limit
GMAIL_SLOT_TTL_HOURS=24                 # slot expiry (R1)
GMAIL_STRIKE_BAN_DAYS=30                # ban duration
GMAIL_STRIKE_BAN_THRESHOLD=3            # 3 strikes/30day = ban
```

### 1.5 Service health

```bash
# Backend running:
curl -sf http://localhost:8080/api/v1/health | jq .
# Expected: {"status":"ok",...}

# Workers spawned (check log on startup):
grep -E "Started Gmail (slot expiry|low inventory) worker" /var/log/premiumhub-api.log
# Expected: 2 lines
```

### 1.6 Auth + endpoints

```bash
# Sell-side endpoints (user JWT):
GET    /api/v1/me/gmail/availability         # quota check
POST   /api/v1/me/gmail/slots                # request slot
PUT    /api/v1/me/gmail/slots/:id/submit     # submit creds
GET    /api/v1/me/gmail/slots                # list my slots
GET    /api/v1/me/gmail/slots/:id            # detail
DELETE /api/v1/me/gmail/slots/:id            # cancel pending

# Buy-side endpoints (user JWT):
GET    /api/v1/gmail/pricing                 # public pricing + tiers
GET    /api/v1/gmail/availability            # public stock count
POST   /api/v1/me/gmail/orders               # create order (atomic claim)
GET    /api/v1/me/gmail/orders               # my orders list
GET    /api/v1/me/gmail/orders/:id           # order detail w/ items

# Warranty (user JWT):
POST   /api/v1/me/gmail/orders/:id/items/:itemId/claim  # raise claim
GET    /api/v1/me/gmail/claims               # my claims

# Admin endpoints (admin JWT):
GET    /api/v1/admin/gmail                   # verify queue
GET    /api/v1/admin/gmail/:id               # detail
GET    /api/v1/admin/gmail/:id/credentials   # decrypted (audit-logged)
POST   /api/v1/admin/gmail/:id/verify        # verify w/ password change
POST   /api/v1/admin/gmail/:id/reject        # reject + strike
GET    /api/v1/admin/gmail-inventory         # browse all
GET    /api/v1/admin/gmail-pricing           # current pricing
PUT    /api/v1/admin/gmail-pricing           # update pricing
GET    /api/v1/admin/gmail-strikes           # users w/ active strikes
POST   /api/v1/admin/gmail-strikes/:userID/reset  # clear strikes
GET    /api/v1/admin/gmail-analytics         # weekly stats
```

Verify auth boundary dgn unauthenticated request → 401.
Verify admin endpoint dgn user JWT → 403.

### 1.7 Frontend routes

```bash
# User-facing:
/dashboard/gmail                              # hub (tab Beli|Jual)
/dashboard/gmail/sell/slots/:id               # slot detail (countdown)
/dashboard/gmail/buy/orders/:id               # order detail (creds + claim)

# Admin:
/admin/gmail                                  # admin hub
/admin/gmail/verifikasi                       # verify queue
/admin/gmail/inventory                        # inventory browser
/admin/gmail/pricing                          # pricing config
/admin/gmail/strikes                          # active strikes
/admin/gmail/analytics                        # weekly stats
```

Verify Next.js build clean: `npx next build` → no compilation errors.
Verify TS strict: `npx tsc --noEmit` → zero errors.

### 1.8 Tests passing

```bash
cd premiumhub-api
go test ./internal/service/ ./internal/repository/ ./internal/handler/ -count=1 2>&1 | tail -5
# Expected: all 3 packages "ok"

# Specifically the 46 gmail tests:
go test ./internal/service/ -run "TestGmail" -v 2>&1 | grep -E "^=== RUN|^--- (PASS|FAIL)" | wc -l
# Expected: 46+ test entries
```

---

## 2. Smoke Test Plan

Run after promote to verify end-to-end. Tiap step di-execute manual via UI
atau curl. Setiap step harus PASS before dianggap LIVE.

### 2.1 Pricing seeded

```bash
curl -sf https://api.premium-hub.example.com/api/v1/gmail/pricing | jq .
# Expected: success=true, data.buy_price>0, data.sell_price>0
```

### 2.2 User happy path — sell-side

```
1. Login user A
2. Goto /dashboard/gmail → tab "Jual"
3. Klik "Setor Gmail Baru"
4. Lihat availability — quota tersedia? ya → klik "Request Slot"
5. Slot ter-create dgn TTL 24h, status=pending_create
6. Submit form: email + password
7. Check /dashboard/gmail/sell/slots/:id → countdown + status=pending_verify
```

### 2.3 Admin verify

```
1. Login admin
2. Goto /admin/gmail/verifikasi
3. Klik akun A dari queue
4. Login test manual ke accounts.google.com pakai creds
5. Klik "Verify" → set password baru → submit
6. Check user A wallet: pendapatan += buy_price
7. Check gmail_accounts row → status=verified, sold_at=null
```

### 2.4 User happy path — buy-side

```
1. Login user B
2. Goto /dashboard/gmail → tab "Beli"
3. Pilih qty (1-50), confirm total
4. Submit order → wallet utama charged, status=delivered
5. Goto /dashboard/gmail/buy/orders/:id
6. Lihat creds di order items, copy email + password (eye toggle reveal)
7. Login ke accounts.google.com → SUKSES
```

### 2.5 Buy concurrent — race safety

```bash
# Bikin 100 verified slots manual via DB, set buyer wallet 5jt
# Race: 5 user beli qty=20 bersamaan
for i in {1..5}; do
  curl -sX POST .../api/v1/me/gmail/orders \
    -H "Authorization: Bearer ${BUYER_$i}" \
    -d '{"qty":20}' &
done
wait
# Expected: max 5 success (100/20=5). 6th = "stok habis" 409 Conflict.
# Verify: 100 gmail_accounts SELECT FOR UPDATE → tidak ada double-spend.
```

### 2.6 Warranty claim happy path

```
1. User B raise claim dlm 24h:
   POST /me/gmail/orders/:id/items/:itemId/claim
   { reason: "login_fail", note: "creds nol" }
2. Status item → claim_pending
3. Admin verify (manual): kalau valid, replace dgn akun fresh dari
   verified pool, update gmail_order_items.replaced_by_account_id
4. User B refresh order detail → creds baru, status=replaced
5. Kalau gak ada replacement: refund_amount → wallet utama buyer
```

### 2.7 Warranty deadline — auto-resolve

```
# Set order warranty_deadline ke 1 menit lalu (manual SQL update untuk test)
# Tunggu warranty worker tick (default 5 min interval)
# Expected: status=warranty_expired, claims auto-rejected
```

### 2.8 Strike + ban path

```
1. User C submit slot dgn creds invalid 3x dlm 30 hari
2. Admin reject 3x dgn reason
3. Check gmail_strikes: 3 row utk user C
4. User C try request slot → 403 "BANNED until {date}"
5. Admin clear ban via /admin/gmail/strikes/:userID/reset
6. User C bisa request slot lagi
```

### 2.9 Auth boundary

```bash
# User token try admin endpoint:
curl -i -X GET .../api/v1/admin/gmail \
  -H "Authorization: Bearer ${USER_TOKEN}"
# Expected: 403 Forbidden

# No token:
curl -i .../api/v1/me/gmail/availability
# Expected: 401 Unauthorized
```

### 2.10 Pricing update propagation

```
1. Admin goto /admin/gmail/pricing
2. Change sell_price 15000 → 16000
3. Klik Simpan
4. User refresh /dashboard/gmail tab Beli → harga 16000 muncul (cache TTL?)
5. Buy 1 → wallet charged 16000 (bukan 15000)
```

---

## 3. Post-Launch Monitoring (Minggu 1)

Daily checklist untuk 7 hari pertama setelah promote.

### 3.1 Inventory health

```sql
-- Verified stok harian:
SELECT DATE(verified_at) AS day, COUNT(*) AS verified_count
FROM gmail_accounts
WHERE verified_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(verified_at) ORDER BY day DESC;

-- Sold velocity:
SELECT DATE(sold_at) AS day, COUNT(*) AS sold_count, SUM(sold_price) AS revenue
FROM gmail_accounts
WHERE sold_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(sold_at) ORDER BY day DESC;

-- Current verified pool:
SELECT COUNT(*) FROM gmail_accounts WHERE status='verified';
-- Watch threshold dari gmail_pricing.low_inventory_threshold.
-- Kalau < threshold, log alert sudah keluar (cek log).
```

### 3.2 Verify queue lag

```sql
-- Akun pending_verify tertua:
SELECT id, email, submitted_at,
       NOW() - submitted_at AS age
FROM gmail_accounts
WHERE status='pending_verify'
ORDER BY submitted_at ASC LIMIT 10;
-- Healthy: age < 6 jam
-- Warning: age > 12 jam → admin slow
-- Alert: age > 24 jam → user akan complaint
```

### 3.3 Order + warranty audit

```sql
-- Order summary 7 hari:
SELECT
  status,
  COUNT(*) AS orders,
  SUM(total_amount) AS revenue,
  AVG(qty) AS avg_qty
FROM gmail_orders
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status;

-- Claim rate (warranty quality signal):
SELECT
  COUNT(*) FILTER (WHERE status='replaced') AS replaced,
  COUNT(*) FILTER (WHERE status='refunded') AS refunded,
  COUNT(*) FILTER (WHERE status='rejected') AS rejected,
  COUNT(*) FILTER (WHERE status='pending') AS pending,
  COUNT(*) AS total
FROM gmail_claims
WHERE created_at >= NOW() - INTERVAL '7 days';
-- Healthy: replaced+refunded < 10% of items sold
-- Warning: > 20% → akun jelek di pool, cek admin verify quality
```

### 3.4 Strike + ban distribution

```sql
-- Active strikes per user (banned next):
SELECT u.email,
       COUNT(s.id) AS active_strikes,
       u.gmail_banned_until
FROM users u
JOIN gmail_strikes s ON s.user_id=u.id
WHERE s.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, u.gmail_banned_until
HAVING COUNT(s.id) >= 2
ORDER BY active_strikes DESC;
-- Watch: user dgn 2 strike (1 strike lagi = ban)
```

### 3.5 Wallet ledger reconciliation

```sql
-- Total komisi seller dibayar:
SELECT SUM(amount)
FROM wallet_ledger
WHERE source_kind='gmail_sell'
  AND created_at >= NOW() - INTERVAL '7 days';

-- Total revenue dari buyer:
SELECT SUM(amount)
FROM wallet_ledger
WHERE source_kind='gmail_buy'
  AND created_at >= NOW() - INTERVAL '7 days';

-- Refund warranty:
SELECT SUM(amount)
FROM wallet_ledger
WHERE source_kind='gmail_refund'
  AND created_at >= NOW() - INTERVAL '7 days';

-- Margin sanity check (revenue - cost - refund):
-- Bandingkan dgn /admin/gmail/analytics totals.margin
```

### 3.6 Worker liveness

```bash
# Slot expiry worker:
grep "Gmail slot expiry tick" /var/log/premiumhub-api.log | tail -5
# Expected: tick tiap 5 menit, "expired N slots" kalau ada

# Low inventory worker:
grep "Gmail low inventory tick" /var/log/premiumhub-api.log | tail -5
# Expected: tick tiap 30 menit, "ALERT verified=X < threshold=Y" kalau low

# Warranty auto-resolve worker:
grep "Gmail warranty deadline" /var/log/premiumhub-api.log | tail -5
# Expected: tick periodic, "auto-resolved N orders" kalau ada
```

---

## 4. Rollback Plan

Kalau ada bug critical pasca-promote, rollback bertahap.
Goal: hentikan bug spread, preserve data, recover safely.

### 4.1 Disable user entry points (frontend)

Quick win: tutup tab Jual/Beli tanpa rebuild API.

```bash
# Hidden via feature flag — set di runtime config:
NEXT_PUBLIC_GMAIL_ENABLED=false
# Restart Next.js → tab Jual/Beli grayed out + banner maintenance
```

### 4.2 Disable POST endpoints (backend)

Lebih kuat: tolak semua write operation Gmail.

```go
// Quick patch di middleware:
api.Use(func(c *gin.Context) {
  if strings.HasPrefix(c.Request.URL.Path, "/api/v1/me/gmail") &&
     c.Request.Method != "GET" {
    response.ServiceUnavailable(c, "Gmail marketplace disabled — maintenance")
    c.Abort()
    return
  }
  c.Next()
})
```

Restart API. User existing tetap bisa GET (read order, lihat creds), tapi
tidak bisa create order/slot baru.

### 4.3 Stop workers

Kalau worker bermasalah (looping, racing):

```bash
# Set env var → restart API:
GMAIL_LOW_INV_CHECK_MINUTES=99999  # effectively disable
# Slot expiry pakai constant 5min, tidak bisa env-disable, harus rebuild.
```

### 4.4 Disable single endpoint via DB

Kalau pricing PUT bermasalah:

```sql
-- Lock pricing update (admin gak bisa change):
ALTER TABLE gmail_pricing ADD CONSTRAINT readonly CHECK (FALSE);
-- Restore later: ALTER TABLE gmail_pricing DROP CONSTRAINT readonly;
```

### 4.5 Manual refund (worst case)

Kalau order bermasalah masal, refund manual:

```sql
-- 1. List affected orders
SELECT id, user_id, total_amount, created_at
FROM gmail_orders
WHERE created_at BETWEEN '2026-05-20 00:00' AND '2026-05-20 06:00'
  AND status='delivered';

-- 2. Untuk tiap order, jalankan transaction:
BEGIN;
UPDATE gmail_orders SET status='refunded' WHERE id=$ORDER_ID;
INSERT INTO wallet_ledger(...) VALUES (
  $USER_ID, 'gmail_refund_manual', $REFUND_AMOUNT, ...
);
UPDATE wallet SET utama_balance = utama_balance + $REFUND_AMOUNT
  WHERE user_id=$USER_ID;
COMMIT;
```

⚠️ **Always wrap dlm transaction.** Jangan partial update.

### 4.6 Full rollback (revert deploy)

Kalau patch tidak sufficient:

```bash
# 1. Identify last good commit before Gmail R1:
git log --oneline | grep -B 1 "feat(gmail): sell-side"
# → commit hash X (pre-gmail)

# 2. Revert all gmail commits (15 commits):
git revert --no-commit 78e91c42..HEAD
git commit -m "revert: rollback Gmail marketplace R1-R6 (incident YYYY-MM-DD)"
git push origin main

# 3. Rebuild + redeploy
# 4. Note: AutoMigrate tidak DROP table, gmail_* tetap ada di DB.
#    Aman karena no code reference. Drop manual nanti kalau confirm
#    tidak rollforward.
```

---

## 5. Quick Reference

```
DATABASE TABLES
─────────────────────────
gmail_accounts        Inventory akun (sell + buy lifecycle)
gmail_orders          Buy order header
gmail_order_items     Buy order line dgn snapshot creds
gmail_claims          Warranty klaim tracking
gmail_pricing         1 row config (buy/sell/threshold/tiers)
gmail_strikes         Audit trail rejection (untuk ban logic)

CRITICAL BACKGROUND WORKERS
─────────────────────────
gmail_slot_expiry         5 min   Mark expired slots, refund quota
gmail_warranty_deadline   tick    Auto-resolve overdue claims
gmail_low_inventory_alert 30 min  Log alert kalau verified < threshold

CONFIG ENV VARS
─────────────────────────
ENCRYPTION_KEY                   AES-256 key (32-byte hex)
GMAIL_BUY_MAX_QTY_PER_ORDER      50 default
GMAIL_WARRANTY_HOURS             24 default
GMAIL_LOW_INV_CHECK_MINUTES      30 default
GMAIL_LOW_INV_COOLDOWN_HOURS     6 default
GMAIL_SLOT_TTL_HOURS             24 default
GMAIL_STRIKE_BAN_DAYS            30 default
GMAIL_STRIKE_BAN_THRESHOLD       3 default

ALERTING TRIGGERS (manual setup)
─────────────────────────
- pending_verify queue age > 24h        → admin slow
- claim rate > 20%                       → akun pool jelek
- low inventory log line                 → restock seller
- verify error rate > 5%                 → bug atau spammer
- strike rate spike 3x baseline          → spammer wave
```

### Common operator commands

```bash
# Restart API (workers respawn):
sudo systemctl restart premiumhub-api

# Check verify queue size:
psql -c "SELECT COUNT(*) FROM gmail_accounts WHERE status='pending_verify';"

# Manual force-expire stuck slot:
psql -c "UPDATE gmail_accounts SET status='expired' WHERE id='$SLOT_ID' AND status='pending_create';"

# Read encrypted password (admin needs it for verify):
# Use admin endpoint, not raw DB query — audit log automatic:
curl -sf -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  https://api.../admin/gmail/${SLOT_ID}/credentials | jq .
```

---

## 6. References

- Plan: `.kiro/steering/gmail-marketplace.md` (650+ LOC plan dokumen)
- Skill: `~/.hermes/skills/devops/premium-hub-ops/` — development conventions
- WD runbook: `.kiro/runbooks/wallet-withdraw-runbook.md` (pattern referensi)
- Smoke script: `scripts/gmail-marketplace-smoke.sh`
- Backend code: `premiumhub-api/internal/{model,repository,service,handler}/gmail_*.go`
- Frontend code: `premiumhub-web/src/{app,services,types}/**/gmail*`
- Tests: `premiumhub-api/internal/{service,repository,handler}/gmail_*_test.go` (46 tests)

### Audit history

| Round | Commit | Tests | Audit |
|-------|--------|-------|-------|
| R1 | 78e91c42 + d19d3a76 | 12 sell-side | TOCTOU + auth + money |
| R2 | 9c06ba65 | 12 buy-side | concurrency + race |
| R3 | 055d3224 | 12 warranty | refund flow |
| R4 | a8efcb30 + d06c1e2e | (FE) | a11y + edge + sec |
| R5 | 24dd47d0 + 1abd6631 | 10 admin | scope + input |
| R6 | (this commit) | smoke + runbook | ops handoff |

**Total: 46 backend tests passing, 5 audit cycles passed.**
