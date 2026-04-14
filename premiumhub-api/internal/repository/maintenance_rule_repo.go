package repository

import (
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MaintenanceRuleRepo struct {
	db *gorm.DB
}

func NewMaintenanceRuleRepo(db *gorm.DB) *MaintenanceRuleRepo {
	return &MaintenanceRuleRepo{db: db}
}

func (r *MaintenanceRuleRepo) List(includeInactive bool) ([]model.MaintenanceRule, error) {
	var rows []model.MaintenanceRule

	query := r.db.Model(&model.MaintenanceRule{})
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.
		Order("is_active DESC").
		Order("target_type ASC").
		Order("target_path ASC").
		Order("created_at DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}

func (r *MaintenanceRuleRepo) FindByID(id uuid.UUID) (*model.MaintenanceRule, error) {
	var row model.MaintenanceRule
	err := r.db.First(&row, "id = ?", id).Error
	if err != nil {
		return nil, err
	}

	return &row, nil
}

func (r *MaintenanceRuleRepo) Create(rule *model.MaintenanceRule) error {
	return r.db.Create(rule).Error
}

func (r *MaintenanceRuleRepo) Update(rule *model.MaintenanceRule) error {
	return r.db.Save(rule).Error
}

func (r *MaintenanceRuleRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.MaintenanceRule{}, "id = ?", id).Error
}

func (r *MaintenanceRuleRepo) ActiveAt(at time.Time) ([]model.MaintenanceRule, error) {
	var rows []model.MaintenanceRule
	err := r.db.Model(&model.MaintenanceRule{}).
		Where("is_active = ?", true).
		Where("starts_at IS NULL OR starts_at <= ?", at).
		Where("ends_at IS NULL OR ends_at >= ?", at).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}
