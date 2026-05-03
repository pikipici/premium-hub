package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSosmedBundleOrderServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.WalletLedger{},
		&model.SosmedService{},
		&model.SosmedBundlePackage{},
		&model.SosmedBundleVariant{},
		&model.SosmedBundleItem{},
		&model.SosmedBundleOrder{},
		&model.SosmedBundleOrderItem{},
	); err != nil {
		t.Fatalf("migrate bundle order service models: %v", err)
	}
	return db
}

func seedSosmedBundleOrderServiceGraph(t *testing.T, db *gorm.DB, walletBalance int64) (*model.User, *model.SosmedBundlePackage, *model.SosmedBundleVariant) {
	t.Helper()

	buyer := &model.User{
		Name:          "Bundle Buyer",
		Email:         fmt.Sprintf("bundle-buyer-%s@example.com", uuid.NewString()),
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: walletBalance,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	followers := &model.SosmedService{
		CategoryCode:      "followers",
		Code:              "jap-ig-followers-bundle",
		Title:             "Instagram Followers Bundle",
		CheckoutPrice:     7500,
		ProviderCode:      "jap",
		ProviderServiceID: "2989",
		ProviderRate:      "2500",
		MinOrder:          "Min 100 Max 10000",
		IsActive:          true,
	}
	likes := &model.SosmedService{
		CategoryCode:      "likes",
		Code:              "jap-ig-likes-bundle",
		Title:             "Instagram Likes Bundle",
		CheckoutPrice:     5000,
		ProviderCode:      "jap",
		ProviderServiceID: "8216",
		ProviderRate:      "1000",
		MinOrder:          "Min 50 Max 10000",
		IsActive:          true,
	}
	if err := db.Create(followers).Error; err != nil {
		t.Fatalf("create followers service: %v", err)
	}
	if err := db.Create(likes).Error; err != nil {
		t.Fatalf("create likes service: %v", err)
	}

	pkg := &model.SosmedBundlePackage{
		Key:           "instagram-umkm",
		Title:         "Instagram UMKM",
		Platform:      "instagram",
		Badge:         "Terlaris",
		IsHighlighted: true,
		IsActive:      true,
		SortOrder:     10,
	}
	if err := db.Create(pkg).Error; err != nil {
		t.Fatalf("create package: %v", err)
	}
	variant := &model.SosmedBundleVariant{
		BundlePackageID: pkg.ID,
		Key:             "starter",
		Name:            "Starter",
		PriceMode:       SosmedBundlePriceModeComputedWithDiscount,
		DiscountAmount:  500,
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(variant).Error; err != nil {
		t.Fatalf("create variant: %v", err)
	}
	items := []model.SosmedBundleItem{
		{
			BundleVariantID: variant.ID,
			SosmedServiceID: followers.ID,
			Label:           "Followers",
			QuantityUnits:   500,
			TargetStrategy:  "same_target",
			IsActive:        true,
			SortOrder:       10,
		},
		{
			BundleVariantID: variant.ID,
			SosmedServiceID: likes.ID,
			Label:           "Likes",
			QuantityUnits:   100,
			TargetStrategy:  "same_target",
			IsActive:        true,
			SortOrder:       20,
		},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("create bundle items: %v", err)
	}
	return buyer, pkg, variant
}

func newSosmedBundleOrderServiceForTest(db *gorm.DB) *SosmedBundleOrderService {
	return NewSosmedBundleOrderService(
		repository.NewSosmedBundleRepo(db),
		repository.NewSosmedBundleOrderRepo(db),
		repository.NewWalletRepo(db),
	)
}

type fakeSosmedBundleJAPOrderProvider struct {
	inputs    []JAPAddOrderInput
	responses []string
	errors    []error
}

func (f *fakeSosmedBundleJAPOrderProvider) GetBalance(context.Context) (*JAPBalanceResponse, error) {
	return nil, nil
}

func (f *fakeSosmedBundleJAPOrderProvider) GetServices(context.Context) ([]JAPServiceItem, error) {
	return nil, nil
}

func (f *fakeSosmedBundleJAPOrderProvider) AddOrder(_ context.Context, input JAPAddOrderInput) (*JAPAddOrderResponse, error) {
	f.inputs = append(f.inputs, input)
	idx := len(f.inputs) - 1
	if idx < len(f.errors) && f.errors[idx] != nil {
		return nil, f.errors[idx]
	}
	if idx < len(f.responses) && strings.TrimSpace(f.responses[idx]) != "" {
		return &JAPAddOrderResponse{Order: JAPServiceID(f.responses[idx])}, nil
	}
	return &JAPAddOrderResponse{Order: JAPServiceID(fmt.Sprintf("BUNDLE-%d", idx+1))}, nil
}

func (f *fakeSosmedBundleJAPOrderProvider) GetOrderStatus(context.Context, string) (*JAPOrderStatusResponse, error) {
	return nil, nil
}

func (f *fakeSosmedBundleJAPOrderProvider) RequestRefill(context.Context, string) (*JAPRefillResponse, error) {
	return nil, nil
}

func (f *fakeSosmedBundleJAPOrderProvider) GetRefillStatus(context.Context, string) (*JAPRefillStatusResponse, error) {
	return nil, nil
}

func TestSosmedBundleOrderServiceCreateDebitsWalletAndCreatesParentWithItems(t *testing.T) {
	db := setupSosmedBundleOrderServiceTestDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderServiceGraph(t, db, 10000)
	svc := newSosmedBundleOrderServiceForTest(db)

	idempotencyKey := uuid.NewString()
	order, err := svc.Create(context.Background(), buyer.ID, CreateSosmedBundleOrderInput{
		BundleKey:             pkg.Key,
		VariantKey:            variant.Key,
		TargetLink:            " https://instagram.com/example ",
		Notes:                 "boost pelan",
		PaymentMethod:         "wallet",
		IdempotencyKey:        idempotencyKey,
		TargetPublicConfirmed: true,
	})
	if err != nil {
		t.Fatalf("create bundle order: %v", err)
	}
	if order.OrderNumber == "" || !strings.HasPrefix(order.OrderNumber, "SB-") {
		t.Fatalf("expected generated SB order number, got %q", order.OrderNumber)
	}
	if order.UserID != buyer.ID || order.BundlePackageID != pkg.ID || order.BundleVariantID != variant.ID {
		t.Fatalf("unexpected order ownership/package snapshots: %+v", order)
	}
	if order.PackageKeySnapshot != "instagram-umkm" || order.VariantKeySnapshot != "starter" || order.TitleSnapshot != "Instagram UMKM - Starter" {
		t.Fatalf("unexpected order snapshots: %+v", order)
	}
	if order.TargetLink != "https://instagram.com/example" || order.Notes != "boost pelan" {
		t.Fatalf("expected normalized target and notes, got target=%q notes=%q", order.TargetLink, order.Notes)
	}
	if order.SubtotalPrice != 4250 || order.DiscountAmount != 500 || order.TotalPrice != 3750 {
		t.Fatalf("unexpected price snapshot subtotal=%d discount=%d total=%d", order.SubtotalPrice, order.DiscountAmount, order.TotalPrice)
	}
	if order.CostPriceSnapshot != 1350 || order.MarginSnapshot != 2400 {
		t.Fatalf("unexpected cost/margin snapshot cost=%d margin=%d", order.CostPriceSnapshot, order.MarginSnapshot)
	}
	if order.Status != "processing" || order.PaymentMethod != "wallet" || order.PaidAt == nil {
		t.Fatalf("expected wallet-paid processing order, got status=%q method=%q paidAt=%v", order.Status, order.PaymentMethod, order.PaidAt)
	}
	if len(order.Items) != 2 {
		t.Fatalf("expected two child items, got %d", len(order.Items))
	}
	if order.Items[0].ServiceCodeSnapshot != "jap-ig-followers-bundle" || order.Items[0].QuantityUnits != 500 || order.Items[0].LinePrice != 3750 || order.Items[0].Status != "queued" {
		t.Fatalf("unexpected first child item: %+v", order.Items[0])
	}
	if order.Items[1].ServiceCodeSnapshot != "jap-ig-likes-bundle" || order.Items[1].QuantityUnits != 100 || order.Items[1].LinePrice != 500 || order.Items[1].Status != "queued" {
		t.Fatalf("unexpected second child item: %+v", order.Items[1])
	}

	var storedBuyer model.User
	if err := db.First(&storedBuyer, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("reload buyer: %v", err)
	}
	if storedBuyer.WalletBalance != 6250 {
		t.Fatalf("expected wallet balance 6250 after debit, got %d", storedBuyer.WalletBalance)
	}
	var ledger model.WalletLedger
	if err := db.First(&ledger, "user_id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load wallet ledger: %v", err)
	}
	if ledger.Type != "debit" || ledger.Category != "sosmed_bundle_purchase" || ledger.Amount != 3750 || ledger.BalanceBefore != 10000 || ledger.BalanceAfter != 6250 {
		t.Fatalf("unexpected ledger row: %+v", ledger)
	}
	if !strings.Contains(ledger.Reference, order.ID.String()) || !strings.Contains(ledger.Reference, "sosmed_bundle_order") {
		t.Fatalf("expected bundle order ledger reference to include order ID, got %q", ledger.Reference)
	}

	duplicate, err := svc.Create(context.Background(), buyer.ID, CreateSosmedBundleOrderInput{
		BundleKey:             pkg.Key,
		VariantKey:            variant.Key,
		TargetLink:            "https://instagram.com/example",
		PaymentMethod:         "wallet",
		IdempotencyKey:        idempotencyKey,
		TargetPublicConfirmed: true,
	})
	if err != nil {
		t.Fatalf("repeat idempotent create: %v", err)
	}
	if duplicate.ID != order.ID || duplicate.OrderNumber != order.OrderNumber {
		t.Fatalf("expected idempotent duplicate to return original order, got original=%s duplicate=%s", order.ID, duplicate.ID)
	}
	var ledgerCount int64
	if err := db.Model(&model.WalletLedger{}).Where("user_id = ?", buyer.ID).Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count wallet ledgers: %v", err)
	}
	if ledgerCount != 1 {
		t.Fatalf("expected one wallet debit after idempotent retry, got %d", ledgerCount)
	}
}

func TestSosmedBundleOrderServiceCreateSubmitsBundleItemsWithExactQuantityUnits(t *testing.T) {
	db := setupSosmedBundleOrderServiceTestDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderServiceGraph(t, db, 10000)
	fakeJAP := &fakeSosmedBundleJAPOrderProvider{responses: []string{"JAP-500", "JAP-100"}}
	svc := newSosmedBundleOrderServiceForTest(db).SetJAPOrderProvider(fakeJAP)

	order, err := svc.Create(context.Background(), buyer.ID, CreateSosmedBundleOrderInput{
		BundleKey:             pkg.Key,
		VariantKey:            variant.Key,
		TargetLink:            "https://instagram.com/example",
		PaymentMethod:         "wallet",
		IdempotencyKey:        uuid.NewString(),
		TargetPublicConfirmed: true,
	})
	if err != nil {
		t.Fatalf("create bundle order with provider submit: %v", err)
	}
	if len(fakeJAP.inputs) != 2 {
		t.Fatalf("expected two provider submissions, got %d", len(fakeJAP.inputs))
	}
	if fakeJAP.inputs[0].ServiceID != "2989" || fakeJAP.inputs[0].Link != "https://instagram.com/example" || fakeJAP.inputs[0].Quantity != 500 {
		t.Fatalf("unexpected first provider input: %+v", fakeJAP.inputs[0])
	}
	if fakeJAP.inputs[1].ServiceID != "8216" || fakeJAP.inputs[1].Link != "https://instagram.com/example" || fakeJAP.inputs[1].Quantity != 100 {
		t.Fatalf("unexpected second provider input: %+v", fakeJAP.inputs[1])
	}
	if order.Status != SosmedBundleOrderStatusProcessing {
		t.Fatalf("expected parent processing after all submissions, got %q", order.Status)
	}
	if len(order.Items) != 2 {
		t.Fatalf("expected two order items, got %d", len(order.Items))
	}
	if order.Items[0].Status != "submitted" || order.Items[0].ProviderOrderID != "JAP-500" || order.Items[0].ProviderStatus != "submitted" || order.Items[0].SubmittedAt == nil {
		t.Fatalf("unexpected first submitted item: %+v", order.Items[0])
	}
	if order.Items[1].Status != "submitted" || order.Items[1].ProviderOrderID != "JAP-100" || order.Items[1].ProviderStatus != "submitted" || order.Items[1].SubmittedAt == nil {
		t.Fatalf("unexpected second submitted item: %+v", order.Items[1])
	}
}

func TestSosmedBundleOrderServiceCreateMarksPartialWhenOneProviderSubmissionFails(t *testing.T) {
	db := setupSosmedBundleOrderServiceTestDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderServiceGraph(t, db, 10000)
	fakeJAP := &fakeSosmedBundleJAPOrderProvider{
		responses: []string{"JAP-500"},
		errors:    []error{nil, errors.New("provider timeout")},
	}
	svc := newSosmedBundleOrderServiceForTest(db).SetJAPOrderProvider(fakeJAP)

	order, err := svc.Create(context.Background(), buyer.ID, CreateSosmedBundleOrderInput{
		BundleKey:             pkg.Key,
		VariantKey:            variant.Key,
		TargetLink:            "https://instagram.com/example",
		PaymentMethod:         "wallet",
		IdempotencyKey:        uuid.NewString(),
		TargetPublicConfirmed: true,
	})
	if err != nil {
		t.Fatalf("partial provider failure should keep created bundle order, got error: %v", err)
	}
	if len(fakeJAP.inputs) != 2 {
		t.Fatalf("expected two provider attempts, got %d", len(fakeJAP.inputs))
	}
	if order.Status != "partial" {
		t.Fatalf("expected parent partial, got %q", order.Status)
	}
	if order.FailureReason == "" || !strings.Contains(order.FailureReason, "provider timeout") {
		t.Fatalf("expected parent failure reason to include provider error, got %q", order.FailureReason)
	}
	if order.Items[0].Status != "submitted" || order.Items[0].ProviderOrderID != "JAP-500" {
		t.Fatalf("expected first item submitted, got %+v", order.Items[0])
	}
	if order.Items[1].Status != "failed" || !strings.Contains(order.Items[1].ProviderError, "provider timeout") {
		t.Fatalf("expected second item failed with provider error, got %+v", order.Items[1])
	}

	var storedBuyer model.User
	if err := db.First(&storedBuyer, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("reload buyer: %v", err)
	}
	if storedBuyer.WalletBalance != 6250 {
		t.Fatalf("partial provider failure should not auto-refund in v1, balance=%d", storedBuyer.WalletBalance)
	}
}

func TestSosmedBundleOrderServiceCreateMarksFailedWhenAllProviderSubmissionsFail(t *testing.T) {
	db := setupSosmedBundleOrderServiceTestDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderServiceGraph(t, db, 10000)
	fakeJAP := &fakeSosmedBundleJAPOrderProvider{
		errors: []error{errors.New("provider down"), errors.New("provider down")},
	}
	svc := newSosmedBundleOrderServiceForTest(db).SetJAPOrderProvider(fakeJAP)

	order, err := svc.Create(context.Background(), buyer.ID, CreateSosmedBundleOrderInput{
		BundleKey:             pkg.Key,
		VariantKey:            variant.Key,
		TargetLink:            "https://instagram.com/example",
		PaymentMethod:         "wallet",
		IdempotencyKey:        uuid.NewString(),
		TargetPublicConfirmed: true,
	})
	if err != nil {
		t.Fatalf("all provider failure should keep failed bundle order, got error: %v", err)
	}
	if order.Status != SosmedBundleOrderStatusFailed {
		t.Fatalf("expected parent failed, got %q", order.Status)
	}
	if len(order.Items) != 2 {
		t.Fatalf("expected two order items, got %d", len(order.Items))
	}
	for _, item := range order.Items {
		if item.Status != SosmedBundleOrderItemStatusFailed || !strings.Contains(item.ProviderError, "provider down") {
			t.Fatalf("expected failed provider item, got %+v", item)
		}
	}
}

func TestSosmedBundleOrderServiceCreateRejectsInsufficientWalletWithoutSideEffects(t *testing.T) {
	db := setupSosmedBundleOrderServiceTestDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderServiceGraph(t, db, 1000)
	svc := newSosmedBundleOrderServiceForTest(db)

	_, err := svc.Create(context.Background(), buyer.ID, CreateSosmedBundleOrderInput{
		BundleKey:             pkg.Key,
		VariantKey:            variant.Key,
		TargetLink:            "https://instagram.com/example",
		PaymentMethod:         "wallet",
		IdempotencyKey:        uuid.NewString(),
		TargetPublicConfirmed: true,
	})
	if err == nil || !strings.Contains(err.Error(), "saldo wallet tidak cukup") {
		t.Fatalf("expected insufficient wallet error, got %v", err)
	}
	assertNoBundleOrderSideEffects(t, db, buyer.ID, 1000)
}

func TestSosmedBundleOrderServiceCreateValidatesTargetBeforeWalletDebit(t *testing.T) {
	db := setupSosmedBundleOrderServiceTestDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderServiceGraph(t, db, 10000)
	svc := newSosmedBundleOrderServiceForTest(db)

	_, err := svc.Create(context.Background(), buyer.ID, CreateSosmedBundleOrderInput{
		BundleKey:             pkg.Key,
		VariantKey:            variant.Key,
		TargetLink:            "https://instagram.com/example",
		PaymentMethod:         "wallet",
		TargetPublicConfirmed: false,
	})
	if err == nil || !strings.Contains(err.Error(), "konfirmasi") {
		t.Fatalf("expected target confirmation error, got %v", err)
	}
	assertNoBundleOrderSideEffects(t, db, buyer.ID, 10000)
}

func assertNoBundleOrderSideEffects(t *testing.T, db *gorm.DB, userID uuid.UUID, wantBalance int64) {
	t.Helper()
	var buyer model.User
	if err := db.First(&buyer, "id = ?", userID).Error; err != nil {
		t.Fatalf("reload buyer: %v", err)
	}
	if buyer.WalletBalance != wantBalance {
		t.Fatalf("expected wallet balance unchanged at %d, got %d", wantBalance, buyer.WalletBalance)
	}
	var orderCount int64
	if err := db.Model(&model.SosmedBundleOrder{}).Where("user_id = ?", userID).Count(&orderCount).Error; err != nil {
		t.Fatalf("count bundle orders: %v", err)
	}
	if orderCount != 0 {
		t.Fatalf("expected no bundle orders, got %d", orderCount)
	}
	var ledgerCount int64
	if err := db.Model(&model.WalletLedger{}).Where("user_id = ?", userID).Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count wallet ledgers: %v", err)
	}
	if ledgerCount != 0 {
		t.Fatalf("expected no wallet ledgers, got %d", ledgerCount)
	}
}
