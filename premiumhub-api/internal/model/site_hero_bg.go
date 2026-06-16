package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SiteHeroBg struct {
	ID                 uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	PageKey            string    `gorm:"size:100;uniqueIndex;not null" json:"page_key"`
	BackgroundColor    string    `gorm:"size:30;not null;default:'#141414'" json:"background_color"`
	BackgroundImageURL string    `gorm:"size:500" json:"background_image_url"`
	IsActive           bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (b *SiteHeroBg) BeforeCreate(_ *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
