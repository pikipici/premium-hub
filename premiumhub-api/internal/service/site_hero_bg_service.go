package service

import (
	"errors"
	"regexp"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

var hexColorRegex = regexp.MustCompile(`^#[0-9a-fA-F]{3,8}$`)

type SiteHeroBgService struct {
	repo *repository.SiteHeroBgRepo
}

func NewSiteHeroBgService(repo *repository.SiteHeroBgRepo) *SiteHeroBgService {
	return &SiteHeroBgService{repo: repo}
}

type SaveHeroBgInput struct {
	PageKey            string `json:"page_key"`
	BackgroundColor    string `json:"background_color"`
	BackgroundImageURL string `json:"background_image_url"`
	IsActive           *bool  `json:"is_active"`
}

func (s *SiteHeroBgService) GetByPageKey(pageKey string) (*model.SiteHeroBg, error) {
	return s.repo.FindByPageKey(pageKey)
}

func (s *SiteHeroBgService) Save(input SaveHeroBgInput) (*model.SiteHeroBg, error) {
	pageKey := strings.TrimSpace(input.PageKey)
	if pageKey == "" {
		return nil, errors.New("page_key wajib diisi")
	}

	bgColor := strings.TrimSpace(input.BackgroundColor)
	if bgColor != "" && !hexColorRegex.MatchString(bgColor) {
		return nil, errors.New("format warna background tidak valid")
	}
	if bgColor == "" {
		bgColor = "#141414"
	}

	bg := &model.SiteHeroBg{
		PageKey:            pageKey,
		BackgroundColor:    bgColor,
		BackgroundImageURL: strings.TrimSpace(input.BackgroundImageURL),
	}

	if input.IsActive != nil {
		bg.IsActive = *input.IsActive
	} else {
		bg.IsActive = true
	}

	if err := s.repo.Upsert(bg); err != nil {
		return nil, errors.New("gagal menyimpan hero background")
	}
	return bg, nil
}
