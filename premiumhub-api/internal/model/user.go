package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name          string         `gorm:"size:100;not null" json:"name"`
	Email         string         `gorm:"size:150;uniqueIndex;not null" json:"email"`
	Phone         string         `gorm:"size:20" json:"phone"`
	Password      string         `gorm:"size:255;not null" json:"-"`
	GoogleSub     *string        `gorm:"size:191;uniqueIndex" json:"-"`
	Role          string         `gorm:"size:20;default:user" json:"role"`
	IsActive      bool           `gorm:"default:true" json:"is_active"`
	WalletBalance int64          `gorm:"not null;default:0" json:"wallet_balance"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (u *User) BeforeCreate(_ *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
