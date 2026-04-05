package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type fakeFiveSimClient struct {
	countries map[string]any
	products  map[string]any
	prices    map[string]any
	profile   map[string]any
	history   map[string]any
	inbox     map[string]any

	buyActivationResp *FiveSimOrderPayload
	buyActivationErr  error
	buyHostingResp    *FiveSimOrderPayload
	buyHostingErr     error
	reuseResp         *FiveSimOrderPayload
	reuseErr          error
	checkResp         *FiveSimOrderPayload
	checkErr          error
	finishResp        *FiveSimOrderPayload
	finishErr         error
	cancelResp        *FiveSimOrderPayload
	cancelErr         error
	banResp           *FiveSimOrderPayload
	banErr            error

	checkHits  int
	cancelHits int
}

func (f *fakeFiveSimClient) GetProfile(_ context.Context) (map[string]any, error) {
	if f.profile == nil {
		return map[string]any{"balance": 0}, nil
	}
	return f.profile, nil
}

func (f *fakeFiveSimClient) GetCountries(_ context.Context) (map[string]any, error) {
	if f.countries == nil {
		return map[string]any{}, nil
	}
	return f.countries, nil
}

func (f *fakeFiveSimClient) GetProducts(_ context.Context, _, _ string) (map[string]any, error) {
	if f.products == nil {
		return map[string]any{}, nil
	}
	return f.products, nil
}

func (f *fakeFiveSimClient) GetPrices(_ context.Context, _, _ string) (map[string]any, error) {
	if f.prices == nil {
		return map[string]any{}, nil
	}
	return f.prices, nil
}

func (f *fakeFiveSimClient) BuyActivation(_ context.Context, _, _, _ string, _ FiveSimBuyActivationOptions) (*FiveSimOrderPayload, error) {
	if f.buyActivationErr != nil {
		return nil, f.buyActivationErr
	}
	if f.buyActivationResp == nil {
		return nil, errors.New("missing buy activation response")
	}
	return f.buyActivationResp, nil
}

func (f *fakeFiveSimClient) BuyHosting(_ context.Context, _, _, _ string) (*FiveSimOrderPayload, error) {
	if f.buyHostingErr != nil {
		return nil, f.buyHostingErr
	}
	if f.buyHostingResp == nil {
		return nil, errors.New("missing buy hosting response")
	}
	return f.buyHostingResp, nil
}

func (f *fakeFiveSimClient) ReuseNumber(_ context.Context, _, _ string) (*FiveSimOrderPayload, error) {
	if f.reuseErr != nil {
		return nil, f.reuseErr
	}
	if f.reuseResp == nil {
		return nil, errors.New("missing reuse response")
	}
	return f.reuseResp, nil
}

func (f *fakeFiveSimClient) CheckOrder(_ context.Context, _ int64) (*FiveSimOrderPayload, error) {
	f.checkHits++
	if f.checkErr != nil {
		return nil, f.checkErr
	}
	if f.checkResp == nil {
		return nil, errors.New("missing check response")
	}
	return f.checkResp, nil
}

func (f *fakeFiveSimClient) FinishOrder(_ context.Context, _ int64) (*FiveSimOrderPayload, error) {
	if f.finishErr != nil {
		return nil, f.finishErr
	}
	if f.finishResp == nil {
		return nil, errors.New("missing finish response")
	}
	return f.finishResp, nil
}

func (f *fakeFiveSimClient) CancelOrder(_ context.Context, _ int64) (*FiveSimOrderPayload, error) {
	f.cancelHits++
	if f.cancelErr != nil {
		return nil, f.cancelErr
	}
	if f.cancelResp == nil {
		return nil, errors.New("missing cancel response")
	}
	return f.cancelResp, nil
}

func (f *fakeFiveSimClient) BanOrder(_ context.Context, _ int64) (*FiveSimOrderPayload, error) {
	if f.banErr != nil {
		return nil, f.banErr
	}
	if f.banResp == nil {
		return nil, errors.New("missing ban response")
	}
	return f.banResp, nil
}

func (f *fakeFiveSimClient) GetSMSInbox(_ context.Context, _ int64) (map[string]any, error) {
	if f.inbox == nil {
		return map[string]any{"Data": []any{}, "Total": 0}, nil
	}
	return f.inbox, nil
}

func (f *fakeFiveSimClient) GetProviderOrderHistory(_ context.Context, _ string, _, _ int, _ string, _ bool) (map[string]any, error) {
	if f.history == nil {
		return map[string]any{"Data": []any{}}, nil
	}
	return f.history, nil
}

func setupFiveSimService(t *testing.T) (*FiveSimService, *gorm.DB, *fakeFiveSimClient, model.User, model.User) {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	if err := db.AutoMigrate(&model.User{}, &model.FiveSimOrder{}, &model.WalletLedger{}); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	activeUser := model.User{
		ID:            uuid.New(),
		Name:          "active",
		Email:         fmt.Sprintf("active-%s@example.com", uuid.NewString()),
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 50_000,
	}
	if err := db.Create(&activeUser).Error; err != nil {
		t.Fatalf("create active user: %v", err)
	}

	otherUser := model.User{
		ID:            uuid.New(),
		Name:          "other",
		Email:         fmt.Sprintf("other-%s@example.com", uuid.NewString()),
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 50_000,
	}
	if err := db.Create(&otherUser).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	fakeClient := &fakeFiveSimClient{}
	svc := NewFiveSimService(
		&config.Config{
			FiveSimWalletPriceMultiplier: "1000",
			FiveSimWalletMinDebit:        "1000",
		},
		repository.NewUserRepo(db),
		repository.NewFiveSimOrderRepo(db),
		repository.NewWalletRepo(db),
		fakeClient,
	)

	return svc, db, fakeClient, activeUser, otherUser
}

func TestFiveSimServiceBuyActivationCreatesLocalOrder(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       991122,
		Phone:    "+447000001111",
		Operator: "vodafone",
		Product:  "telegram",
		Price:    0.34,
		Status:   "PENDING",
		Country:  "england",
	}

	localOrder, providerOrder, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:  "england",
		Operator: "any",
		Product:  "telegram",
	})
	if err != nil {
		t.Fatalf("buy activation: %v", err)
	}

	if providerOrder.ID != 991122 {
		t.Fatalf("unexpected provider order id: %d", providerOrder.ID)
	}
	if localOrder.ProviderOrderID != 991122 {
		t.Fatalf("unexpected local provider order id: %d", localOrder.ProviderOrderID)
	}
	if localOrder.OrderType != "activation" {
		t.Fatalf("unexpected order type: %s", localOrder.OrderType)
	}

	var dbRow model.FiveSimOrder
	if err := db.First(&dbRow, "provider_order_id = ?", 991122).Error; err != nil {
		t.Fatalf("load fivesim order: %v", err)
	}
	if dbRow.UserID != activeUser.ID {
		t.Fatalf("ownership mismatch")
	}
	if dbRow.ProviderStatus != "PENDING" {
		t.Fatalf("expected provider status PENDING, got %s", dbRow.ProviderStatus)
	}

	var updatedUser model.User
	if err := db.First(&updatedUser, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if updatedUser.WalletBalance != 49_000 {
		t.Fatalf("unexpected wallet balance: got %d want %d", updatedUser.WalletBalance, 49_000)
	}

	var ledger model.WalletLedger
	if err := db.First(&ledger, "reference = ?", "fivesim_order:991122:charge").Error; err != nil {
		t.Fatalf("load wallet ledger: %v", err)
	}
	if ledger.Type != "debit" || ledger.Category != "5sim_purchase" {
		t.Fatalf("unexpected ledger row: type=%s category=%s", ledger.Type, ledger.Category)
	}
	if ledger.Amount != 1000 {
		t.Fatalf("unexpected debit amount: got %d want %d", ledger.Amount, 1000)
	}
}

func TestFiveSimServiceCheckOrderRespectsOwnership(t *testing.T) {
	svc, db, fake, activeUser, otherUser := setupFiveSimService(t)
	seed := model.FiveSimOrder{
		ID:              uuid.New(),
		UserID:          activeUser.ID,
		ProviderOrderID: 12345,
		OrderType:       "activation",
		Product:         "telegram",
		ProviderStatus:  "PENDING",
	}
	if err := db.Create(&seed).Error; err != nil {
		t.Fatalf("seed order: %v", err)
	}
	fake.checkResp = &FiveSimOrderPayload{ID: 12345, Status: "RECEIVED", Product: "telegram"}

	_, _, err := svc.CheckOrder(context.Background(), otherUser.ID, 12345)
	if err == nil || !strings.Contains(err.Error(), "tidak ditemukan") {
		t.Fatalf("expected ownership not found error, got: %v", err)
	}
	if fake.checkHits != 0 {
		t.Fatalf("provider should not be called for foreign order")
	}
}

func TestFiveSimServiceMapsProviderRateLimitError(t *testing.T) {
	svc, _, fake, activeUser, _ := setupFiveSimService(t)
	fake.buyActivationErr = &FiveSimAPIError{StatusCode: 429, Message: "too many requests", Retryable: true}

	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country: "england",
		Product: "telegram",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "limit request") {
		t.Fatalf("expected mapped rate-limit error, got: %v", err)
	}
}

func TestFiveSimServiceBuyActivationInsufficientWalletCancelsProviderOrder(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	if err := db.Model(&model.User{}).Where("id = ?", activeUser.ID).Update("wallet_balance", 100).Error; err != nil {
		t.Fatalf("set wallet balance: %v", err)
	}

	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       774411,
		Phone:    "+62812345678",
		Operator: "telkomsel",
		Product:  "telegram",
		Price:    2.40,
		Status:   "PENDING",
		Country:  "indonesia",
	}
	fake.cancelResp = &FiveSimOrderPayload{
		ID:       774411,
		Phone:    "+62812345678",
		Operator: "telkomsel",
		Product:  "telegram",
		Price:    2.40,
		Status:   "CANCELED",
		Country:  "indonesia",
	}

	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:  "indonesia",
		Operator: "any",
		Product:  "telegram",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "saldo wallet tidak cukup") {
		t.Fatalf("expected insufficient wallet error, got: %v", err)
	}
	if fake.cancelHits != 1 {
		t.Fatalf("expected cancel provider hit once, got %d", fake.cancelHits)
	}

	var updatedUser model.User
	if err := db.First(&updatedUser, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if updatedUser.WalletBalance != 100 {
		t.Fatalf("wallet balance should remain unchanged, got %d", updatedUser.WalletBalance)
	}

	var ledgerCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", "fivesim_order:774411:charge").Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count ledger: %v", err)
	}
	if ledgerCount != 0 {
		t.Fatalf("expected no debit ledger row, got %d", ledgerCount)
	}

	var row model.FiveSimOrder
	if err := db.First(&row, "provider_order_id = ?", 774411).Error; err != nil {
		t.Fatalf("load local order: %v", err)
	}
	if row.ProviderStatus != "CANCELED" {
		t.Fatalf("expected local order status CANCELED, got %s", row.ProviderStatus)
	}
}

func TestFiveSimServiceBuyActivationInsufficientWalletCancelFailureEscalates(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	if err := db.Model(&model.User{}).Where("id = ?", activeUser.ID).Update("wallet_balance", 100).Error; err != nil {
		t.Fatalf("set wallet balance: %v", err)
	}

	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       889900,
		Phone:    "+62811222333",
		Operator: "xl",
		Product:  "telegram",
		Price:    1.25,
		Status:   "PENDING",
		Country:  "indonesia",
	}
	fake.cancelErr = &FiveSimAPIError{StatusCode: 503, Message: "server offline", Retryable: true}

	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country: "indonesia",
		Product: "telegram",
	})
	if err == nil {
		t.Fatalf("expected error when cancel rollback fails")
	}
	msg := strings.ToLower(err.Error())
	if !strings.Contains(msg, "saldo wallet tidak cukup") || !strings.Contains(msg, "hubungi admin") {
		t.Fatalf("expected escalated rollback message, got: %v", err)
	}
	if fake.cancelHits != 1 {
		t.Fatalf("expected cancel provider hit once, got %d", fake.cancelHits)
	}
}
