package repository

import (
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SiteFlashSaleRepo struct {
	db *gorm.DB
}

func NewSiteFlashSaleRepo(db *gorm.DB) *SiteFlashSaleRepo {
	return &SiteFlashSaleRepo{db: db}
}

func (r *SiteFlashSaleRepo) List() ([]model.SiteFlashSale, error) {
	var rows []model.SiteFlashSale
	err := r.db.Preload("Product").Preload("Product.Prices").
		Order("sort_order ASC").Order("created_at DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *SiteFlashSaleRepo) Active(now time.Time) ([]model.SiteFlashSale, error) {
	var rows []model.SiteFlashSale
	err := r.db.Preload("Product").Preload("Product.Prices").
		Where("is_active = ?", true).
		Where("ends_at > ?", now).
		Order("sort_order ASC").Order("created_at DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *SiteFlashSaleRepo) FindByID(id uuid.UUID) (*model.SiteFlashSale, error) {
	var row model.SiteFlashSale
	err := r.db.Preload("Product").Preload("Product.Prices").First(&row, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *SiteFlashSaleRepo) FindByProductID(productID uuid.UUID) (*model.SiteFlashSale, error) {
	var row model.SiteFlashSale
	err := r.db.Where("product_id = ?", productID).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *SiteFlashSaleRepo) Create(fs *model.SiteFlashSale) error {
	return r.db.Create(fs).Error
}

func (r *SiteFlashSaleRepo) Update(fs *model.SiteFlashSale) error {
	return r.db.Save(fs).Error
}

func (r *SiteFlashSaleRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.SiteFlashSale{}, "id = ?", id).Error
}
