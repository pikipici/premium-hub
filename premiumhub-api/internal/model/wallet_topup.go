package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WalletTopup struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;index;uniqueIndex:idx_wallet_topups_user_idem" json:"user_id"`
	Provider        string     `gorm:"size:30;not null;default:duitku" json:"provider"`
	GatewayRef      string     `gorm:"size:120;uniqueIndex" json:"gateway_ref"`
	PaymentMethod   string     `gorm:"size:40" json:"payment_method"`
	PaymentNumber   string     `gorm:"type:text" json:"payment_number"`
	IdempotencyKey  string     `gorm:"size:80;not null;default:'';uniqueIndex:idx_wallet_topups_user_idem" json:"idempotency_key"`
	RequestedAmount int64      `gorm:"not null" json:"requested_amount"`
	UniqueCode      int        `gorm:"not null" json:"unique_code"`
	PayableAmount   int64      `gorm:"not null" json:"payable_amount"`
	Status          string     `gorm:"size:20;not null;default:pending;index" json:"status"`
	ProviderStatus  string     `gorm:"size:30;not null;default:pending" json:"provider_status"`
	RawRequest      string     `gorm:"type:text" json:"-"`
	RawResponse     string     `gorm:"type:text" json:"-"`
	LastCheckedAt   *time.Time `json:"last_checked_at"`
	ExpiresAt       time.Time  `gorm:"index" json:"expires_at"`
	SettledAt       *time.Time `json:"settled_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (w *WalletTopup) BeforeCreate(_ *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}
