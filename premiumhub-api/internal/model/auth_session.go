package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthSession struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"`
	UserID     uuid.UUID  `gorm:"type:uuid;index;not null"`
	User       User       `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	TokenHash  string     `gorm:"size:64;uniqueIndex;not null"`
	UserAgent  string     `gorm:"size:255"`
	IPAddress  string     `gorm:"size:64"`
	LastSeenAt *time.Time `gorm:"index"`
	ExpiresAt  time.Time  `gorm:"index;not null"`
	RevokedAt  *time.Time `gorm:"index"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  gorm.DeletedAt `gorm:"index"`
}

func (s *AuthSession) BeforeCreate(_ *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
