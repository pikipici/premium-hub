package service

import (
	"errors"
	"sort"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

const (
	NavbarMenuApps    = "apps"
	NavbarMenuConvert = "convert_asset"
	NavbarMenuVirtual = "nomor_virtual"
	NavbarMenuSosmed  = "sosmed"
)

type NavbarMenuSettingService struct {
	repo *repository.NavbarMenuSettingRepo
}

func NewNavbarMenuSettingService(repo *repository.NavbarMenuSettingRepo) *NavbarMenuSettingService {
	return &NavbarMenuSettingService{repo: repo}
}

type UpdateNavbarMenuSettingsInput struct {
	Items []UpdateNavbarMenuSettingItem `json:"items" binding:"required"`
}

type UpdateNavbarMenuSettingItem struct {
	Key       string `json:"key" binding:"required"`
	IsVisible *bool  `json:"is_visible" binding:"required"`
}

func DefaultNavbarMenuSettings() []model.NavbarMenuSetting {
	return []model.NavbarMenuSetting{
		{
			Key:       NavbarMenuApps,
			Label:     "Apps",
			Href:      "/product/prem-apps",
			SortOrder: 10,
			IsVisible: false,
			IsSystem:  true,
		},
		{
			Key:       NavbarMenuConvert,
			Label:     "Convert Aset",
			Href:      "/product/convert",
			SortOrder: 20,
			IsVisible: false,
			IsSystem:  true,
		},
		{
			Key:       NavbarMenuVirtual,
			Label:     "Nomor Virtual",
			Href:      "/product/nokos",
			SortOrder: 30,
			IsVisible: true,
			IsSystem:  true,
		},
		{
			Key:       NavbarMenuSosmed,
			Label:     "Sosmed",
			Href:      "/product/sosmed",
			SortOrder: 40,
			IsVisible: true,
			IsSystem:  true,
		},
	}
}

func navbarDefaultKeySet() map[string]bool {
	out := map[string]bool{}
	for _, item := range DefaultNavbarMenuSettings() {
		out[item.Key] = true
	}
	return out
}

func (s *NavbarMenuSettingService) ensureDefaults() error {
	if s == nil || s.repo == nil {
		return errors.New("repo setting navbar belum siap")
	}
	return s.repo.EnsureDefaults(DefaultNavbarMenuSettings())
}

func (s *NavbarMenuSettingService) List() ([]model.NavbarMenuSetting, error) {
	if err := s.ensureDefaults(); err != nil {
		return nil, errors.New("gagal menyiapkan setting navbar")
	}

	rows, err := s.repo.List()
	if err != nil {
		return nil, errors.New("gagal memuat setting navbar")
	}

	allowed := navbarDefaultKeySet()
	filtered := make([]model.NavbarMenuSetting, 0, len(rows))
	for _, row := range rows {
		if allowed[strings.TrimSpace(row.Key)] {
			filtered = append(filtered, row)
		}
	}

	sortNavbarMenuSettings(filtered)
	return filtered, nil
}

func (s *NavbarMenuSettingService) PublicList() ([]model.NavbarMenuSetting, error) {
	items, err := s.List()
	if err != nil {
		return nil, err
	}

	visible := make([]model.NavbarMenuSetting, 0, len(items))
	for _, item := range items {
		if item.IsVisible {
			visible = append(visible, item)
		}
	}

	return visible, nil
}

func (s *NavbarMenuSettingService) Update(input UpdateNavbarMenuSettingsInput) ([]model.NavbarMenuSetting, error) {
	if err := s.ensureDefaults(); err != nil {
		return nil, errors.New("gagal menyiapkan setting navbar")
	}

	allowed := navbarDefaultKeySet()
	for _, item := range input.Items {
		key := strings.TrimSpace(item.Key)
		if !allowed[key] {
			return nil, errors.New("key navbar tidak valid")
		}
		if item.IsVisible == nil {
			return nil, errors.New("status visible wajib diisi")
		}

		row, err := s.repo.FindByKey(key)
		if err != nil {
			return nil, errors.New("setting navbar tidak ditemukan")
		}
		row.IsVisible = *item.IsVisible
		if err := s.repo.Update(row); err != nil {
			return nil, errors.New("gagal update setting navbar")
		}
	}

	return s.List()
}

func sortNavbarMenuSettings(items []model.NavbarMenuSetting) {
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].SortOrder != items[j].SortOrder {
			return items[i].SortOrder < items[j].SortOrder
		}
		return items[i].Key < items[j].Key
	})
}
