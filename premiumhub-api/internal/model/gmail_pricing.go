package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailPricing is a single-row config table for the gmail marketplace.
//
// Seeded by ensureDefaultGmailPricing in config/database.go on first
// boot. Read on every buy and verify (sell payout) to compute the
// current rate. Admin updates via /admin/gmail/pricing.
//
// BulkDiscountTiers is JSON-encoded:
//
//	[{"min_qty":10,"discount_pct":5},{"min_qty":50,"discount_pct":10}]
//
// Tiers are evaluated highest-min-qty-first that the buyer's quantity
// satisfies. discount_pct applies to gross before tax (no tax in MVP).
//
// LowInventoryThreshold drives the admin "stok menipis" notification
// when verified-count drops below this number.
type GmailPricing struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	BuyPrice  int64 `gorm:"not null" json:"buy_price"`  // Rp paid per gmail to seller (default 3000)
	SellPrice int64 `gorm:"not null" json:"sell_price"` // Rp charged per gmail to buyer (default 5000)

	BulkDiscountEnabled bool   `gorm:"not null;default:false" json:"bulk_discount_enabled"`
	BulkDiscountTiers   string `gorm:"type:text" json:"bulk_discount_tiers"`

	LowInventoryThreshold int `gorm:"not null;default:20" json:"low_inventory_threshold"`

	UpdatedByAdminID *uuid.UUID `gorm:"type:uuid" json:"updated_by_admin_id,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (g *GmailPricing) BeforeCreate(_ *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}
