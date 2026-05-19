# Gmail Marketplace System — Design & Implementation Plan

> **For Hermes:** Use subagent-driven-development atau eksekusi sequential per round. Stop and ask user `gas live` before promoting to production after each round's workspace deploy. Workspace = `rdpkhorur:18082` BE / `:3005` FE; live = `digimarket.id`.

**Goal:** Bangun sistem marketplace gmail dua-arah platform↔user. Sell-side: user setor gmail dengan flow guided + admin manual verify, di-credit ke Saldo Pendapatan saat verified. Buy-side: user beli gmail instant auto-deliver, garansi 1×24 jam replacement.

**Architecture summary:** Hybrid inventory — `Product` existing untuk katalog/pricing, `GmailAccount` model baru untuk per-akun tracking dengan source attribution (created_by, verified_by, sold_to). Sell-side flow pakai "slot" model (platform generate creds, user create gmail di Google manual, admin verify + lock). Buy-side reuse `Order` flow existing dengan source ke-swap dari `Stock` ke `GmailAccount`. Saldo Pendapatan integrasi tight dengan `wallet-withdraw-system.md` plan — gmail = sumber utama earnings.

**Tech Stack:** Go (Gin + GORM), PostgreSQL, Next.js App Router, lucide-react, TanStack Query. Reuse `pkg/credential/NewStockCipher` untuk encrypt credentials at rest. Reuse `Claim` model untuk warranty.

**Baseline:** main `37d12e66`. Workspace = same.

**Hard dependency:** Plan ini **butuh Round 1 dari `wallet-withdraw-system.md` selesai dulu** — pocket=earn harus exist sebelum credit Saldo Pendapatan. Round 2-6 WD bisa parallel atau setelahnya.

---

## Final Spec (locked-in decisions)

| Aspect | Value |
|---|---|
| Kategori gmail | Single category, no tier |
| Live-create flow | Guided manual; platform generate creds → user bikin di Google → user submit |
| Anti-hackback | Admin manual change password setelah verify |
| Recovery rule | User dilarang set recovery; admin delete kalo ada saat verify |
| Default beli (platform → user) | Rp 3.000 / akun (admin-tunable) |
| Default jual (platform → buyer) | Rp 5.000 / akun (admin-tunable) |
| Default margin | Rp 2.000 / akun (40%) |
| Inventory model | Hybrid — `Product` (catalog) + `GmailAccount` (per-row inventory) |
| Buyer purchase mode | One-by-one + bulk, default qty 1 |
| Bulk discount | Default flat, admin bisa enable tier discount kapan aja |
| Buyer warranty | 1×24 jam replacement (reuse `Claim` model) |
| Banned account handling | Mark `disposed`, simpan permanent untuk audit |
| Buyer delivery | Instant auto-deliver setelah bayar |
| Sell-side concurrency | Max 3 slot pending simultan per user, no daily cap |
| Slot expiry | 6 jam (worker mark expired) |
| Seller payout timing | Credit Saldo Pendapatan langsung saat admin verify (sebelum laku) |
| User nakal handling | Strike system 3-and-out 30-day ban sell-side |
| Banned-after-sale cost | Platform absorbs full (gak debit balik seller) |
| Replacement saat inventory empty | Auto-refund ke Saldo Utama |
| Buyer rate limit | No cap (anti-fraud di layer topup) |
| User sidebar | Satu entry "Gmail" → halaman dengan tab Beli / Jual |
| Admin sidebar | Section "Gmail" di Transaksi, sub-items: Verifikasi, Inventory, Pricing, Strike, Sales |

---

## Acceptance Criteria

1. User bisa request slot setor (max 3 pending), platform generate creds, user follow guide, submit.
2. Admin queue di `/admin/gmail/verifikasi` — admin bisa verify (login test, freshness OK, no recovery, change password) atau reject (with reason).
3. Saat verify OK, seller dapet `+Rp default_buy_price` di Saldo Pendapatan.
4. Saat reject 3x dalam 30 hari window, user kena ban sell-side 30 hari.
5. Slot pending > 6 jam → auto-expired oleh worker.
6. Buyer bisa beli (1-by-1 atau bulk), instant auto-deliver credentials lewat dashboard order detail.
7. Buyer bisa claim warranty dalam 1×24 jam → sistem auto-deliver replacement dari inventory; kalo inventory kosong → auto-refund ke Saldo Utama.
8. Akun banned-after-sale di-mark `disposed`, akun tetep di DB untuk audit.
9. Admin bisa tune harga beli + harga jual + bulk discount tier dari `/admin/gmail/pricing`.
10. Sales analytics dashboard nampilin: inventory in/out per minggu, revenue/margin per minggu (chart minimal — sparkline + total).
11. Inventory low alert: kalo verified count < threshold (admin-set), notif admin (in-app + email kalo ada).
12. Build clean: `go build ./... && go test ./internal/repository/ ./internal/service/ ./internal/handler/`. FE `npm run build` clean.
13. Workspace deploy + smoke test: 5 user-side route + 5 admin-side route HTTP 200, end-to-end sell+buy+claim flow lolos.

## Task Status Legend

`[ ]` pending — `[~]` in progress — `[x]` done — `[!]` blocked/needs decision

---

## Round 1: Domain Model + Slot Lifecycle (HIGH)

**Objective:** Bikin core domain `GmailAccount` + slot generation flow + verify lifecycle. Belum ada buy-side, belum FE.

**Pre-req:** `wallet-withdraw-system.md` Round 1 selesai (kolom `pocket` di `wallet_ledgers` exist).

### Task 1.1: Model

**Files:**
- Create: `premiumhub-api/internal/model/gmail_account.go`
- Create: `premiumhub-api/internal/model/gmail_pricing.go`
- Create: `premiumhub-api/internal/model/gmail_strike.go`

```go
// gmail_account.go
package model

import (
    "time"
    "github.com/google/uuid"
    "gorm.io/gorm"
)

const (
    GmailStatusPendingCreate  = "pending_create"   // slot generated, user belum submit
    GmailStatusPendingVerify  = "pending_verify"   // user submit, admin queue
    GmailStatusVerified       = "verified"          // admin verified, in inventory ready jual
    GmailStatusSold           = "sold"              // udah dibeli buyer
    GmailStatusDisposed       = "disposed"          // banned/replaced, audit only
    GmailStatusExpired        = "expired"           // slot pending_create > 6 jam, gak dibikin user
    GmailStatusRejected       = "rejected"          // admin reject saat verify
)

type GmailAccount struct {
    ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

    // Source tracking (sell-side)
    CreatedByUserID uuid.UUID  `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
    Status          string     `gorm:"type:varchar(24);not null;index" json:"status"`

    // Credentials (encrypted at rest via NewStockCipher)
    Email           string `gorm:"type:varchar(128);not null;uniqueIndex" json:"email"`
    PasswordEnc     string `gorm:"type:text;not null" json:"-"`            // generated by platform initially, replaced by admin after verify
    PasswordVersion string `gorm:"type:varchar(16);not null;default:'initial'" json:"password_version"` // initial | post_verify | post_handover

    // Slot lifecycle
    SlotExpiresAt   *time.Time `json:"slot_expires_at,omitempty"`            // 6h dari created_at (kalo masih pending_create)
    SubmittedAt     *time.Time `json:"submitted_at,omitempty"`               // saat user submit "udah selesai"

    // Verify (sell-side)
    VerifiedByAdminID *uuid.UUID `gorm:"type:uuid" json:"verified_by_admin_id,omitempty"`
    VerifiedAt        *time.Time `json:"verified_at,omitempty"`
    SellerPayoutAmount int64     `gorm:"not null;default:0" json:"seller_payout_amount"` // amount credited to Saldo Pendapatan
    SellerPayoutLedgerID *uuid.UUID `gorm:"type:uuid" json:"seller_payout_ledger_id,omitempty"`

    // Reject (sell-side)
    RejectedByAdminID *uuid.UUID `gorm:"type:uuid" json:"rejected_by_admin_id,omitempty"`
    RejectedAt        *time.Time `json:"rejected_at,omitempty"`
    RejectReason      string     `gorm:"type:varchar(64)" json:"reject_reason,omitempty"`
    RejectNote        string     `json:"reject_note,omitempty"`

    // Sold (buy-side)
    SoldToUserID *uuid.UUID `gorm:"type:uuid;index" json:"sold_to_user_id,omitempty"`
    SoldOrderID  *uuid.UUID `gorm:"type:uuid;index" json:"sold_order_id,omitempty"`
    SoldPrice    int64      `gorm:"not null;default:0" json:"sold_price"`
    SoldAt       *time.Time `json:"sold_at,omitempty"`

    // Disposed (banned)
    DisposedAt   *time.Time `json:"disposed_at,omitempty"`
    DisposedReason string   `json:"disposed_reason,omitempty"` // banned_after_sale | etc

    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

func (g *GmailAccount) BeforeCreate(_ *gorm.DB) error {
    if g.ID == uuid.Nil {
        g.ID = uuid.New()
    }
    return nil
}
```

```go
// gmail_pricing.go — single row config table
package model

import (
    "time"
    "github.com/google/uuid"
    "gorm.io/gorm"
)

type GmailPricing struct {
    ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

    BuyPrice  int64 `gorm:"not null" json:"buy_price"`   // platform pays seller
    SellPrice int64 `gorm:"not null" json:"sell_price"`  // platform charges buyer

    BulkDiscountEnabled bool `gorm:"not null;default:false" json:"bulk_discount_enabled"`
    // tiers stored as JSON: [{"min_qty":10,"discount_pct":5}, {"min_qty":50,"discount_pct":10}]
    BulkDiscountTiers   string `gorm:"type:text" json:"bulk_discount_tiers"`

    LowInventoryThreshold int `gorm:"not null;default:20" json:"low_inventory_threshold"`

    UpdatedByAdminID *uuid.UUID `gorm:"type:uuid" json:"updated_by_admin_id,omitempty"`
    CreatedAt        time.Time  `json:"created_at"`
    UpdatedAt        time.Time  `json:"updated_at"`
}

func (g *GmailPricing) BeforeCreate(_ *gorm.DB) error {
    if g.ID == uuid.Nil {
        g.ID = uuid.New()
    }
    return nil
}
```

```go
// gmail_strike.go
package model

import (
    "time"
    "github.com/google/uuid"
    "gorm.io/gorm"
)

type GmailStrike struct {
    ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
    UserID uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
    GmailAccountID uuid.UUID `gorm:"type:uuid;not null" json:"gmail_account_id"`
    Reason string `gorm:"type:varchar(64);not null" json:"reason"`
    AdminID uuid.UUID `gorm:"type:uuid;not null" json:"admin_id"`
    CreatedAt time.Time `json:"created_at"`
}

func (g *GmailStrike) BeforeCreate(_ *gorm.DB) error {
    if g.ID == uuid.Nil {
        g.ID = uuid.New()
    }
    return nil
}
```

User ban field: tambah ke `User` model existing — `GmailSellBannedUntil *time.Time`. Jangan bikin tabel terpisah, ban itu temporal flag user.

Register semua di `config/database.go` `AutoMigrate(...)`. Default `GmailPricing` di-seed via `ensureDefaultGmailPricing(db)` mirip pattern existing seeders.

### Task 1.2: Repo

**Files:**
- Create: `premiumhub-api/internal/repository/gmail_account_repo.go`
- Create: `premiumhub-api/internal/repository/gmail_pricing_repo.go`
- Create: `premiumhub-api/internal/repository/gmail_strike_repo.go`

`GmailAccountRepo` methods:
- `Create(g *model.GmailAccount) error`
- `GetByID(id uuid.UUID) (*model.GmailAccount, error)`
- `GetByEmail(email string) (*model.GmailAccount, error)` — uniqueness check pas slot generation
- `CountPendingByUser(userID uuid.UUID) (int64, error)` — sum `pending_create` + `pending_verify` per user (untuk cap 3 simultan)
- `ListPendingVerify(page, limit) ([]GmailAccount, int64, error)` — admin queue
- `ListVerified(page, limit) ([]GmailAccount, int64, error)` — inventory ready jual
- `CountVerified() (int64, error)` — buat low-inventory alert + buy-side stock check
- `LockOldestVerifiedForOrder(tx *gorm.DB, n int) ([]GmailAccount, error)` — FIFO claim N rows in tx, mark sold tentative
- `MarkVerified(id, adminID, payoutAmount, ledgerID, newPasswordEnc)`
- `MarkRejected(id, adminID, reason, note)`
- `MarkSold(id, buyerID, orderID, soldPrice)`
- `MarkDisposed(id, reason)`
- `MarkExpired(id)`
- `ListSlotsExpiring(now time.Time, limit int) ([]GmailAccount, error)` — worker query: status=pending_create AND slot_expires_at < now
- `ListMyContributions(userID, page, limit, statusFilter)` — user dashboard

`GmailPricingRepo`:
- `Get() (*model.GmailPricing, error)` — single row, ensure exists via seed
- `Update(updates, adminID)`

`GmailStrikeRepo`:
- `Create(s *model.GmailStrike) error`
- `CountActiveByUser(userID, since time.Time) (int64, error)` — count strike dalam window 30 hari terakhir
- `ListByUser(userID) ([]model.GmailStrike, error)`

### Task 1.3: Service — slot generation

**Files:**
- Create: `premiumhub-api/internal/service/gmail_service.go`
- Create: `premiumhub-api/internal/service/gmail_creds_generator.go`

```go
type GmailService struct {
    cfg               *config.Config
    repo              *repository.GmailAccountRepo
    pricingRepo       *repository.GmailPricingRepo
    strikeRepo        *repository.GmailStrikeRepo
    walletRepo        *repository.WalletRepo
    userRepo          *repository.UserRepo
    notifSvc          *NotificationService
    cipher            *credential.StockCipher  // reuse, encrypt password
}
```

Public method `RequestSlot(userID) (*GmailAccount, error)`:
1. Check user `GmailSellBannedUntil` — kalo `now < banned_until` → 403 with remaining days
2. Check `CountPendingByUser` ≥ 3 → 400 "Selesaikan slot pending dulu"
3. Generate creds via `creds_generator`:
   - Email: format `{prefix}{rand6digit}@gmail.com`. Prefix configurable via env `GMAIL_GENERATED_EMAIL_PREFIX` (default "premium"). Random suffix 6-8 char alphanumeric.
   - Loop generate sampe `GetByEmail` return not found (uniqueness retry, max 10 attempts).
   - Password: 12-16 char, mix upper/lower/digit/special. Cryptographic random.
4. Encrypt password via `cipher.Encrypt()`.
5. Create `GmailAccount` row: status=`pending_create`, slot_expires_at = now + 6h.
6. Return — handler tampilin email + plain password ke user (one-time view).

```go
// creds_generator.go
type GmailCredsGenerator struct {
    prefix string
}

func NewGmailCredsGenerator(prefix string) *GmailCredsGenerator { ... }

func (g *GmailCredsGenerator) Generate() (email, password string, err error)
```

Public method `SubmitSlot(userID, slotID) error`:
1. Load gmail by ID
2. Cek `g.CreatedByUserID == userID`
3. Cek `g.Status == pending_create` (not expired, not already submitted)
4. Set `Status = pending_verify`, `SubmittedAt = now`, save.
5. Notif user (in-app): "Submission diterima, menunggu verifikasi admin."

Public method `ListMySlots(userID, status, page, limit)`:
- Return list user's gmail accounts dengan filter

### Task 1.4: Service — admin verify + reject + strike

**Files:**
- Modify: `premiumhub-api/internal/service/gmail_service.go`

Admin methods:

```go
func (s *GmailService) AdminListPendingVerify(page, limit) (...)
func (s *GmailService) AdminGetByID(id) (*GmailAccount, error)
func (s *GmailService) AdminVerify(adminID, gmailID, newPlainPassword string) error
func (s *GmailService) AdminReject(adminID, gmailID, reason, note string) error
```

`AdminVerify` flow (semua dalam 1 walletRepo.Transaction):
1. Load gmail, validate `Status == pending_verify`
2. Encrypt `newPlainPassword` → set `PasswordEnc`, `PasswordVersion = "post_verify"`
3. Set `VerifiedByAdminID, VerifiedAt = now`
4. Load `GmailPricing.BuyPrice` → `payoutAmount`
5. Credit Saldo Pendapatan via wallet ledger entry: `Type=gmail_sell_credit, Pocket=earn, Amount=+payoutAmount`, ref `gmail:<gmailID>:sell`
6. Set `SellerPayoutAmount, SellerPayoutLedgerID, Status = verified`
7. Save gmail
8. Notif user "Akun terverifikasi, +Rp X masuk Saldo Pendapatan"
9. Async (post-tx): check if verified count cross low-inventory threshold → fire admin notif

`AdminReject` flow:
1. Load gmail, validate `Status == pending_verify`
2. Set `RejectedByAdminID, RejectedAt = now, RejectReason, RejectNote, Status = rejected`
3. Create strike entry
4. `CountActiveByUser(userID, now-30days)` ≥ 3 → set `User.GmailSellBannedUntil = now + 30days`, notif user "Akun lu di-ban dari setor gmail 30 hari"
5. Else notif user "Setoran ditolak: <reason>. Strike X/3."
6. Save

**Reject reasons** (enum):
- `recovery_set` — user nambah recovery email/phone (langgar aturan)
- `login_failed` — credentials gak match (user salah submit / akun belum dibikin)
- `freshness_failed` — akun bukan baru (ada history, recovery sudah set sebelumnya, dll)
- `other` — admin manual reason

### Task 1.5: Slot expiry worker

**Files:**
- Create: `premiumhub-api/internal/service/gmail_slot_expiry_worker.go`
- Modify: `premiumhub-api/internal/routes/router.go` — register `service.StartGmailSlotExpiryWorker(cfg, gmailSvc)`

Worker loop tiap 5 menit:
1. `ListSlotsExpiring(now)` → list slot pending_create yang melebihi expiry
2. Per row: `MarkExpired(id)` + notif user "Slot setor expired (>6 jam tidak diselesaikan), kuota pending kebuka kembali"

Window check: `WHERE status = 'pending_create' AND slot_expires_at < now`. Limit 100/run buat avoid lock long.

### Task 1.6: Handler + routes (sell-side user)

**Files:**
- Create: `premiumhub-api/internal/handler/gmail_handler.go`
- Modify: `premiumhub-api/internal/routes/router.go`

User routes (di `protected`):
```
POST   /api/v1/gmail/slots                       → RequestSlot (response: email + one-time plain password + guide instructions)
POST   /api/v1/gmail/slots/:id/submit            → SubmitSlot
GET    /api/v1/gmail/slots                       → ListMySlots (filter by status)
GET    /api/v1/gmail/slots/:id                   → GetMine
```

Rate limit: pakai `NewUserRateLimiter` dengan `cfg.GmailSellRateLimitMax/Window` — config baru, default 30/min (request slot bisa burst pas user bener-bener mau setor banyak).

### Round 1 Verification

- [ ] User submit `RequestSlot` 4x → 4th rejected (cap 3 simultan)
- [ ] Slot pending_create, tunggu 6 jam (atau adjust env temporary 1 menit) → worker mark expired, kuota kebuka
- [ ] User submit slot → admin liat di `pending_verify` queue
- [ ] Admin reject 3x → user kena ban 30 hari, request slot ke-4 hari berikut → 403
- [ ] Admin verify → ledger entry pocket=earn tercipta, balance pendapatan user naik
- [ ] Verify cross threshold → admin dapet notif low-inventory (manual trigger test)

---

## Round 2: Buy-side — Inventory + Order Flow (HIGH)

**Objective:** Buyer bisa beli gmail (1-by-1 atau bulk), instant auto-deliver dari verified pool.

**Architectural decision (post-R1):** Pakai **isolated GmailOrderService + dedicated GmailOrder model** paralel, gak fork OrderService existing. Reasoning:
- OrderService udah dipake premapps + sosmed (production stable). Modifying = regression risk.
- Order model tightly coupled ke ProductPrice (`PriceID NOT NULL`) — gmail gak punya ProductPrice, semantically beda. Force-fit = schema bloat + nullable creep.
- Isolated audit surface buat per-round audit workflow (cuma audit gmail-specific code).
- Pattern sama dengan DigiConnect yang udah jalan paralel.
- New model `GmailOrder` lean (UserID, Quantity, GrossAmount, DiscountAmount, NetAmount, Status, LedgerID).
- New endpoint POST /api/v1/gmail/buy (gak shadow POST /api/v1/orders).

### Task 2.1: Pricing service (no schema change)

**Files:**
- Create: `premiumhub-api/internal/service/gmail_pricing_service.go`

```go
type GmailPricingService struct {
    repo *repository.GmailPricingRepo
}

func (s *GmailPricingService) GetActive() (*model.GmailPricing, error)
func (s *GmailPricingService) CalculateTotal(qty int64) (gross int64, discount int64, net int64, err error)
func (s *GmailPricingService) AdminUpdate(adminID uuid.UUID, input GmailPricingUpdateInput) error
```

`CalculateTotal` logic:
- `gross = qty * sell_price`
- Kalo `bulk_discount_enabled`: parse tiers JSON, find tier yang `qty >= min_qty` (terbesar), apply `discount_pct`
- `net = gross - discount`

Validation di AdminUpdate:
- `buy_price > 0`, `sell_price > buy_price` (margin guard)
- Bulk tier JSON parseable, no overlap, ascending min_qty

### Task 2.2: GmailOrderService — buy flow

**Files:**
- Create: `premiumhub-api/internal/service/gmail_order_service.go`

```go
type GmailOrderService struct {
    cfg          *config.Config
    gmailRepo    *repository.GmailAccountRepo
    orderRepo    *repository.OrderRepo
    walletRepo   *repository.WalletRepo
    notifRepo    *repository.NotificationRepo
    pricingSvc   *GmailPricingService
    cipher       *credential.StockCipher
}

func (s *GmailOrderService) Buy(buyerID uuid.UUID, qty int64) (*BuyResult, error)
func (s *GmailOrderService) ListMyOrders(buyerID uuid.UUID, page, limit int) ([]model.Order, int64, error)
func (s *GmailOrderService) GetMyOrderWithCreds(buyerID, orderID uuid.UUID) (*OrderWithCreds, error)
```

`Buy` flow (atomic via walletRepo.Transaction):
1. Validate qty >= 1 (max via cfg.GmailBuyMaxQtyPerOrder, default 50)
2. CalculateTotal (gross/discount/net)
3. Lock buyer user spend pocket via LockUserByIDTx
4. Cek balance >= net → kalo gak cukup → 400 "Saldo Utama gak cukup"
5. LockOldestVerifiedForOrderTx(tx, qty) — FIFO claim dengan SKIP LOCKED (sudah ada di repo R1)
6. Kalo `len(locked) < qty` → rollback, 409 "Stok cuma N, kurangi qty"
7. Debit buyer.WalletBalance (spend pocket) -= net
8. Create Order row: Type="gmail", Status="completed" (instant), Quantity=qty, TotalPrice=net
9. Per locked row: mark Status=sold, SoldToUserID=buyer, SoldOrderID=order.ID, SoldPrice=unit (gross/qty round), SoldAt=now
10. CreateLedgerTx (credit reverse: type=debit, pocket=spend, category=gmail_buy, ref="gmail-order:<orderID>")
11. writeNotifTx (gmail_purchased, "Pembelian sukses, X akun")

`OrderWithCreds` decrypt creds on-the-fly buat response, gak pernah persist plain. `GetMyOrderWithCreds` cek buyer == user_id (ownership guard).

### Task 2.3: Buy-side handler + routes

**Files:**
- Modify: `premiumhub-api/internal/handler/gmail_handler.go`
- Modify: `premiumhub-api/internal/routes/router.go`

```
GET    /api/v1/public/gmail/pricing           → public, current sell_price + tier preview
GET    /api/v1/public/gmail/availability      → public, current verified count (cache 60s biar gak bocor signal kompetitor)
POST   /api/v1/gmail/buy                      → protected, body: { quantity }
GET    /api/v1/gmail/orders                   → protected, list buyer orders type=gmail
GET    /api/v1/gmail/orders/:id               → protected, detail with decrypted credentials (auth check buyer = user)
```

Rate limit POST /gmail/buy dengan PaymentRateLimit middleware.

Public endpoints gak butuh auth tapi pake API throttler global.

### Task 2.4: Audit + Tests (mandatory per-round workflow)

**Audit checklist** (sama kaya R1):
1. Auth boundary — GetMyOrderWithCreds enforce buyer==user, ownership di order.UserID
2. Input validation — qty >= 1 dan <= max, pricing valid
3. Money flow — atomic dalam tx, idempotent guard (order.Status=completed udah final)
4. TOCTOU — pricing + balance + claim + debit semua di tx, no count-then-act outside lock
5. Rate limit — /buy endpoint
6. Audit trail — order.Type="gmail", ledger.Reference="gmail-order:<id>"
7. Notif clarity — "Pembelian sukses, X akun, total Rp Y"
8. Credential leak — decrypted creds cuma di response, gak masuk log/db plain

**Tests** (`gmail_order_service_test.go`):
- Happy: buy 1, buy 5, buy with bulk discount tier
- Stock exhausted: 409 dengan rollback (no balance debit, no order created)
- Insufficient balance: 400 dengan rollback
- Race regression: 5 parallel buys @ qty=2 dengan stock=5 (cuma yg lock duluan menang, total sold ≤ stock)
- Auth scoping: GetMyOrderWithCreds nge-rejct cross-user access
- Pricing validation: qty=0, qty>max
- Idempotency: re-call atomic action gak double-debit/double-claim

### Round 2 Verification

- [ ] Buyer beli 1 akun → instant order completed, credentials tampil di response
- [ ] Buyer beli 5 akun bulk (flat pricing) → 5 rows ke-mark sold, total = 5×5000
- [ ] Admin enable tier discount 10% di 50+ → buyer beli 50 → total = 50×5000×0.9 = 225000
- [ ] Buyer beli 10 saat inventory cuma 5 → 409 "Stok cuma 5", balance gak ke-debit, no order row
- [ ] Buyer balance pocket=spend insufficient → 400, no claim, no debit
- [ ] Public pricing endpoint return correct config dan preview tier
- [ ] Public availability endpoint cached 60s (cek header)
- [ ] Race test PASS (parallel buys gak overcommit stock)
- [ ] Audit + tests lulus, commit dengan summary lengkap

---

## Round 3: Warranty + Replacement Flow (HIGH)

**Objective:** Reuse `Claim` model untuk warranty 1×24 jam. Auto-replace dari inventory atau auto-refund kalo kosong.

### Task 3.1: Extend Claim model (kalo perlu)

**Files:**
- Modify: `premiumhub-api/internal/model/claim.go` (kalo perlu field tambahan)

Field check current:
- `OrderID` — link ke order yang di-claim
- `OrderItemID` (kalo per-item granularity needed)
- `Status` (pending/approved/rejected/replaced/refunded)
- `Reason`
- `AdminID, ReviewedAt`

Untuk gmail: 1 order bisa punya N akun, tiap akun bisa di-claim independent. Berarti `Claim.OrderItemID` perlu (kalo belum ada, tambah). Atau pakai `Claim.GmailAccountID` direct link.

Tambah field di Claim kalo belum ada: `ResolutionType string` enum (`replaced` | `refunded`), `ReplacementGmailAccountID *uuid.UUID`, `RefundLedgerID *uuid.UUID`.

### Task 3.2: Service — claim resolution

**Files:**
- Create: `premiumhub-api/internal/service/gmail_warranty_service.go`

```go
type GmailWarrantyService struct {
    cfg          *config.Config
    gmailRepo    *repository.GmailAccountRepo
    claimRepo    *repository.ClaimRepo
    orderRepo    *repository.OrderRepo
    walletRepo   *repository.WalletRepo
    pricingSvc   *GmailPricingService
    notifSvc     *NotificationService
}
```

Public `CreateClaim(buyerID, gmailAccountID, reason)`:
1. Load gmail, validate `SoldToUserID == buyerID && Status == sold`
2. Cek `now - SoldAt <= 24h` → kalo lewat → 400 "Garansi expired"
3. Cek belum ada claim approved untuk gmail ini (1 replacement per akun)
4. Buat Claim entry status=pending, link ke gmail
5. **Auto-resolve immediately** (no admin approval needed untuk MVP):
   a. Lock 1 row dari inventory verified (FIFO)
   b. Kalo dapet → mark gmail original `Status=disposed, DisposedReason=banned_after_sale`, mark replacement `Status=sold, SoldOrderID=original.SoldOrderID` (chain), update Claim `Status=replaced, ResolutionType=replaced, ReplacementGmailAccountID=replacement.ID`, notif buyer "Replacement dikirim"
   c. Kalo gagal (inventory empty) → mark gmail original `Status=disposed, DisposedReason=banned_after_sale`, refund original sold price ke buyer pocket=spend, update Claim `Status=refunded, ResolutionType=refunded, RefundLedgerID=ledger.ID`, notif buyer "Refund Rp X ke Saldo Utama"

### Task 3.3: Handler

**Files:**
- Modify: `premiumhub-api/internal/handler/gmail_handler.go`

```
POST   /api/v1/gmail/orders/:order_id/claims     → CreateClaim (body: gmail_account_id, reason)
GET    /api/v1/gmail/orders/:order_id/claims     → list claims for buyer order
```

### Round 3 Verification

- [ ] Buyer claim akun banned dalam 24 jam → instant replacement dari inventory
- [ ] Buyer claim akun banned dalam 24 jam, inventory kosong → instant refund ke pocket=spend
- [ ] Buyer claim 25 jam setelah beli → 400 "garansi expired"
- [ ] Buyer claim akun yang udah pernah di-replace → 400 "already replaced"
- [ ] Original gmail status=disposed setelah claim resolved
- [ ] Replacement gmail.SoldOrderID == original.SoldOrderID (audit chain)

---

## Round 4: Frontend — User Side (MEDIUM)

**Objective:** UI lengkap user side: tab Beli + Jual di /dashboard/gmail.

### Task 4.1: Types + Service

**Files:**
- Create: `premiumhub-web/src/types/gmail.ts`
- Create: `premiumhub-web/src/services/gmailService.ts`

Mirror struct backend: `GmailAccount`, `GmailPricing`, `GmailSlotResponse` (one-time view dengan plain password), `GmailOrderItem`.

### Task 4.2: User dashboard page (tabs)

**Files:**
- Create: `premiumhub-web/src/app/dashboard/gmail/page.tsx` (tabs Beli/Jual landing)
- Create: `premiumhub-web/src/app/dashboard/gmail/buy/page.tsx` (buy form)
- Create: `premiumhub-web/src/app/dashboard/gmail/buy/orders/[id]/page.tsx` (order detail dengan creds)
- Create: `premiumhub-web/src/app/dashboard/gmail/sell/page.tsx` (sell hub: my slots + request slot button)
- Create: `premiumhub-web/src/app/dashboard/gmail/sell/slots/[id]/page.tsx` (slot detail with guide + submit form)

Tab strip pakai pattern existing dashboard (lihat `/dashboard/sosmed/orders` yang udah ada tab strip post-overhaul). `StatusPill` shared. `EmptyState` shared. `ConfirmDialog` shared buat submit slot + claim warranty.

**Buy page:**
- Form qty input dengan live total preview
- Tampilin `availability` dari public endpoint
- Submit → reuse axios call ke `/api/v1/orders`
- Setelah sukses → redirect ke order detail, credentials tampil dengan copy-to-clipboard button per akun
- Setiap akun ada button "Klaim Garansi" (cuma aktif kalo dalam 24 jam dan belum di-claim)

**Sell hub page:**
- Card "Request Slot Setor" (button disabled kalo banned atau pending ≥ 3)
- List my slots (filter status: all/pending_create/pending_verify/verified/rejected/expired)
- Tiap row tampil status pill, tanggal, action (kalo pending_create → "Lanjutkan", kalo pending_verify → "Menunggu admin")

**Slot detail page (for pending_create):**
- Tampil email + plain password (one-time view, warning "screenshot atau salin sekarang, password ini gak akan ditampilkan lagi setelah lu refresh")
- Step-by-step guide bahasa Indonesia:
  1. Buka https://accounts.google.com/signup di tab baru
  2. Gunakan email + password ini
  3. **JANGAN** tambahkan recovery email/phone
  4. Isi nama, tanggal lahir, dll sesuai kebutuhan
  5. Setelah akun jadi, klik "Saya Sudah Selesai" di bawah
- Submit button "Saya Sudah Selesai" → POST submit
- Timer countdown sampai slot expired (slot_expires_at)

**Slot detail (for pending_verify / verified / rejected):**
- Status info, timeline, kalo rejected tampil reason + strike count
- Kalo verified tampil amount yang masuk Saldo Pendapatan + link ke /dashboard/wallet

### Task 4.3: Sidebar entry

**Files:**
- Modify: `premiumhub-web/src/components/layout/DashboardSidebar.tsx`

Tambah ke `MENU`:
```ts
{ href: '/dashboard/gmail', icon: AtSign /* lucide */, label: 'Gmail' }
```

Posisi: di atas "Order DigiSosmed" atau setelahnya, tergantung priority. Default: setelah DigiSosmed entry, sebelum DigiConnect.

### Round 4 Verification

- [ ] Tab Beli/Jual switch lancar, no flicker
- [ ] Buy 1 akun → order detail show credentials, copy works
- [ ] Klaim garansi button works, replacement/refund reflected real-time (atau refresh)
- [ ] Sell flow: request slot → guide muncul → manual create di Google → submit → masuk pending_verify
- [ ] Pending_create slot setelah 6 jam → di-mark expired (worker), card disable + label "Expired"
- [ ] Verified slot tampil "+Rp X to Saldo Pendapatan"
- [ ] Rejected slot tampil reason + warning "Strike X/3"
- [ ] Banned user tampil banner "Lu kena ban 30 hari sampe DD/MM"

---

## Round 5: Admin Side (HIGH)

**Objective:** Admin tools lengkap — verifikasi queue, inventory browser, pricing config, strike management, sales analytics, low alert.

### Task 5.1: Admin handler + routes

**Files:**
- Modify: `premiumhub-api/internal/handler/gmail_handler.go`

Admin routes:
```
GET    /api/v1/admin/gmail/pending-verify          → list queue
GET    /api/v1/admin/gmail/accounts/:id            → detail (with decrypted creds untuk admin verify)
POST   /api/v1/admin/gmail/accounts/:id/verify     → body: { new_password }
POST   /api/v1/admin/gmail/accounts/:id/reject     → body: { reason, note }
GET    /api/v1/admin/gmail/inventory               → list filter status
GET    /api/v1/admin/gmail/pricing                 → get current
PUT    /api/v1/admin/gmail/pricing                 → update
GET    /api/v1/admin/gmail/strikes                 → list users with active strikes
POST   /api/v1/admin/gmail/strikes/:user_id/reset  → unban + clear strikes
GET    /api/v1/admin/gmail/analytics               → sales analytics aggregate
```

`/admin/gmail/accounts/:id` GET response include:
- `decrypted_password` (only for admin role, for verification login)
- All meta fields

Risk: admin endpoint exposes plain password. Restrict via `middleware.AdminOnly` udah, plus log access ke audit table optional.

### Task 5.2: Sales analytics service

**Files:**
- Create: `premiumhub-api/internal/service/gmail_analytics_service.go`

`GetWeeklyOverview(since time.Time, until time.Time)` return:
```go
type GmailWeeklyAnalytics struct {
    Weeks []WeekStats
    Totals AggregateStats
}

type WeekStats struct {
    WeekStart time.Time
    InventoryIn int64   // # gmail verified that week
    InventoryOut int64  // # gmail sold that week
    Revenue int64       // sum sold_price
    Cost int64          // sum buy_price (yang di-credit ke seller)
    Margin int64        // revenue - cost
}
```

Default range 8 minggu terakhir.

### Task 5.3: Low inventory alert worker

**Files:**
- Create: `premiumhub-api/internal/service/gmail_low_inventory_worker.go`
- Modify: `premiumhub-api/internal/routes/router.go` — register `service.StartGmailLowInventoryWorker(cfg, gmailSvc)`

Worker tiap 30 menit:
1. `CountVerified()` → current inventory
2. Get `pricing.LowInventoryThreshold`
3. Kalo `count < threshold` AND **belum di-notify dalam 6 jam terakhir** (anti-spam) → send notif ke semua admin + record `last_alert_at`
4. Track `last_alert_at` di `GmailPricing` row sebagai field tambahan, atau di Redis (`gmail:low_alert:last_at`).

### Task 5.4: Admin FE pages

**Files:**
- Create: `premiumhub-web/src/app/admin/(core)/gmail/page.tsx` (overview hub: links ke sub-pages)
- Create: `premiumhub-web/src/app/admin/(core)/gmail/verifikasi/page.tsx` (queue + verify form)
- Create: `premiumhub-web/src/app/admin/(core)/gmail/inventory/page.tsx` (inventory browser)
- Create: `premiumhub-web/src/app/admin/(core)/gmail/pricing/page.tsx` (config editor)
- Create: `premiumhub-web/src/app/admin/(core)/gmail/strikes/page.tsx` (strike management)
- Create: `premiumhub-web/src/app/admin/(core)/gmail/analytics/page.tsx` (sales analytics)
- Modify: `premiumhub-web/src/components/admin/admin-sidebar.tsx` — tambah section "Gmail"
- Modify: `premiumhub-web/src/app/admin/(core)/layout.tsx` — `resolveCorePageMeta` branches untuk semua sub-routes

Admin sidebar update:
```ts
{
  label: 'Gmail',
  items: [
    { href: '/admin/gmail/verifikasi', label: 'Verifikasi Setoran', icon: '✓' },
    { href: '/admin/gmail/inventory',  label: 'Inventory',           icon: '◳' },
    { href: '/admin/gmail/pricing',    label: 'Pricing',              icon: '$' },
    { href: '/admin/gmail/strikes',    label: 'Strike Users',         icon: '!' },
    { href: '/admin/gmail/analytics',  label: 'Sales Analytics',      icon: '📊' },
  ],
}
```

Verifikasi page detail:
- Card per pending gmail: email + decrypted password (with copy button) + button "Login & Verify" yang buka Gmail di tab baru
- Form di bawah: input "Password baru" (auto-generated suggestion via JS, admin bisa edit), button Verify
- Reject button → confirmation dengan reason picker + note textarea

Pricing page:
- Form simple: input buy_price, sell_price, low_inventory_threshold, toggle bulk_discount_enabled
- Kalo enabled, dynamic add/remove tier rows (min_qty, discount_pct)
- Save → PUT, refresh

Analytics page:
- Sparkline 8 minggu (revenue, margin) dengan Recharts/Chart.js minimal — atau just simple HTML bars kalo gak mau pasang lib
- Total card: cumulative revenue, cost, margin, net inventory turnover

### Round 5 Verification

- [ ] Admin queue list, click row → detail page → form verify works
- [ ] Reject → strike count user naik, kalo cross 3 → user kena ban
- [ ] Pricing update → buy/sell flow pake angka baru immediately
- [ ] Strike management: list user dengan strikes, reset works
- [ ] Analytics page render chart 8 minggu (trigger seed data via dummy verify+sold flow di workspace)
- [ ] Low inventory alert: temporary set threshold 999 → admin dapet notif within 30 menit

---

## Round 6: Workspace Promote → Live (HIGH)

**Objective:** Setelah Round 1-5 stable di workspace, deploy live.

### Task 6.1: Pre-promote checks

- [ ] Sandbox: `\d gmail_accounts`, `\d gmail_pricings`, `\d gmail_strikes` exist
- [ ] Default `gmail_pricings` row seeded dengan buy=3000, sell=5000, threshold=20
- [ ] Existing wallet pocket migration udah selesai (dependency dari WD plan)
- [ ] Env vars: `GMAIL_GENERATED_EMAIL_PREFIX` (default "premium"), `GMAIL_SELL_RATE_LIMIT_MAX` (default 30), `GMAIL_SELL_RATE_LIMIT_WINDOW` (default 1m), `GMAIL_SLOT_EXPIRY_HOURS` (default 6), `GMAIL_VERIFY_BAN_STRIKES` (default 3), `GMAIL_VERIFY_BAN_DURATION_DAYS` (default 30) di sandbox `.env`
- [ ] `apis@lokal.com` injector service (sandbox-ubuntu) gak ngirim ke gmail endpoint — confirm injector cuma 5sim/sosmed

### Task 6.2: Promote

User trigger `gas live`. Hermes deploy via `./deploy.sh`. Smoke test:
- Public endpoints: `/public/gmail/pricing`, `/public/gmail/availability` → 200
- User flow: login → request slot → submit → verify by admin (use staging test admin) → check Saldo Pendapatan
- Buy flow: login as buyer → topup → buy → check creds in order detail
- Claim flow: trigger banned-after-sale via admin manual disposed marker, claim → replacement or refund

### Task 6.3: Monitor minggu pertama

- Daily verified count vs sold count (turnover ratio)
- Strike rate per user (kalo > 30% reject rate, mungkin guide kurang jelas atau spam attack)
- Low inventory alerts firing → adjust threshold kalo terlalu sensitif
- Buyer claim rate (% banned within 24h) → kalo > 10%, freshness verification harus diperketat
- Audit ledger consistency: sum gmail_sell_credit pocket=earn entries == sum verified.SellerPayoutAmount

---

## Open Questions / Decisions Pending

- [ ] **Email prefix policy.** Pakai `premium`, `pikipici`, brand-specific, atau random non-branded? Branded gampang dikenali Google sebagai bot pattern → akun lebih cepet flagged. Random non-branded lebih aman tapi gak ada brand signal. **Default: `premium` + 8 random char.**
- [ ] **Plain password storage saat slot pending_create.** Kita simpan encrypted, tapi user perlu liat sekali. Approach: tampilin dari decrypt sekali pada slot detail, lalu tetep encrypted di DB. User wajib screenshot/save sendiri. Kalo lupa → dia harus minta slot baru (cancel slot lama). **Confirm flow ini OK, atau mau "tampilkan max 3 kali"?**
- [ ] **Admin verify password input.** Admin harus generate password baru manual, atau sistem auto-generate dan admin tinggal copy ke Google? Default: auto-generate dengan tombol "regenerate" di FE, admin tinggal paste ke Google account settings.
- [ ] **Decrypted creds di admin endpoint.** Berisiko kalo admin token bocor. Mau tambah audit log per akses admin ke decrypted creds? (defer ke later round).
- [ ] **Concurrent buy race.** 2 buyer beli barengan, qty total > inventory. `LockOldestVerifiedForOrder` pake `SELECT FOR UPDATE` di gorm? Confirm transaction isolation level dan FOR UPDATE clause.
- [ ] **Refund pocket destination.** Saat replacement empty → refund ke pocket=spend (saldo utama). Confirmed di #18. Tapi: kalo buyer originally pay pake gabungan spend+earn (kalo nanti sistem support), refund balikin proporsional? Untuk MVP: spend-only, single pocket.
- [ ] **Strike window semantics.** "3 strike dalam 30 hari" — window rolling atau calendar? Default: rolling 30 hari dari `now`.
- [ ] **Banned user expiry.** Setelah 30 hari ban, strike count clear-out atau tetep accumulate? Default: clear strikes saat ban expire (clean slate).
- [ ] **Inventory turnover signal ke seller.** Kalo inventory tinggi banget (banyak verified gak laku), apa user yang mau setor di-warning? Atau di-block sementara request slot? **Default: gak ada gating, kasih signal di FE aja ("inventory penuh, akun mungkin lama lakunya")**.

---

## References

- `premium-hub-ops` skill — repo conventions, deploy, pitfalls (`pkg/credential` cipher pattern)
- `.kiro/steering/wallet-withdraw-system.md` — pocket=earn dependency, hard pre-req Round 1 selesai
- `.kiro/steering/digiconnect-backend-hardening.md` — pola round-based hardening
- `.kiro/steering/dashboard-user-overhaul.md` — shared FE components yang harus di-reuse
- Existing `internal/service/order_service.go` + `Stock` flow — pattern yang di-extend untuk gmail buy-side
- Existing `internal/service/claim_service.go` — pattern yang di-extend untuk gmail warranty
