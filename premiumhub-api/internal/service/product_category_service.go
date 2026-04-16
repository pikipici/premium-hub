package service

import (
	"errors"
	"regexp"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var productCategoryCodePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,48}$`)

type ProductCategoryService struct {
	repo *repository.ProductCategoryRepo
}

func NewProductCategoryService(repo *repository.ProductCategoryRepo) *ProductCategoryService {
	return &ProductCategoryService{repo: repo}
}

type CreateProductCategoryInput struct {
	Scope       string `json:"scope" binding:"required"`
	Code        string `json:"code" binding:"required"`
	Label       string `json:"label" binding:"required"`
	Description string `json:"description"`
	SortOrder   *int   `json:"sort_order"`
	IsActive    *bool  `json:"is_active"`
}

type UpdateProductCategoryInput struct {
	Scope       *string `json:"scope"`
	Code        *string `json:"code"`
	Label       *string `json:"label"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sort_order"`
	IsActive    *bool   `json:"is_active"`
}

func normalizeProductCategoryScope(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "-", "_")
	return normalized
}

func validateProductCategoryScope(scope string) error {
	switch scope {
	case model.ProductCategoryScopePremApps, model.ProductCategoryScopeSosmed:
		return nil
	default:
		return errors.New("scope kategori tidak valid")
	}
}

func normalizeProductCategoryCode(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, " ", "-")
	for strings.Contains(normalized, "--") {
		normalized = strings.ReplaceAll(normalized, "--", "-")
	}
	return normalized
}

func validateProductCategoryCode(code string) error {
	if !productCategoryCodePattern.MatchString(code) {
		return errors.New("kode kategori tidak valid (pakai huruf kecil, angka, -, _)")
	}
	return nil
}

func (s *ProductCategoryService) List(scope string, includeInactive bool) ([]model.ProductCategory, error) {
	normalizedScope := ""
	if strings.TrimSpace(scope) != "" {
		normalizedScope = normalizeProductCategoryScope(scope)
		if err := validateProductCategoryScope(normalizedScope); err != nil {
			return nil, err
		}
	}

	return s.repo.List(normalizedScope, includeInactive)
}

func (s *ProductCategoryService) Create(input CreateProductCategoryInput) (*model.ProductCategory, error) {
	scope := normalizeProductCategoryScope(input.Scope)
	if err := validateProductCategoryScope(scope); err != nil {
		return nil, err
	}

	code := normalizeProductCategoryCode(input.Code)
	if code == "" {
		return nil, errors.New("kode kategori wajib diisi")
	}
	if err := validateProductCategoryCode(code); err != nil {
		return nil, err
	}

	label := strings.TrimSpace(input.Label)
	if label == "" {
		return nil, errors.New("label kategori wajib diisi")
	}

	if _, err := s.repo.FindByScopeAndCode(scope, code); err == nil {
		return nil, errors.New("kode kategori sudah dipakai pada scope ini")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek duplikasi kategori")
	}

	sortOrder := 100
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	item := &model.ProductCategory{
		Scope:       scope,
		Code:        code,
		Label:       label,
		Description: strings.TrimSpace(input.Description),
		SortOrder:   sortOrder,
		IsActive:    isActive,
	}

	if err := s.repo.Create(item); err != nil {
		return nil, errors.New("gagal membuat kategori")
	}

	return item, nil
}

func (s *ProductCategoryService) Update(id uuid.UUID, input UpdateProductCategoryInput) (*model.ProductCategory, error) {
	item, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("kategori tidak ditemukan")
	}

	if input.Scope != nil {
		nextScope := normalizeProductCategoryScope(*input.Scope)
		if err := validateProductCategoryScope(nextScope); err != nil {
			return nil, err
		}
		if nextScope != item.Scope {
			return nil, errors.New("scope kategori tidak bisa diubah")
		}
	}

	if input.Code != nil {
		nextCode := normalizeProductCategoryCode(*input.Code)
		if err := validateProductCategoryCode(nextCode); err != nil {
			return nil, err
		}
		if nextCode != item.Code {
			return nil, errors.New("kode kategori tidak bisa diubah")
		}
	}

	if input.Label != nil {
		label := strings.TrimSpace(*input.Label)
		if label == "" {
			return nil, errors.New("label kategori wajib diisi")
		}
		item.Label = label
	}

	if input.Description != nil {
		item.Description = strings.TrimSpace(*input.Description)
	}

	if input.SortOrder != nil {
		item.SortOrder = *input.SortOrder
	}

	if input.IsActive != nil {
		item.IsActive = *input.IsActive
	}

	if err := s.repo.Update(item); err != nil {
		return nil, errors.New("gagal memperbarui kategori")
	}

	return item, nil
}

func (s *ProductCategoryService) Delete(id uuid.UUID) error {
	item, err := s.repo.FindByID(id)
	if err != nil {
		return errors.New("kategori tidak ditemukan")
	}

	if !item.IsActive {
		return nil
	}

	item.IsActive = false
	if err := s.repo.Update(item); err != nil {
		return errors.New("gagal menonaktifkan kategori")
	}

	return nil
}

func (s *ProductCategoryService) ValidateActiveCode(scope, value string) (string, error) {
	normalizedScope := normalizeProductCategoryScope(scope)
	if err := validateProductCategoryScope(normalizedScope); err != nil {
		return "", err
	}

	code := normalizeProductCategoryCode(value)
	if code == "" {
		return "", errors.New("kategori produk wajib diisi")
	}
	if err := validateProductCategoryCode(code); err != nil {
		return "", err
	}

	item, err := s.repo.FindByScopeAndCode(normalizedScope, code)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("kategori belum terdaftar di master kategori")
		}
		return "", errors.New("gagal validasi kategori")
	}
	if !item.IsActive {
		return "", errors.New("kategori nonaktif")
	}

	return code, nil
}
