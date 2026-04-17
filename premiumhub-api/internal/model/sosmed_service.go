package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedService struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CategoryCode  string    `gorm:"size:50;not null;index:idx_sosmed_services_category" json:"category_code"`
	Code          string    `gorm:"size:80;not null;uniqueIndex" json:"code"`
	Title         string    `gorm:"size:180;not null" json:"title"`
	Summary       string    `gorm:"type:text" json:"summary"`
	PlatformLabel string    `gorm:"size:120" json:"platform_label"`
	BadgeText     string    `gorm:"size:80" json:"badge_text"`
	Theme         string    `gorm:"size:24;default:blue" json:"theme"`
	MinOrder      string    `gorm:"size:80" json:"min_order"`
	StartTime     string    `gorm:"size:80" json:"start_time"`
	Refill        string    `gorm:"size:80" json:"refill"`
	ETA           string    `gorm:"size:80" json:"eta"`
	PriceStart    string    `gorm:"size:80" json:"price_start"`
	PricePer1K    string    `gorm:"size:120" json:"price_per_1k"`
	CheckoutPrice int64     `gorm:"not null;default:0" json:"checkout_price"`
	TrustBadges   []string  `gorm:"serializer:json" json:"trust_badges,omitempty"`
	SortOrder     int       `gorm:"default:100;index:idx_sosmed_services_sort" json:"sort_order"`
	IsActive      bool      `gorm:"default:true" json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (s *SosmedService) BeforeCreate(_ *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
