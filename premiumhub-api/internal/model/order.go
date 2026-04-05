package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Order struct {
	ID            uuid.UUID    `gorm:"type:uuid;primaryKey" json:"id"`
	UserID        uuid.UUID    `gorm:"type:uuid;not null" json:"user_id"`
	StockID       *uuid.UUID   `gorm:"type:uuid" json:"stock_id"`
	PriceID       uuid.UUID    `gorm:"type:uuid;not null" json:"price_id"`
	TotalPrice    int64        `gorm:"not null" json:"total_price"`
	PaymentMethod string       `gorm:"size:50" json:"payment_method"`
	PaymentStatus string       `gorm:"size:20;default:pending" json:"payment_status"`
	OrderStatus   string       `gorm:"size:20;default:pending" json:"order_status"`
	MidtransID    string       `gorm:"size:100" json:"midtrans_id"`
	SnapToken     string       `gorm:"size:255" json:"snap_token"`
	PaidAt        *time.Time   `json:"paid_at"`
	ExpiresAt     *time.Time   `json:"expires_at"`
	User          User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Stock         *Stock       `gorm:"foreignKey:StockID" json:"stock,omitempty"`
	Price         ProductPrice `gorm:"foreignKey:PriceID" json:"price,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

func (o *Order) BeforeCreate(_ *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return nil
}
