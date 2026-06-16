package service

import (
	"errors"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type SiteFlashSaleService struct {
	repo        *repository.SiteFlashSaleRepo
	productRepo *repository.ProductRepo
}

func NewSiteFlashSaleService(repo *repository.SiteFlashSaleRepo, productRepo *repository.ProductRepo) *SiteFlashSaleService {
	return &SiteFlashSaleService{repo: repo, productRepo: productRepo}
}

type SaveFlashSaleInput struct {
	ProductID string `json:"product_id"`
	EndsAt    string `json:"ends_at"`
	SortOrder int    `json:"sort_order"`
	IsActive  *bool  `json:"is_active"`
}

func (s *SiteFlashSaleService) List() ([]model.SiteFlashSale, error) {
	return s.repo.List()
}

func (s *SiteFlashSaleService) Active() ([]model.SiteFlashSale, error) {
	return s.repo.Active(time.Now())
}

func (s *SiteFlashSaleService) FindByID(id uuid.UUID) (*model.SiteFlashSale, error) {
	return s.repo.FindByID(id)
}

func (s *SiteFlashSaleService) Create(input SaveFlashSaleInput) (*model.SiteFlashSale, error) {
	pid, err := uuid.Parse(strings.TrimSpace(input.ProductID))
	if err != nil {
		return nil, errors.New("product_id tidak valid")
	}

	if _, err := s.productRepo.FindByID(pid); err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	existing, _ := s.repo.FindByProductID(pid)
	if existing != nil {
		return nil, errors.New("produk ini sudah ada di flash sale")
	}

	endsAt, err := time.Parse(time.RFC3339, strings.TrimSpace(input.EndsAt))
	if err != nil {
		return nil, errors.New("format deadline tidak valid (gunakan RFC3339)")
	}
	if !endsAt.After(time.Now()) {
		return nil, errors.New("deadline harus di masa depan")
	}

	fs := &model.SiteFlashSale{
		ProductID: pid,
		EndsAt:    endsAt,
		SortOrder: input.SortOrder,
	}

	if input.IsActive != nil {
		fs.IsActive = *input.IsActive
	} else {
		fs.IsActive = true
	}

	if err := s.repo.Create(fs); err != nil {
		return nil, errors.New("gagal membuat flash sale")
	}
	return s.repo.FindByID(fs.ID)
}

func (s *SiteFlashSaleService) Update(id uuid.UUID, input SaveFlashSaleInput) (*model.SiteFlashSale, error) {
	fs, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("flash sale tidak ditemukan")
	}

	if v := strings.TrimSpace(input.EndsAt); v != "" {
		endsAt, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return nil, errors.New("format deadline tidak valid")
		}
		if !endsAt.After(time.Now()) {
			return nil, errors.New("deadline harus di masa depan")
		}
		fs.EndsAt = endsAt
	}

	fs.SortOrder = input.SortOrder

	if input.IsActive != nil {
		fs.IsActive = *input.IsActive
	}

	if err := s.repo.Update(fs); err != nil {
		return nil, errors.New("gagal update flash sale")
	}
	return s.repo.FindByID(fs.ID)
}

func (s *SiteFlashSaleService) Delete(id uuid.UUID) error {
	if err := s.repo.Delete(id); err != nil {
		return errors.New("gagal menghapus flash sale")
	}
	return nil
}
