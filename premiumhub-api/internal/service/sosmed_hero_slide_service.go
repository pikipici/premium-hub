package service

import (
	"errors"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type SosmedHeroSlideService struct {
	repo *repository.SosmedHeroSlideRepo
}

func NewSosmedHeroSlideService(repo *repository.SosmedHeroSlideRepo) *SosmedHeroSlideService {
	return &SosmedHeroSlideService{repo: repo}
}

type CreateSosmedHeroSlideInput struct {
	PageKey              string   `json:"page_key"`
	Title                string   `json:"title"`
	Subtitle             string   `json:"subtitle"`
	CTALabel             string   `json:"cta_label"`
	CTAHref              string   `json:"cta_href"`
	Icon                 string   `json:"icon"`
	BackgroundColor      string   `json:"background_color"`
	BackgroundImageURL   string   `json:"background_image_url"`
	FeaturedServiceCodes []string `json:"featured_service_codes"`
	SortOrder            int      `json:"sort_order"`
	StartsAt             string   `json:"starts_at"`
	EndsAt               string   `json:"ends_at"`
	IsActive             *bool    `json:"is_active"`
}

type UpdateSosmedHeroSlideInput struct {
	Title                string   `json:"title"`
	Subtitle             string   `json:"subtitle"`
	CTALabel             string   `json:"cta_label"`
	CTAHref              string   `json:"cta_href"`
	Icon                 string   `json:"icon"`
	BackgroundColor      string   `json:"background_color"`
	BackgroundImageURL   string   `json:"background_image_url"`
	FeaturedServiceCodes []string `json:"featured_service_codes"`
	SortOrder            *int     `json:"sort_order"`
	StartsAt             string   `json:"starts_at"`
	EndsAt               string   `json:"ends_at"`
	IsActive             *bool    `json:"is_active"`
}

func parseHeroSlideTime(s string) *time.Time {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil
	}
	return &t
}

func cleanServiceCodes(codes []string) []string {
	var out []string
	seen := make(map[string]bool)
	for _, c := range codes {
		trimmed := strings.TrimSpace(c)
		if trimmed != "" && !seen[trimmed] {
			out = append(out, trimmed)
			seen[trimmed] = true
		}
	}
	return out
}

func (s *SosmedHeroSlideService) ListActive(pageKey string) ([]model.SosmedHeroSlide, error) {
	return s.repo.ListActive(pageKey)
}

func (s *SosmedHeroSlideService) ListAll(pageKey string) ([]model.SosmedHeroSlide, error) {
	return s.repo.ListAll(pageKey)
}

func (s *SosmedHeroSlideService) Create(input CreateSosmedHeroSlideInput) (*model.SosmedHeroSlide, error) {
	pageKey := strings.TrimSpace(input.PageKey)
	if pageKey == "" {
		return nil, errors.New("page_key wajib diisi")
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("judul slide wajib diisi")
	}

	bgColor := strings.TrimSpace(input.BackgroundColor)
	if bgColor != "" && !hexColorRegex.MatchString(bgColor) {
		return nil, errors.New("format warna background tidak valid")
	}
	if bgColor == "" {
		bgColor = "#141414"
	}

	icon := strings.TrimSpace(input.Icon)
	if icon == "" {
		icon = "Sparkles"
	}

	slide := &model.SosmedHeroSlide{
		PageKey:              pageKey,
		Title:                title,
		Subtitle:             strings.TrimSpace(input.Subtitle),
		CTALabel:             strings.TrimSpace(input.CTALabel),
		CTAHref:              strings.TrimSpace(input.CTAHref),
		Icon:                 icon,
		BackgroundColor:      bgColor,
		BackgroundImageURL:   strings.TrimSpace(input.BackgroundImageURL),
		FeaturedServiceCodes: cleanServiceCodes(input.FeaturedServiceCodes),
		SortOrder:            input.SortOrder,
		StartsAt:             parseHeroSlideTime(input.StartsAt),
		EndsAt:               parseHeroSlideTime(input.EndsAt),
	}

	if input.IsActive != nil {
		slide.IsActive = *input.IsActive
	} else {
		slide.IsActive = true
	}

	if err := s.repo.Create(slide); err != nil {
		return nil, errors.New("gagal menyimpan hero slide sosmed")
	}
	return slide, nil
}

func (s *SosmedHeroSlideService) Update(id string, input UpdateSosmedHeroSlideInput) (*model.SosmedHeroSlide, error) {
	existing, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("slide tidak ditemukan")
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("judul slide wajib diisi")
	}

	bgColor := strings.TrimSpace(input.BackgroundColor)
	if bgColor != "" && !hexColorRegex.MatchString(bgColor) {
		return nil, errors.New("format warna background tidak valid")
	}
	if bgColor != "" {
		existing.BackgroundColor = bgColor
	}

	existing.Title = title
	existing.Subtitle = strings.TrimSpace(input.Subtitle)
	existing.CTALabel = strings.TrimSpace(input.CTALabel)
	existing.CTAHref = strings.TrimSpace(input.CTAHref)

	if input.Icon != "" {
		existing.Icon = input.Icon
	}

	if input.BackgroundImageURL != "" {
		existing.BackgroundImageURL = strings.TrimSpace(input.BackgroundImageURL)
	}

	if input.FeaturedServiceCodes != nil {
		existing.FeaturedServiceCodes = cleanServiceCodes(input.FeaturedServiceCodes)
	}

	if input.SortOrder != nil {
		existing.SortOrder = *input.SortOrder
	}

	if input.StartsAt != "" {
		if t := parseHeroSlideTime(input.StartsAt); t != nil {
			existing.StartsAt = t
		}
	}

	if input.EndsAt != "" {
		if t := parseHeroSlideTime(input.EndsAt); t != nil {
			existing.EndsAt = t
		}
	}

	if input.IsActive != nil {
		existing.IsActive = *input.IsActive
	}

	if err := s.repo.Update(existing); err != nil {
		return nil, errors.New("gagal mengupdate hero slide sosmed")
	}
	return existing, nil
}

func (s *SosmedHeroSlideService) Delete(id string) error {
	_, err := s.repo.FindByID(id)
	if err != nil {
		return errors.New("slide tidak ditemukan")
	}
	return s.repo.Delete(id)
}

var _ = uuid.UUID{} // ensure import
