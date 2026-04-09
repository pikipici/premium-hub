package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ConvertOrder struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	UserID uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_convert_orders_user_idem" json:"user_id"`
	User   User      `gorm:"foreignKey:UserID" json:"user,omitempty"`

	AssetType string `gorm:"size:20;not null;index" json:"asset_type"`
	Status    string `gorm:"size:30;not null;index" json:"status"`
	IsGuest   bool   `gorm:"not null;default:false" json:"is_guest"`

	SourceAmount int64 `gorm:"not null" json:"source_amount"`

	SourceChannel string `gorm:"size:120;not null" json:"source_channel"`
	SourceAccount string `gorm:"size:200;not null" json:"source_account"`

	DestinationBank          string `gorm:"size:120;not null" json:"destination_bank"`
	DestinationAccountNumber string `gorm:"size:80;not null" json:"destination_account_number"`
	DestinationAccountName   string `gorm:"size:180;not null" json:"destination_account_name"`

	Rate           float64 `gorm:"not null" json:"rate"`
	AdminFee       int64   `gorm:"not null" json:"admin_fee"`
	RiskFee        int64   `gorm:"not null" json:"risk_fee"`
	TransferFee    int64   `gorm:"not null" json:"transfer_fee"`
	GuestSurcharge int64   `gorm:"not null" json:"guest_surcharge"`
	PPNRate        float64 `gorm:"not null" json:"ppn_rate"`
	PPNAmount      int64   `gorm:"not null" json:"ppn_amount"`

	ConvertedAmount int64 `gorm:"not null" json:"converted_amount"`
	TotalFee        int64 `gorm:"not null" json:"total_fee"`
	ReceiveAmount   int64 `gorm:"not null" json:"receive_amount"`

	IdempotencyKey string `gorm:"size:80;not null;default:'';uniqueIndex:idx_convert_orders_user_idem" json:"idempotency_key"`
	Notes          string `gorm:"type:text" json:"notes"`

	ExpiresAt *time.Time `gorm:"index" json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (o *ConvertOrder) BeforeCreate(_ *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return nil
}
