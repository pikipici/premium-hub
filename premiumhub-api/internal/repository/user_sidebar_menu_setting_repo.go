package repository

import (
	"errors"
	"strings"

	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

type UserSidebarMenuSettingRepo struct {
	db *gorm.DB
}

func NewUserSidebarMenuSettingRepo(db *gorm.DB) *UserSidebarMenuSettingRepo {
	return &UserSidebarMenuSettingRepo{db: db}
}

func (r *UserSidebarMenuSettingRepo) EnsureDefaults(defaults []model.UserSidebarMenuSetting) error {
	for _, item := range defaults {
		item.Key = strings.TrimSpace(item.Key)
		if item.Key == "" {
			continue
		}

		var existing model.UserSidebarMenuSetting
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

func (r *UserSidebarMenuSettingRepo) List() ([]model.UserSidebarMenuSetting, error) {
	var rows []model.UserSidebarMenuSetting
	err := r.db.Model(&model.UserSidebarMenuSetting{}).
		Order("sort_order ASC").
		Order("key ASC").
		Find(&rows).Error
	return rows, err
}

func (r *UserSidebarMenuSettingRepo) FindByKey(key string) (*model.UserSidebarMenuSetting, error) {
	var row model.UserSidebarMenuSetting
	err := r.db.First(&row, "key = ?", strings.TrimSpace(key)).Error
	return &row, err
}

func (r *UserSidebarMenuSettingRepo) Update(row *model.UserSidebarMenuSetting) error {
	return r.db.Save(row).Error
}
