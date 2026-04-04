package service

import (
	"errors"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type ProductService struct {
	productRepo *repository.ProductRepo
	stockRepo   *repository.StockRepo
}

func NewProductService(productRepo *repository.ProductRepo, stockRepo *repository.StockRepo) *ProductService {
	return &ProductService{productRepo: productRepo, stockRepo: stockRepo}
}

func (s *ProductService) List(category string, page, limit int) ([]model.Product, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 12
	}
	return s.productRepo.List(category, page, limit)
}

func (s *ProductService) GetBySlug(slug string) (*model.Product, error) {
	return s.productRepo.FindBySlug(slug)
}

type CreateProductInput struct {
	Name        string `json:"name" binding:"required"`
	Category    string `json:"category" binding:"required"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	IsPopular   bool   `json:"is_popular"`
}

func (s *ProductService) Create(input CreateProductInput) (*model.Product, error) {
	slug := generateSlug(input.Name)
	product := &model.Product{
		Name:        input.Name,
		Slug:        slug,
		Category:    input.Category,
		Description: input.Description,
		Icon:        input.Icon,
		Color:       input.Color,
		IsPopular:   input.IsPopular,
		IsActive:    true,
	}
	if err := s.productRepo.Create(product); err != nil {
		return nil, errors.New("gagal membuat produk")
	}
	return product, nil
}

type UpdateProductInput struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	IsPopular   *bool  `json:"is_popular"`
	IsActive    *bool  `json:"is_active"`
}

func (s *ProductService) Update(id uuid.UUID, input UpdateProductInput) (*model.Product, error) {
	product, err := s.productRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}
	if input.Name != "" {
		product.Name = input.Name
		product.Slug = generateSlug(input.Name)
	}
	if input.Category != "" {
		product.Category = input.Category
	}
	if input.Description != "" {
		product.Description = input.Description
	}
	if input.Icon != "" {
		product.Icon = input.Icon
	}
	if input.Color != "" {
		product.Color = input.Color
	}
	if input.IsPopular != nil {
		product.IsPopular = *input.IsPopular
	}
	if input.IsActive != nil {
		product.IsActive = *input.IsActive
	}
	if err := s.productRepo.Update(product); err != nil {
		return nil, err
	}
	return product, nil
}

func (s *ProductService) Delete(id uuid.UUID) error {
	return s.productRepo.Delete(id)
}

func (s *ProductService) AdminList(page, limit int) ([]model.Product, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	return s.productRepo.AdminList(page, limit)
}

func (s *ProductService) GetStockCount(productID uuid.UUID, accountType string) (int64, error) {
	return s.stockRepo.CountByProduct(productID, accountType)
}

func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "-")
	slug = strings.ReplaceAll(slug, "+", "plus")
	// Remove non-alphanumeric except hyphens
	var result []byte
	for _, c := range []byte(slug) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' {
			result = append(result, c)
		}
	}
	return string(result)
}
