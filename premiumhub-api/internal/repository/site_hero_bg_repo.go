package repository

import (
	"premiumhub-api/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SiteHeroBgRepo struct {
	db *gorm.DB
}

func NewSiteHeroBgRepo(db *gorm.DB) *SiteHeroBgRepo {
	return &SiteHeroBgRepo{db: db}
}

func (r *SiteHeroBgRepo) FindByPageKey(pageKey string) (*model.SiteHeroBg, error) {
	var row model.SiteHeroBg
	err := r.db.Where("page_key = ? AND is_active = ?", pageKey, true).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *SiteHeroBgRepo) Upsert(bg *model.SiteHeroBg) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "page_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"background_color", "background_image_url", "is_active", "updated_at"}),
	}).Create(bg).Error
}
