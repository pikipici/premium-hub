package service

import (
	"errors"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var sosmedServiceCodePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,78}$`)

var sosmedServiceAllowedThemes = map[string]struct{}{
	"blue":   {},
	"pink":   {},
	"yellow": {},
	"purple": {},
	"mint":   {},
	"orange": {},
	"gray":   {},
}

type SosmedServiceService struct {
	repo                 *repository.SosmedServiceRepo
	productCategorySvc   *ProductCategoryService
	resellerFXConfig     SosmedResellerFXConfig
	resellerFXHTTPClient *http.Client
}

func NewSosmedServiceService(
	repo *repository.SosmedServiceRepo,
	productCategoryRepo *repository.ProductCategoryRepo,
) *SosmedServiceService {
	svc := &SosmedServiceService{
		repo: repo,
		resellerFXConfig: SosmedResellerFXConfig{
			Mode:        defaultSosmedResellerFXMode,
			FixedRate:   defaultSosmedResellerFXRate,
			LiveURL:     defaultSosmedResellerFXLiveURL,
			LiveTimeout: 8 * time.Second,
		},
	}
	if productCategoryRepo != nil {
		svc.productCategorySvc = NewProductCategoryService(productCategoryRepo)
	}
	svc.resellerFXHTTPClient = &http.Client{Timeout: svc.resellerFXConfig.LiveTimeout}
	return svc
}

type CreateSosmedServiceInput struct {
	CategoryCode  string   `json:"category_code" binding:"required"`
	Code          string   `json:"code" binding:"required"`
	Title         string   `json:"title" binding:"required"`
	ProviderTitle string   `json:"provider_title"`
	Summary       string   `json:"summary"`
	PlatformLabel string   `json:"platform_label"`
	BadgeText     string   `json:"badge_text"`
	Theme         string   `json:"theme"`
	MinOrder      string   `json:"min_order"`
	StartTime     string   `json:"start_time"`
	Refill        string   `json:"refill"`
	ETA           string   `json:"eta"`
	PriceStart    string   `json:"price_start"`
	PricePer1K    string   `json:"price_per_1k"`
	CheckoutPrice int64    `json:"checkout_price"`
	TrustBadges   []string `json:"trust_badges"`
	SortOrder     *int     `json:"sort_order"`
	IsActive      *bool    `json:"is_active"`
}

type UpdateSosmedServiceInput struct {
	CategoryCode  *string   `json:"category_code"`
	Code          *string   `json:"code"`
	Title         *string   `json:"title"`
	ProviderTitle *string   `json:"provider_title"`
	Summary       *string   `json:"summary"`
	PlatformLabel *string   `json:"platform_label"`
	BadgeText     *string   `json:"badge_text"`
	Theme         *string   `json:"theme"`
	MinOrder      *string   `json:"min_order"`
	StartTime     *string   `json:"start_time"`
	Refill        *string   `json:"refill"`
	ETA           *string   `json:"eta"`
	PriceStart    *string   `json:"price_start"`
	PricePer1K    *string   `json:"price_per_1k"`
	CheckoutPrice *int64    `json:"checkout_price"`
	TrustBadges   *[]string `json:"trust_badges"`
	SortOrder     *int      `json:"sort_order"`
	IsActive      *bool     `json:"is_active"`
}

func normalizeSosmedServiceCode(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, " ", "-")
	for strings.Contains(normalized, "--") {
		normalized = strings.ReplaceAll(normalized, "--", "-")
	}
	return normalized
}

func validateSosmedServiceCode(value string) error {
	if !sosmedServiceCodePattern.MatchString(value) {
		return errors.New("kode layanan tidak valid (pakai huruf kecil, angka, -, _)")
	}
	return nil
}

func sanitizeSosmedServiceTheme(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return "blue"
	}
	if _, ok := sosmedServiceAllowedThemes[normalized]; ok {
		return normalized
	}
	return "blue"
}

func sanitizeSosmedTrustBadges(items []string) []string {
	if len(items) == 0 {
		return []string{}
	}

	cleaned := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if len(trimmed) > 48 {
			trimmed = strings.TrimSpace(trimmed[:48])
		}
		key := strings.ToLower(trimmed)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		cleaned = append(cleaned, trimmed)
	}

	sort.Strings(cleaned)
	if len(cleaned) > 8 {
		return cleaned[:8]
	}
	return cleaned
}

func (s *SosmedServiceService) validateCategoryCode(value string) (string, error) {
	if s.productCategorySvc == nil {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return "", errors.New("kategori layanan wajib diisi")
		}
		return trimmed, nil
	}
	return s.productCategorySvc.ValidateActiveCode(model.ProductCategoryScopeSosmed, value)
}

func (s *SosmedServiceService) List(includeInactive bool) ([]model.SosmedService, error) {
	return s.repo.List(includeInactive)
}

func (s *SosmedServiceService) Create(input CreateSosmedServiceInput) (*model.SosmedService, error) {
	categoryCode, err := s.validateCategoryCode(input.CategoryCode)
	if err != nil {
		return nil, err
	}

	code := normalizeSosmedServiceCode(input.Code)
	if code == "" {
		return nil, errors.New("kode layanan wajib diisi")
	}
	if err := validateSosmedServiceCode(code); err != nil {
		return nil, err
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("judul layanan wajib diisi")
	}

	if _, err := s.repo.FindByCode(code); err == nil {
		return nil, errors.New("kode layanan sudah dipakai")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek duplikasi layanan")
	}

	sortOrder := 100
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	if input.CheckoutPrice < 0 {
		return nil, errors.New("checkout_price tidak valid")
	}

	item := &model.SosmedService{
		CategoryCode:  categoryCode,
		Code:          code,
		Title:         title,
		ProviderTitle: strings.TrimSpace(input.ProviderTitle),
		Summary:       strings.TrimSpace(input.Summary),
		PlatformLabel: strings.TrimSpace(input.PlatformLabel),
		BadgeText:     strings.TrimSpace(input.BadgeText),
		Theme:         sanitizeSosmedServiceTheme(input.Theme),
		MinOrder:      strings.TrimSpace(input.MinOrder),
		StartTime:     strings.TrimSpace(input.StartTime),
		Refill:        strings.TrimSpace(input.Refill),
		ETA:           strings.TrimSpace(input.ETA),
		PriceStart:    strings.TrimSpace(input.PriceStart),
		PricePer1K:    strings.TrimSpace(input.PricePer1K),
		CheckoutPrice: input.CheckoutPrice,
		TrustBadges:   sanitizeSosmedTrustBadges(input.TrustBadges),
		SortOrder:     sortOrder,
		IsActive:      isActive,
	}

	if err := s.repo.Create(item); err != nil {
		return nil, errors.New("gagal membuat layanan sosmed")
	}

	return item, nil
}

func (s *SosmedServiceService) Update(id uuid.UUID, input UpdateSosmedServiceInput) (*model.SosmedService, error) {
	item, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("layanan sosmed tidak ditemukan")
	}

	if input.CategoryCode != nil {
		categoryCode, err := s.validateCategoryCode(*input.CategoryCode)
		if err != nil {
			return nil, err
		}
		item.CategoryCode = categoryCode
	}

	if input.Code != nil {
		nextCode := normalizeSosmedServiceCode(*input.Code)
		if err := validateSosmedServiceCode(nextCode); err != nil {
			return nil, err
		}
		if nextCode != item.Code {
			return nil, errors.New("kode layanan tidak bisa diubah")
		}
	}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return nil, errors.New("judul layanan wajib diisi")
		}
		item.Title = title
	}

	if input.ProviderTitle != nil {
		item.ProviderTitle = strings.TrimSpace(*input.ProviderTitle)
	}

	if input.Summary != nil {
		item.Summary = strings.TrimSpace(*input.Summary)
	}
	if input.PlatformLabel != nil {
		item.PlatformLabel = strings.TrimSpace(*input.PlatformLabel)
	}
	if input.BadgeText != nil {
		item.BadgeText = strings.TrimSpace(*input.BadgeText)
	}
	if input.Theme != nil {
		item.Theme = sanitizeSosmedServiceTheme(*input.Theme)
	}
	if input.MinOrder != nil {
		item.MinOrder = strings.TrimSpace(*input.MinOrder)
	}
	if input.StartTime != nil {
		item.StartTime = strings.TrimSpace(*input.StartTime)
	}
	if input.Refill != nil {
		item.Refill = strings.TrimSpace(*input.Refill)
	}
	if input.ETA != nil {
		item.ETA = strings.TrimSpace(*input.ETA)
	}
	if input.PriceStart != nil {
		item.PriceStart = strings.TrimSpace(*input.PriceStart)
	}
	if input.PricePer1K != nil {
		item.PricePer1K = strings.TrimSpace(*input.PricePer1K)
	}
	if input.CheckoutPrice != nil {
		if *input.CheckoutPrice < 0 {
			return nil, errors.New("checkout_price tidak valid")
		}
		item.CheckoutPrice = *input.CheckoutPrice
	}
	if input.TrustBadges != nil {
		item.TrustBadges = sanitizeSosmedTrustBadges(*input.TrustBadges)
	}
	if input.SortOrder != nil {
		item.SortOrder = *input.SortOrder
	}
	if input.IsActive != nil {
		item.IsActive = *input.IsActive
	}

	if err := s.repo.Update(item); err != nil {
		return nil, errors.New("gagal memperbarui layanan sosmed")
	}

	return item, nil
}

func (s *SosmedServiceService) Delete(id uuid.UUID) error {
	item, err := s.repo.FindByID(id)
	if err != nil {
		return errors.New("layanan sosmed tidak ditemukan")
	}

	if !item.IsActive {
		return nil
	}

	item.IsActive = false
	if err := s.repo.Update(item); err != nil {
		return errors.New("gagal menonaktifkan layanan sosmed")
	}

	return nil
}
