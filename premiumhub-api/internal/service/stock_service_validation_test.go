package service

import (
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

func TestStockService_AccountTypeValidationAgainstProductPrices(t *testing.T) {
	db := setupCoreDB(t)
	stockRepo := repository.NewStockRepo(db)
	productRepo := repository.NewProductRepo(db)
	svc := NewStockService(stockRepo, productRepo)

	product, _ := seedProductAndPrice(t, db, "Validation Product", "streaming", "shared", 10000, 1)
	if err := db.Create(&model.ProductPrice{
		ProductID:   product.ID,
		Duration:    3,
		AccountType: "private",
		Price:       20000,
		IsActive:    true,
	}).Error; err != nil {
		t.Fatalf("create second price: %v", err)
	}

	if _, err := svc.Create(CreateStockInput{
		ProductID:   product.ID.String(),
		AccountType: "family",
		Email:       "invalid-type@example.com",
		Password:    "abc12345",
	}); err == nil || !strings.Contains(err.Error(), "tidak valid") {
		t.Fatalf("expected invalid account_type error, got: %v", err)
	}

	created, err := svc.Create(CreateStockInput{
		ProductID:   product.ID.String(),
		AccountType: " PRIVATE ",
		Email:       "valid-type@example.com",
		Password:    "abc12345",
		ProfileName: "profile",
	})
	if err != nil {
		t.Fatalf("create valid stock: %v", err)
	}
	if created.AccountType != "private" {
		t.Fatalf("expected normalized account_type private, got %s", created.AccountType)
	}

	if _, err := svc.Update(created.ID, CreateStockInput{
		ProductID:   product.ID.String(),
		AccountType: "family",
		Email:       "valid-type@example.com",
	}); err == nil || !strings.Contains(err.Error(), "tidak valid") {
		t.Fatalf("expected update invalid account_type error, got: %v", err)
	}

	if _, err := svc.Update(created.ID, CreateStockInput{
		ProductID:   uuid.NewString(),
		AccountType: "private",
		Email:       "valid-type@example.com",
	}); err == nil || !strings.Contains(err.Error(), "tidak boleh diubah") {
		t.Fatalf("expected product_id immutable error, got: %v", err)
	}

	if _, err := svc.CreateBulk(BulkStockInput{
		ProductID:   product.ID.String(),
		AccountType: "private",
		Accounts: []struct {
			Email       string `json:"email"`
			Password    string `json:"password"`
			ProfileName string `json:"profile_name"`
		}{
			{Email: "bulk-empty-pass@example.com", Password: ""},
		},
	}); err == nil || !strings.Contains(err.Error(), "password akun bulk baris 1 wajib diisi") {
		t.Fatalf("expected bulk empty password error, got: %v", err)
	}
}

func TestStockService_CreateRejectsProductWithoutActiveAccountType(t *testing.T) {
	db := setupCoreDB(t)
	stockRepo := repository.NewStockRepo(db)
	productRepo := repository.NewProductRepo(db)
	svc := NewStockService(stockRepo, productRepo)

	product := &model.Product{
		Name:      "No Price Product",
		Slug:      "no-price-product-" + uuid.NewString()[:6],
		Category:  "streaming",
		IsActive:  true,
		IsPopular: false,
	}
	if err := db.Create(product).Error; err != nil {
		t.Fatalf("create product without price: %v", err)
	}

	if _, err := svc.Create(CreateStockInput{
		ProductID:   product.ID.String(),
		AccountType: "shared",
		Email:       "n/a@example.com",
		Password:    "abc12345",
	}); err == nil || !strings.Contains(err.Error(), "produk belum punya tipe akun aktif") {
		t.Fatalf("expected no active account type error, got: %v", err)
	}
}
