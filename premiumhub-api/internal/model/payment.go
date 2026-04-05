package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Payment struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID         uuid.UUID `gorm:"type:uuid;not null" json:"order_id"`
	MidtransOrderID string    `gorm:"size:100" json:"midtrans_order_id"`
	Amount          int64     `json:"amount"`
	Status          string    `gorm:"size:20" json:"status"`
	PaymentType     string    `gorm:"size:50" json:"payment_type"`
	RawResponse     string    `gorm:"type:text" json:"-"`
	CreatedAt       time.Time `json:"created_at"`
}

func (p *Payment) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
