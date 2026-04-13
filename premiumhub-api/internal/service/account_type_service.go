package service

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var accountTypeCodePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,48}$`)
var hexColorPattern = regexp.MustCompile(`^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)

type AccountTypeService struct {
	repo *repository.AccountTypeRepo
}

func NewAccountTypeService(repo *repository.AccountTypeRepo) *AccountTypeService {
	return &AccountTypeService{repo: repo}
}

type CreateAccountTypeInput struct {
	Code           string `json:"code" binding:"required"`
	Label          string `json:"label" binding:"required"`
	Description    string `json:"description"`
	SortOrder      *int   `json:"sort_order"`
	BadgeBgColor   string `json:"badge_bg_color"`
	BadgeTextColor string `json:"badge_text_color"`
	IsActive       *bool  `json:"is_active"`
}

type UpdateAccountTypeInput struct {
	Code           *string `json:"code"`
	Label          *string `json:"label"`
	Description    *string `json:"description"`
	SortOrder      *int    `json:"sort_order"`
	BadgeBgColor   *string `json:"badge_bg_color"`
	BadgeTextColor *string `json:"badge_text_color"`
	IsActive       *bool   `json:"is_active"`
}

func normalizeAccountTypeCode(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, " ", "-")
	for strings.Contains(normalized, "--") {
		normalized = strings.ReplaceAll(normalized, "--", "-")
	}
	return normalized
}

func validateAccountTypeCode(value string) error {
	if !accountTypeCodePattern.MatchString(value) {
		return errors.New("kode tipe akun tidak valid (pakai huruf kecil, angka, -, _)")
	}
	return nil
}

func normalizeColor(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	if !hexColorPattern.MatchString(trimmed) {
		return "", errors.New("format warna harus hex, contoh #22C55E")
	}
	if len(trimmed) == 4 {
		return strings.ToUpper("#" + strings.Repeat(string(trimmed[1]), 2) + strings.Repeat(string(trimmed[2]), 2) + strings.Repeat(string(trimmed[3]), 2)), nil
	}
	return strings.ToUpper(trimmed), nil
}

func (s *AccountTypeService) List(includeInactive bool) ([]model.AccountType, error) {
	return s.repo.List(includeInactive)
}

func (s *AccountTypeService) Create(input CreateAccountTypeInput) (*model.AccountType, error) {
	code := normalizeAccountTypeCode(input.Code)
	if code == "" {
		return nil, errors.New("kode tipe akun wajib diisi")
	}
	if err := validateAccountTypeCode(code); err != nil {
		return nil, err
	}

	label := strings.TrimSpace(input.Label)
	if label == "" {
		return nil, errors.New("label tipe akun wajib diisi")
	}

	bgColor, err := normalizeColor(input.BadgeBgColor)
	if err != nil {
		return nil, err
	}
	textColor, err := normalizeColor(input.BadgeTextColor)
	if err != nil {
		return nil, err
	}

	if _, err := s.repo.FindByCode(code); err == nil {
		return nil, errors.New("kode tipe akun sudah dipakai")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek duplikasi tipe akun")
	}

	sortOrder := 100
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	item := &model.AccountType{
		Code:           code,
		Label:          label,
		Description:    strings.TrimSpace(input.Description),
		SortOrder:      sortOrder,
		BadgeBgColor:   bgColor,
		BadgeTextColor: textColor,
		IsActive:       isActive,
		IsSystem:       false,
	}

	if err := s.repo.Create(item); err != nil {
		return nil, errors.New("gagal membuat tipe akun")
	}

	return item, nil
}

func (s *AccountTypeService) Update(id uuid.UUID, input UpdateAccountTypeInput) (*model.AccountType, error) {
	item, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("tipe akun tidak ditemukan")
	}

	if input.Code != nil {
		nextCode := normalizeAccountTypeCode(*input.Code)
		if nextCode != item.Code {
			return nil, errors.New("kode tipe akun tidak bisa diubah")
		}
	}

	if input.Label != nil {
		label := strings.TrimSpace(*input.Label)
		if label == "" {
			return nil, errors.New("label tipe akun wajib diisi")
		}
		item.Label = label
	}

	if input.Description != nil {
		item.Description = strings.TrimSpace(*input.Description)
	}

	if input.SortOrder != nil {
		item.SortOrder = *input.SortOrder
	}

	if input.BadgeBgColor != nil {
		bgColor, err := normalizeColor(*input.BadgeBgColor)
		if err != nil {
			return nil, err
		}
		item.BadgeBgColor = bgColor
	}

	if input.BadgeTextColor != nil {
		textColor, err := normalizeColor(*input.BadgeTextColor)
		if err != nil {
			return nil, err
		}
		item.BadgeTextColor = textColor
	}

	if input.IsActive != nil && item.IsActive != *input.IsActive {
		if !*input.IsActive {
			priceUsage, stockUsage, err := s.repo.CountUsage(item.Code)
			if err != nil {
				return nil, errors.New("gagal cek penggunaan tipe akun")
			}
			if priceUsage > 0 || stockUsage > 0 {
				return nil, fmt.Errorf("tipe akun masih dipakai (harga aktif: %d, stok tersedia: %d)", priceUsage, stockUsage)
			}
		}

		item.IsActive = *input.IsActive
	}

	if err := s.repo.Update(item); err != nil {
		return nil, errors.New("gagal memperbarui tipe akun")
	}
	return item, nil
}

func (s *AccountTypeService) Delete(id uuid.UUID) error {
	item, err := s.repo.FindByID(id)
	if err != nil {
		return errors.New("tipe akun tidak ditemukan")
	}

	if item.IsSystem {
		return errors.New("tipe akun sistem tidak bisa dihapus")
	}

	if !item.IsActive {
		return nil
	}

	priceUsage, stockUsage, err := s.repo.CountUsage(item.Code)
	if err != nil {
		return errors.New("gagal cek penggunaan tipe akun")
	}
	if priceUsage > 0 || stockUsage > 0 {
		return fmt.Errorf("tipe akun masih dipakai (harga aktif: %d, stok tersedia: %d)", priceUsage, stockUsage)
	}

	item.IsActive = false
	if err := s.repo.Update(item); err != nil {
		return errors.New("gagal menghapus tipe akun")
	}

	return nil
}

func (s *AccountTypeService) ValidateActiveCode(value string) (string, error) {
	code := normalizeAccountTypeCode(value)
	if code == "" {
		return "", errors.New("account_type wajib diisi")
	}
	if err := validateAccountTypeCode(code); err != nil {
		return "", err
	}

	item, err := s.repo.FindByCode(code)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("account_type belum terdaftar di master tipe akun")
		}
		return "", errors.New("gagal validasi account_type")
	}
	if !item.IsActive {
		return "", errors.New("account_type nonaktif")
	}

	return code, nil
}
