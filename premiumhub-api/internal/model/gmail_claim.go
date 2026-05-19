package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Gmail warranty claim lifecycle.
//
// Buyer hits POST /gmail/orders/:id/claims with a gmail_account_id
// they purchased. Service auto-resolves immediately (no admin queue
// for MVP):
//   - replaced  → another verified row from inventory taken, original
//                 disposed, replacement chained to the same order
//   - refunded  → no inventory available, original disposed, sold price
//                 refunded to buyer's spend pocket
//
// Disposed reason on the original gmail row stays "banned_after_sale"
// to keep the audit chain consistent (a refund == replaced with cash
// from platform absorbing the loss).
const (
	GmailClaimStatusReplaced = "replaced"
	GmailClaimStatusRefunded = "refunded"
	GmailClaimStatusRejected = "rejected"
)

const (
	GmailClaimResolutionReplaced = "replaced"
	GmailClaimResolutionRefunded = "refunded"
)

// Disposed reason set on the original gmail row when warranty resolves.
const (
	GmailDisposedReasonBannedAfterSale = "banned_after_sale"
)

// Ledger category for warranty refund debit on the platform side
// (credit on buyer side, pocket=spend).
const (
	LedgerCategoryGmailWarrantyRefund = "gmail_warranty_refund"
)

// GmailClaim is the warranty record. Lean: 1 claim per gmail_account
// (ResolvedAt + ResolutionType immutable post-resolve).
type GmailClaim struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	BuyerID        uuid.UUID `gorm:"type:uuid;not null;index" json:"buyer_id"`
	GmailOrderID   uuid.UUID `gorm:"type:uuid;not null;index" json:"gmail_order_id"`
	GmailAccountID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"gmail_account_id"`

	Status         string `gorm:"type:varchar(16);not null" json:"status"`
	ResolutionType string `gorm:"type:varchar(16);not null" json:"resolution_type"`

	Reason string `gorm:"type:varchar(255)" json:"reason,omitempty"`

	// Resolution links — exactly one of these is set depending on
	// ResolutionType.
	ReplacementGmailAccountID *uuid.UUID `gorm:"type:uuid" json:"replacement_gmail_account_id,omitempty"`
	RefundLedgerID            *uuid.UUID `gorm:"type:uuid" json:"refund_ledger_id,omitempty"`
	RefundAmount              int64      `gorm:"not null;default:0" json:"refund_amount"`

	ResolvedAt time.Time `json:"resolved_at"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (g *GmailClaim) BeforeCreate(_ *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}
