package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FiveSimOrder struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID          uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	ProviderOrderID int64     `gorm:"not null;uniqueIndex" json:"provider_order_id"`
	OrderType       string    `gorm:"size:20;not null;index" json:"order_type"`

	Phone          string  `gorm:"size:40" json:"phone"`
	Country        string  `gorm:"size:100;index" json:"country"`
	Operator       string  `gorm:"size:100;index" json:"operator"`
	Product        string  `gorm:"size:120;index" json:"product"`
	ProviderPrice  float64 `gorm:"not null;default:0" json:"provider_price"`
	ProviderStatus string  `gorm:"size:32;index" json:"provider_status"`

	SyncFailCount     int        `gorm:"not null;default:0" json:"sync_fail_count"`
	LastSyncErrorCode string     `gorm:"size:64" json:"last_sync_error_code,omitempty"`
	LastSyncErrorMsg  string     `gorm:"size:255" json:"last_sync_error_message,omitempty"`
	ResolutionSource  string     `gorm:"size:32;index" json:"resolution_source,omitempty"`
	ResolutionReason  string     `gorm:"size:120" json:"resolution_reason,omitempty"`
	RawPayload        string     `gorm:"type:text" json:"raw_payload,omitempty"`
	LastSyncedAt      *time.Time `json:"last_synced_at,omitempty"`
	NextSyncAt        *time.Time `json:"next_sync_at,omitempty"`
	ResolvedAt        *time.Time `json:"resolved_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (o *FiveSimOrder) BeforeCreate(_ *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return nil
}
