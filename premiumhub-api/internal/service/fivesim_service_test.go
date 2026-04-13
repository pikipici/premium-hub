package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

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
	checkRespByID     map[int64]*FiveSimOrderPayload
	checkErrByID      map[int64]error
	finishResp        *FiveSimOrderPayload
	finishErr         error
	cancelResp        *FiveSimOrderPayload
	cancelErr         error
	cancelRespByID    map[int64]*FiveSimOrderPayload
	cancelErrByID     map[int64]error
	banResp           *FiveSimOrderPayload
	banErr            error

	buyActivationHits int
	buyHostingHits    int
	reuseHits         int
	checkHits         int
	cancelHits        int
	inboxHits         int
	checkHitsBy       map[int64]int
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
	f.buyActivationHits++
	if f.buyActivationErr != nil {
		return nil, f.buyActivationErr
	}
	if f.buyActivationResp == nil {
		return nil, errors.New("missing buy activation response")
	}
	return f.buyActivationResp, nil
}

func (f *fakeFiveSimClient) BuyHosting(_ context.Context, _, _, _ string) (*FiveSimOrderPayload, error) {
	f.buyHostingHits++
	if f.buyHostingErr != nil {
		return nil, f.buyHostingErr
	}
	if f.buyHostingResp == nil {
		return nil, errors.New("missing buy hosting response")
	}
	return f.buyHostingResp, nil
}

func (f *fakeFiveSimClient) ReuseNumber(_ context.Context, _, _ string) (*FiveSimOrderPayload, error) {
	f.reuseHits++
	if f.reuseErr != nil {
		return nil, f.reuseErr
	}
	if f.reuseResp == nil {
		return nil, errors.New("missing reuse response")
	}
	return f.reuseResp, nil
}

func (f *fakeFiveSimClient) CheckOrder(_ context.Context, providerOrderID int64) (*FiveSimOrderPayload, error) {
	f.checkHits++
	if f.checkHitsBy == nil {
		f.checkHitsBy = map[int64]int{}
	}
	f.checkHitsBy[providerOrderID] = f.checkHitsBy[providerOrderID] + 1

	if f.checkErrByID != nil {
		if err, ok := f.checkErrByID[providerOrderID]; ok && err != nil {
			return nil, err
		}
	}
	if f.checkRespByID != nil {
		if res, ok := f.checkRespByID[providerOrderID]; ok && res != nil {
			return res, nil
		}
	}
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

func (f *fakeFiveSimClient) CancelOrder(_ context.Context, providerOrderID int64) (*FiveSimOrderPayload, error) {
	f.cancelHits++
	if f.cancelErrByID != nil {
		if err, ok := f.cancelErrByID[providerOrderID]; ok && err != nil {
			return nil, err
		}
	}
	if f.cancelRespByID != nil {
		if res, ok := f.cancelRespByID[providerOrderID]; ok && res != nil {
			return res, nil
		}
	}
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
	f.inboxHits++
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

	if err := db.AutoMigrate(&model.User{}, &model.FiveSimOrder{}, &model.FiveSimOrderIdempotency{}, &model.WalletLedger{}); err != nil {
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

func TestFiveSimServiceGetCatalogPricesSanitizesProviderCost(t *testing.T) {
	svc, _, fake, activeUser, _ := setupFiveSimService(t)
	svc.cfg.FiveSimWalletPriceMultiplier = "18500"
	svc.cfg.FiveSimWalletMinDebit = "1"

	fake.prices = map[string]any{
		"indonesia": map[string]any{
			"twitter": map[string]any{
				"virtual52": map[string]any{"cost": 0.0192, "count": 0, "rate": 0},
				"virtual4":  map[string]any{"cost": 0.35, "count": 12, "rate": 40},
			},
		},
	}

	res, err := svc.GetCatalogPrices(context.Background(), activeUser.ID, "indonesia", "twitter")
	if err != nil {
		t.Fatalf("get catalog prices: %v", err)
	}

	if res.Currency != "IDR" {
		t.Fatalf("unexpected currency: %s", res.Currency)
	}
	if res.Country != "indonesia" {
		t.Fatalf("unexpected country: %s", res.Country)
	}
	if res.Product != "twitter" {
		t.Fatalf("unexpected product: %s", res.Product)
	}
	if len(res.Prices) != 1 {
		t.Fatalf("expected 1 buyable row, got %d", len(res.Prices))
	}

	row := res.Prices[0]
	if row.Operator != "virtual4" {
		t.Fatalf("unexpected operator: %s", row.Operator)
	}
	if row.WalletDebit != 6475 {
		t.Fatalf("unexpected wallet debit virtual4: got %d want %d", row.WalletDebit, 6475)
	}
	if row.NumberCount == nil || *row.NumberCount != 12 {
		t.Fatalf("unexpected number_count virtual4: %#v", row.NumberCount)
	}
	if !row.BuyEnabled {
		t.Fatalf("expected buy_enabled true")
	}
	if row.AvailabilityStatus != fiveSimAvailabilityAvailable {
		t.Fatalf("unexpected availability status: %s", row.AvailabilityStatus)
	}
}

func TestFiveSimServiceGetCatalogPricesHandlesMalformedPayload(t *testing.T) {
	svc, _, fake, activeUser, _ := setupFiveSimService(t)
	fake.prices = map[string]any{
		"indonesia": map[string]any{
			"twitter": map[string]any{
				"virtual52": map[string]any{"cost": "invalid"},
			},
		},
	}

	res, err := svc.GetCatalogPrices(context.Background(), activeUser.ID, "indonesia", "twitter")
	if err != nil {
		t.Fatalf("get catalog prices malformed: %v", err)
	}
	if len(res.Prices) != 0 {
		t.Fatalf("expected empty rows for malformed payload, got %d", len(res.Prices))
	}
}

func TestFiveSimServiceBuyActivationRejectsOutOfStockOperatorBeforeProviderCall(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	svc.cfg.FiveSimWalletPriceMultiplier = "18500"
	svc.cfg.FiveSimWalletMinDebit = "1"

	fake.prices = map[string]any{
		"indonesia": map[string]any{
			"telegram": map[string]any{
				"virtual52": map[string]any{"cost": 0.0192, "count": 0},
				"virtual4":  map[string]any{"cost": 0.35, "count": 12},
			},
		},
	}

	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:        "indonesia",
		Operator:       "virtual52",
		Product:        "telegram",
		IdempotencyKey: "idem-precheck-out-of-stock",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "stok nomor operator ini sedang habis") {
		t.Fatalf("expected out of stock error, got: %v", err)
	}
	if fake.buyActivationHits != 0 {
		t.Fatalf("provider buy should not be called on out of stock precheck, got %d", fake.buyActivationHits)
	}

	var idemCount int64
	if err := db.Model(&model.FiveSimOrderIdempotency{}).Count(&idemCount).Error; err != nil {
		t.Fatalf("count idempotency rows: %v", err)
	}
	if idemCount != 0 {
		t.Fatalf("out of stock precheck should not create idempotency row, got %d", idemCount)
	}
}

func TestFiveSimServiceBuyActivationNoFreePhonesTriggersCooldownBlock(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	svc.cfg.FiveSimWalletPriceMultiplier = "18500"
	svc.cfg.FiveSimWalletMinDebit = "1"

	fake.prices = map[string]any{
		"usa": map[string]any{
			"michat": map[string]any{
				"virtual28": map[string]any{"cost": 0.0206, "count": 10},
			},
		},
	}
	fake.buyActivationErr = &FiveSimAPIError{StatusCode: 400, Message: "no free phones"}

	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:        "usa",
		Operator:       "virtual28",
		Product:        "michat",
		IdempotencyKey: "idem-no-free-phones-1",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "stok nomor operator ini sedang habis") {
		t.Fatalf("expected no free phones normalized error, got: %v", err)
	}
	if fake.buyActivationHits != 1 {
		t.Fatalf("expected first provider buy hit, got %d", fake.buyActivationHits)
	}

	fake.buyActivationErr = nil
	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       991140,
		Phone:    "+11234567890",
		Operator: "virtual28",
		Product:  "michat",
		Price:    0.0206,
		Status:   "PENDING",
		Country:  "usa",
	}

	_, _, err = svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:        "usa",
		Operator:       "virtual28",
		Product:        "michat",
		IdempotencyKey: "idem-no-free-phones-2",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "stok nomor operator ini sedang habis") {
		t.Fatalf("expected cooldown out of stock error, got: %v", err)
	}
	if fake.buyActivationHits != 1 {
		t.Fatalf("provider buy should be blocked by cooldown, got %d", fake.buyActivationHits)
	}

	var idem model.FiveSimOrderIdempotency
	if err := db.Where("idempotency_key = ?", "idem-no-free-phones-1").First(&idem).Error; err != nil {
		t.Fatalf("load idempotency row: %v", err)
	}
	if idem.Status != fiveSimIdemStatusFailed {
		t.Fatalf("expected failed idempotency status, got %s", idem.Status)
	}
	if !strings.Contains(strings.ToLower(idem.ErrorMessage), "stok nomor operator") {
		t.Fatalf("expected localized idempotency error, got %s", idem.ErrorMessage)
	}
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
		Country:        "england",
		Operator:       "any",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-create-local-order",
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

func TestFiveSimServiceBuyActivationIdempotencyReturnsExistingOrder(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       991124,
		Phone:    "+447000001124",
		Operator: "vodafone",
		Product:  "telegram",
		Price:    0.34,
		Status:   "PENDING",
		Country:  "england",
	}

	input := FiveSimBuyActivationInput{
		Country:        "england",
		Operator:       "any",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-activation-001",
	}

	firstOrder, firstProvider, err := svc.BuyActivation(context.Background(), activeUser.ID, input)
	if err != nil {
		t.Fatalf("first buy activation: %v", err)
	}

	secondOrder, secondProvider, err := svc.BuyActivation(context.Background(), activeUser.ID, input)
	if err != nil {
		t.Fatalf("second buy activation idempotent: %v", err)
	}

	if fake.buyActivationHits != 1 {
		t.Fatalf("provider buy should be called once, got %d", fake.buyActivationHits)
	}
	if firstOrder.ProviderOrderID != secondOrder.ProviderOrderID {
		t.Fatalf("idempotency should return same provider order id, got %d and %d", firstOrder.ProviderOrderID, secondOrder.ProviderOrderID)
	}
	if firstProvider.ID != secondProvider.ID {
		t.Fatalf("idempotency should return same provider payload id, got %d and %d", firstProvider.ID, secondProvider.ID)
	}

	var updatedUser model.User
	if err := db.First(&updatedUser, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if updatedUser.WalletBalance != 49_000 {
		t.Fatalf("wallet should be debited once to 49000, got %d", updatedUser.WalletBalance)
	}

	var chargeCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", "fivesim_order:991124:charge").Count(&chargeCount).Error; err != nil {
		t.Fatalf("count charge ledger: %v", err)
	}
	if chargeCount != 1 {
		t.Fatalf("expected one charge ledger, got %d", chargeCount)
	}
}

func TestFiveSimServiceBuyActivationIdempotencyRejectsDifferentPayload(t *testing.T) {
	svc, _, fake, activeUser, _ := setupFiveSimService(t)
	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       991125,
		Phone:    "+447000001125",
		Operator: "vodafone",
		Product:  "telegram",
		Price:    0.34,
		Status:   "PENDING",
		Country:  "england",
	}

	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:        "england",
		Operator:       "any",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-activation-002",
	})
	if err != nil {
		t.Fatalf("first buy activation should succeed: %v", err)
	}

	_, _, err = svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:        "england",
		Operator:       "any",
		Product:        "whatsapp",
		IdempotencyKey: "idem-fivesim-activation-002",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "request berbeda") {
		t.Fatalf("expected idempotency mismatch error, got: %v", err)
	}
	if fake.buyActivationHits != 1 {
		t.Fatalf("provider buy should stay one hit, got %d", fake.buyActivationHits)
	}
}

func TestFiveSimServiceBuyActivationIdempotencyRejectsTooLongKey(t *testing.T) {
	svc, _, fake, activeUser, _ := setupFiveSimService(t)
	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       991128,
		Phone:    "+447000001128",
		Operator: "vodafone",
		Product:  "telegram",
		Price:    0.34,
		Status:   "PENDING",
		Country:  "england",
	}

	tooLong := strings.Repeat("x", 81)
	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:        "england",
		Operator:       "any",
		Product:        "telegram",
		IdempotencyKey: tooLong,
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "idempotency_key") {
		t.Fatalf("expected idempotency length error, got: %v", err)
	}
	if fake.buyActivationHits != 0 {
		t.Fatalf("provider buy should not be called for invalid idempotency key")
	}
}

func TestFiveSimServiceBuyActivationIdempotencyMissingRejected(t *testing.T) {
	svc, _, fake, activeUser, _ := setupFiveSimService(t)
	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       991129,
		Phone:    "+447000001129",
		Operator: "vodafone",
		Product:  "telegram",
		Price:    0.34,
		Status:   "PENDING",
		Country:  "england",
	}

	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:  "england",
		Operator: "any",
		Product:  "telegram",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "idempotency_key wajib") {
		t.Fatalf("expected missing idempotency key error, got: %v", err)
	}
	if fake.buyActivationHits != 0 {
		t.Fatalf("provider buy should not be called when idempotency_key missing")
	}
}

func TestFiveSimServiceBuyActivationIdempotencyProcessingBlocksDuplicate(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)

	seed := model.FiveSimOrderIdempotency{
		ID:              uuid.New(),
		UserID:          activeUser.ID,
		OrderType:       "activation",
		IdempotencyKey:  "idem-fivesim-activation-processing",
		RequestHash:     buildFiveSimBuyRequestHash("activation", "england", "any", "telegram", "null", "", "false", "false", "", "null"),
		Status:          fiveSimIdemStatusProcessing,
		ProviderOrderID: 0,
	}
	if err := db.Create(&seed).Error; err != nil {
		t.Fatalf("seed idempotency row: %v", err)
	}

	_, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:        "england",
		Operator:       "any",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-activation-processing",
	})
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "sedang diproses") {
		t.Fatalf("expected processing idempotency error, got: %v", err)
	}
	if fake.buyActivationHits != 0 {
		t.Fatalf("provider buy should not be called when processing, got %d", fake.buyActivationHits)
	}
}

func TestFiveSimServiceBuyHostingIdempotencyReturnsExistingOrder(t *testing.T) {
	svc, _, fake, activeUser, _ := setupFiveSimService(t)
	fake.buyHostingResp = &FiveSimOrderPayload{
		ID:       991126,
		Phone:    "+447000001126",
		Operator: "vodafone",
		Product:  "telegram",
		Price:    0.34,
		Status:   "PENDING",
		Country:  "england",
	}

	input := FiveSimBuyHostingInput{
		Country:        "england",
		Operator:       "any",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-hosting-001",
	}

	first, _, err := svc.BuyHosting(context.Background(), activeUser.ID, input)
	if err != nil {
		t.Fatalf("first buy hosting: %v", err)
	}
	second, _, err := svc.BuyHosting(context.Background(), activeUser.ID, input)
	if err != nil {
		t.Fatalf("second buy hosting idempotent: %v", err)
	}

	if fake.buyHostingHits != 1 {
		t.Fatalf("provider hosting buy should be called once, got %d", fake.buyHostingHits)
	}
	if first.ProviderOrderID != second.ProviderOrderID {
		t.Fatalf("hosting idempotency should return same provider order id, got %d and %d", first.ProviderOrderID, second.ProviderOrderID)
	}
}

func TestFiveSimServiceReuseNumberIdempotencyReturnsExistingOrder(t *testing.T) {
	svc, _, fake, activeUser, _ := setupFiveSimService(t)
	fake.reuseResp = &FiveSimOrderPayload{
		ID:       991127,
		Phone:    "+447000001127",
		Operator: "vodafone",
		Product:  "telegram",
		Price:    0.34,
		Status:   "PENDING",
		Country:  "england",
	}

	input := FiveSimReuseInput{
		Product:        "telegram",
		Number:         "+447000001127",
		IdempotencyKey: "idem-fivesim-reuse-001",
	}

	first, _, err := svc.ReuseNumber(context.Background(), activeUser.ID, input)
	if err != nil {
		t.Fatalf("first reuse number: %v", err)
	}
	second, _, err := svc.ReuseNumber(context.Background(), activeUser.ID, input)
	if err != nil {
		t.Fatalf("second reuse number idempotent: %v", err)
	}

	if fake.reuseHits != 1 {
		t.Fatalf("provider reuse should be called once, got %d", fake.reuseHits)
	}
	if first.ProviderOrderID != second.ProviderOrderID {
		t.Fatalf("reuse idempotency should return same provider order id, got %d and %d", first.ProviderOrderID, second.ProviderOrderID)
	}
}

func TestFiveSimServiceBuyActivationTerminalStatusAutoRefundImmediately(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	fake.buyActivationResp = &FiveSimOrderPayload{
		ID:       991133,
		Phone:    "+447000002222",
		Operator: "vodafone",
		Product:  "telegram",
		Price:    0.34,
		Status:   "CANCELED",
		Country:  "england",
		SMS:      []FiveSimSMS{},
	}

	localOrder, _, err := svc.BuyActivation(context.Background(), activeUser.ID, FiveSimBuyActivationInput{
		Country:        "england",
		Operator:       "any",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-terminal-auto-refund",
	})
	if err != nil {
		t.Fatalf("buy activation canceled: %v", err)
	}
	if localOrder.ProviderStatus != "CANCELED" {
		t.Fatalf("expected local order status CANCELED, got %s", localOrder.ProviderStatus)
	}

	var updatedUser model.User
	if err := db.First(&updatedUser, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if updatedUser.WalletBalance != 50_000 {
		t.Fatalf("wallet should be auto-refunded to 50000, got %d", updatedUser.WalletBalance)
	}

	var chargeCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", "fivesim_order:991133:charge").Count(&chargeCount).Error; err != nil {
		t.Fatalf("count charge ledger: %v", err)
	}
	if chargeCount != 1 {
		t.Fatalf("expected charge ledger exactly once, got %d", chargeCount)
	}

	var refundCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", "fivesim_order:991133:refund").Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledger: %v", err)
	}
	if refundCount != 1 {
		t.Fatalf("expected refund ledger exactly once, got %d", refundCount)
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
		Country:        "england",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-provider-ratelimit",
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
		Country:        "indonesia",
		Operator:       "any",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-insufficient-cancel",
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
		Country:        "indonesia",
		Product:        "telegram",
		IdempotencyKey: "idem-fivesim-insufficient-cancel-fail",
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

func TestFiveSimServiceCheckOrderBlockedWhenUnbilled(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	seedFiveSimOrderUnbilled(t, db, activeUser.ID, 550001, "PENDING", time.Now().Add(-2*time.Minute))

	fake.checkRespByID = map[int64]*FiveSimOrderPayload{
		550001: {
			ID:      550001,
			Status:  "RECEIVED",
			Country: "indonesia",
			Product: "telegram",
			SMS: []FiveSimSMS{{
				Code: "12345",
			}},
		},
	}

	_, _, err := svc.CheckOrder(context.Background(), activeUser.ID, 550001)
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "belum berhasil didebit") {
		t.Fatalf("expected unbilled order blocked error, got: %v", err)
	}
	if fake.checkHits != 0 {
		t.Fatalf("provider check should not be called for unbilled order")
	}
}

func TestFiveSimServiceGetSMSInboxBlockedWhenUnbilled(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	seedFiveSimOrderUnbilled(t, db, activeUser.ID, 550002, "PENDING", time.Now().Add(-2*time.Minute))

	_, err := svc.GetSMSInbox(context.Background(), activeUser.ID, 550002)
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "belum berhasil didebit") {
		t.Fatalf("expected unbilled sms inbox blocked error, got: %v", err)
	}
	if fake.inboxHits != 0 {
		t.Fatalf("provider inbox should not be called for unbilled order")
	}
}

func TestFiveSimServiceCancelOrderAllowedWhenUnbilled(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	seedFiveSimOrderUnbilled(t, db, activeUser.ID, 550003, "PENDING", time.Now().Add(-2*time.Minute))

	fake.cancelRespByID = map[int64]*FiveSimOrderPayload{
		550003: {
			ID:       550003,
			Status:   "CANCELED",
			Country:  "indonesia",
			Operator: "any",
			Product:  "telegram",
			SMS:      []FiveSimSMS{},
		},
	}

	localOrder, _, err := svc.CancelOrder(context.Background(), activeUser.ID, 550003)
	if err != nil {
		t.Fatalf("cancel unbilled order should succeed: %v", err)
	}
	if localOrder.ProviderStatus != "CANCELED" {
		t.Fatalf("expected local order canceled, got %s", localOrder.ProviderStatus)
	}
	if fake.cancelHits != 1 {
		t.Fatalf("provider cancel should be called once, got %d", fake.cancelHits)
	}
}

func TestFiveSimServiceCheckOrderPersistsStatusAndSnapshot(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)

	seedFiveSimOrderWithCharge(t, db, activeUser.ID, 551100, "PENDING", 1000, time.Now().Add(-2*time.Minute))

	fake.checkRespByID = map[int64]*FiveSimOrderPayload{
		551100: {
			ID:       551100,
			Status:   "RECEIVED",
			Phone:    "+628123123123",
			Country:  "indonesia",
			Operator: "any",
			Product:  "telegram",
			Price:    0.22,
			SMS: []FiveSimSMS{{
				Code: "12345",
				Text: "kode otp 12345",
			}},
		},
	}

	localOrder, _, err := svc.CheckOrder(context.Background(), activeUser.ID, 551100)
	if err != nil {
		t.Fatalf("check order: %v", err)
	}
	if localOrder.ProviderStatus != "RECEIVED" {
		t.Fatalf("expected returned status RECEIVED, got %s", localOrder.ProviderStatus)
	}

	var dbRow model.FiveSimOrder
	if err := db.First(&dbRow, "provider_order_id = ?", 551100).Error; err != nil {
		t.Fatalf("load db row: %v", err)
	}
	if dbRow.ProviderStatus != "RECEIVED" {
		t.Fatalf("expected persisted status RECEIVED, got %s", dbRow.ProviderStatus)
	}
	if dbRow.LastSyncedAt == nil {
		t.Fatalf("expected last_synced_at to be set")
	}
	if !strings.Contains(dbRow.RawPayload, "12345") {
		t.Fatalf("expected raw payload to include sms snapshot")
	}
}

func TestFiveSimServiceAutoRefundOnFailedStatusWithoutSMS(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	seedFiveSimOrderWithCharge(t, db, activeUser.ID, 662211, "PENDING", 1_000, time.Now().Add(-3*time.Minute))

	fake.checkRespByID = map[int64]*FiveSimOrderPayload{
		662211: {
			ID:       662211,
			Status:   "TIMEOUT",
			Phone:    "+628880001111",
			Country:  "indonesia",
			Operator: "any",
			Product:  "telegram",
			Price:    0.5,
			SMS:      []FiveSimSMS{},
		},
	}

	if _, _, err := svc.CheckOrder(context.Background(), activeUser.ID, 662211); err != nil {
		t.Fatalf("check order timeout: %v", err)
	}

	var userAfterFirst model.User
	if err := db.First(&userAfterFirst, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user first: %v", err)
	}
	if userAfterFirst.WalletBalance != 50_000 {
		t.Fatalf("wallet should be refunded to 50000, got %d", userAfterFirst.WalletBalance)
	}

	if _, _, err := svc.CheckOrder(context.Background(), activeUser.ID, 662211); err != nil {
		t.Fatalf("check order timeout second pass: %v", err)
	}

	var refundCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", "fivesim_order:662211:refund").Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledger: %v", err)
	}
	if refundCount != 1 {
		t.Fatalf("expected exactly 1 refund ledger row, got %d", refundCount)
	}
}

func TestFiveSimServiceNoRefundWhenSMSAlreadyExists(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	seedFiveSimOrderWithCharge(t, db, activeUser.ID, 773322, "PENDING", 1_000, time.Now().Add(-3*time.Minute))

	fake.checkRespByID = map[int64]*FiveSimOrderPayload{
		773322: {
			ID:       773322,
			Status:   "CANCELED",
			Phone:    "+628880001222",
			Country:  "indonesia",
			Operator: "any",
			Product:  "telegram",
			Price:    0.5,
			SMS: []FiveSimSMS{{
				Code: "99887",
				Text: "kode otp 99887",
			}},
		},
	}

	if _, _, err := svc.CheckOrder(context.Background(), activeUser.ID, 773322); err != nil {
		t.Fatalf("check order canceled with sms: %v", err)
	}

	var userAfter model.User
	if err := db.First(&userAfter, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if userAfter.WalletBalance != 49_000 {
		t.Fatalf("wallet should stay deducted when sms exists, got %d", userAfter.WalletBalance)
	}

	var refundCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", "fivesim_order:773322:refund").Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledger: %v", err)
	}
	if refundCount != 0 {
		t.Fatalf("expected no refund ledger, got %d", refundCount)
	}
}

func TestFiveSimServiceReconcileOpenOrdersAutoCancelAndRefund(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	seedFiveSimOrderWithCharge(t, db, activeUser.ID, 884433, "PENDING", 1_000, time.Now().Add(-20*time.Minute))

	fake.checkRespByID = map[int64]*FiveSimOrderPayload{
		884433: {
			ID:       884433,
			Status:   "PENDING",
			Phone:    "+628880004433",
			Country:  "indonesia",
			Operator: "any",
			Product:  "telegram",
			Price:    0.4,
			SMS:      []FiveSimSMS{},
		},
	}
	fake.cancelRespByID = map[int64]*FiveSimOrderPayload{
		884433: {
			ID:       884433,
			Status:   "CANCELED",
			Phone:    "+628880004433",
			Country:  "indonesia",
			Operator: "any",
			Product:  "telegram",
			Price:    0.4,
			SMS:      []FiveSimSMS{},
		},
	}

	res, err := svc.ReconcileOpenOrders(context.Background(), FiveSimReconcileInput{
		Limit:      50,
		MinSyncAge: time.Second,
		MaxWaiting: 15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("reconcile open orders: %v", err)
	}
	if res.Checked != 1 || res.Synced != 1 || res.AutoCanceled != 1 || res.Refunded != 1 || res.Failed != 0 {
		t.Fatalf("unexpected reconcile result: %+v", res)
	}
	if fake.cancelHits != 1 {
		t.Fatalf("expected auto cancel to be called once, got %d", fake.cancelHits)
	}

	var row model.FiveSimOrder
	if err := db.First(&row, "provider_order_id = ?", 884433).Error; err != nil {
		t.Fatalf("load order: %v", err)
	}
	if row.ProviderStatus != "CANCELED" {
		t.Fatalf("expected final provider status CANCELED, got %s", row.ProviderStatus)
	}

	var userAfter model.User
	if err := db.First(&userAfter, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user after reconcile: %v", err)
	}
	if userAfter.WalletBalance != 50_000 {
		t.Fatalf("wallet should be refunded to 50000, got %d", userAfter.WalletBalance)
	}
}

func TestFiveSimServiceReconcileOpenOrdersResolveNotFoundAfterThreshold(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	svc.cfg.FiveSimResolveNotFoundThreshold = "1"
	svc.cfg.FiveSimResolveNotFoundMinAge = "1s"
	seedFiveSimOrderWithCharge(t, db, activeUser.ID, 995511, "PENDING", 1_000, time.Now().Add(-20*time.Minute))

	fake.checkErrByID = map[int64]error{
		995511: &FiveSimAPIError{StatusCode: 404, Message: "order not found", Retryable: false},
	}

	res, err := svc.ReconcileOpenOrders(context.Background(), FiveSimReconcileInput{
		Limit:      50,
		MinSyncAge: time.Second,
		MaxWaiting: 15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("reconcile open orders: %v", err)
	}
	if res.Checked != 1 || res.Synced != 1 || res.SyntheticResolved != 1 || res.Refunded != 1 || res.Failed != 0 {
		t.Fatalf("unexpected reconcile result: %+v", res)
	}

	var row model.FiveSimOrder
	if err := db.First(&row, "provider_order_id = ?", 995511).Error; err != nil {
		t.Fatalf("load order: %v", err)
	}
	if row.ProviderStatus != "TIMEOUT" {
		t.Fatalf("expected synthetic status TIMEOUT, got %s", row.ProviderStatus)
	}
	if row.ResolutionSource != fiveSimResolutionSourceSynthetic {
		t.Fatalf("expected synthetic resolution source, got %s", row.ResolutionSource)
	}
	if row.ResolvedAt == nil {
		t.Fatalf("expected resolved_at to be set")
	}

	var userAfter model.User
	if err := db.First(&userAfter, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user after reconcile: %v", err)
	}
	if userAfter.WalletBalance != 50_000 {
		t.Fatalf("wallet should be refunded to 50000, got %d", userAfter.WalletBalance)
	}
}

func TestFiveSimServiceReconcileOpenOrdersNotFoundBelowThresholdKeepsOpen(t *testing.T) {
	svc, db, fake, activeUser, _ := setupFiveSimService(t)
	svc.cfg.FiveSimResolveNotFoundThreshold = "3"
	svc.cfg.FiveSimResolveNotFoundMinAge = "1s"
	seedFiveSimOrderWithCharge(t, db, activeUser.ID, 995512, "PENDING", 1_000, time.Now().Add(-20*time.Minute))

	fake.checkErrByID = map[int64]error{
		995512: &FiveSimAPIError{StatusCode: 404, Message: "order not found", Retryable: false},
	}

	res, err := svc.ReconcileOpenOrders(context.Background(), FiveSimReconcileInput{
		Limit:      50,
		MinSyncAge: time.Second,
		MaxWaiting: 15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("reconcile open orders: %v", err)
	}
	if res.Checked != 1 || res.Synced != 0 || res.SyntheticResolved != 0 || res.Refunded != 0 || res.Failed != 1 {
		t.Fatalf("unexpected reconcile result: %+v", res)
	}

	var row model.FiveSimOrder
	if err := db.First(&row, "provider_order_id = ?", 995512).Error; err != nil {
		t.Fatalf("load order: %v", err)
	}
	if row.ProviderStatus != "PENDING" {
		t.Fatalf("expected order to stay PENDING, got %s", row.ProviderStatus)
	}
	if row.SyncFailCount != 1 {
		t.Fatalf("expected sync_fail_count=1, got %d", row.SyncFailCount)
	}
	if row.LastSyncErrorCode != fiveSimSyncErrOrderNotFound {
		t.Fatalf("expected error code ORDER_NOT_FOUND, got %s", row.LastSyncErrorCode)
	}
	if row.NextSyncAt == nil {
		t.Fatalf("expected next_sync_at to be set")
	}
	if row.ResolvedAt != nil {
		t.Fatalf("expected unresolved order")
	}

	var userAfter model.User
	if err := db.First(&userAfter, "id = ?", activeUser.ID).Error; err != nil {
		t.Fatalf("load user after reconcile: %v", err)
	}
	if userAfter.WalletBalance != 49_000 {
		t.Fatalf("wallet should remain deducted, got %d", userAfter.WalletBalance)
	}
}

func seedFiveSimOrderUnbilled(t *testing.T, db *gorm.DB, userID uuid.UUID, providerOrderID int64, status string, createdAt time.Time) {
	t.Helper()

	order := model.FiveSimOrder{
		ID:              uuid.New(),
		UserID:          userID,
		ProviderOrderID: providerOrderID,
		OrderType:       "activation",
		Phone:           "+628123000000",
		Country:         "indonesia",
		Operator:        "any",
		Product:         "telegram",
		ProviderPrice:   0.5,
		ProviderStatus:  status,
		CreatedAt:       createdAt,
		UpdatedAt:       createdAt,
	}
	if err := db.Create(&order).Error; err != nil {
		t.Fatalf("create seed unbilled order: %v", err)
	}
}

func seedFiveSimOrderWithCharge(t *testing.T, db *gorm.DB, userID uuid.UUID, providerOrderID int64, status string, amount int64, createdAt time.Time) {
	t.Helper()

	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		t.Fatalf("load user seed: %v", err)
	}

	before := user.WalletBalance
	after := before - amount
	user.WalletBalance = after
	if err := db.Save(&user).Error; err != nil {
		t.Fatalf("save user seed wallet: %v", err)
	}

	order := model.FiveSimOrder{
		ID:              uuid.New(),
		UserID:          userID,
		ProviderOrderID: providerOrderID,
		OrderType:       "activation",
		Phone:           "+628123000000",
		Country:         "indonesia",
		Operator:        "any",
		Product:         "telegram",
		ProviderPrice:   0.5,
		ProviderStatus:  status,
		CreatedAt:       createdAt,
		UpdatedAt:       createdAt,
	}
	if err := db.Create(&order).Error; err != nil {
		t.Fatalf("create seed order: %v", err)
	}

	ledger := model.WalletLedger{
		ID:            uuid.New(),
		UserID:        userID,
		Type:          "debit",
		Category:      "5sim_purchase",
		Amount:        amount,
		BalanceBefore: before,
		BalanceAfter:  after,
		Reference:     fmt.Sprintf("fivesim_order:%d:charge", providerOrderID),
		Description:   "seed charge ledger",
	}
	if err := db.Create(&ledger).Error; err != nil {
		t.Fatalf("create seed ledger: %v", err)
	}
}
