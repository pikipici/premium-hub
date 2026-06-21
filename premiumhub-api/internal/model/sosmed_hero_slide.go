package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedHeroSlide struct {
	ID                 uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	PageKey            string    `gorm:"size:100;uniqueIndex;not null" json:"page_key"`
	Title              string    `gorm:"size:160;not null" json:"title"`
	Subtitle           string    `gorm:"size:500" json:"subtitle"`
	CTALabel           string    `gorm:"size:80" json:"cta_label"`
	CTAHref            string    `gorm:"size:300" json:"cta_href"`
	Icon               string    `gorm:"size:50;default:'Sparkles'" json:"icon"`
	BackgroundColor    string    `gorm:"size:30;not null;default:'#141414'" json:"background_color"`
	BackgroundImageURL string    `gorm:"size:500" json:"background_image_url"`
	IsActive           bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (s *SosmedHeroSlide) BeforeCreate(_ *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

func (SosmedHeroSlide) TableName() string {
	return "sosmed_hero_slides"
}
