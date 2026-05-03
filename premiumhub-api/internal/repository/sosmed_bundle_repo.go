package repository

import (
	"context"
	"strings"

	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

type SosmedBundleRepo struct {
	db *gorm.DB
}

func NewSosmedBundleRepo(db *gorm.DB) *SosmedBundleRepo {
	return &SosmedBundleRepo{db: db}
}

func (r *SosmedBundleRepo) DB() *gorm.DB {
	return r.db
}

func (r *SosmedBundleRepo) ListActiveBundles(ctx context.Context) ([]model.SosmedBundlePackage, error) {
	var bundles []model.SosmedBundlePackage
	err := r.db.WithContext(ctx).
		Preload("Variants", activeSortScope("sort_order ASC, created_at ASC")).
		Preload("Variants.Items", activeSortScope("sort_order ASC, created_at ASC")).
		Preload("Variants.Items.Service").
		Where("is_active = ?", true).
		Order("sort_order ASC, created_at ASC").
		Find(&bundles).Error
	return bundles, err
}

func (r *SosmedBundleRepo) GetBundleByKey(ctx context.Context, key string) (*model.SosmedBundlePackage, error) {
	var bundle model.SosmedBundlePackage
	err := r.db.WithContext(ctx).
		Preload("Variants", activeSortScope("sort_order ASC, created_at ASC")).
		Preload("Variants.Items", activeSortScope("sort_order ASC, created_at ASC")).
		Preload("Variants.Items.Service").
		Where("key = ? AND is_active = ?", strings.TrimSpace(key), true).
		First(&bundle).Error
	return &bundle, err
}

func (r *SosmedBundleRepo) GetVariantForCheckout(ctx context.Context, bundleKey, variantKey string) (*model.SosmedBundleVariant, error) {
	var variant model.SosmedBundleVariant
	err := r.db.WithContext(ctx).
		Joins("JOIN sosmed_bundle_packages ON sosmed_bundle_packages.id = sosmed_bundle_variants.bundle_package_id").
		Preload("Package").
		Preload("Items", activeSortScope("sort_order ASC, created_at ASC")).
		Preload("Items.Service").
		Where("sosmed_bundle_packages.key = ?", strings.TrimSpace(bundleKey)).
		Where("sosmed_bundle_packages.is_active = ?", true).
		Where("sosmed_bundle_variants.key = ?", strings.TrimSpace(variantKey)).
		Where("sosmed_bundle_variants.is_active = ?", true).
		First(&variant).Error
	return &variant, err
}

func activeSortScope(order string) func(*gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Where("is_active = ?", true).Order(order)
	}
}
