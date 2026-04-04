package service

import (
	"errors"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/hash"

	"github.com/google/uuid"
)

type StockService struct {
	stockRepo *repository.StockRepo
}

func NewStockService(stockRepo *repository.StockRepo) *StockService {
	return &StockService{stockRepo: stockRepo}
}

type CreateStockInput struct {
	ProductID   string `json:"product_id" binding:"required"`
	AccountType string `json:"account_type" binding:"required"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required"`
	ProfileName string `json:"profile_name"`
}

func (s *StockService) Create(input CreateStockInput) (*model.Stock, error) {
	productID, err := uuid.Parse(input.ProductID)
	if err != nil {
		return nil, errors.New("product_id tidak valid")
	}

	encryptedPw, err := hash.Password(input.Password)
	if err != nil {
		return nil, errors.New("gagal enkripsi password")
	}

	stock := &model.Stock{
		ProductID:   productID,
		AccountType: input.AccountType,
		Email:       input.Email,
		Password:    encryptedPw,
		ProfileName: input.ProfileName,
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

	var stocks []model.Stock
	for _, acc := range input.Accounts {
		encPw, _ := hash.Password(acc.Password)
		stocks = append(stocks, model.Stock{
			ProductID:   productID,
			AccountType: input.AccountType,
			Email:       acc.Email,
			Password:    encPw,
			ProfileName: acc.ProfileName,
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
	stock.Email = input.Email
	if input.Password != "" {
		encPw, _ := hash.Password(input.Password)
		stock.Password = encPw
	}
	stock.ProfileName = input.ProfileName
	stock.AccountType = input.AccountType
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
