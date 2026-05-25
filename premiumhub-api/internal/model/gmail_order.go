package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Gmail order lifecycle states.
const (
	GmailOrderStatusCompleted = "completed" // success — gmail rows claimed + creds delivered
	GmailOrderStatusRefunded  = "refunded"  // post-sale: warranty refund (set in Round 3)
)

// Ledger category for buy-side debit.
const (
	LedgerCategoryGmailBuyDebit = "gmail_buy_debit"
)

// GmailOrder is the buy-side counterpart to the sell-side GmailAccount.
//
// One GmailOrder row represents a buyer's purchase of N gmail accounts.
// Each row is denormalized and lean — UserID + Quantity + amounts +
// status — and is intentionally NOT a fork of model.Order (which is
// tightly coupled to ProductPrice for premapps/sosmed flows).
//
// Atomicity: Buy() inside one walletRepo.Transaction:
//   1. Lock buyer user (FOR UPDATE)
//   2. Read current GmailPricing (in tx so admin updates don't race)
//   3. CalculateTotal → gross / discount / net
//   4. LockOldestVerifiedForOrderTx(qty) — FIFO claim with SKIP LOCKED
//   5. Debit buyer.WalletBalance -= net
//   6. Create this GmailOrder row
//   7. Mark each claimed GmailAccount row Status=sold + SoldOrderID
//   8. Write WalletLedger row (debit, pocket=spend, ref=gmail-order:<id>)
//   9. Notify buyer
//
// Refund path (Round 3 warranty) flips Status=refunded and stamps
// RefundLedgerID; original sold GmailAccounts get Status=disposed.
type GmailOrder struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`

	// Pricing snapshot at purchase time. Storing all three lets the
	// receipt show "Subtotal Rp X, Diskon Rp Y, Bayar Rp Z" without
	// recomputing against the (potentially mutated) pricing config.
	Quantity        int64 `gorm:"not null" json:"quantity"`
	UnitPrice       int64 `gorm:"not null" json:"unit_price"`
	GrossAmount     int64 `gorm:"not null" json:"gross_amount"`
	DiscountAmount  int64 `gorm:"not null;default:0" json:"discount_amount"`
	DiscountTierPct int   `gorm:"not null;default:0" json:"discount_tier_pct"`
	NetAmount       int64 `gorm:"not null" json:"net_amount"`

	Status string `gorm:"type:varchar(16);not null;index" json:"status"`

	// Ledger linkage — debit at buy time, refund stamp at warranty.
	DebitLedgerID  *uuid.UUID `gorm:"type:uuid" json:"debit_ledger_id,omitempty"`
	RefundLedgerID *uuid.UUID `gorm:"type:uuid" json:"refund_ledger_id,omitempty"`
	RefundedAt     *time.Time `json:"refunded_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Items hydrated on detail fetch — gmail rows tied to this order.
	// gorm:"-" because the FK belongs on gmail_accounts.sold_order_id,
	// and AutoMigrate processes gmail_accounts BEFORE gmail_orders
	// (alphabetical order), causing "relation gmail_orders does not
	// exist" on first deployment. Items are populated by the repository
	// layer, not by GORM preloading.
	Items []GmailAccount `gorm:"-" json:"items,omitempty"`
}

func (g *GmailOrder) BeforeCreate(_ *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}
