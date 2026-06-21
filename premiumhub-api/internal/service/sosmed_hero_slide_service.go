package service

import (
	"errors"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

type SosmedHeroSlideService struct {
	repo *repository.SosmedHeroSlideRepo
}

func NewSosmedHeroSlideService(repo *repository.SosmedHeroSlideRepo) *SosmedHeroSlideService {
	return &SosmedHeroSlideService{repo: repo}
}

type SaveSosmedHeroSlideInput struct {
	PageKey            string `json:"page_key"`
	Title              string `json:"title"`
	Subtitle           string `json:"subtitle"`
	CTALabel           string `json:"cta_label"`
	CTAHref            string `json:"cta_href"`
	Icon               string `json:"icon"`
	BackgroundColor    string `json:"background_color"`
	BackgroundImageURL string `json:"background_image_url"`
	IsActive           *bool  `json:"is_active"`
}

func (s *SosmedHeroSlideService) GetByPageKey(pageKey string) (*model.SosmedHeroSlide, error) {
	return s.repo.FindByPageKey(pageKey)
}

func (s *SosmedHeroSlideService) GetByPageKeyAll(pageKey string) (*model.SosmedHeroSlide, error) {
	return s.repo.FindByPageKeyAll(pageKey)
}

func (s *SosmedHeroSlideService) Save(input SaveSosmedHeroSlideInput) (*model.SosmedHeroSlide, error) {
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
		PageKey:            pageKey,
		Title:              title,
		Subtitle:           strings.TrimSpace(input.Subtitle),
		CTALabel:           strings.TrimSpace(input.CTALabel),
		CTAHref:            strings.TrimSpace(input.CTAHref),
		Icon:               icon,
		BackgroundColor:    bgColor,
		BackgroundImageURL: strings.TrimSpace(input.BackgroundImageURL),
	}

	if input.IsActive != nil {
		slide.IsActive = *input.IsActive
	} else {
		slide.IsActive = true
	}

	if err := s.repo.Upsert(slide); err != nil {
		return nil, errors.New("gagal menyimpan hero slide sosmed")
	}
	return slide, nil
}
