package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Stock struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID   uuid.UUID  `gorm:"type:uuid;not null" json:"product_id"`
	AccountType string     `gorm:"size:20;not null" json:"account_type"`
	Email       string     `gorm:"size:150;not null" json:"email"`
	Password    string     `gorm:"size:255;not null" json:"-"`
	ProfileName string     `gorm:"size:100" json:"profile_name"`
	Status      string     `gorm:"size:20;default:available" json:"status"`
	UsedBy      *uuid.UUID `gorm:"type:uuid" json:"used_by"`
	UsedAt      *time.Time `json:"used_at"`
	ExpiresAt   *time.Time `json:"expires_at"`
	Product     Product    `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

func (s *Stock) BeforeCreate(_ *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
