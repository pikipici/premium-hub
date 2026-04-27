package repository

import (
	"errors"
	"strings"

	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

type NavbarMenuSettingRepo struct {
	db *gorm.DB
}

func NewNavbarMenuSettingRepo(db *gorm.DB) *NavbarMenuSettingRepo {
	return &NavbarMenuSettingRepo{db: db}
}

func (r *NavbarMenuSettingRepo) EnsureDefaults(defaults []model.NavbarMenuSetting) error {
	for _, item := range defaults {
		item.Key = strings.TrimSpace(item.Key)
		if item.Key == "" {
			continue
		}

		var existing model.NavbarMenuSetting
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

		updates := map[string]interface{}{}
		if strings.TrimSpace(existing.Label) == "" || existing.Label != item.Label {
			updates["label"] = item.Label
		}
		if strings.TrimSpace(existing.Href) == "" || existing.Href != item.Href {
			updates["href"] = item.Href
		}
		if existing.SortOrder == 0 || existing.SortOrder != item.SortOrder {
			updates["sort_order"] = item.SortOrder
		}
		if !existing.IsSystem {
			updates["is_system"] = true
		}

		if len(updates) > 0 {
			if updateErr := r.db.Model(&existing).Updates(updates).Error; updateErr != nil {
				return updateErr
			}
		}
	}

	return nil
}

func (r *NavbarMenuSettingRepo) List() ([]model.NavbarMenuSetting, error) {
	var rows []model.NavbarMenuSetting
	err := r.db.Model(&model.NavbarMenuSetting{}).
		Order("sort_order ASC").
		Order("key ASC").
		Find(&rows).Error
	return rows, err
}

func (r *NavbarMenuSettingRepo) FindByKey(key string) (*model.NavbarMenuSetting, error) {
	var row model.NavbarMenuSetting
	err := r.db.First(&row, "key = ?", strings.TrimSpace(key)).Error
	return &row, err
}

func (r *NavbarMenuSettingRepo) Update(row *model.NavbarMenuSetting) error {
	return r.db.Save(row).Error
}
