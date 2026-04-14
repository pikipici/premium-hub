package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MaintenanceRule struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Name             string     `gorm:"size:120;not null" json:"name"`
	TargetType       string     `gorm:"size:20;not null;default:exact" json:"target_type"`
	TargetPath       string     `gorm:"size:255;not null;default:/" json:"target_path"`
	Title            string     `gorm:"size:160" json:"title"`
	Message          string     `gorm:"size:1000" json:"message"`
	IsActive         bool       `gorm:"not null;default:false" json:"is_active"`
	AllowAdminBypass bool       `gorm:"not null;default:true" json:"allow_admin_bypass"`
	StartsAt         *time.Time `json:"starts_at"`
	EndsAt           *time.Time `json:"ends_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (m *MaintenanceRule) BeforeCreate(_ *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
