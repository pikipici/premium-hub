package repository

import (
	"errors"
	"strings"

	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

type PaymentMethodSettingRepo struct {
	db *gorm.DB
}

func NewPaymentMethodSettingRepo(db *gorm.DB) *PaymentMethodSettingRepo {
	return &PaymentMethodSettingRepo{db: db}
}

// EnsureDefaults seeds rows that don't exist yet. It never overwrites
// admin-customised fields (is_enabled, unavailable_note).
func (r *PaymentMethodSettingRepo) EnsureDefaults(defaults []model.PaymentMethodSetting) error {
	for _, item := range defaults {
		item.Key = strings.TrimSpace(item.Key)
		if item.Key == "" {
			continue
		}

		var existing model.PaymentMethodSetting
		err := r.db.Where("key = ?", item.Key).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if createErr := r.db.Create(&item).Error; createErr != nil {
				return createErr
			}
			continue
		}
		if err != nil {
			return err
		}

		// Only sync structural / display fields; never overwrite admin choices.
		updates := map[string]interface{}{}
		if strings.TrimSpace(existing.Label) == "" {
			updates["label"] = item.Label
		}
		if existing.SortOrder == 0 {
			updates["sort_order"] = item.SortOrder
		}

		if len(updates) > 0 {
			if updateErr := r.db.Model(&existing).Updates(updates).Error; updateErr != nil {
				return updateErr
			}
		}
	}
	return nil
}

func (r *PaymentMethodSettingRepo) List() ([]model.PaymentMethodSetting, error) {
	var rows []model.PaymentMethodSetting
	err := r.db.Model(&model.PaymentMethodSetting{}).
		Order("sort_order ASC").
		Order("key ASC").
		Find(&rows).Error
	return rows, err
}

func (r *PaymentMethodSettingRepo) FindByKey(key string) (*model.PaymentMethodSetting, error) {
	var row model.PaymentMethodSetting
	err := r.db.First(&row, "key = ?", strings.TrimSpace(key)).Error
	return &row, err
}

func (r *PaymentMethodSettingRepo) Update(row *model.PaymentMethodSetting) error {
	return r.db.Save(row).Error
}
