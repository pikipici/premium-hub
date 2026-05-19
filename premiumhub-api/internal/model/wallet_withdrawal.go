package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WalletWithdrawal status machine:
//
//	pending  → approved      (admin approve OR auto-approve <100k)
//	pending  → rejected      (admin reject, refund earn)
//	pending  → cancelled     (user cancel, refund earn)
//	approved → processing    (admin start payout)
//	processing → paid        (admin confirm money landed)
//	processing → failed      (payout rail error, admin marks)
//
// Once `paid` or `failed` the row is terminal — no further state transitions.
// Refund ledger is written on rejected/cancelled only.
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

	// Wallet ledger categories used by the WD flow. Match the existing
	// "topup" / "product_purchase" naming convention so dashboards that
	// group by category can render a Withdraw section without surprises.
	LedgerCategoryWithdrawalHold   = "withdrawal_hold"
	LedgerCategoryWithdrawalRefund = "withdrawal_refund"
	LedgerCategoryWithdrawalFinal  = "withdrawal_final"
)

// WalletWithdrawalDestinations is the canonical list returned by
// GET /wallet/withdrawals/destinations. Frontend renders this as a
// dropdown — keep codes stable, labels are display-only.
type WalletWithdrawalDestination struct {
	Code  string `json:"code"`
	Label string `json:"label"`
	Type  string `json:"type"` // bank | ewallet
}

// SupportedWithdrawalDestinations returns the static list spec'd in the
// wallet-withdraw plan (Round 2). Adding a new destination = append
// here. Removing one is breaking — leave it but mark inactive instead.
func SupportedWithdrawalDestinations() []WalletWithdrawalDestination {
	return []WalletWithdrawalDestination{
		{Code: "BCA", Label: "Bank BCA", Type: WithdrawalDestBank},
		{Code: "MANDIRI", Label: "Bank Mandiri", Type: WithdrawalDestBank},
		{Code: "BRI", Label: "Bank BRI", Type: WithdrawalDestBank},
		{Code: "BNI", Label: "Bank BNI", Type: WithdrawalDestBank},
		{Code: "CIMB", Label: "Bank CIMB Niaga", Type: WithdrawalDestBank},
		{Code: "DANA", Label: "DANA", Type: WithdrawalDestEwallet},
		{Code: "OVO", Label: "OVO", Type: WithdrawalDestEwallet},
		{Code: "GOPAY", Label: "GoPay", Type: WithdrawalDestEwallet},
		{Code: "SHOPEEPAY", Label: "ShopeePay", Type: WithdrawalDestEwallet},
		{Code: "LINKAJA", Label: "LinkAja", Type: WithdrawalDestEwallet},
	}
}

// IsKnownWithdrawalDestination returns true if (destType, code) is in the
// supported list.
func IsKnownWithdrawalDestination(destType, code string) bool {
	for _, d := range SupportedWithdrawalDestinations() {
		if d.Type == destType && d.Code == code {
			return true
		}
	}
	return false
}

// WalletWithdrawal is one user-submitted withdrawal request. The audit
// trail (hold, refund on reject, final on paid) lives in WalletLedger
// rows linked via Ledger*ID. Earn-pocket balance is mutated on
// User.WalletBalanceEarn — never derived from the ledger.
type WalletWithdrawal struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`

	Amount    int64 `gorm:"not null" json:"amount"`     // gross, what user requested
	Fee       int64 `gorm:"not null" json:"fee"`        // 2500 flat (configurable)
	NetAmount int64 `gorm:"not null" json:"net_amount"` // amount - fee, what lands at the destination

	Status string `gorm:"type:varchar(24);not null;index" json:"status"`

	DestinationType    string `gorm:"type:varchar(16);not null" json:"destination_type"`
	DestinationCode    string `gorm:"type:varchar(32);not null" json:"destination_code"`
	DestinationAccount string `gorm:"type:varchar(64);not null" json:"destination_account"`
	DestinationName    string `gorm:"type:varchar(128);not null" json:"destination_name"`

	AdminID      *uuid.UUID `gorm:"type:uuid;index" json:"admin_id,omitempty"`
	AdminNote    string     `gorm:"type:text" json:"admin_note,omitempty"`
	AutoApproved bool       `gorm:"not null;default:false" json:"auto_approved"`

	LedgerHoldID   *uuid.UUID `gorm:"type:uuid" json:"ledger_hold_id,omitempty"`
	LedgerFinalID  *uuid.UUID `gorm:"type:uuid" json:"ledger_final_id,omitempty"`
	LedgerRefundID *uuid.UUID `gorm:"type:uuid" json:"ledger_refund_id,omitempty"`

	PayoutRailKind string `gorm:"type:varchar(32)" json:"payout_rail_kind"`
	PayoutRailRef  string `gorm:"type:varchar(128)" json:"payout_rail_ref,omitempty"`
	FailureReason  string `gorm:"type:text" json:"failure_reason,omitempty"`

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
	if w.Status == "" {
		w.Status = WithdrawalStatusPending
	}
	return nil
}

// IsTerminal reports whether the withdrawal has reached a state from
// which no further transitions are allowed.
func (w *WalletWithdrawal) IsTerminal() bool {
	switch w.Status {
	case WithdrawalStatusPaid, WithdrawalStatusFailed,
		WithdrawalStatusRejected, WithdrawalStatusCancelled:
		return true
	default:
		return false
	}
}
