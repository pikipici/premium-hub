# Wallet Withdraw System — Design & Implementation Plan

> **For Hermes:** Use subagent-driven-development atau eksekusi sequential per round. Stop and ask user `gas live` before promoting to production after each round's workspace deploy. Workspace = `rdpkhorur:18082` BE / `:3005` FE; live = `digimarket.id`.

**Goal:** Bangun sistem withdraw saldo end-to-end yang aman, scalable, dan extensible. WD jadi prerequisite buat sell-side gmail (next plan: `gmail-marketplace.md`) — user butuh exit jalur cair sebelum mulai setor gmail dan dapet earnings.

**Architecture summary:** Dual-pocket wallet (Saldo Utama untuk topup, Saldo Pendapatan untuk earnings) dengan one-way transfer rule (Pendapatan → Utama only) sebagai anti-money-laundering by design. WD cuma debit dari pocket=earn. PayoutRail interface abstraction biar manual implementation MVP bisa di-swap ke disbursement API tanpa rombak ulang.

**Tech Stack:** Go (Gin + GORM), PostgreSQL, Next.js App Router, lucide-react, TanStack Query, Zustand. Reuse `wallet_repo` + `wallet_service` existing — extend, jangan duplicate.

**Baseline:** main `37d12e66`. Workspace = same.

---

## Final Spec (locked-in decisions)

| Aspect | Value |
|---|---|
| Wallet pockets | `spend` (Saldo Utama, dari topup) + `earn` (Saldo Pendapatan, dari earnings) |
| Transfer Pendapatan → Utama | Boleh, user bisa pindahin sendiri |
| Transfer Utama → Pendapatan | Dilarang (anti-MLA by design) |
| Min WD per request | Rp 50.000 |
| Max WD per request | Rp 500.000 |
| Fee | Rp 2.500 flat, dipotong dari amount (request 50k → cair 47.500) |
| Daily limit | Max 5 request/hari, total max Rp 2.500.000/hari per user |
| Destination | Bank: BCA, Mandiri, BRI, BNI, CIMB <br> E-wallet: DANA, OVO, GoPay, ShopeePay, LinkAja |
| KYC | Tidak diperlukan (dimitigasi via live-create gmail flow di sell-side) |
| Cancel | Hanya saat `status=pending` (sebelum admin approve) |
| Approval flow | Auto-approve `< 100.000`, manual ≥ 100.000 |
| Notif | 4 momen: `submitted`, `approved`/`rejected`, `processing`, `paid`/`failed` |
| Mark paid | Admin tinggal klik, gak wajib ref/bukti (trust mode untuk MVP) |
| Bank rail | Hybrid `PayoutRail` interface — manual implementation dulu, swap ke disbursement API (Duitku/Xendit/Flip/Tripay) belakangan |

---

## Acceptance Criteria

1. User bisa lihat dua saldo terpisah (Saldo Utama + Saldo Pendapatan) di `/dashboard/wallet`.
2. User bisa request WD dari Saldo Pendapatan — semua validasi (min/max/daily limit/fee) enforced di backend.
3. User bisa transfer Saldo Pendapatan → Saldo Utama (one-way), tapi gak bisa kebalikannya (UI gak nampilin opsi + backend reject 400).
4. WD `< 100k` auto-approve; `≥ 100k` masuk antrian admin manual.
5. Admin bisa approve/reject/mark-paid dari `/admin/wallet/withdrawals`.
6. User dapet 4 notifikasi (submitted, approved/rejected, processing, paid/failed) via `notification_service` existing.
7. WD ledger entry konsisten — saldo Pendapatan ter-debit saat submit (lock), ter-refund saat reject/cancel, ter-finalize saat paid.
8. Daily limit dihitung dari `created_at >= start_of_today_jakarta` AND `status NOT IN ('rejected', 'cancelled', 'failed')`.
9. `PayoutRail` interface terdefinisi clean — manual implementation route admin upload + mark paid; future API implementation tinggal nambah file baru.
10. Build clean: `go build ./... && go test ./internal/repository/ ./internal/service/ ./internal/handler/`. FE `npm run build` clean.
11. Workspace deploy + smoke test: 5 user-side route + 4 admin-side route HTTP 200.

## Task Status Legend

`[ ]` pending — `[~]` in progress — `[x]` done — `[!]` blocked/needs decision

---

## Round 1: Pocket Migration — Foundation (HIGH)

**Objective:** Tambah konsep `pocket` ke wallet existing tanpa break flow yang udah jalan. Backward compatible — saldo lama otomatis jadi `spend`. Topup masuk ke `spend`, gak ada perubahan business logic dulu.

### Findings yang ditangani

- **R1.1** `WalletLedger` belum punya kolom `pocket`. Semua entry existing diasumsikan `spend`.
- **R1.2** Belum ada konsep balance per pocket. Sekarang cuma sum semua ledger entry.
- **R1.3** Wallet service `Balance(userID)` return single number — perlu return per-pocket.

### Task 1.1: Schema — tambah kolom pocket

**Files:**
- Modify: `premiumhub-api/internal/model/wallet_ledger.go`

Tambah field:
```go
Pocket string `gorm:"type:varchar(16);not null;default:'spend';index" json:"pocket"`
```

Constants di `model/wallet_pocket.go` (file baru):
```go
package model

const (
    WalletPocketSpend = "spend"
    WalletPocketEarn  = "earn"
)

func IsValidWalletPocket(p string) bool {
    return p == WalletPocketSpend || p == WalletPocketEarn
}
```

`AutoMigrate` udah include `&model.WalletLedger{}` — kolom baru ditambahin GORM auto. **Sandbox schema verify** wajib karena AutoMigrate gak rename, tapi tambah kolom dengan default OK. Backfill SQL kalo perlu:
```sql
UPDATE wallet_ledgers SET pocket = 'spend' WHERE pocket IS NULL OR pocket = '';
```

### Task 1.2: Repo — query per pocket

**Files:**
- Modify: `premiumhub-api/internal/repository/wallet_repo.go`

Tambah methods:
```go
func (r *WalletRepo) BalanceByPocket(userID uuid.UUID, pocket string) (int64, error)
func (r *WalletRepo) BalancesAllPockets(userID uuid.UUID) (map[string]int64, error)
```

`BalancesAllPockets` return `{"spend": 150000, "earn": 25000}`. Single SQL query GROUP BY pocket.

### Task 1.3: Service — expose dual balance

**Files:**
- Modify: `premiumhub-api/internal/service/wallet_service.go`

Tambah `BalanceDetailed(userID) (*WalletBalanceDetailed, error)`:
```go
type WalletBalanceDetailed struct {
    Spend int64 `json:"spend"`
    Earn  int64 `json:"earn"`
    Total int64 `json:"total"`
}
```

Existing `Balance()` method **jangan diubah** — masih return total (spend + earn) buat backward compat dengan tempat lain (mis. checkout sosmed yang nge-cek "saldo cukup gak"). Tambah method baru, jangan ganti.

### Task 1.4: Handler — endpoint dual balance

**Files:**
- Modify: `premiumhub-api/internal/handler/wallet_handler.go`
- Modify: `premiumhub-api/internal/routes/router.go`

Endpoint baru: `GET /api/v1/wallet/balance-detailed` → return `BalanceDetailed`.

`GET /api/v1/wallet/balance` (existing) **gak diubah** — masih return single total.

### Task 1.5: Wire pocket di topup + checkout flow existing

**Files:**
- Modify: `premiumhub-api/internal/service/wallet_service.go` (topup credit)
- Modify: `premiumhub-api/internal/service/sosmed_order_service.go` (debit on checkout)
- Modify: `premiumhub-api/internal/service/sosmed_bundle_order_service.go` (debit on bundle checkout)
- Modify: `premiumhub-api/internal/service/digiconnect_service.go` (debit on AI usage)
- Modify: `premiumhub-api/internal/service/payment_webhook_service.go` (topup webhook)

Setiap tempat yang create `WalletLedger` entry: explicit set `Pocket: model.WalletPocketSpend`. Sekarang semua duit topup masuk ke `spend`, semua debit produk ngambil dari `spend`. Behavior identik dengan sebelum migrasi.

**Pitfall:** `BalanceByPocket("spend")` saat checkout, **bukan** total balance. Topup webhook flow yang masih pake `Balance()` aman karena `earn` masih kosong di Round 1, tapi setelah Round 3 (sell gmail mulai jalan) wajib pake `BalanceByPocket("spend")` biar gak akses Pendapatan.

### Round 1 Verification

- [ ] Sandbox: `\d wallet_ledgers` punya kolom `pocket varchar(16) DEFAULT 'spend'`
- [ ] Existing topup masih masuk → ledger entry `pocket='spend'`
- [ ] Existing checkout sosmed masih debit dari `spend`
- [ ] `GET /wallet/balance-detailed` return `{spend: N, earn: 0, total: N}`
- [ ] `GET /wallet/balance` (legacy) tetap return total — gak break apapun

---

## Round 2: WD Model + Service (HIGH)

**Objective:** Bikin core domain `WalletWithdrawal` lengkap — model, repo, service, handler, routes (user + admin) — tapi belum integrate dengan rail beneran. Approve = trust manual button, mark paid = trust manual button.

### Task 2.1: Model

**Files:**
- Create: `premiumhub-api/internal/model/wallet_withdrawal.go`

```go
package model

import (
    "time"
    "github.com/google/uuid"
    "gorm.io/gorm"
)

const (
    WithdrawalStatusPending    = "pending"
    WithdrawalStatusApproved   = "approved"
    WithdrawalStatusRejected   = "rejected"
    WithdrawalStatusCancelled  = "cancelled"
    WithdrawalStatusProcessing = "processing"
    WithdrawalStatusPaid       = "paid"
    WithdrawalStatusFailed     = "failed"

    WithdrawalDestBank    = "bank"
    WithdrawalDestEwallet = "ewallet"
)

type WalletWithdrawal struct {
    ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
    UserID uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`

    Amount      int64 `gorm:"not null" json:"amount"`        // gross, yang user request
    Fee         int64 `gorm:"not null" json:"fee"`           // 2500 flat
    NetAmount   int64 `gorm:"not null" json:"net_amount"`    // amount - fee, yang sampe ke rekening

    Status string `gorm:"type:varchar(24);not null;index" json:"status"`

    DestinationType    string `gorm:"type:varchar(16);not null" json:"destination_type"` // bank | ewallet
    DestinationCode    string `gorm:"type:varchar(32);not null" json:"destination_code"` // BCA, DANA, etc
    DestinationAccount string `gorm:"type:varchar(64);not null" json:"destination_account"`
    DestinationName    string `gorm:"type:varchar(128);not null" json:"destination_name"`

    AdminID         *uuid.UUID `gorm:"type:uuid;index" json:"admin_id,omitempty"`
    AdminNote       string     `json:"admin_note,omitempty"`
    AutoApproved    bool       `gorm:"not null;default:false" json:"auto_approved"`

    LedgerHoldID    *uuid.UUID `gorm:"type:uuid" json:"ledger_hold_id,omitempty"`    // entry yang lock saldo
    LedgerFinalID   *uuid.UUID `gorm:"type:uuid" json:"ledger_final_id,omitempty"`   // entry final saat paid
    LedgerRefundID  *uuid.UUID `gorm:"type:uuid" json:"ledger_refund_id,omitempty"`  // entry refund saat reject/cancel

    PayoutRailKind  string `gorm:"type:varchar(32)" json:"payout_rail_kind"`         // manual | duitku | xendit | ...
    PayoutRailRef   string `gorm:"type:varchar(128)" json:"payout_rail_ref,omitempty"`
    FailureReason   string `json:"failure_reason,omitempty"`

    CreatedAt   time.Time  `json:"created_at"`
    ApprovedAt  *time.Time `json:"approved_at,omitempty"`
    RejectedAt  *time.Time `json:"rejected_at,omitempty"`
    CancelledAt *time.Time `json:"cancelled_at,omitempty"`
    PaidAt      *time.Time `json:"paid_at,omitempty"`
    UpdatedAt   time.Time  `json:"updated_at"`
}

func (w *WalletWithdrawal) BeforeCreate(_ *gorm.DB) error {
    if w.ID == uuid.Nil {
        w.ID = uuid.New()
    }
    return nil
}
```

Register di `config/database.go` `AutoMigrate(...)` block.

### Task 2.2: Repo

**Files:**
- Create: `premiumhub-api/internal/repository/wallet_withdrawal_repo.go`

Methods minimal:
- `Create(w *model.WalletWithdrawal) error`
- `GetByID(id uuid.UUID) (*model.WalletWithdrawal, error)`
- `GetByIDForUser(id, userID uuid.UUID) (*model.WalletWithdrawal, error)`
- `ListByUser(userID, page, limit) ([]model.WalletWithdrawal, int64, error)`
- `ListByStatus(status, page, limit) ([]model.WalletWithdrawal, int64, error)` — untuk admin
- `ListAdmin(filters, page, limit) ([]model.WalletWithdrawal, int64, error)`
- `UpdateStatus(id, status, ...optional fields)`
- `CountTodayByUser(userID, since time.Time) (count int64, totalAmount int64, error)` — untuk daily limit check (Asia/Jakarta start of day)

### Task 2.3: Service

**Files:**
- Create: `premiumhub-api/internal/service/wallet_withdrawal_service.go`

```go
type WalletWithdrawalService struct {
    cfg            *config.Config
    repo           *repository.WalletWithdrawalRepo
    walletRepo     *repository.WalletRepo
    notifSvc       *NotificationService
    payoutRail     PayoutRail   // interface, lihat Round 4
}
```

Public methods:
- `CreateRequest(userID, req CreateWithdrawalInput) (*model.WalletWithdrawal, error)` — validate min/max/daily limit, check `BalanceByPocket("earn") >= amount`, lock saldo via debit ledger entry pocket=earn, set status=pending. **Auto-approve check**: kalo `amount < AutoApproveThreshold` (100k), langsung set `status=approved, auto_approved=true, approved_at=now`. Notif submitted + (kalo auto) approved.
- `Cancel(userID, id)` — hanya jika `status=pending`. Refund (credit ledger pocket=earn). Notif rejected.
- `ListMine(userID, page, limit)`
- `GetMine(userID, id)`
- (admin) `ListAdmin(filters)`, `Approve(adminID, id, note)`, `Reject(adminID, id, note)`, `MarkProcessing(adminID, id)`, `MarkPaid(adminID, id, payoutRailKind, payoutRailRef)`, `MarkFailed(adminID, id, reason)`.

**Validations di CreateRequest**:
1. `req.Amount >= 50_000 && req.Amount <= 500_000`
2. `req.DestinationType in (bank, ewallet)` + `req.DestinationCode in known list`
3. `req.DestinationAccount`, `req.DestinationName` non-empty, sane length
4. `BalanceByPocket(userID, "earn") >= req.Amount` — pre-debit check
5. Daily limit: `count, total = CountTodayByUser(userID)`; require `count < 5 && total + req.Amount <= 2_500_000`. **Cancelled/rejected exclude dari count** (refund jadi gak charge ke daily limit).

**Saldo lock pattern**:
- Submit → buat 1 ledger entry `Type=withdrawal_hold`, `Amount=-req.Amount`, `Pocket=earn`, link ke `withdrawal.LedgerHoldID`
- Reject/Cancel → buat 1 entry `Type=withdrawal_refund`, `Amount=+req.Amount`, `Pocket=earn`, link ke `LedgerRefundID`
- Mark paid → buat 1 entry `Type=withdrawal_final` `Amount=0` (just for audit + linking), link ke `LedgerFinalID`. Saldo gak berubah karena udah ke-debit di hold.
- Daily limit check ngeliat `withdrawal_hold` entries today, **bukan** balance change.

### Task 2.4: Handler

**Files:**
- Create: `premiumhub-api/internal/handler/wallet_withdrawal_handler.go`

Routes user (di `protected`):
```
POST   /api/v1/wallet/withdrawals                 → Create
GET    /api/v1/wallet/withdrawals                 → ListMine (paginated)
GET    /api/v1/wallet/withdrawals/:id             → GetMine
POST   /api/v1/wallet/withdrawals/:id/cancel      → Cancel
GET    /api/v1/wallet/withdrawals/destinations    → static list of supported banks + ewallets
```

Routes admin (di `admin`):
```
GET    /api/v1/admin/wallet/withdrawals                  → ListAdmin (filter status, user_id, etc)
GET    /api/v1/admin/wallet/withdrawals/:id              → GetByID
POST   /api/v1/admin/wallet/withdrawals/:id/approve      → with optional note
POST   /api/v1/admin/wallet/withdrawals/:id/reject       → require reason note
POST   /api/v1/admin/wallet/withdrawals/:id/mark-processing
POST   /api/v1/admin/wallet/withdrawals/:id/mark-paid    → with optional payout_rail_ref
POST   /api/v1/admin/wallet/withdrawals/:id/mark-failed  → require reason
```

Pakai rate limiter `PaymentRateLimitMax/Window` untuk user create + cancel; `ProviderRateLimitMax/Window` untuk admin actions (lebih lentur).

### Task 2.5: Notification wiring

**Files:**
- Modify: `premiumhub-api/internal/service/wallet_withdrawal_service.go`

4 notif (pakai `notification_service` existing, type baru `withdrawal_*`):
- `withdrawal_submitted` — saat create request
- `withdrawal_approved` / `withdrawal_rejected` — saat status berubah
- `withdrawal_processing` — saat admin mark processing
- `withdrawal_paid` / `withdrawal_failed` — final state

Title + body bahasa Indonesia, link ke `/dashboard/wallet/withdrawals/:id` (route FE Round 3).

### Round 2 Verification

- [ ] User submit WD 50k → saldo Pendapatan turun 50k, ledger entry hold tercipta
- [ ] User submit WD 75k → auto-approved (di bawah 100k), notif approved fire
- [ ] User submit WD 200k → status=pending, nungguin admin
- [ ] User cancel pending → saldo balik, ledger refund tercipta
- [ ] Admin reject 200k → saldo balik, ledger refund, notif rejected fire
- [ ] User submit ke-6 di hari yang sama → 400 daily limit reached
- [ ] User submit total 2.5jt + lagi 50k → 400 daily total reached
- [ ] User submit 30k → 400 below min
- [ ] User submit 600k → 400 above max
- [ ] Admin mark paid → ledger final tercipta, notif paid fire

---

## Round 3: Frontend — User Side (MEDIUM)

**Objective:** UI untuk user request, list, detail, cancel WD. Reuse shared components dashboard overhaul.

### Task 3.1: Types + Service

**Files:**
- Create: `premiumhub-web/src/types/walletWithdrawal.ts`
- Create: `premiumhub-web/src/services/walletWithdrawalService.ts`

Mirror struct backend. Service pakai axios `api` instance.

### Task 3.2: Wallet page rebuild — dual balance

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/wallet/page.tsx`
- Modify: `premiumhub-web/src/components/shared/WalletCard.tsx`

Sekarang harus nampilin **dua card balance**: Saldo Utama (current `WalletCard`) + Saldo Pendapatan (variant baru atau prop `tone`). Plus tombol "Tarik Saldo" yang cuma aktif kalo `earn > 0`.

Kalo `earn > 0`, tampil juga tombol "Pindahkan ke Saldo Utama" yang trigger transfer Pendapatan → Utama (lihat Round 5).

### Task 3.3: Withdrawal request page

**Files:**
- Create: `premiumhub-web/src/app/dashboard/wallet/withdrawals/page.tsx` (list)
- Create: `premiumhub-web/src/app/dashboard/wallet/withdrawals/new/page.tsx` (form)
- Create: `premiumhub-web/src/app/dashboard/wallet/withdrawals/[id]/page.tsx` (detail)

Form fields: amount (input rupiah dengan formatter), destination type (radio bank/ewallet), destination code (select), account number, account name. Live preview: gross / fee / net.

Pakai `ConfirmDialog` shared sebelum submit ("Tarik Rp X ke BCA 1234?"). Pakai `EmptyState` shared kalo list kosong. `StatusPill` shared untuk status badge. `DashboardSkeleton` shared untuk loading.

### Task 3.4: Sidebar entry

**Files:**
- Modify: `premiumhub-web/src/components/layout/DashboardSidebar.tsx`

`MENU` dapat entry baru? **Decision pending:** apakah WD jadi sub-item Wallet (tanpa entry sidebar terpisah) atau standalone? Default: di-merge ke `/dashboard/wallet` dengan tab "Tarik Saldo" — gak nambah noise sidebar. Kalau standalone, tambah `{ href: '/dashboard/wallet/withdrawals', icon: ArrowDownToLine, label: 'Penarikan' }`.

### Round 3 Verification

- [ ] `/dashboard/wallet` nampilin dua card balance, total tetap di header
- [ ] Form submit valid → redirect ke detail page, status pending/approved
- [ ] List paginated, filter by status
- [ ] Cancel button hanya muncul saat status=pending
- [ ] FE notif badge update saat WD status berubah (existing notif system)

---

## Round 4: Admin Side + PayoutRail Interface (HIGH)

**Objective:** Admin queue + actions. Define `PayoutRail` interface clean — manual implementation jadi default. Future API implementations (Duitku, Xendit, dll) tinggal nambah file.

### Task 4.1: PayoutRail interface

**Files:**
- Create: `premiumhub-api/internal/service/payout_rail.go`
- Create: `premiumhub-api/internal/service/payout_rail_manual.go`

```go
package service

type PayoutRailKind string

const (
    PayoutRailManual PayoutRailKind = "manual"
    PayoutRailDuitku PayoutRailKind = "duitku"
    PayoutRailXendit PayoutRailKind = "xendit"
)

type PayoutRequest struct {
    WithdrawalID       uuid.UUID
    Amount             int64  // net amount
    DestinationType    string
    DestinationCode    string
    DestinationAccount string
    DestinationName    string
}

type PayoutResult struct {
    Status    string  // pending | success | failed
    RailRef   string  // reference number / transaction id
    RawResp   string  // jsonb raw response untuk debug
    Error     string
}

type PayoutRail interface {
    Kind() PayoutRailKind
    Submit(ctx context.Context, req PayoutRequest) (*PayoutResult, error)
    CheckStatus(ctx context.Context, railRef string) (*PayoutResult, error)
}
```

`payout_rail_manual.go`:
```go
type ManualPayoutRail struct{}

func (m *ManualPayoutRail) Kind() PayoutRailKind { return PayoutRailManual }
func (m *ManualPayoutRail) Submit(ctx, req) (*PayoutResult, error) {
    // Manual mode: cuma return pending dengan ref kosong.
    // Admin nanti yang panggil MarkPaid manual.
    return &PayoutResult{Status: "pending", RailRef: ""}, nil
}
func (m *ManualPayoutRail) CheckStatus(ctx, ref) (*PayoutResult, error) {
    // Manual: gak bisa cek otomatis, return pending.
    return &PayoutResult{Status: "pending", RailRef: ref}, nil
}
```

### Task 4.2: Wire PayoutRail di service

**Files:**
- Modify: `premiumhub-api/internal/service/wallet_withdrawal_service.go`
- Modify: `premiumhub-api/internal/routes/router.go`

Saat `Approve()`:
1. Set status=approved
2. Panggil `payoutRail.Submit(req)` → simpan `PayoutRailKind`, `PayoutRailRef`
3. Kalo `result.Status == "pending"` → set withdrawal status=`processing` + notif processing
4. Kalo `result.Status == "success"` → langsung `MarkPaid` flow + notif paid (untuk future API rail yang sync)
5. Kalo `result.Status == "failed"` → `MarkFailed` + refund ledger + notif failed

`router.go`: `payoutRail := &service.ManualPayoutRail{}`. Pakai env var nanti buat switch (`PAYOUT_RAIL_KIND=manual|duitku|...`).

### Task 4.3: Auto-approve threshold

**Files:**
- Modify: `premiumhub-api/config/config.go`
- Modify: `premiumhub-api/internal/service/wallet_withdrawal_service.go`

Tambah `WithdrawalAutoApproveThreshold int64` (default 100_000), env `WITHDRAWAL_AUTO_APPROVE_THRESHOLD`.

Tambah `WithdrawalDailyMaxRequests int` (default 5), `WithdrawalDailyMaxTotal int64` (default 2_500_000), `WithdrawalMin int64` (default 50_000), `WithdrawalMax int64` (default 500_000), `WithdrawalFee int64` (default 2_500).

Semua bisa di-tune via env. Hardcode di config struct dengan default kalo env empty.

### Task 4.4: Admin FE page

**Files:**
- Create: `premiumhub-web/src/app/admin/(core)/wallet/withdrawals/page.tsx` (list + filters)
- Create: `premiumhub-web/src/app/admin/(core)/wallet/withdrawals/[id]/page.tsx` (detail + actions)
- Modify: `premiumhub-web/src/components/admin/admin-sidebar.tsx` — tambah `{ href: '/admin/wallet/withdrawals', label: 'Penarikan', icon: '↓' }` di section Transaksi

Detail page: status timeline (submitted → approved → processing → paid), action buttons (approve/reject/mark-processing/mark-paid/mark-failed) yang muncul sesuai status. Approve+reject pakai `ConfirmDialog` shared dengan note input. `StatusPill` shared.

### Task 4.5: Auto-approve background path

**Decision:** Saat user submit WD `< 100k`, status langsung approved sync di handler (bukan worker). Lalu `payoutRail.Submit` juga sync. Manual rail return pending → status processing → admin masih harus mark paid manual.

Ini **bukan** auto-paid, cuma auto-approved. Admin masih jadi gate ke transfer rail. Saat rail di-swap ke API, auto-approve flow bisa langsung sampai paid otomatis kalo API success.

### Round 4 Verification

- [ ] Admin list + filter status works
- [ ] Approve 200k → status approved → processing (manual rail)
- [ ] Reject → refund ledger, notif fire
- [ ] Mark paid manual → status paid, notif fire, ledger final tercipta
- [ ] Mark failed manual → refund ledger + notif failed
- [ ] Auto-approve 75k → langsung approved → processing tanpa intervensi admin
- [ ] Admin sidebar nampilin entry Penarikan

---

## Round 5: Pocket Transfer (Pendapatan → Utama) (LOW)

**Objective:** User bisa pindahin saldo Pendapatan ke Utama. One-way (Utama → Pendapatan dilarang).

### Task 5.1: Service + handler

**Files:**
- Modify: `premiumhub-api/internal/service/wallet_service.go`
- Modify: `premiumhub-api/internal/handler/wallet_handler.go`

```go
func (s *WalletService) TransferEarnToSpend(userID uuid.UUID, amount int64) error
```

Validasi:
- `amount > 0`
- `BalanceByPocket(userID, "earn") >= amount`
- Buat 2 ledger entry dalam 1 transaction:
  - debit pocket=earn (`Type=transfer_out`)
  - credit pocket=spend (`Type=transfer_in`)
- Link via reference ID (UUID generated, dipakai di kedua entry)

Endpoint: `POST /api/v1/wallet/transfer-earn-to-spend` body `{amount}`.

**Tidak ada endpoint kebalikan.** Backend explicit reject kalo someone mancing-mancing.

### Task 5.2: FE button

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/wallet/page.tsx`

Tombol "Pindahkan ke Saldo Utama" di card Pendapatan, modal input amount + confirm. Dialog jelasin "Pindahan ini permanen, tidak bisa dibalik."

### Round 5 Verification

- [ ] Transfer 50k earn→spend → spend +50k, earn -50k, dua ledger entries terlink
- [ ] Reverse direction `POST /wallet/transfer-spend-to-earn` doesn't exist (404)
- [ ] Frontend gak nampilin opsi transfer balik

---

## Round 6: Workspace Promote → Live (HIGH)

**Objective:** Setelah semua round 1-5 stable di workspace, deploy ke live `digimarket.id`.

### Task 6.1: Pre-promote checks

- [ ] Sandbox-ubuntu Postgres `\d wallet_ledgers` punya kolom `pocket`
- [ ] Sandbox `\d wallet_withdrawals` ada
- [ ] Existing user balance gak berubah angkanya (legacy `Balance()` masih return total benar)
- [ ] Rate limiter env var sudah di sandbox `.env`
- [ ] `WITHDRAWAL_*` env var sudah di sandbox `.env` (atau pakai default)
- [ ] `PAYOUT_RAIL_KIND=manual` di sandbox `.env`

### Task 6.2: Promote

User trigger `gas live` setelah verify workspace clean. Hermes deploy ke production via standard `./deploy.sh`. Smoke test: user-side route + admin-side route HTTP 200.

### Task 6.3: Monitor minggu pertama

- Bandar daily WD volume vs Saldo Pendapatan total → matching ratio
- Cek complaint user soal saldo / WD failed via chat support
- Audit ledger consistency: sum(`spend` entries) == reported `Saldo Utama`, sum(`earn` entries) == reported `Saldo Pendapatan`

---

## Open Questions / Decisions Pending

- [ ] **Sidebar entry:** WD jadi sub-tab di Wallet page atau item sidebar terpisah? (default: sub-tab)
- [ ] **Auto-approve route:** kalo PayoutRail manual return pending, admin tetep harus klik mark-paid. Konfirmasi UX flow.
- [ ] **Idempotency client-side:** form submit double-tap protection, request body include `client_request_id` UUID? Untuk MVP cukup loading state disable button, tapi untuk audit trail bagus.
- [ ] **Audit log table khusus admin actions:** sekarang admin actions cuma ke-track via `AdminID` di withdrawal record. Mau separate audit log table? (defer ke later round, gak blocking).
- [ ] **Multi-language notif:** sekarang asumsi Bahasa. Kalo ada plan ke EN, structure notif body harus i18n-ready.

---

## References

- `premium-hub-ops` skill — repo conventions, deploy, pitfalls
- `.kiro/steering/digiconnect-backend-hardening.md` — pola round-based hardening
- `.kiro/steering/dashboard-user-overhaul.md` — shared FE components yang harus di-reuse
- Future: `.kiro/steering/gmail-marketplace.md` — sell-side gmail flow yang akan ngisi Saldo Pendapatan
