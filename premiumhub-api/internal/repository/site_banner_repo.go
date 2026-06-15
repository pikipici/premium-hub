package repository

import (
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SiteBannerRepo struct {
	db *gorm.DB
}

func NewSiteBannerRepo(db *gorm.DB) *SiteBannerRepo {
	return &SiteBannerRepo{db: db}
}

func (r *SiteBannerRepo) List() ([]model.SiteBanner, error) {
	var rows []model.SiteBanner
	err := r.db.Order("sort_order ASC").Order("created_at DESC").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *SiteBannerRepo) FindByID(id uuid.UUID) (*model.SiteBanner, error) {
	var row model.SiteBanner
	err := r.db.First(&row, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *SiteBannerRepo) Create(banner *model.SiteBanner) error {
	return r.db.Create(banner).Error
}

func (r *SiteBannerRepo) Update(banner *model.SiteBanner) error {
	return r.db.Save(banner).Error
}

func (r *SiteBannerRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.SiteBanner{}, "id = ?", id).Error
}

func (r *SiteBannerRepo) ActiveBanners(now time.Time) ([]model.SiteBanner, error) {
	var rows []model.SiteBanner
	err := r.db.Model(&model.SiteBanner{}).
		Where("is_active = ?", true).
		Where("starts_at IS NULL OR starts_at <= ?", now).
		Where("ends_at IS NULL OR ends_at >= ?", now).
		Order("sort_order ASC").
		Order("created_at DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}
