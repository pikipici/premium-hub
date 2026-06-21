package repository

import (
	"time"

	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

type SosmedHeroSlideRepo struct {
	db *gorm.DB
}

func NewSosmedHeroSlideRepo(db *gorm.DB) *SosmedHeroSlideRepo {
	return &SosmedHeroSlideRepo{db: db}
}

func (r *SosmedHeroSlideRepo) ListActive(pageKey string) ([]model.SosmedHeroSlide, error) {
	var rows []model.SosmedHeroSlide
	now := time.Now()
	err := r.db.Where("page_key = ? AND is_active = ?", pageKey, true).
		Where("(starts_at IS NULL OR starts_at <= ?)", now).
		Where("(ends_at IS NULL OR ends_at >= ?)", now).
		Order("sort_order ASC, created_at ASC").
		Find(&rows).Error
	return rows, err
}

func (r *SosmedHeroSlideRepo) ListAll(pageKey string) ([]model.SosmedHeroSlide, error) {
	var rows []model.SosmedHeroSlide
	err := r.db.Where("page_key = ?", pageKey).
		Order("sort_order ASC, created_at ASC").
		Find(&rows).Error
	return rows, err
}

func (r *SosmedHeroSlideRepo) FindByID(id string) (*model.SosmedHeroSlide, error) {
	var row model.SosmedHeroSlide
	err := r.db.First(&row, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *SosmedHeroSlideRepo) Create(slide *model.SosmedHeroSlide) error {
	return r.db.Create(slide).Error
}

func (r *SosmedHeroSlideRepo) Update(slide *model.SosmedHeroSlide) error {
	return r.db.Save(slide).Error
}

func (r *SosmedHeroSlideRepo) Delete(id string) error {
	return r.db.Delete(&model.SosmedHeroSlide{}, "id = ?", id).Error
}
