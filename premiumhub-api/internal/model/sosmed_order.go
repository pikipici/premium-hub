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

	ProviderCode      string     `gorm:"size:32;index" json:"provider_code,omitempty"`
	ProviderServiceID string     `gorm:"size:64;index" json:"provider_service_id,omitempty"`
	ProviderOrderID   string     `gorm:"size:80;index" json:"provider_order_id,omitempty"`
	ProviderStatus    string     `gorm:"size:40;index" json:"provider_status,omitempty"`
	ProviderPayload   string     `gorm:"type:text" json:"provider_payload,omitempty"`
	ProviderError     string     `gorm:"type:text" json:"provider_error,omitempty"`
	ProviderSyncedAt  *time.Time `json:"provider_synced_at"`

	// Refill tracking — populated at checkout from SosmedService metadata.
	RefillEligible        bool                       `gorm:"default:false" json:"refill_eligible"`
	RefillPeriodDays      int                        `gorm:"default:0" json:"refill_period_days"`
	RefillDeadline        *time.Time                 `json:"refill_deadline"`
	RefillStatus          string                     `gorm:"size:30;default:none;index" json:"refill_status"`
	RefillProviderOrderID string                     `gorm:"size:80" json:"refill_provider_order_id,omitempty"`
	RefillProviderStatus  string                     `gorm:"size:40" json:"refill_provider_status,omitempty"`
	RefillProviderError   string                     `gorm:"type:text" json:"refill_provider_error,omitempty"`
	RefillRequestedAt     *time.Time                 `json:"refill_requested_at"`
	RefillCompletedAt     *time.Time                 `json:"refill_completed_at"`
	RefillHistory         []SosmedOrderRefillAttempt `gorm:"foreignKey:OrderID" json:"refill_history,omitempty"`

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
