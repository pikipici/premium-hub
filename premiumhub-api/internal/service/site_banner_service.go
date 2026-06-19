package service

import (
	"errors"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type SiteBannerService struct {
	repo *repository.SiteBannerRepo
}

func NewSiteBannerService(repo *repository.SiteBannerRepo) *SiteBannerService {
	return &SiteBannerService{repo: repo}
}

type CreateBannerInput struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url" binding:"required"`
	LinkURL     string `json:"link_url"`
	IsActive    *bool  `json:"is_active"`
	SortOrder   int    `json:"sort_order"`
	StartsAt    string `json:"starts_at"`
	EndsAt      string `json:"ends_at"`
}

type UpdateBannerInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url"`
	LinkURL     string `json:"link_url"`
	IsActive    *bool  `json:"is_active"`
	SortOrder   *int   `json:"sort_order"`
	StartsAt    string `json:"starts_at"`
	EndsAt      string `json:"ends_at"`
}

func parseOptionalTime(raw string) (*time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil, errors.New("format waktu tidak valid")
	}
	return &t, nil
}

func (s *SiteBannerService) List() ([]model.SiteBanner, error) {
	return s.repo.List()
}

func (s *SiteBannerService) Create(input CreateBannerInput) (*model.SiteBanner, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("judul banner wajib diisi")
	}
	imageURL := strings.TrimSpace(input.ImageURL)
	if imageURL == "" {
		return nil, errors.New("URL gambar banner wajib diisi")
	}

	banner := &model.SiteBanner{
		Title:       title,
		Description: strings.TrimSpace(input.Description),
		ImageURL:    imageURL,
		LinkURL:     strings.TrimSpace(input.LinkURL),
		SortOrder:   input.SortOrder,
	}

	if input.IsActive != nil {
		banner.IsActive = *input.IsActive
	} else {
		banner.IsActive = true
	}

	if input.StartsAt != "" {
		t, err := parseOptionalTime(input.StartsAt)
		if err != nil {
			return nil, err
		}
		banner.StartsAt = t
	}
	if input.EndsAt != "" {
		t, err := parseOptionalTime(input.EndsAt)
		if err != nil {
			return nil, err
		}
		banner.EndsAt = t
	}

	if err := s.repo.Create(banner); err != nil {
		return nil, errors.New("gagal membuat banner")
	}
	return banner, nil
}

func (s *SiteBannerService) Update(id uuid.UUID, input UpdateBannerInput) (*model.SiteBanner, error) {
	banner, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("banner tidak ditemukan")
	}

	if v := strings.TrimSpace(input.Title); v != "" {
		banner.Title = v
	}
	if input.Description != "" {
		banner.Description = strings.TrimSpace(input.Description)
	}
	if v := strings.TrimSpace(input.ImageURL); v != "" {
		banner.ImageURL = v
	}
	if v := strings.TrimSpace(input.LinkURL); v != "" || input.LinkURL == "" {
		banner.LinkURL = v
	}
	if input.IsActive != nil {
		banner.IsActive = *input.IsActive
	}
	if input.SortOrder != nil {
		banner.SortOrder = *input.SortOrder
	}
	if input.StartsAt != "" {
		t, err := parseOptionalTime(input.StartsAt)
		if err != nil {
			return nil, err
		}
		banner.StartsAt = t
	}
	if input.EndsAt != "" {
		t, err := parseOptionalTime(input.EndsAt)
		if err != nil {
			return nil, err
		}
		banner.EndsAt = t
	}

	if err := s.repo.Update(banner); err != nil {
		return nil, errors.New("gagal update banner")
	}
	return banner, nil
}

func (s *SiteBannerService) Delete(id uuid.UUID) error {
	if err := s.repo.Delete(id); err != nil {
		return errors.New("gagal menghapus banner")
	}
	return nil
}

func (s *SiteBannerService) ActiveBanners() ([]model.SiteBanner, error) {
	return s.repo.ActiveBanners(time.Now())
}
