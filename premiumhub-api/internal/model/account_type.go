package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AccountType struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Code           string    `gorm:"size:50;uniqueIndex;not null" json:"code"`
	Label          string    `gorm:"size:120;not null" json:"label"`
	Description    string    `gorm:"size:220" json:"description"`
	SortOrder      int       `gorm:"default:100" json:"sort_order"`
	BadgeBgColor   string    `gorm:"size:20" json:"badge_bg_color"`
	BadgeTextColor string    `gorm:"size:20" json:"badge_text_color"`
	IsActive       bool      `gorm:"default:true" json:"is_active"`
	IsSystem       bool      `gorm:"default:false" json:"is_system"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (a *AccountType) BeforeCreate(_ *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
