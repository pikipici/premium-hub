package service

import (
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

func TestProductService_CreatePrice_ValidatesMasterAccountType(t *testing.T) {
	db := setupCoreDB(t)
	productRepo := repository.NewProductRepo(db)
	stockRepo := repository.NewStockRepo(db)
	accountTypeRepo := repository.NewAccountTypeRepo(db)
	if err := accountTypeRepo.EnsureDefaults(); err != nil {
		t.Fatalf("ensure defaults: %v", err)
	}

	svc := NewProductService(productRepo, stockRepo).SetAccountTypeRepo(accountTypeRepo)
	product := &model.Product{Name: "Pro A", Slug: "pro-a", Category: "streaming", IsActive: true}
	if err := db.Create(product).Error; err != nil {
		t.Fatalf("create product: %v", err)
	}

	if _, err := svc.CreatePrice(product.ID, CreateProductPriceInput{Duration: 1, AccountType: "family", Price: 10000}); err == nil || !strings.Contains(err.Error(), "belum terdaftar") {
		t.Fatalf("expected unknown account_type error, got: %v", err)
	}

	accountTypeSvc := NewAccountTypeService(accountTypeRepo)
	if _, err := accountTypeSvc.Create(CreateAccountTypeInput{Code: "family", Label: "Family"}); err != nil {
		t.Fatalf("create account type family: %v", err)
	}

	created, err := svc.CreatePrice(product.ID, CreateProductPriceInput{Duration: 1, AccountType: "family", Price: 10000})
	if err != nil {
		t.Fatalf("create price with registered account_type: %v", err)
	}
	if created.AccountType != "family" {
		t.Fatalf("expected account_type family, got %s", created.AccountType)
	}
}

func TestProductService_UpdatePrice_RejectsInactiveAccountType(t *testing.T) {
	db := setupCoreDB(t)
	productRepo := repository.NewProductRepo(db)
	stockRepo := repository.NewStockRepo(db)
	accountTypeRepo := repository.NewAccountTypeRepo(db)
	if err := accountTypeRepo.EnsureDefaults(); err != nil {
		t.Fatalf("ensure defaults: %v", err)
	}

	accountTypeSvc := NewAccountTypeService(accountTypeRepo)
	family, err := accountTypeSvc.Create(CreateAccountTypeInput{Code: "family", Label: "Family"})
	if err != nil {
		t.Fatalf("create family account type: %v", err)
	}
	if _, err := accountTypeSvc.Update(family.ID, UpdateAccountTypeInput{IsActive: boolPtr(false)}); err != nil {
		t.Fatalf("deactivate family account type: %v", err)
	}

	svc := NewProductService(productRepo, stockRepo).SetAccountTypeRepo(accountTypeRepo)
	product, price := seedProductAndPrice(t, db, "Pro B", "streaming", "shared", 10000, 1)

	_, err = svc.UpdatePrice(product.ID, price.ID, UpdateProductPriceInput{AccountType: strPtr("family")})
	if err == nil || !strings.Contains(err.Error(), "nonaktif") {
		t.Fatalf("expected inactive account_type error, got: %v", err)
	}
}

func strPtr(value string) *string { return &value }
