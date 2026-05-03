package repository

import (
	"context"
	"strings"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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

func (r *SosmedBundleRepo) ListAdminBundles(ctx context.Context, includeInactive bool) ([]model.SosmedBundlePackage, error) {
	var bundles []model.SosmedBundlePackage
	q := r.db.WithContext(ctx).
		Preload("Variants", sortScope("sort_order ASC, created_at ASC")).
		Preload("Variants.Items", sortScope("sort_order ASC, created_at ASC")).
		Preload("Variants.Items.Service").
		Order("sort_order ASC, created_at ASC")
	if !includeInactive {
		q = q.Where("is_active = ?", true)
	}
	err := q.Find(&bundles).Error
	return bundles, err
}

func (r *SosmedBundleRepo) GetAdminBundleByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*model.SosmedBundlePackage, error) {
	var bundle model.SosmedBundlePackage
	q := r.db.WithContext(ctx).
		Preload("Variants", sortScope("sort_order ASC, created_at ASC")).
		Preload("Variants.Items", sortScope("sort_order ASC, created_at ASC")).
		Preload("Variants.Items.Service")
	if !includeInactive {
		q = q.Where("is_active = ?", true)
	}
	err := q.First(&bundle, "id = ?", id).Error
	return &bundle, err
}

func (r *SosmedBundleRepo) FindBundleByKeyIncludingInactive(ctx context.Context, key string) (*model.SosmedBundlePackage, error) {
	var bundle model.SosmedBundlePackage
	err := r.db.WithContext(ctx).
		Where("key = ?", strings.TrimSpace(key)).
		First(&bundle).Error
	return &bundle, err
}

func (r *SosmedBundleRepo) CreateBundlePackage(ctx context.Context, pkg *model.SosmedBundlePackage) error {
	isActive := pkg.IsActive
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(pkg).Error; err != nil {
			return err
		}
		if !isActive {
			pkg.IsActive = false
			return tx.Model(pkg).Update("is_active", false).Error
		}
		return nil
	})
}

func (r *SosmedBundleRepo) UpdateBundlePackage(ctx context.Context, pkg *model.SosmedBundlePackage) error {
	return r.db.WithContext(ctx).Omit(clause.Associations).Select("*").Save(pkg).Error
}

func (r *SosmedBundleRepo) CreateBundleVariant(ctx context.Context, variant *model.SosmedBundleVariant) error {
	isActive := variant.IsActive
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(variant).Error; err != nil {
			return err
		}
		if !isActive {
			variant.IsActive = false
			return tx.Model(variant).Update("is_active", false).Error
		}
		return nil
	})
}

func (r *SosmedBundleRepo) UpdateBundleVariant(ctx context.Context, variant *model.SosmedBundleVariant) error {
	return r.db.WithContext(ctx).Omit(clause.Associations).Select("*").Save(variant).Error
}

func (r *SosmedBundleRepo) CreateBundleItem(ctx context.Context, item *model.SosmedBundleItem) error {
	isActive := item.IsActive
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(item).Error; err != nil {
			return err
		}
		if !isActive {
			item.IsActive = false
			return tx.Model(item).Update("is_active", false).Error
		}
		return nil
	})
}

func (r *SosmedBundleRepo) UpdateBundleItem(ctx context.Context, item *model.SosmedBundleItem) error {
	return r.db.WithContext(ctx).Omit(clause.Associations).Select("*").Save(item).Error
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

func sortScope(order string) func(*gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Order(order)
	}
}
