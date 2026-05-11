package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedPromotion struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	Name            string               `gorm:"size:160;not null" json:"name"`
	TargetType      string               `gorm:"size:30;not null;index:idx_sosmed_promotions_target" json:"target_type"`
	ServiceID       *uuid.UUID           `gorm:"type:uuid;index:idx_sosmed_promotions_target" json:"service_id,omitempty"`
	Service         *SosmedService       `gorm:"foreignKey:ServiceID" json:"service,omitempty"`
	BundleVariantID *uuid.UUID           `gorm:"type:uuid;index:idx_sosmed_promotions_target" json:"bundle_variant_id,omitempty"`
	BundleVariant   *SosmedBundleVariant `gorm:"foreignKey:BundleVariantID" json:"bundle_variant,omitempty"`

	DiscountType  string    `gorm:"size:20;not null" json:"discount_type"`
	DiscountValue int64     `gorm:"not null;default:0" json:"discount_value"`
	StartsAt      time.Time `gorm:"not null;index" json:"starts_at"`
	EndsAt        time.Time `gorm:"not null;index" json:"ends_at"`
	IsActive      bool      `gorm:"default:true;index" json:"is_active"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (p *SosmedPromotion) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
