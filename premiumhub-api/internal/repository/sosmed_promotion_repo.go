package repository

import (
	"context"
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedPromotionRepo struct {
	db *gorm.DB
}

func NewSosmedPromotionRepo(db *gorm.DB) *SosmedPromotionRepo {
	return &SosmedPromotionRepo{db: db}
}

func (r *SosmedPromotionRepo) DB() *gorm.DB { return r.db }

func (r *SosmedPromotionRepo) List(ctx context.Context) ([]model.SosmedPromotion, error) {
	var items []model.SosmedPromotion
	err := r.db.WithContext(ctx).
		Preload("Service").
		Preload("BundleVariant").
		Preload("BundleVariant.Package").
		Order("is_active DESC, ends_at DESC, created_at DESC").
		Find(&items).Error
	return items, err
}

func (r *SosmedPromotionRepo) Create(ctx context.Context, item *model.SosmedPromotion) error {
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *SosmedPromotionRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.SosmedPromotion, error) {
	var item model.SosmedPromotion
	err := r.db.WithContext(ctx).Preload("Service").Preload("BundleVariant").Preload("BundleVariant.Package").First(&item, "id = ?", id).Error
	return &item, err
}

func (r *SosmedPromotionRepo) Save(ctx context.Context, item *model.SosmedPromotion) error {
	return r.db.WithContext(ctx).Save(item).Error
}

func (r *SosmedPromotionRepo) ActiveForService(ctx context.Context, serviceID uuid.UUID, at time.Time) (*model.SosmedPromotion, error) {
	var item model.SosmedPromotion
	err := r.db.WithContext(ctx).
		Where("target_type = ? AND service_id = ? AND is_active = ? AND starts_at <= ? AND ends_at > ?", "service", serviceID, true, at, at).
		Order("created_at DESC").First(&item).Error
	return &item, err
}

func (r *SosmedPromotionRepo) ActiveForBundleVariant(ctx context.Context, variantID uuid.UUID, at time.Time) (*model.SosmedPromotion, error) {
	var item model.SosmedPromotion
	err := r.db.WithContext(ctx).
		Where("target_type = ? AND bundle_variant_id = ? AND is_active = ? AND starts_at <= ? AND ends_at > ?", "bundle_variant", variantID, true, at, at).
		Order("created_at DESC").First(&item).Error
	return &item, err
}
