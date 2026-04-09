package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ConvertTrackingToken struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	OrderID uuid.UUID    `gorm:"type:uuid;not null;uniqueIndex" json:"order_id"`
	Order   ConvertOrder `gorm:"foreignKey:OrderID" json:"order,omitempty"`

	Token     string     `gorm:"size:80;not null;uniqueIndex" json:"token"`
	IsActive  bool       `gorm:"not null;default:true" json:"is_active"`
	ExpiresAt *time.Time `gorm:"index" json:"expires_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (t *ConvertTrackingToken) BeforeCreate(_ *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}
