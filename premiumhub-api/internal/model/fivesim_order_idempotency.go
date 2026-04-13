package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FiveSimOrderIdempotency struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID          uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_fivesim_order_idem" json:"user_id"`
	OrderType       string    `gorm:"size:20;not null;uniqueIndex:idx_fivesim_order_idem" json:"order_type"`
	IdempotencyKey  string    `gorm:"size:80;not null;uniqueIndex:idx_fivesim_order_idem" json:"idempotency_key"`
	RequestHash     string    `gorm:"size:128;not null" json:"request_hash"`
	Status          string    `gorm:"size:16;not null;default:processing;index" json:"status"`
	ProviderOrderID int64     `gorm:"not null;default:0;index" json:"provider_order_id"`
	ErrorMessage    string    `gorm:"size:255" json:"error_message,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (r *FiveSimOrderIdempotency) BeforeCreate(_ *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
