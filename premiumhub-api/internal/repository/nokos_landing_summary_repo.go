package repository

import (
	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

type NokosLandingSummaryRepo struct {
	db *gorm.DB
}

func NewNokosLandingSummaryRepo(db *gorm.DB) *NokosLandingSummaryRepo {
	return &NokosLandingSummaryRepo{db: db}
}

func (r *NokosLandingSummaryRepo) FindBySource(source string) (*model.NokosLandingSummary, error) {
	var row model.NokosLandingSummary
	err := r.db.Where("source = ?", source).First(&row).Error
	return &row, err
}

func (r *NokosLandingSummaryRepo) Save(row *model.NokosLandingSummary) error {
	return r.db.Save(row).Error
}
