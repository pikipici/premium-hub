package repository

import (
	"premiumhub-api/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SosmedHeroSlideRepo struct {
	db *gorm.DB
}

func NewSosmedHeroSlideRepo(db *gorm.DB) *SosmedHeroSlideRepo {
	return &SosmedHeroSlideRepo{db: db}
}

func (r *SosmedHeroSlideRepo) FindByPageKey(pageKey string) (*model.SosmedHeroSlide, error) {
	var row model.SosmedHeroSlide
	err := r.db.Where("page_key = ? AND is_active = ?", pageKey, true).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *SosmedHeroSlideRepo) FindByPageKeyAll(pageKey string) (*model.SosmedHeroSlide, error) {
	var row model.SosmedHeroSlide
	err := r.db.Where("page_key = ?", pageKey).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *SosmedHeroSlideRepo) Upsert(slide *model.SosmedHeroSlide) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "page_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "subtitle", "cta_label", "cta_href", "icon", "background_color", "background_image_url", "is_active", "updated_at"}),
	}).Create(slide).Error
}
