package service

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/credential"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockService struct {
	stockRepo             *repository.StockRepo
	productRepo           *repository.ProductRepo
	accountTypeSvc        *AccountTypeService
	stockCredentialCipher *credential.StockCipher
}

func NewStockService(stockRepo *repository.StockRepo, productRepos ...*repository.ProductRepo) *StockService {
	var productRepo *repository.ProductRepo
	if len(productRepos) > 0 {
		productRepo = productRepos[0]
	}

	return &StockService{stockRepo: stockRepo, productRepo: productRepo}
}

func (s *StockService) SetAccountTypeRepo(repo *repository.AccountTypeRepo) *StockService {
	if repo != nil {
		s.accountTypeSvc = NewAccountTypeService(repo)
	}
	return s
}

func (s *StockService) SetStockCredentialCipher(cipher *credential.StockCipher) *StockService {
	s.stockCredentialCipher = cipher
	return s
}

func (s *StockService) encryptStockPassword(password string) (string, error) {
	if s.stockCredentialCipher == nil {
		return "", errors.New("stock credential cipher belum dikonfigurasi")
	}

	encryptedPw, err := s.stockCredentialCipher.Encrypt(password)
	if err != nil {
		return "", errors.New("gagal enkripsi password")
	}

	return encryptedPw, nil
}

type CreateStockInput struct {
	ProductID     string `json:"product_id" binding:"required"`
	AccountType   string `json:"account_type" binding:"required"`
	DurationMonth int    `json:"duration_month"`
	Email         string `json:"email" binding:"required,email"`
	Password      string `json:"password" binding:"required"`
	ProfileName   string `json:"profile_name"`
}

func (s *StockService) validateAccountType(productID uuid.UUID, accountType string) (string, error) {
	normalized := normalizeAccountType(accountType)
	if normalized == "" {
		return "", errors.New("account_type wajib diisi")
	}

	if s.accountTypeSvc != nil {
		validated, err := s.accountTypeSvc.ValidateActiveCode(normalized)
		if err != nil {
			return "", err
		}
		normalized = validated
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

		key := normalizeAccountType(price.AccountType)
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

func (s *StockService) availableDurationsForAccountType(productID uuid.UUID, accountType string) ([]int, error) {
	if s.productRepo == nil {
		if accountType == "" {
			return nil, nil
		}
		return []int{1}, nil
	}

	product, err := s.productRepo.FindByID(productID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("produk tidak ditemukan")
		}
		return nil, errors.New("gagal validasi durasi produk")
	}

	durationsSet := make(map[int]struct{})
	for _, price := range product.Prices {
		if !price.IsActive {
			continue
		}
		if normalizeAccountType(price.AccountType) != accountType {
			continue
		}
		if price.Duration < 1 {
			continue
		}
		durationsSet[price.Duration] = struct{}{}
	}

	if len(durationsSet) == 0 {
		return nil, errors.New("produk belum punya durasi aktif untuk tipe akun ini")
	}

	durations := make([]int, 0, len(durationsSet))
	for value := range durationsSet {
		durations = append(durations, value)
	}
	sort.Ints(durations)
	return durations, nil
}

func (s *StockService) resolveDurationMonth(productID uuid.UUID, accountType string, durationInput int) (int, error) {
	durations, err := s.availableDurationsForAccountType(productID, accountType)
	if err != nil {
		return 0, err
	}

	if durationInput <= 0 {
		return durations[0], nil
	}

	for _, duration := range durations {
		if duration == durationInput {
			return durationInput, nil
		}
	}

	labels := make([]string, 0, len(durations))
	for _, duration := range durations {
		labels = append(labels, strconv.Itoa(duration))
	}

	return 0, fmt.Errorf("durasi %d bulan tidak valid untuk tipe akun ini. Opsi: %s", durationInput, strings.Join(labels, ", "))
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

	durationMonth, err := s.resolveDurationMonth(productID, accountType, input.DurationMonth)
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

	encryptedPw, err := s.encryptStockPassword(password)
	if err != nil {
		return nil, err
	}

	stock := &model.Stock{
		ProductID:     productID,
		AccountType:   accountType,
		DurationMonth: durationMonth,
		Email:         email,
		Password:      encryptedPw,
		ProfileName:   strings.TrimSpace(input.ProfileName),
		Status:        "available",
	}

	if err := s.stockRepo.Create(stock); err != nil {
		return nil, errors.New("gagal menambah stok")
	}
	return stock, nil
}

type BulkStockInput struct {
	ProductID     string `json:"product_id" binding:"required"`
	AccountType   string `json:"account_type" binding:"required"`
	DurationMonth int    `json:"duration_month"`
	Accounts      []struct {
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

	durationMonth, err := s.resolveDurationMonth(productID, accountType, input.DurationMonth)
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

		encPw, err := s.encryptStockPassword(password)
		if err != nil {
			return 0, err
		}

		stocks = append(stocks, model.Stock{
			ProductID:     productID,
			AccountType:   accountType,
			DurationMonth: durationMonth,
			Email:         email,
			Password:      encPw,
			ProfileName:   strings.TrimSpace(acc.ProfileName),
			Status:        "available",
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

	durationInput := input.DurationMonth
	if durationInput <= 0 {
		durationInput = stock.DurationMonth
	}
	durationMonth, err := s.resolveDurationMonth(stock.ProductID, accountType, durationInput)
	if err != nil {
		return nil, err
	}

	email := strings.TrimSpace(input.Email)
	if email == "" {
		return nil, errors.New("email wajib diisi")
	}

	stock.Email = email
	if strings.TrimSpace(input.Password) != "" {
		encPw, err := s.encryptStockPassword(strings.TrimSpace(input.Password))
		if err != nil {
			return nil, err
		}
		stock.Password = encPw
	}
	stock.ProfileName = strings.TrimSpace(input.ProfileName)
	stock.AccountType = accountType
	stock.DurationMonth = durationMonth
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
