package repository

import (
	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

type NokosLandingSummaryRepo struct {
	db *gorm.DB
}

type NokosSentTotals struct {
	Activation int64
	Hosting    int64
	Total      int64
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

func (r *NokosLandingSummaryRepo) CountSentTotals() (NokosSentTotals, error) {
	type sentTotalsRow struct {
		Activation int64
		Hosting    int64
		Total      int64
	}

	var row sentTotalsRow
	err := r.db.Model(&model.FiveSimOrder{}).
		Select(`
			COALESCE(SUM(CASE WHEN LOWER(order_type) = 'activation' THEN 1 ELSE 0 END), 0) AS activation,
			COALESCE(SUM(CASE WHEN LOWER(order_type) = 'hosting' THEN 1 ELSE 0 END), 0) AS hosting,
			COALESCE(COUNT(*), 0) AS total
		`).
		Where("COALESCE(UPPER(provider_status), '') NOT IN ?", []string{"CANCELED", "BANNED"}).
		Scan(&row).Error
	if err != nil {
		return NokosSentTotals{}, err
	}

	return NokosSentTotals{
		Activation: row.Activation,
		Hosting:    row.Hosting,
		Total:      row.Total,
	}, nil
}
