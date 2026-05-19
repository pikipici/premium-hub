package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Gmail account lifecycle states.
//
// Sell-side path:
//
//	pending_create -> user has slot, platform-generated creds shown,
//	                  user must create gmail manually within 6h
//	pending_verify -> user submitted "selesai", admin queue
//	verified       -> admin login-tested, password rotated, in inventory ready jual
//	rejected       -> admin reject saat verify (strike-eligible)
//	expired        -> slot pending_create > 6h tanpa submit (no strike)
//
// Buy-side path:
//
//	verified -> sold (buyer checkout, instant deliver)
//
// Terminal states with audit trail:
//
//	disposed -> banned-after-sale, replaced, or otherwise removed from
//	            circulation; row stays for audit.
const (
	GmailStatusPendingCreate = "pending_create"
	GmailStatusPendingVerify = "pending_verify"
	GmailStatusVerified      = "verified"
	GmailStatusSold          = "sold"
	GmailStatusDisposed      = "disposed"
	GmailStatusExpired       = "expired"
	GmailStatusRejected      = "rejected"
)

// Password version tags — track which generation of password is
// currently encrypted in PasswordEnc.
const (
	GmailPasswordVersionInitial     = "initial"      // platform-generated, given to user to create gmail
	GmailPasswordVersionPostVerify  = "post_verify"  // admin rotated after verify (anti-hackback)
	GmailPasswordVersionPostHandover = "post_handover" // future: rotated again at sale time
)

// Ledger category for sell-side payout. Pocket=earn credit when admin
// verifies a submitted gmail account and the user's earn balance gets
// the BuyPrice from GmailPricing.
const (
	LedgerCategoryGmailSellPayout = "gmail_sell_payout"
)

// GmailAccount tracks the full lifecycle of one gmail credential pair
// from user creation -> admin verify -> sold to buyer (or disposed).
//
// Source tracking (CreatedByUserID, VerifiedByAdminID) makes the
// sell-side audit trail explicit. Sell vs sold (SoldToUserID,
// SoldOrderID, SoldPrice, SoldAt) handles the buy-side leg.
//
// Password is always encrypted at rest via pkg/credential.StockCipher
// — never store plaintext. The plain password is only shown to the
// user once at slot generation and to the buyer once at delivery.
type GmailAccount struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	// Source tracking (sell-side).
	CreatedByUserID uuid.UUID `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	Status          string    `gorm:"type:varchar(24);not null;index" json:"status"`

	// Credentials. Email is unique platform-wide; PasswordEnc is the
	// encrypted current password.
	Email           string `gorm:"type:varchar(128);not null;uniqueIndex" json:"email"`
	PasswordEnc     string `gorm:"type:text;not null" json:"-"`
	PasswordVersion string `gorm:"type:varchar(16);not null;default:'initial'" json:"password_version"`

	// Slot lifecycle. SlotExpiresAt = CreatedAt + 6h while
	// status=pending_create. Cleared after submit.
	SlotExpiresAt *time.Time `json:"slot_expires_at,omitempty"`
	SubmittedAt   *time.Time `json:"submitted_at,omitempty"`

	// Verify (sell-side). Set when admin marks verified. SellerPayout*
	// fields record how much went to the user's earn pocket and the
	// ledger row reference for that credit.
	VerifiedByAdminID    *uuid.UUID `gorm:"type:uuid" json:"verified_by_admin_id,omitempty"`
	VerifiedAt           *time.Time `json:"verified_at,omitempty"`
	SellerPayoutAmount   int64      `gorm:"not null;default:0" json:"seller_payout_amount"`
	SellerPayoutLedgerID *uuid.UUID `gorm:"type:uuid" json:"seller_payout_ledger_id,omitempty"`

	// Reject (sell-side). Reason enum + free-form note for admin.
	RejectedByAdminID *uuid.UUID `gorm:"type:uuid" json:"rejected_by_admin_id,omitempty"`
	RejectedAt        *time.Time `json:"rejected_at,omitempty"`
	RejectReason      string     `gorm:"type:varchar(64)" json:"reject_reason,omitempty"`
	RejectNote        string     `gorm:"type:text" json:"reject_note,omitempty"`

	// Sold (buy-side). FIFO claim by buyer flow.
	SoldToUserID *uuid.UUID `gorm:"type:uuid;index" json:"sold_to_user_id,omitempty"`
	SoldOrderID  *uuid.UUID `gorm:"type:uuid;index" json:"sold_order_id,omitempty"`
	SoldPrice    int64      `gorm:"not null;default:0" json:"sold_price"`
	SoldAt       *time.Time `json:"sold_at,omitempty"`

	// Disposed. Set when account is banned after sale, replaced under
	// warranty, or otherwise removed from active inventory.
	DisposedAt     *time.Time `json:"disposed_at,omitempty"`
	DisposedReason string     `gorm:"type:varchar(64)" json:"disposed_reason,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (g *GmailAccount) BeforeCreate(_ *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}

// IsSlotPending returns true if the slot is still in the live sell-side
// queue (pending_create or pending_verify). Used to enforce per-user
// concurrent slot cap.
func (g *GmailAccount) IsSlotPending() bool {
	return g.Status == GmailStatusPendingCreate || g.Status == GmailStatusPendingVerify
}
