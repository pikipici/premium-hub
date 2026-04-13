package service

import (
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

func TestStockService_Create_ValidatesMasterAccountType(t *testing.T) {
	db := setupCoreDB(t)
	stockRepo := repository.NewStockRepo(db)
	productRepo := repository.NewProductRepo(db)
	accountTypeRepo := repository.NewAccountTypeRepo(db)
	if err := accountTypeRepo.EnsureDefaults(); err != nil {
		t.Fatalf("ensure defaults: %v", err)
	}

	svc := NewStockService(stockRepo, productRepo).SetAccountTypeRepo(accountTypeRepo)
	product, _ := seedProductAndPrice(t, db, "Stock Product", "streaming", "shared", 10000, 1)

	if _, err := svc.Create(CreateStockInput{
		ProductID:   product.ID.String(),
		AccountType: "family",
		Email:       "invalid-master@example.com",
		Password:    "abc12345",
	}); err == nil || !strings.Contains(err.Error(), "belum terdaftar") {
		t.Fatalf("expected unknown account_type error, got: %v", err)
	}

	accountTypeSvc := NewAccountTypeService(accountTypeRepo)
	if _, err := accountTypeSvc.Create(CreateAccountTypeInput{Code: "family", Label: "Family"}); err != nil {
		t.Fatalf("create family account type: %v", err)
	}

	if err := db.Create(&model.ProductPrice{ProductID: product.ID, Duration: 2, AccountType: "family", Price: 15000, IsActive: true}).Error; err != nil {
		t.Fatalf("create product price family: %v", err)
	}

	created, err := svc.Create(CreateStockInput{
		ProductID:   product.ID.String(),
		AccountType: "family",
		Email:       "valid-master@example.com",
		Password:    "abc12345",
	})
	if err != nil {
		t.Fatalf("create stock with registered account_type: %v", err)
	}
	if created.AccountType != "family" {
		t.Fatalf("expected account_type family, got %s", created.AccountType)
	}
}
