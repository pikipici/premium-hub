package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedOrder struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	UserID uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	User   User      `gorm:"foreignKey:UserID" json:"user,omitempty"`

	ServiceID uuid.UUID     `gorm:"type:uuid;not null;index" json:"service_id"`
	Service   SosmedService `gorm:"foreignKey:ServiceID" json:"service,omitempty"`

	ServiceCode  string `gorm:"size:80;not null;index" json:"service_code"`
	ServiceTitle string `gorm:"size:180;not null" json:"service_title"`

	TargetLink string `gorm:"size:255" json:"target_link"`
	Quantity   int64  `gorm:"not null;default:1" json:"quantity"`
	UnitPrice  int64  `gorm:"not null" json:"unit_price"`
	TotalPrice int64  `gorm:"not null" json:"total_price"`

	PaymentMethod  string `gorm:"size:50" json:"payment_method"`
	PaymentStatus  string `gorm:"size:20;default:pending;index" json:"payment_status"`
	OrderStatus    string `gorm:"size:30;default:pending_payment;index" json:"order_status"`
	GatewayOrderID string `gorm:"size:120;index" json:"gateway_order_id"`
	PaymentPayload string `gorm:"type:text" json:"payment_payload,omitempty"`

	Notes string `gorm:"type:text" json:"notes"`

	PaidAt    *time.Time `json:"paid_at"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (o *SosmedOrder) BeforeCreate(_ *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return nil
}
