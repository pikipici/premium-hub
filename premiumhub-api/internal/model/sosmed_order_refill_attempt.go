package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedOrderRefillAttempt struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	OrderID uuid.UUID   `gorm:"type:uuid;not null;index;uniqueIndex:idx_sosmed_refill_attempt_order_number" json:"order_id"`
	Order   SosmedOrder `gorm:"foreignKey:OrderID" json:"order,omitempty"`

	AttemptNumber int `gorm:"not null;default:1;index;uniqueIndex:idx_sosmed_refill_attempt_order_number" json:"attempt_number"`

	Status           string `gorm:"size:30;not null;default:processing;index" json:"status"`
	ProviderRefillID string `gorm:"size:80;index" json:"provider_refill_id,omitempty"`
	ProviderStatus   string `gorm:"size:40;index" json:"provider_status,omitempty"`
	ProviderError    string `gorm:"type:text" json:"provider_error,omitempty"`
	Reason           string `gorm:"type:text" json:"reason,omitempty"`

	ActorType string     `gorm:"size:20;not null" json:"actor_type"`
	ActorID   *uuid.UUID `gorm:"type:uuid;index" json:"actor_id,omitempty"`

	RequestedAt time.Time  `gorm:"not null;index" json:"requested_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (a *SosmedOrderRefillAttempt) BeforeCreate(_ *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
