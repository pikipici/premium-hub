package service

import (
	"errors"
	"fmt"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/hash"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockService struct {
	stockRepo   *repository.StockRepo
	productRepo *repository.ProductRepo
}

func NewStockService(stockRepo *repository.StockRepo, productRepos ...*repository.ProductRepo) *StockService {
	var productRepo *repository.ProductRepo
	if len(productRepos) > 0 {
		productRepo = productRepos[0]
	}

	return &StockService{stockRepo: stockRepo, productRepo: productRepo}
}

type CreateStockInput struct {
	ProductID   string `json:"product_id" binding:"required"`
	AccountType string `json:"account_type" binding:"required"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required"`
	ProfileName string `json:"profile_name"`
}

func (s *StockService) validateAccountType(productID uuid.UUID, accountType string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(accountType))
	if normalized == "" {
		return "", errors.New("account_type wajib diisi")
	}

	if s.productRepo == nil {
		return normalized, nil
	}

	product, err := s.productRepo.FindByID(productID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("produk tidak ditemukan")
		}
		return "", errors.New("gagal validasi account_type produk")
	}

	allowed := make(map[string]struct{})
	ordered := make([]string, 0, len(product.Prices))
	for _, price := range product.Prices {
		if !price.IsActive {
			continue
		}

		key := strings.ToLower(strings.TrimSpace(price.AccountType))
		if key == "" {
			continue
		}

		if _, exists := allowed[key]; !exists {
			allowed[key] = struct{}{}
			ordered = append(ordered, key)
		}
	}

	if len(allowed) == 0 {
		return "", errors.New("produk belum punya tipe akun aktif")
	}

	if _, exists := allowed[normalized]; !exists {
		return "", fmt.Errorf("account_type \"%s\" tidak valid untuk produk ini. Opsi: %s", normalized, strings.Join(ordered, ", "))
	}

	return normalized, nil
}

func (s *StockService) Create(input CreateStockInput) (*model.Stock, error) {
	productID, err := uuid.Parse(input.ProductID)
	if err != nil {
		return nil, errors.New("product_id tidak valid")
	}

	accountType, err := s.validateAccountType(productID, input.AccountType)
	if err != nil {
		return nil, err
	}

	email := strings.TrimSpace(input.Email)
	if email == "" {
		return nil, errors.New("email wajib diisi")
	}

	password := strings.TrimSpace(input.Password)
	if password == "" {
		return nil, errors.New("password wajib diisi")
	}

	encryptedPw, err := hash.Password(password)
	if err != nil {
		return nil, errors.New("gagal enkripsi password")
	}

	stock := &model.Stock{
		ProductID:   productID,
		AccountType: accountType,
		Email:       email,
		Password:    encryptedPw,
		ProfileName: strings.TrimSpace(input.ProfileName),
		Status:      "available",
	}

	if err := s.stockRepo.Create(stock); err != nil {
		return nil, errors.New("gagal menambah stok")
	}
	return stock, nil
}

type BulkStockInput struct {
	ProductID   string `json:"product_id" binding:"required"`
	AccountType string `json:"account_type" binding:"required"`
	Accounts    []struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		ProfileName string `json:"profile_name"`
	} `json:"accounts" binding:"required,min=1"`
}

func (s *StockService) CreateBulk(input BulkStockInput) (int, error) {
	productID, err := uuid.Parse(input.ProductID)
	if err != nil {
		return 0, errors.New("product_id tidak valid")
	}

	accountType, err := s.validateAccountType(productID, input.AccountType)
	if err != nil {
		return 0, err
	}

	var stocks []model.Stock
	for index, acc := range input.Accounts {
		email := strings.TrimSpace(acc.Email)
		if email == "" {
			return 0, fmt.Errorf("email akun bulk baris %d wajib diisi", index+1)
		}

		password := strings.TrimSpace(acc.Password)
		if password == "" {
			return 0, fmt.Errorf("password akun bulk baris %d wajib diisi", index+1)
		}

		encPw, err := hash.Password(password)
		if err != nil {
			return 0, errors.New("gagal enkripsi password")
		}

		stocks = append(stocks, model.Stock{
			ProductID:   productID,
			AccountType: accountType,
			Email:       email,
			Password:    encPw,
			ProfileName: strings.TrimSpace(acc.ProfileName),
			Status:      "available",
		})
	}

	if err := s.stockRepo.CreateBulk(stocks); err != nil {
		return 0, errors.New("gagal menambah stok bulk")
	}
	return len(stocks), nil
}

func (s *StockService) List(productID *uuid.UUID, status string, page, limit int) ([]model.Stock, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	return s.stockRepo.List(productID, status, page, limit)
}

func (s *StockService) Update(id uuid.UUID, input CreateStockInput) (*model.Stock, error) {
	stock, err := s.stockRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("stok tidak ditemukan")
	}

	if input.ProductID != "" {
		productID, err := uuid.Parse(input.ProductID)
		if err != nil {
			return nil, errors.New("product_id tidak valid")
		}
		if productID != stock.ProductID {
			return nil, errors.New("product_id tidak boleh diubah")
		}
	}

	accountType, err := s.validateAccountType(stock.ProductID, input.AccountType)
	if err != nil {
		return nil, err
	}

	email := strings.TrimSpace(input.Email)
	if email == "" {
		return nil, errors.New("email wajib diisi")
	}

	stock.Email = email
	if strings.TrimSpace(input.Password) != "" {
		encPw, err := hash.Password(strings.TrimSpace(input.Password))
		if err != nil {
			return nil, errors.New("gagal enkripsi password")
		}
		stock.Password = encPw
	}
	stock.ProfileName = strings.TrimSpace(input.ProfileName)
	stock.AccountType = accountType
	if err := s.stockRepo.Update(stock); err != nil {
		return nil, err
	}
	return stock, nil
}

func (s *StockService) Delete(id uuid.UUID) error {
	stock, err := s.stockRepo.FindByID(id)
	if err != nil {
		return errors.New("stok tidak ditemukan")
	}
	if stock.Status == "used" {
		return errors.New("stok sedang digunakan, tidak bisa dihapus")
	}
	return s.stockRepo.Delete(id)
}
