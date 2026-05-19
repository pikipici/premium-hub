package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailPricingRepo wraps the single-row GmailPricing config table.
//
// Get returns the singleton — caller must run ensureDefaultGmailPricing
// at boot so the row exists. Update applies admin-tunable changes; the
// row is identified by ID returned from the seed.
type GmailPricingRepo struct {
	db *gorm.DB
}

func NewGmailPricingRepo(db *gorm.DB) *GmailPricingRepo {
	return &GmailPricingRepo{db: db}
}

// Get returns the current pricing config. There is exactly one row.
func (r *GmailPricingRepo) Get() (*model.GmailPricing, error) {
	var p model.GmailPricing
	if err := r.db.First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

// Update applies field updates. adminID is recorded in UpdatedByAdminID.
func (r *GmailPricingRepo) Update(updates map[string]any, adminID uuid.UUID) error {
	if updates == nil {
		updates = map[string]any{}
	}
	updates["updated_by_admin_id"] = adminID
	return r.db.Model(&model.GmailPricing{}).
		Where("1 = 1"). // single row
		Updates(updates).Error
}
