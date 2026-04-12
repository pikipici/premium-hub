package service

import (
	"errors"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
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
	Name               string                 `json:"name" binding:"required"`
	Slug               string                 `json:"slug"`
	Category           string                 `json:"category" binding:"required"`
	Description        string                 `json:"description"`
	Tagline            string                 `json:"tagline"`
	Icon               string                 `json:"icon"`
	Color              string                 `json:"color"`
	BadgePopularText   string                 `json:"badge_popular_text"`
	BadgeGuaranteeText string                 `json:"badge_guarantee_text"`
	SoldText           string                 `json:"sold_text"`
	SharedNote         string                 `json:"shared_note"`
	PrivateNote        string                 `json:"private_note"`
	TrustItems         []string               `json:"trust_items"`
	FAQItems           []model.ProductFAQItem `json:"faq_items"`
	SeoDescription     string                 `json:"seo_description"`
	SortPriority       *int                   `json:"sort_priority"`
	IsPopular          bool                   `json:"is_popular"`
	IsActive           *bool                  `json:"is_active"`
}

func (s *ProductService) Create(input CreateProductInput) (*model.Product, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("nama produk wajib diisi")
	}

	category := strings.TrimSpace(input.Category)
	if category == "" {
		return nil, errors.New("kategori produk wajib diisi")
	}

	slug := sanitizeSlug(input.Slug, name)
	if slug == "" {
		return nil, errors.New("slug produk tidak valid")
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	sortPriority := 0
	if input.SortPriority != nil {
		sortPriority = *input.SortPriority
	}

	product := &model.Product{
		Name:               name,
		Slug:               slug,
		Category:           category,
		Description:        strings.TrimSpace(input.Description),
		Tagline:            strings.TrimSpace(input.Tagline),
		Icon:               strings.TrimSpace(input.Icon),
		Color:              strings.TrimSpace(input.Color),
		BadgePopularText:   strings.TrimSpace(input.BadgePopularText),
		BadgeGuaranteeText: strings.TrimSpace(input.BadgeGuaranteeText),
		SoldText:           strings.TrimSpace(input.SoldText),
		SharedNote:         strings.TrimSpace(input.SharedNote),
		PrivateNote:        strings.TrimSpace(input.PrivateNote),
		TrustItems:         sanitizeStringList(input.TrustItems),
		FAQItems:           sanitizeFAQItems(input.FAQItems),
		SeoDescription:     strings.TrimSpace(input.SeoDescription),
		SortPriority:       sortPriority,
		IsPopular:          input.IsPopular,
		IsActive:           isActive,
	}
	if err := s.productRepo.Create(product); err != nil {
		return nil, errors.New("gagal membuat produk")
	}
	return product, nil
}

type UpdateProductInput struct {
	Name               *string                 `json:"name"`
	Slug               *string                 `json:"slug"`
	Category           *string                 `json:"category"`
	Description        *string                 `json:"description"`
	Tagline            *string                 `json:"tagline"`
	Icon               *string                 `json:"icon"`
	Color              *string                 `json:"color"`
	BadgePopularText   *string                 `json:"badge_popular_text"`
	BadgeGuaranteeText *string                 `json:"badge_guarantee_text"`
	SoldText           *string                 `json:"sold_text"`
	SharedNote         *string                 `json:"shared_note"`
	PrivateNote        *string                 `json:"private_note"`
	TrustItems         *[]string               `json:"trust_items"`
	FAQItems           *[]model.ProductFAQItem `json:"faq_items"`
	SeoDescription     *string                 `json:"seo_description"`
	SortPriority       *int                    `json:"sort_priority"`
	IsPopular          *bool                   `json:"is_popular"`
	IsActive           *bool                   `json:"is_active"`
}

func (s *ProductService) Update(id uuid.UUID, input UpdateProductInput) (*model.Product, error) {
	product, err := s.productRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, errors.New("nama produk wajib diisi")
		}
		product.Name = name
	}

	if input.Slug != nil {
		slug := sanitizeSlug(*input.Slug, product.Name)
		if slug == "" {
			return nil, errors.New("slug produk tidak valid")
		}
		product.Slug = slug
	}

	if input.Category != nil {
		category := strings.TrimSpace(*input.Category)
		if category == "" {
			return nil, errors.New("kategori produk wajib diisi")
		}
		product.Category = category
	}

	if input.Description != nil {
		product.Description = strings.TrimSpace(*input.Description)
	}
	if input.Tagline != nil {
		product.Tagline = strings.TrimSpace(*input.Tagline)
	}
	if input.Icon != nil {
		product.Icon = strings.TrimSpace(*input.Icon)
	}
	if input.Color != nil {
		product.Color = strings.TrimSpace(*input.Color)
	}
	if input.BadgePopularText != nil {
		product.BadgePopularText = strings.TrimSpace(*input.BadgePopularText)
	}
	if input.BadgeGuaranteeText != nil {
		product.BadgeGuaranteeText = strings.TrimSpace(*input.BadgeGuaranteeText)
	}
	if input.SoldText != nil {
		product.SoldText = strings.TrimSpace(*input.SoldText)
	}
	if input.SharedNote != nil {
		product.SharedNote = strings.TrimSpace(*input.SharedNote)
	}
	if input.PrivateNote != nil {
		product.PrivateNote = strings.TrimSpace(*input.PrivateNote)
	}
	if input.TrustItems != nil {
		product.TrustItems = sanitizeStringList(*input.TrustItems)
	}
	if input.FAQItems != nil {
		product.FAQItems = sanitizeFAQItems(*input.FAQItems)
	}
	if input.SeoDescription != nil {
		product.SeoDescription = strings.TrimSpace(*input.SeoDescription)
	}
	if input.SortPriority != nil {
		product.SortPriority = *input.SortPriority
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

type CreateProductPriceInput struct {
	Duration    int    `json:"duration" binding:"required,min=1"`
	AccountType string `json:"account_type" binding:"required"`
	Price       int64  `json:"price" binding:"required,min=1"`
	IsActive    *bool  `json:"is_active"`
}

type UpdateProductPriceInput struct {
	Duration    *int    `json:"duration"`
	AccountType *string `json:"account_type"`
	Price       *int64  `json:"price"`
	IsActive    *bool   `json:"is_active"`
}

func (s *ProductService) CreatePrice(productID uuid.UUID, input CreateProductPriceInput) (*model.ProductPrice, error) {
	if _, err := s.productRepo.FindByID(productID); err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	accountType := normalizeAccountType(input.AccountType)
	if accountType == "" {
		return nil, errors.New("account_type wajib diisi")
	}
	if input.Duration < 1 {
		return nil, errors.New("durasi harus lebih dari 0")
	}
	if input.Price < 1 {
		return nil, errors.New("harga harus lebih dari 0")
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	existing, err := s.productRepo.FindPriceBySignature(productID, input.Duration, accountType)
	if err == nil {
		existing.Price = input.Price
		existing.IsActive = isActive
		if err := s.productRepo.UpdatePrice(existing); err != nil {
			return nil, errors.New("gagal memperbarui harga produk")
		}
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal memeriksa duplikasi harga produk")
	}

	price := &model.ProductPrice{
		ProductID:   productID,
		Duration:    input.Duration,
		AccountType: accountType,
		Price:       input.Price,
		IsActive:    isActive,
	}
	if err := s.productRepo.CreatePrice(price); err != nil {
		return nil, errors.New("gagal membuat harga produk")
	}
	return price, nil
}

func (s *ProductService) UpdatePrice(productID, priceID uuid.UUID, input UpdateProductPriceInput) (*model.ProductPrice, error) {
	if _, err := s.productRepo.FindByID(productID); err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	price, err := s.productRepo.FindPriceByID(priceID)
	if err != nil {
		return nil, errors.New("harga produk tidak ditemukan")
	}
	if price.ProductID != productID {
		return nil, errors.New("harga produk tidak cocok dengan produk")
	}

	nextDuration := price.Duration
	nextAccountType := price.AccountType

	if input.Duration != nil {
		if *input.Duration < 1 {
			return nil, errors.New("durasi harus lebih dari 0")
		}
		nextDuration = *input.Duration
	}
	if input.AccountType != nil {
		normalized := normalizeAccountType(*input.AccountType)
		if normalized == "" {
			return nil, errors.New("account_type wajib diisi")
		}
		nextAccountType = normalized
	}
	if input.Price != nil && *input.Price < 1 {
		return nil, errors.New("harga harus lebih dari 0")
	}

	if nextDuration != price.Duration || nextAccountType != price.AccountType {
		duplicate, err := s.productRepo.FindPriceBySignature(productID, nextDuration, nextAccountType)
		if err == nil && duplicate.ID != priceID {
			return nil, errors.New("kombinasi durasi dan tipe akun sudah ada")
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("gagal memeriksa duplikasi harga produk")
		}
	}

	price.Duration = nextDuration
	price.AccountType = nextAccountType
	if input.Price != nil {
		price.Price = *input.Price
	}
	if input.IsActive != nil {
		price.IsActive = *input.IsActive
	}

	if err := s.productRepo.UpdatePrice(price); err != nil {
		return nil, errors.New("gagal memperbarui harga produk")
	}
	return price, nil
}

func (s *ProductService) DeletePrice(productID, priceID uuid.UUID) error {
	price, err := s.productRepo.FindPriceByID(priceID)
	if err != nil {
		return errors.New("harga produk tidak ditemukan")
	}
	if price.ProductID != productID {
		return errors.New("harga produk tidak cocok dengan produk")
	}

	if !price.IsActive {
		return nil
	}

	price.IsActive = false
	if err := s.productRepo.UpdatePrice(price); err != nil {
		return errors.New("gagal menonaktifkan harga produk")
	}
	return nil
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

func sanitizeStringList(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
		if len(result) >= 10 {
			break
		}
	}
	return result
}

func sanitizeFAQItems(items []model.ProductFAQItem) []model.ProductFAQItem {
	result := make([]model.ProductFAQItem, 0, len(items))
	for _, item := range items {
		question := strings.TrimSpace(item.Question)
		answer := strings.TrimSpace(item.Answer)
		if question == "" && answer == "" {
			continue
		}
		if question == "" || answer == "" {
			continue
		}
		result = append(result, model.ProductFAQItem{Question: question, Answer: answer})
		if len(result) >= 10 {
			break
		}
	}
	return result
}

func normalizeAccountType(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func sanitizeSlug(value, fallback string) string {
	slug := generateSlug(strings.TrimSpace(value))
	if slug != "" {
		return slug
	}
	return generateSlug(strings.TrimSpace(fallback))
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
