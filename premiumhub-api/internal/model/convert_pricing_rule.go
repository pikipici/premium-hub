package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ConvertPricingRule struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	AssetType string `gorm:"size:20;not null;uniqueIndex" json:"asset_type"`
	Enabled   bool   `gorm:"not null;default:true" json:"enabled"`

	Rate           float64 `gorm:"not null" json:"rate"`
	AdminFee       int64   `gorm:"not null" json:"admin_fee"`
	RiskFee        int64   `gorm:"not null" json:"risk_fee"`
	TransferFee    int64   `gorm:"not null" json:"transfer_fee"`
	GuestSurcharge int64   `gorm:"not null" json:"guest_surcharge"`
	PPNRate        float64 `gorm:"not null;default:0.11" json:"ppn_rate"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (p *ConvertPricingRule) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
