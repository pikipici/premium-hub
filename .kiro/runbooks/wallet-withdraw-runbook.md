# Wallet Withdraw — Operations Runbook (Round 6)

Bahan operasional setelah Round 1-5 stable di workspace. Punya tiga
bagian utama:

1. **Pre-promote checklist** — apa yang harus dipastikan sebelum
   `gas live`.
2. **Smoke test plan** — apa yang harus berhasil di sandbox dan di
   production setelah deploy.
3. **Post-launch monitoring** — apa yang harus dipantau minggu pertama.

Reference plan: `.kiro/steering/wallet-withdraw-system.md`.

---

## 1. Pre-Promote Checklist

Verify di **sandbox-ubuntu workspace** (host `digimarketdev.id`)
sebelum minta promote ke live.

### 1.1 Database — schema

```bash
ssh sandbox-ubuntu 'sudo -u postgres psql premiumhub -c "\d wallet_ledgers"'
# expect: kolom `pocket` ada, type varchar(16), default 'spend', not null
```

```bash
ssh sandbox-ubuntu 'sudo -u postgres psql premiumhub -c "\d wallet_withdrawals"'
# expect: tabel ada dengan 22+ kolom, indexes user_id, status, created_at
```

```bash
ssh sandbox-ubuntu 'sudo -u postgres psql premiumhub -c "SELECT column_name FROM information_schema.columns WHERE table_name = '\''users'\'' AND column_name = '\''wallet_balance_earn'\''"'
# expect: 1 row
```

### 1.2 Database — backfill safety

```bash
ssh sandbox-ubuntu 'sudo -u postgres psql premiumhub -c "SELECT COUNT(*) FROM wallet_ledgers WHERE pocket IS NULL OR pocket = '\'''\''"'
# expect: 0 — backfill di applyWalletPocketBackfill harus jalan
```

```bash
ssh sandbox-ubuntu 'sudo -u postgres psql premiumhub -c "SELECT pocket, COUNT(*) FROM wallet_ledgers GROUP BY pocket"'
# expect: 'spend' = total existing rows; 'earn' = 0 (atau low kalo udah
# ada gmail flow)
```

### 1.3 Backward compat — legacy balance

User existing yg punya saldo lama harus tetep keliatan angka yang sama
di Saldo Utama (`balance` legacy = `wallet_balance_spend`).

```bash
ssh sandbox-ubuntu 'sudo -u postgres psql premiumhub -c "SELECT id, wallet_balance, wallet_balance_earn FROM users WHERE wallet_balance > 0 LIMIT 5"'
```

Bandingkan dengan endpoint:

```bash
# Login as one of those users via FE; cek dashboard wallet —
# Saldo Utama harus = wallet_balance dari DB.
```

### 1.4 Environment variables

Sandbox `.env` minimal punya:

```
WITHDRAWAL_MIN=50000
WITHDRAWAL_MAX=500000
WITHDRAWAL_FEE=2500
WITHDRAWAL_AUTO_APPROVE_THRESHOLD=100000
WITHDRAWAL_DAILY_MAX_REQUESTS=5
WITHDRAWAL_DAILY_MAX_TOTAL=2500000
WITHDRAWAL_RAIL_KIND=manual
```

Note: defaults aman (50k/500k/2.5k/100k/5/2.5jt/manual), jadi
kalau env unset pun tetep jalan. Tapi kalau mau tuning di production,
tambahin eksplisit.

### 1.5 Service health

```bash
ssh sandbox-ubuntu 'systemctl --user status premiumhub-workspace-api.service'
# expect: active (running), no restart loop di logs
```

```bash
curl -fsS https://digimarketdev.id/api/v1/health
# expect: 200 OK
```

### 1.6 Auth + endpoints

Pakai test account user + admin. Endpoint user side:

```
GET    /api/v1/wallet/balance-detailed
GET    /api/v1/wallet/withdrawals
GET    /api/v1/wallet/withdrawals/destinations
POST   /api/v1/wallet/withdrawals
GET    /api/v1/wallet/withdrawals/:id
POST   /api/v1/wallet/withdrawals/:id/cancel
POST   /api/v1/wallet/transfer-earn-to-spend
```

Admin side (require `is_admin`):

```
GET    /api/v1/admin/wallet/withdrawals
GET    /api/v1/admin/wallet/withdrawals/:id
POST   /api/v1/admin/wallet/withdrawals/:id/approve
POST   /api/v1/admin/wallet/withdrawals/:id/reject
POST   /api/v1/admin/wallet/withdrawals/:id/mark-processing
POST   /api/v1/admin/wallet/withdrawals/:id/mark-paid
POST   /api/v1/admin/wallet/withdrawals/:id/mark-failed
```

### 1.7 Frontend routes

User:
- `/dashboard/wallet` — dual balance card render kedua dompet
- `/dashboard/wallet/withdrawals` — list withdraws
- `/dashboard/wallet/withdrawals/new` — form
- `/dashboard/wallet/withdrawals/[id]` — detail + cancel

Admin:
- `/admin/wallet/withdrawals` — queue list
- `/admin/wallet/withdrawals/[id]` — detail + actions
- `/admin/` sidebar nampilin entri baru "Penarikan"

### 1.8 No-op for users without earn

User yang belum pernah dapet earn pocket (semua existing user
pre-launch) harus tetep:
- Saldo Utama tampil normal di `/dashboard/wallet`
- Card Saldo Pendapatan render di Rp 0 (atau hidden — implementation
  detail)
- Tombol "Tarik Saldo" disabled (saldo earn = 0 < minimum 50k)
- Form WD reject dengan "saldo pendapatan tidak cukup" kalo dipaksa

---

## 2. Smoke Test Plan

Run smoke setelah deploy ke sandbox AND setelah promote ke live.
Pakai `scripts/wallet-withdraw-smoke.sh` (see file di samping runbook
ini) atau manual dengan steps di bawah.

### 2.1 User happy path (manual rail, auto-approve)

1. Login as test user yang punya **earn balance > 50k** (inject via DB
   atau via gmail flow saat udah ada).
2. Buka `/dashboard/wallet` — verify Saldo Pendapatan tampil benar.
3. Klik "Tarik Saldo" — form open di `/dashboard/wallet/withdrawals/new`.
4. Pilih bank, isi rekening + nama + amount **75000** (di bawah
   threshold 100k → auto-approve).
5. Submit — expect redirect ke detail page dengan status `approved`
   (auto), badge AUTO ada.
6. Check DB:
   ```sql
   SELECT id, status, auto_approved, amount, fee, net_amount
     FROM wallet_withdrawals ORDER BY created_at DESC LIMIT 1;
   -- status = approved, auto_approved = true,
   -- fee = 2500, net_amount = 72500
   ```
7. Check ledger:
   ```sql
   SELECT pocket, type, category, amount FROM wallet_ledgers
     WHERE reference LIKE 'withdrawal:%:hold'
     ORDER BY created_at DESC LIMIT 1;
   -- pocket=earn, type=debit, category=withdrawal_hold, amount=75000
   ```
8. Check user balance: `SELECT wallet_balance, wallet_balance_earn FROM users WHERE id = ...` — earn pocket berkurang 75000.

### 2.2 User happy path (manual rail, manual-approve)

1. Submit WD **150000** (di atas threshold → manual approve).
2. Status = `pending`, auto_approved = false.
3. Login as admin → `/admin/wallet/withdrawals` → klik item → "Approve".
4. Verify status flip ke `processing` (manual rail return pending →
   service mark processing).
5. Klik "Mark Paid" → verify:
   - Status = `paid`
   - `paid_at` tidak null
   - Ledger row baru dengan `category=withdrawal_final` (amount=0,
     audit-only)
   - User dapat notif `withdrawal_paid`

### 2.3 User reject path

1. Admin reject pending WD dengan alasan "test reject".
2. Verify:
   - Status = `rejected`
   - `failure_reason` = "test reject"
   - User earn balance balik (refund)
   - Ledger row baru `category=withdrawal_refund` pocket=earn type=credit
   - User dapat notif `withdrawal_rejected`

### 2.4 User cancel path

1. User submit WD ≥ 100k (pending state).
2. User klik cancel di detail page.
3. Verify:
   - Status = `cancelled`
   - `cancelled_at` tidak null
   - User earn balance balik
   - Ledger row baru `category=withdrawal_refund` pocket=earn

### 2.5 Limits

1. Submit 5 WD di hari yang sama → submit ke-6 reject dengan
   "limit harian tercapai".
2. Submit WD total > 2.5jt sehari → reject "total harian tercapai".
3. Submit < 50k → reject "minimal withdraw Rp 50.000".
4. Submit > 500k → reject "maksimal withdraw Rp 500.000".

### 2.6 Transfer earn → spend

1. User dengan earn balance > 0.
2. Buka `/dashboard/wallet`, klik "Pindahkan".
3. Modal open, isi amount, submit.
4. Verify:
   - earn balance berkurang
   - spend balance bertambah persis sama
   - 2 ledger row baru: `transfer_out` pocket=earn (debit) +
     `transfer_in` pocket=spend (credit) dengan reference yang link
     ke transferID UUID yang sama
5. Coba `POST /api/v1/wallet/transfer-spend-to-earn` via curl —
   expect 404 (route gak exist).

### 2.7 Auth boundary

```bash
# User endpoint without token → 401
curl -i https://digimarketdev.id/api/v1/wallet/withdrawals

# Admin endpoint dengan user token (non-admin) → 403
curl -H "Authorization: Bearer USER_TOKEN" https://digimarketdev.id/api/v1/admin/wallet/withdrawals

# Other user's withdrawal → 403/404
curl -H "Authorization: Bearer USER_A_TOKEN" \
  https://digimarketdev.id/api/v1/wallet/withdrawals/USER_B_WITHDRAWAL_ID
```

---

## 3. Post-Launch Monitoring (Minggu 1)

### 3.1 Daily WD volume

Run setiap hari sore:

```sql
SELECT
  DATE(created_at) AS day,
  status,
  COUNT(*) AS cnt,
  SUM(amount) AS total_diminta,
  SUM(net_amount) AS total_cair
FROM wallet_withdrawals
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

Look for anomaly:
- Status `failed` ratio > 20% → ada masalah dengan rail / data destination
- Status `cancelled` ratio > 50% → user nyoba pancing-pancing,
  bisa jadi UX confusing atau attack
- `pending` queue > 3 hari → admin gak ngolah → eskalasi

### 3.2 Ledger audit

Check minggu kedua: sum ledger per pocket = balance reported di
`users` table?

```sql
-- Spend pocket consistency
SELECT
  u.id,
  u.wallet_balance AS reported,
  COALESCE(SUM(CASE WHEN l.type = 'credit' THEN l.amount ELSE -l.amount END), 0) AS computed
FROM users u
LEFT JOIN wallet_ledgers l ON l.user_id = u.id AND l.pocket = 'spend'
GROUP BY u.id, u.wallet_balance
HAVING u.wallet_balance != COALESCE(SUM(CASE WHEN l.type = 'credit' THEN l.amount ELSE -l.amount END), 0)
LIMIT 20;
```

```sql
-- Earn pocket consistency
SELECT
  u.id,
  u.wallet_balance_earn AS reported,
  COALESCE(SUM(CASE WHEN l.type = 'credit' THEN l.amount ELSE -l.amount END), 0) AS computed
FROM users u
LEFT JOIN wallet_ledgers l ON l.user_id = u.id AND l.pocket = 'earn'
GROUP BY u.id, u.wallet_balance_earn
HAVING u.wallet_balance_earn != COALESCE(SUM(CASE WHEN l.type = 'credit' THEN l.amount ELSE -l.amount END), 0)
LIMIT 20;
```

Empty result = ledger consistent. Any row = drift bug, escalate.

### 3.3 Notification delivery

Cek tabel `notifications` untuk WD events. User harus dapet:
- `withdrawal_submitted` saat submit
- `withdrawal_approved` (atau `withdrawal_processing` direct kalo
  rail langsung process)
- Terminal: `withdrawal_paid`, `withdrawal_rejected`,
  `withdrawal_failed`, atau `withdrawal_cancelled`

```sql
SELECT type, COUNT(*) FROM notifications
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND type LIKE 'withdrawal_%'
GROUP BY type;
```

### 3.4 Chat support signals

Filter chat support thread minggu pertama dengan keyword:
- "saldo gak masuk"
- "withdraw gagal"
- "uang belum cair"
- "kenapa saldo pendapatan"

Eskalasi kalau muncul > 3 keluhan unik dalam seminggu.

---

## 4. Rollback Plan

Kalau ada issue post-promote:

### 4.1 Disable WD entry point

Tarik link "Tarik Saldo" sementara dengan feature flag (kalau ada),
atau push hotfix yang hide button.

### 4.2 Disable POST endpoint

Add middleware that returns 503 di `/api/v1/wallet/withdrawals` POST
saja. List/get tetep jalan biar user bisa liat status existing.

### 4.3 Restore balance manual

Kalau bug menyebabkan saldo earn user salah, restore via SQL:

```sql
-- Cek dulu ledger sum-nya benar:
SELECT user_id, SUM(CASE WHEN type='credit' THEN amount ELSE -amount END) AS computed
FROM wallet_ledgers
WHERE pocket='earn' AND user_id = '...'
GROUP BY user_id;

-- Update users tabel:
UPDATE users SET wallet_balance_earn = COMPUTED WHERE id = '...';
```

Audit log via git commit + chat support thread.

---

## 5. Quick Reference

| File path | Purpose |
|-----------|---------|
| `premiumhub-api/internal/model/wallet_pocket.go` | Pocket constants |
| `premiumhub-api/internal/model/wallet_withdrawal.go` | Withdrawal model + status machine |
| `premiumhub-api/internal/service/wallet_withdrawal_service.go` | Business logic |
| `premiumhub-api/internal/service/payout_rail.go` | Rail interface |
| `premiumhub-api/internal/service/payout_rail_manual.go` | Default manual rail |
| `premiumhub-api/internal/service/wallet_transfer_service.go` | Earn → spend transfer |
| `premiumhub-api/config/config.go:WithdrawalMin..` | Env-tuned policy |
| `premiumhub-web/src/app/dashboard/wallet/page.tsx` | User wallet w/ dual balance |
| `premiumhub-web/src/app/dashboard/wallet/withdrawals/` | User WD pages |
| `premiumhub-web/src/app/admin/(core)/wallet/withdrawals/` | Admin queue |

---

## 6. References

- `.kiro/steering/wallet-withdraw-system.md` — full plan, all 6 rounds
- `.kiro/runbooks/wallet-withdraw-smoke.sh` — automated smoke script
- `premium-hub-ops` skill — repo conventions, deploy, pitfalls
