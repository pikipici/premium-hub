package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ConvertOrderEvent struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	OrderID uuid.UUID    `gorm:"type:uuid;not null;index" json:"order_id"`
	Order   ConvertOrder `gorm:"foreignKey:OrderID" json:"order,omitempty"`

	FromStatus string `gorm:"size:30;not null" json:"from_status"`
	ToStatus   string `gorm:"size:30;not null;index" json:"to_status"`

	Reason       string `gorm:"type:text" json:"reason"`
	InternalNote string `gorm:"type:text" json:"internal_note"`

	ActorType string     `gorm:"size:20;not null" json:"actor_type"`
	ActorID   *uuid.UUID `gorm:"type:uuid;index" json:"actor_id,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

func (e *ConvertOrderEvent) BeforeCreate(_ *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}
