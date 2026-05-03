package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedBundlePackage struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	Key           string `gorm:"size:100;not null;uniqueIndex" json:"key"`
	Title         string `gorm:"size:180;not null" json:"title"`
	Subtitle      string `gorm:"size:220" json:"subtitle,omitempty"`
	Description   string `gorm:"type:text" json:"description,omitempty"`
	Platform      string `gorm:"size:60;not null;index" json:"platform"`
	Badge         string `gorm:"size:80" json:"badge,omitempty"`
	IsHighlighted bool   `gorm:"default:false" json:"is_highlighted"`
	IsActive      bool   `gorm:"default:true;index" json:"is_active"`
	SortOrder     int    `gorm:"default:0;index" json:"sort_order"`
	MetadataJSON  string `gorm:"type:text" json:"metadata_json,omitempty"`

	Variants []SosmedBundleVariant `gorm:"foreignKey:BundlePackageID" json:"variants,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (p *SosmedBundlePackage) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

type SosmedBundleVariant struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	BundlePackageID uuid.UUID           `gorm:"type:uuid;not null;index;uniqueIndex:idx_sosmed_bundle_variant_package_key" json:"bundle_package_id"`
	Package         SosmedBundlePackage `gorm:"foreignKey:BundlePackageID" json:"package,omitempty"`

	Key             string `gorm:"size:100;not null;uniqueIndex:idx_sosmed_bundle_variant_package_key" json:"key"`
	Name            string `gorm:"size:140;not null" json:"name"`
	Description     string `gorm:"type:text" json:"description,omitempty"`
	PriceMode       string `gorm:"size:40;not null;default:computed" json:"price_mode"`
	FixedPrice      int64  `gorm:"default:0" json:"fixed_price"`
	DiscountPercent int    `gorm:"default:0" json:"discount_percent"`
	DiscountAmount  int64  `gorm:"default:0" json:"discount_amount"`
	IsActive        bool   `gorm:"default:true;index" json:"is_active"`
	SortOrder       int    `gorm:"default:0;index" json:"sort_order"`
	MetadataJSON    string `gorm:"type:text" json:"metadata_json,omitempty"`

	Items []SosmedBundleItem `gorm:"foreignKey:BundleVariantID" json:"items,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (v *SosmedBundleVariant) BeforeCreate(_ *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	return nil
}

type SosmedBundleItem struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	BundleVariantID uuid.UUID           `gorm:"type:uuid;not null;index" json:"bundle_variant_id"`
	Variant         SosmedBundleVariant `gorm:"foreignKey:BundleVariantID" json:"variant,omitempty"`
	SosmedServiceID uuid.UUID           `gorm:"type:uuid;not null;index" json:"sosmed_service_id"`
	Service         SosmedService       `gorm:"foreignKey:SosmedServiceID" json:"service,omitempty"`
	Label           string              `gorm:"size:180" json:"label,omitempty"`
	QuantityUnits   int64               `gorm:"not null" json:"quantity_units"`
	TargetStrategy  string              `gorm:"size:40;not null;default:same_target" json:"target_strategy"`
	SortOrder       int                 `gorm:"default:0;index" json:"sort_order"`
	IsActive        bool                `gorm:"default:true;index" json:"is_active"`
	MetadataJSON    string              `gorm:"type:text" json:"metadata_json,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (i *SosmedBundleItem) BeforeCreate(_ *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}

type SosmedBundleOrder struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	OrderNumber string `gorm:"size:80;not null;uniqueIndex" json:"order_number"`

	UserID uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_sosmed_bundle_orders_user_idem" json:"user_id"`
	User   User      `gorm:"foreignKey:UserID" json:"user,omitempty"`

	BundlePackageID uuid.UUID           `gorm:"type:uuid;not null;index" json:"bundle_package_id"`
	Package         SosmedBundlePackage `gorm:"foreignKey:BundlePackageID" json:"package,omitempty"`
	BundleVariantID uuid.UUID           `gorm:"type:uuid;not null;index" json:"bundle_variant_id"`
	Variant         SosmedBundleVariant `gorm:"foreignKey:BundleVariantID" json:"variant,omitempty"`

	PackageKeySnapshot string `gorm:"size:100;not null" json:"package_key_snapshot"`
	VariantKeySnapshot string `gorm:"size:100;not null" json:"variant_key_snapshot"`
	TitleSnapshot      string `gorm:"size:220;not null" json:"title_snapshot"`
	TargetLink         string `gorm:"size:255" json:"target_link"`
	TargetUsername     string `gorm:"size:120" json:"target_username,omitempty"`
	Notes              string `gorm:"type:text" json:"notes,omitempty"`

	SubtotalPrice     int64 `gorm:"not null" json:"subtotal_price"`
	DiscountAmount    int64 `gorm:"not null;default:0" json:"discount_amount"`
	TotalPrice        int64 `gorm:"not null" json:"total_price"`
	CostPriceSnapshot int64 `gorm:"default:0" json:"cost_price_snapshot"`
	MarginSnapshot    int64 `gorm:"default:0" json:"margin_snapshot"`

	Status              string     `gorm:"size:30;not null;default:pending_payment;index" json:"status"`
	PaymentMethod       string     `gorm:"size:50" json:"payment_method"`
	IdempotencyKey      string     `gorm:"size:80;not null;default:'';uniqueIndex:idx_sosmed_bundle_orders_user_idem" json:"idempotency_key,omitempty"`
	WalletTransactionID *uuid.UUID `gorm:"type:uuid;index" json:"wallet_transaction_id,omitempty"`
	FailureReason       string     `gorm:"type:text" json:"failure_reason,omitempty"`

	Items []SosmedBundleOrderItem `gorm:"foreignKey:BundleOrderID" json:"items,omitempty"`

	PaidAt      *time.Time     `json:"paid_at,omitempty"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (o *SosmedBundleOrder) BeforeCreate(_ *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return nil
}

type SosmedBundleOrderItem struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	BundleOrderID uuid.UUID         `gorm:"type:uuid;not null;index" json:"bundle_order_id"`
	BundleOrder   SosmedBundleOrder `gorm:"foreignKey:BundleOrderID" json:"bundle_order,omitempty"`

	SosmedServiceID uuid.UUID     `gorm:"type:uuid;not null;index" json:"sosmed_service_id"`
	Service         SosmedService `gorm:"foreignKey:SosmedServiceID" json:"service,omitempty"`

	ServiceCodeSnapshot       string `gorm:"size:80;not null;index" json:"service_code_snapshot"`
	ServiceTitleSnapshot      string `gorm:"size:180;not null" json:"service_title_snapshot"`
	ProviderCodeSnapshot      string `gorm:"size:32;index" json:"provider_code_snapshot,omitempty"`
	ProviderServiceIDSnapshot string `gorm:"size:64;index" json:"provider_service_id_snapshot,omitempty"`
	QuantityUnits             int64  `gorm:"not null" json:"quantity_units"`
	UnitPricePer1KSnapshot    int64  `gorm:"not null" json:"unit_price_per_1k_snapshot"`
	LinePrice                 int64  `gorm:"not null" json:"line_price"`
	CostPriceSnapshot         int64  `gorm:"default:0" json:"cost_price_snapshot"`
	TargetLinkSnapshot        string `gorm:"size:255" json:"target_link_snapshot"`

	Status          string     `gorm:"size:30;not null;default:queued;index" json:"status"`
	ProviderOrderID string     `gorm:"size:80;index" json:"provider_order_id,omitempty"`
	ProviderStatus  string     `gorm:"size:40;index" json:"provider_status,omitempty"`
	ProviderError   string     `gorm:"type:text" json:"provider_error,omitempty"`
	SubmittedAt     *time.Time `json:"submitted_at,omitempty"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (i *SosmedBundleOrderItem) BeforeCreate(_ *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}
