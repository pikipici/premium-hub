package repository

import (
	"errors"
	"strings"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AccountTypeRepo struct {
	db *gorm.DB
}

func NewAccountTypeRepo(db *gorm.DB) *AccountTypeRepo {
	return &AccountTypeRepo{db: db}
}

func (r *AccountTypeRepo) EnsureDefaults() error {
	defaults := []model.AccountType{
		{
			Code:           "shared",
			Label:          "Shared · Akun Bersama",
			Description:    "Akun dipakai bersama beberapa user.",
			SortOrder:      10,
			BadgeBgColor:   "#ECFDF5",
			BadgeTextColor: "#047857",
			IsActive:       true,
			IsSystem:       true,
		},
		{
			Code:           "private",
			Label:          "Private · Akun Pribadi",
			Description:    "Akun dedicated untuk satu user.",
			SortOrder:      20,
			BadgeBgColor:   "#EFF6FF",
			BadgeTextColor: "#1D4ED8",
			IsActive:       true,
			IsSystem:       true,
		},
	}

	for _, item := range defaults {
		var existing model.AccountType
		err := r.db.Where("code = ?", item.Code).First(&existing).Error
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
		if strings.TrimSpace(existing.Label) == "" {
			updates["label"] = item.Label
		}
		if strings.TrimSpace(existing.Description) == "" {
			updates["description"] = item.Description
		}
		if existing.SortOrder == 0 {
			updates["sort_order"] = item.SortOrder
		}
		if strings.TrimSpace(existing.BadgeBgColor) == "" {
			updates["badge_bg_color"] = item.BadgeBgColor
		}
		if strings.TrimSpace(existing.BadgeTextColor) == "" {
			updates["badge_text_color"] = item.BadgeTextColor
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

func (r *AccountTypeRepo) List(includeInactive bool) ([]model.AccountType, error) {
	var items []model.AccountType
	q := r.db.Model(&model.AccountType{})
	if !includeInactive {
		q = q.Where("is_active = ?", true)
	}

	err := q.Order("sort_order ASC").Order("code ASC").Find(&items).Error
	return items, err
}

func (r *AccountTypeRepo) FindByID(id uuid.UUID) (*model.AccountType, error) {
	var item model.AccountType
	err := r.db.First(&item, "id = ?", id).Error
	return &item, err
}

func (r *AccountTypeRepo) FindByCode(code string) (*model.AccountType, error) {
	var item model.AccountType
	err := r.db.Where("code = ?", code).First(&item).Error
	return &item, err
}

func (r *AccountTypeRepo) Create(item *model.AccountType) error {
	return r.db.Create(item).Error
}

func (r *AccountTypeRepo) Update(item *model.AccountType) error {
	return r.db.Save(item).Error
}

func (r *AccountTypeRepo) CountUsage(code string) (int64, int64, error) {
	var activePriceCount int64
	if err := r.db.Model(&model.ProductPrice{}).
		Where("account_type = ? AND is_active = ?", code, true).
		Count(&activePriceCount).Error; err != nil {
		return 0, 0, err
	}

	var stockCount int64
	if err := r.db.Model(&model.Stock{}).
		Where("account_type = ? AND status = ?", code, "available").
		Count(&stockCount).Error; err != nil {
		return 0, 0, err
	}

	return activePriceCount, stockCount, nil
}
