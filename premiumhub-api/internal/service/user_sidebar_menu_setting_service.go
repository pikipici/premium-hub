package service

import (
	"errors"
	"sort"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

const (
	UserSidebarMenuConvertHistory = "convert_history"
	UserSidebarMenuActiveAccounts = "active_accounts"
	UserSidebarMenuOrderHistory   = "order_history"
	UserSidebarMenuWarrantyClaim  = "warranty_claim"
)

type UserSidebarMenuSettingService struct {
	repo *repository.UserSidebarMenuSettingRepo
}

func NewUserSidebarMenuSettingService(repo *repository.UserSidebarMenuSettingRepo) *UserSidebarMenuSettingService {
	return &UserSidebarMenuSettingService{repo: repo}
}

type UpdateUserSidebarMenuSettingsInput struct {
	Items []UpdateUserSidebarMenuSettingItem `json:"items" binding:"required"`
}

type UpdateUserSidebarMenuSettingItem struct {
	Key       string `json:"key" binding:"required"`
	IsVisible *bool  `json:"is_visible" binding:"required"`
}

func DefaultUserSidebarMenuSettings() []model.UserSidebarMenuSetting {
	return []model.UserSidebarMenuSetting{
		{
			Key:       UserSidebarMenuConvertHistory,
			Label:     "Riwayat Convert",
			Href:      "/dashboard/convert/orders",
			SortOrder: 30,
			IsVisible: false,
			IsSystem:  true,
		},
		{
			Key:       UserSidebarMenuActiveAccounts,
			Label:     "Akun Aktif",
			Href:      "/dashboard/akun-aktif",
			SortOrder: 60,
			IsVisible: false,
			IsSystem:  true,
		},
		{
			Key:       UserSidebarMenuOrderHistory,
			Label:     "Riwayat Order",
			Href:      "/dashboard/riwayat-order",
			SortOrder: 70,
			IsVisible: false,
			IsSystem:  true,
		},
		{
			Key:       UserSidebarMenuWarrantyClaim,
			Label:     "Klaim Garansi",
			Href:      "/dashboard/klaim-garansi",
			SortOrder: 80,
			IsVisible: false,
			IsSystem:  true,
		},
	}
}

func userSidebarDefaultKeySet() map[string]bool {
	out := map[string]bool{}
	for _, item := range DefaultUserSidebarMenuSettings() {
		out[item.Key] = true
	}
	return out
}

func (s *UserSidebarMenuSettingService) ensureDefaults() error {
	if s == nil || s.repo == nil {
		return errors.New("repo setting menu user belum siap")
	}
	return s.repo.EnsureDefaults(DefaultUserSidebarMenuSettings())
}

func (s *UserSidebarMenuSettingService) List() ([]model.UserSidebarMenuSetting, error) {
	if err := s.ensureDefaults(); err != nil {
		return nil, errors.New("gagal menyiapkan setting menu user")
	}

	rows, err := s.repo.List()
	if err != nil {
		return nil, errors.New("gagal memuat setting menu user")
	}

	allowed := userSidebarDefaultKeySet()
	filtered := make([]model.UserSidebarMenuSetting, 0, len(rows))
	for _, row := range rows {
		if allowed[strings.TrimSpace(row.Key)] {
			filtered = append(filtered, row)
		}
	}

	sort.SliceStable(filtered, func(i, j int) bool {
		if filtered[i].SortOrder != filtered[j].SortOrder {
			return filtered[i].SortOrder < filtered[j].SortOrder
		}
		return filtered[i].Key < filtered[j].Key
	})

	return filtered, nil
}

func (s *UserSidebarMenuSettingService) Update(input UpdateUserSidebarMenuSettingsInput) ([]model.UserSidebarMenuSetting, error) {
	if err := s.ensureDefaults(); err != nil {
		return nil, errors.New("gagal menyiapkan setting menu user")
	}

	allowed := userSidebarDefaultKeySet()
	for _, item := range input.Items {
		key := strings.TrimSpace(item.Key)
		if !allowed[key] {
			return nil, errors.New("key menu user tidak valid")
		}
		if item.IsVisible == nil {
			return nil, errors.New("status visible wajib diisi")
		}

		row, err := s.repo.FindByKey(key)
		if err != nil {
			return nil, errors.New("setting menu user tidak ditemukan")
		}
		row.IsVisible = *item.IsVisible
		if err := s.repo.Update(row); err != nil {
			return nil, errors.New("gagal update setting menu user")
		}
	}

	return s.List()
}
