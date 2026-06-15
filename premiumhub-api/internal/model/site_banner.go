package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SiteBanner struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Title     string     `gorm:"size:160;not null" json:"title"`
	ImageURL  string     `gorm:"size:500;not null" json:"image_url"`
	LinkURL   string     `gorm:"size:500" json:"link_url"`
	IsActive  bool       `gorm:"not null;default:true" json:"is_active"`
	SortOrder int        `gorm:"not null;default:0" json:"sort_order"`
	StartsAt  *time.Time `json:"starts_at"`
	EndsAt    *time.Time `json:"ends_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (b *SiteBanner) BeforeCreate(_ *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
