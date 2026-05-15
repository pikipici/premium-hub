package service

import (
	"fmt"
	"testing"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupDigiConnectCheckoutSmoke(t *testing.T, walletBalance int64) (*DigiConnectService, *gorm.DB, uuid.UUID) {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.WalletLedger{}, &model.DigiConnectEntitlement{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	user := &model.User{
		ID:            uuid.New(),
		Name:          "DigiConnect Smoke User",
		Email:         fmt.Sprintf("digiconnect-smoke-%s@example.com", uuid.NewString()),
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: walletBalance,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	svc := NewDigiConnectService(&config.Config{DigiConnectEnabled: true}, repository.NewDigiConnectRepo(db)).SetWalletRepo(repository.NewWalletRepo(db))
	return svc, db, user.ID
}

func TestDigiConnectCheckoutDurationPackageWithWalletSmoke(t *testing.T) {
	svc, db, userID := setupDigiConnectCheckoutSmoke(t, 100000)

	entitlement, err := svc.CheckoutWithWallet(userID, DigiConnectCheckoutInput{PlanCode: "digiconnect_2d"})
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if entitlement.PlanCode != "digiconnect_2d" || entitlement.Status != "active" || entitlement.Price != 15000 || entitlement.ExpiresAt == nil {
		t.Fatalf("unexpected entitlement: %#v", entitlement)
	}

	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if user.WalletBalance != 85000 {
		t.Fatalf("expected wallet balance 85000, got %d", user.WalletBalance)
	}

	var ledger model.WalletLedger
	if err := db.First(&ledger, "user_id = ? AND category = ?", userID, "digiconnect_plan").Error; err != nil {
		t.Fatalf("load ledger: %v", err)
	}
	if ledger.Type != "debit" || ledger.Amount != 15000 || ledger.BalanceAfter != 85000 {
		t.Fatalf("unexpected ledger: %#v", ledger)
	}
}

func TestDigiConnectCheckoutPayPerRequestDoesNotPrecharge(t *testing.T) {
	svc, db, userID := setupDigiConnectCheckoutSmoke(t, 1000)

	entitlement, err := svc.CheckoutWithWallet(userID, DigiConnectCheckoutInput{PlanCode: "digiconnect_ppr_premium"})
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if entitlement.PlanCode != "digiconnect_ppr_premium" || entitlement.Price != 200 || entitlement.ExpiresAt != nil || !entitlement.PayPerRequestEnabled {
		t.Fatalf("unexpected pay-per-request entitlement: %#v", entitlement)
	}

	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if user.WalletBalance != 1000 {
		t.Fatalf("expected wallet balance unchanged, got %d", user.WalletBalance)
	}

	var ledgerCount int64
	if err := db.Model(&model.WalletLedger{}).Where("user_id = ? AND category = ?", userID, "digiconnect_plan").Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count ledger: %v", err)
	}
	if ledgerCount != 0 {
		t.Fatalf("expected no plan debit for pay-per-request, got %d", ledgerCount)
	}
}

func TestDigiConnectCheckoutWithWalletRejectsInsufficientBalance(t *testing.T) {
	svc, db, userID := setupDigiConnectCheckoutSmoke(t, 1000)

	if _, err := svc.CheckoutWithWallet(userID, DigiConnectCheckoutInput{PlanCode: "digiconnect_2d"}); err == nil {
		t.Fatal("expected insufficient balance error")
	}

	var count int64
	if err := db.Model(&model.DigiConnectEntitlement{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
		t.Fatalf("count entitlement: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no entitlement, got %d", count)
	}
}
