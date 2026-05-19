package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WalletLedger struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	TopupID       *uuid.UUID `gorm:"type:uuid;index" json:"topup_id,omitempty"`
	Type          string     `gorm:"size:10;not null" json:"type"` // credit/debit
	Category      string     `gorm:"size:30;not null" json:"category"`
	// Pocket identifies which wallet pocket this entry affects. See
	// model/wallet_pocket.go for the canonical constants. Defaults to
	// "spend" so legacy rows (and code paths that don't yet set Pocket
	// explicitly) keep working unchanged.
	Pocket        string     `gorm:"size:16;not null;default:'spend';index" json:"pocket"`
	Amount        int64      `gorm:"not null" json:"amount"`
	BalanceBefore int64      `gorm:"not null" json:"balance_before"`
	BalanceAfter  int64      `gorm:"not null" json:"balance_after"`
	Reference     string     `gorm:"size:120;not null;uniqueIndex" json:"reference"`
	Description   string     `gorm:"type:text" json:"description"`
	CreatedAt     time.Time  `json:"created_at"`
}

func (w *WalletLedger) BeforeCreate(_ *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	// Default pocket to "spend" if caller didn't specify. Backward
	// compat shield: every legacy call site builds WalletLedger without
	// a Pocket value and must keep working unchanged. New code that
	// needs the earn pocket has to set Pocket: model.WalletPocketEarn
	// explicitly.
	if w.Pocket == "" {
		w.Pocket = WalletPocketSpend
	}
	return nil
}
