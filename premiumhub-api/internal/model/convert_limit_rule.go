package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ConvertLimitRule struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	AssetType string `gorm:"size:20;not null;uniqueIndex" json:"asset_type"`
	Enabled   bool   `gorm:"not null;default:true" json:"enabled"`

	AllowGuest            bool  `gorm:"not null;default:false" json:"allow_guest"`
	RequireLogin          bool  `gorm:"not null;default:true" json:"require_login"`
	MinAmount             int64 `gorm:"not null" json:"min_amount"`
	MaxAmount             int64 `gorm:"not null" json:"max_amount"`
	DailyLimit            int64 `gorm:"not null" json:"daily_limit"`
	ManualReviewThreshold int64 `gorm:"not null" json:"manual_review_threshold"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (l *ConvertLimitRule) BeforeCreate(_ *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}
