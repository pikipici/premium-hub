package service

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type fakeSosmedJAPOrderProvider struct {
	mu                 sync.Mutex
	inputs             []JAPAddOrderInput
	res                *JAPAddOrderResponse
	err                error
	statusInputs       []string
	statusRes          *JAPOrderStatusResponse
	statusErr          error
	statusByOrderID    map[string]*JAPOrderStatusResponse
	statusErrByOrderID map[string]error
	refillInputs       []string
	refillRes          *JAPRefillResponse
	refillErr          error
	refillStarted      chan struct{}
	refillRelease      chan struct{}
	refillStatusInputs []string
	refillStatusRes    *JAPRefillStatusResponse
	refillStatusErr    error
	cancelInputs       []string
	cancelRes          *JAPCancelOrderResponse
	cancelErr          error
}

func (f *fakeSosmedJAPOrderProvider) AddOrder(_ context.Context, input JAPAddOrderInput) (*JAPAddOrderResponse, error) {
	f.inputs = append(f.inputs, input)
	if f.err != nil {
		return nil, f.err
	}
	if f.res != nil {
		return f.res, nil
	}
	return &JAPAddOrderResponse{Order: "991122"}, nil
}

func (f *fakeSosmedJAPOrderProvider) GetOrderStatus(_ context.Context, orderID string) (*JAPOrderStatusResponse, error) {
	f.statusInputs = append(f.statusInputs, orderID)
	if f.statusErrByOrderID != nil {
		if err := f.statusErrByOrderID[orderID]; err != nil {
			return nil, err
		}
	}
	if f.statusErr != nil {
		return nil, f.statusErr
	}
	if f.statusByOrderID != nil {
		if res := f.statusByOrderID[orderID]; res != nil {
			return res, nil
		}
	}
	if f.statusRes != nil {
		return f.statusRes, nil
	}
	return &JAPOrderStatusResponse{Status: "In Progress"}, nil
}

func (f *fakeSosmedJAPOrderProvider) RequestRefill(_ context.Context, orderID string) (*JAPRefillResponse, error) {
	f.mu.Lock()
	f.refillInputs = append(f.refillInputs, orderID)
	started := f.refillStarted
	f.refillStarted = nil
	release := f.refillRelease
	res := f.refillRes
	err := f.refillErr
	f.mu.Unlock()

	if started != nil {
		close(started)
	}
	if release != nil {
		<-release
	}
	if err != nil {
		return nil, err
	}
	if res != nil {
		return res, nil
	}
	return &JAPRefillResponse{Refill: "REFILL-1001"}, nil
}

func (f *fakeSosmedJAPOrderProvider) GetRefillStatus(_ context.Context, refillID string) (*JAPRefillStatusResponse, error) {
	f.mu.Lock()
	f.refillStatusInputs = append(f.refillStatusInputs, refillID)
	res := f.refillStatusRes
	err := f.refillStatusErr
	f.mu.Unlock()

	if err != nil {
		return nil, err
	}
	if res != nil {
		return res, nil
	}
	return &JAPRefillStatusResponse{Status: "Processing"}, nil
}

func (f *fakeSosmedJAPOrderProvider) CancelOrder(_ context.Context, orderID string) (*JAPCancelOrderResponse, error) {
	f.mu.Lock()
	f.cancelInputs = append(f.cancelInputs, orderID)
	res := f.cancelRes
	err := f.cancelErr
	f.mu.Unlock()

	if err != nil {
		return nil, err
	}
	if res != nil {
		return res, nil
	}
	return &JAPCancelOrderResponse{Order: JAPFlexibleValue(orderID), Cancel: JAPCancelResult{Accepted: true}}, nil
}

func TestSosmedOrderService_CancelJAPProcessingOrderRequestsProviderAndRefundsOnCanceledStatus(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.ProductCategory{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.Notification{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate sosmed cancel models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer Cancel",
		Email:         "buyer-cancel@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 0,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	svcRow := &model.SosmedService{
		ID:                      uuid.New(),
		CategoryCode:            "followers",
		Code:                    "jap-cancel-1",
		Title:                   "JAP Cancelable",
		ProviderCode:            "jap",
		ProviderServiceID:       "6331",
		ProviderCancelSupported: true,
		CheckoutPrice:           12000,
		IsActive:                true,
	}
	if err := db.Create(svcRow).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         svcRow.ID,
		ServiceCode:       svcRow.Code,
		ServiceTitle:      svcRow.Title,
		TargetLink:        "https://instagram.com/example",
		Quantity:          1,
		UnitPrice:         12000,
		TotalPrice:        12000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "991122",
		ProviderStatus:    "In Progress",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	if err := db.Create(&model.WalletLedger{
		ID:            uuid.New(),
		UserID:        buyer.ID,
		Type:          "debit",
		Category:      "sosmed_purchase",
		Amount:        12000,
		BalanceBefore: 12000,
		BalanceAfter:  0,
		Reference:     sosmedOrderWalletChargeRef(order.ID),
		Description:   "charge sosmed test",
	}).Error; err != nil {
		t.Fatalf("create charge ledger: %v", err)
	}

	provider := &fakeSosmedJAPOrderProvider{
		cancelRes: &JAPCancelOrderResponse{Order: JAPFlexibleValue("991122"), Cancel: JAPCancelResult{Accepted: true}},
		statusRes: &JAPOrderStatusResponse{Status: "Canceled"},
	}
	svc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), repository.NewNotificationRepo(db)).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(provider)

	detail, err := svc.Cancel(context.Background(), order.ID, buyer.ID)
	if err != nil {
		t.Fatalf("cancel jap order: %v", err)
	}
	if len(provider.cancelInputs) != 1 || provider.cancelInputs[0] != "991122" {
		t.Fatalf("expected one provider cancel for 991122, got %#v", provider.cancelInputs)
	}
	if detail.Order.OrderStatus != sosmedOrderStatusCanceled {
		t.Fatalf("expected local order canceled after provider status Canceled, got %q", detail.Order.OrderStatus)
	}
	if detail.Order.PaymentStatus != "failed" {
		t.Fatalf("expected payment failed after wallet refund, got %q", detail.Order.PaymentStatus)
	}
	if detail.Order.ProviderCancelStatus != "completed" {
		t.Fatalf("expected provider cancel completed, got %q", detail.Order.ProviderCancelStatus)
	}

	var storedBuyer model.User
	if err := db.First(&storedBuyer, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load buyer: %v", err)
	}
	if storedBuyer.WalletBalance != 12000 {
		t.Fatalf("expected wallet refunded to 12000, got %d", storedBuyer.WalletBalance)
	}
	var refundCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", sosmedOrderWalletRefundRef(order.ID)).Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledger: %v", err)
	}
	if refundCount != 1 {
		t.Fatalf("expected one refund ledger, got %d", refundCount)
	}

	if _, err := svc.Cancel(context.Background(), order.ID, buyer.ID); err == nil {
		t.Fatalf("expected duplicate cancel to be blocked")
	}
	if len(provider.cancelInputs) != 1 {
		t.Fatalf("expected duplicate cancel not to hit provider, got %#v", provider.cancelInputs)
	}
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", sosmedOrderWalletRefundRef(order.ID)).Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledger after duplicate: %v", err)
	}
	if refundCount != 1 {
		t.Fatalf("expected one refund ledger after duplicate, got %d", refundCount)
	}
}

func TestSosmedOrderService_CancelJAPProcessingOrderBlocksUnsupportedServiceBeforeProvider(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.ProductCategory{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.Notification{},
	); err != nil {
		t.Fatalf("migrate sosmed cancel unsupported models: %v", err)
	}

	buyer := &model.User{ID: uuid.New(), Name: "Buyer Cancel Unsupported", Email: "buyer-cancel-unsupported@example.com", Password: "hashed", Role: "user", IsActive: true}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}
	svcRow := &model.SosmedService{
		ID:                      uuid.New(),
		CategoryCode:            "followers",
		Code:                    "jap-no-cancel",
		Title:                   "JAP No Cancel",
		ProviderCode:            "jap",
		ProviderServiceID:       "6332",
		ProviderCancelSupported: false,
		CheckoutPrice:           12000,
		IsActive:                true,
	}
	if err := db.Create(svcRow).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}
	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         svcRow.ID,
		ServiceCode:       svcRow.Code,
		ServiceTitle:      svcRow.Title,
		TargetLink:        "https://instagram.com/example",
		Quantity:          1,
		UnitPrice:         12000,
		TotalPrice:        12000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      "jap",
		ProviderServiceID: "6332",
		ProviderOrderID:   "991123",
		ProviderStatus:    "In Progress",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	provider := &fakeSosmedJAPOrderProvider{}
	svc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), repository.NewNotificationRepo(db)).
		SetJAPOrderProvider(provider)

	_, err := svc.Cancel(context.Background(), order.ID, buyer.ID)
	if err == nil {
		t.Fatalf("expected unsupported cancel error")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "support cancel") {
		t.Fatalf("expected support cancel error, got %q", err.Error())
	}
	if len(provider.cancelInputs) != 0 {
		t.Fatalf("expected provider not called, got %#v", provider.cancelInputs)
	}
}

func TestSosmedOrderService_CreateAndConfirm(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.ProductCategory{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.Notification{},
	); err != nil {
		t.Fatalf("migrate sosmed order models: %v", err)
	}

	buyer := &model.User{
		ID:       uuid.New(),
		Name:     "Buyer Sosmed",
		Email:    "buyer-sosmed@example.com",
		Password: "hashed",
		Role:     "user",
		IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	admin := &model.User{
		ID:       uuid.New(),
		Name:     "Admin Sosmed",
		Email:    "admin-sosmed@example.com",
		Password: "hashed",
		Role:     "admin",
		IsActive: true,
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	categorySvc := NewProductCategoryService(categoryRepo)
	if _, err := categorySvc.Create(CreateProductCategoryInput{
		Scope:       model.ProductCategoryScopeSosmed,
		Code:        "followers",
		Label:       "Followers",
		Description: "Followers package",
		SortOrder:   intPtr(10),
		IsActive:    boolPtr(true),
	}); err != nil && !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("seed sosmed category: %v", err)
	}

	sosmedServiceRepo := repository.NewSosmedServiceRepo(db)
	sosmedSvc := NewSosmedServiceService(sosmedServiceRepo, categoryRepo)
	createdService, err := sosmedSvc.Create(CreateSosmedServiceInput{
		CategoryCode:  "followers",
		Code:          "ig-followers-id",
		Title:         "IG Followers Indonesia Aktif",
		PriceStart:    "Rp 28.000",
		PricePer1K:    "≈ Rp 28 / 1K",
		CheckoutPrice: 28000,
		SortOrder:     intPtr(10),
	})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	orderRepo := repository.NewSosmedOrderRepo(db)
	notifRepo := repository.NewNotificationRepo(db)
	orderSvc := NewSosmedOrderService(orderRepo, sosmedServiceRepo, notifRepo)

	_, err = orderSvc.Create(context.Background(), buyer.ID, CreateSosmedOrderInput{
		ServiceID:  createdService.ID.String(),
		TargetLink: "https://instagram.com/example",
		Quantity:   1,
	})
	if err == nil || !strings.Contains(err.Error(), "konfirmasi dulu") {
		t.Fatalf("expected target public confirmation error, got: %v", err)
	}

	detail, err := orderSvc.Create(context.Background(), buyer.ID, CreateSosmedOrderInput{
		ServiceID:             createdService.ID.String(),
		TargetLink:            "https://instagram.com/example",
		Quantity:              2,
		Notes:                 "Campaign launch",
		TargetPublicConfirmed: true,
	})
	if err != nil {
		t.Fatalf("create sosmed order: %v", err)
	}

	if detail.Order.OrderStatus != sosmedOrderStatusPendingPayment {
		t.Fatalf("expected pending payment status, got %s", detail.Order.OrderStatus)
	}
	if detail.Order.TotalPrice != 56000 {
		t.Fatalf("expected total price 56000, got %d", detail.Order.TotalPrice)
	}

	if err := orderSvc.ConfirmPayment(detail.Order.ID); err != nil {
		t.Fatalf("confirm payment: %v", err)
	}

	stored, err := orderSvc.GetByID(detail.Order.ID, buyer.ID)
	if err != nil {
		t.Fatalf("get order by id: %v", err)
	}
	if stored.Order.PaymentStatus != "paid" {
		t.Fatalf("expected paid payment status, got %s", stored.Order.PaymentStatus)
	}
	if stored.Order.OrderStatus != sosmedOrderStatusProcessing {
		t.Fatalf("expected processing order status, got %s", stored.Order.OrderStatus)
	}
	if len(stored.Events) < 2 {
		t.Fatalf("expected >= 2 order events, got %d", len(stored.Events))
	}

	updated, err := orderSvc.AdminUpdateStatus(stored.Order.ID, admin.ID, AdminUpdateSosmedOrderStatusInput{
		ToStatus: sosmedOrderStatusSuccess,
		Reason:   "Fulfillment selesai",
	})
	if err != nil {
		t.Fatalf("admin update status: %v", err)
	}
	if updated.Order.OrderStatus != sosmedOrderStatusSuccess {
		t.Fatalf("expected success order status, got %s", updated.Order.OrderStatus)
	}
}

func TestSosmedOrderService_CancelValidation(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.ProductCategory{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
	); err != nil {
		t.Fatalf("migrate sosmed order models: %v", err)
	}

	buyer := &model.User{ID: uuid.New(), Name: "Buyer 2", Email: "buyer2@example.com", Password: "hashed", Role: "user", IsActive: true}
	other := &model.User{ID: uuid.New(), Name: "Other", Email: "other@example.com", Password: "hashed", Role: "user", IsActive: true}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}
	if err := db.Create(other).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	categorySvc := NewProductCategoryService(categoryRepo)
	if _, err := categorySvc.Create(CreateProductCategoryInput{Scope: model.ProductCategoryScopeSosmed, Code: "likes", Label: "Likes"}); err != nil && !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("seed category: %v", err)
	}

	sosmedServiceRepo := repository.NewSosmedServiceRepo(db)
	sosmedSvc := NewSosmedServiceService(sosmedServiceRepo, categoryRepo)
	serviceItem, err := sosmedSvc.Create(CreateSosmedServiceInput{CategoryCode: "likes", Code: "ig-likes-premium", Title: "IG Likes Premium", CheckoutPrice: 16000})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), sosmedServiceRepo, nil)
	created, err := orderSvc.Create(context.Background(), buyer.ID, CreateSosmedOrderInput{
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/example",
		TargetPublicConfirmed: true,
	})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}

	if _, err := orderSvc.Cancel(context.Background(), created.Order.ID, other.ID); err == nil || !strings.Contains(err.Error(), "akses ditolak") {
		t.Fatalf("expected access denied when other user cancel order, got: %v", err)
	}

	if _, err := orderSvc.Cancel(context.Background(), created.Order.ID, buyer.ID); err != nil {
		t.Fatalf("cancel order: %v", err)
	}

	stored, err := orderSvc.GetByID(created.Order.ID, buyer.ID)
	if err != nil {
		t.Fatalf("get order after cancel: %v", err)
	}
	if stored.Order.OrderStatus != sosmedOrderStatusCanceled {
		t.Fatalf("expected canceled status, got %s", stored.Order.OrderStatus)
	}
}

func TestSosmedOrderService_CreateWalletPaidJAPOrder(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
		&model.Notification{},
	); err != nil {
		t.Fatalf("migrate wallet sosmed models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer Wallet Sosmed",
		Email:         "buyer-wallet-sosmed@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 100000,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{res: &JAPAddOrderResponse{Order: "JAP-7788"}}
	orderRepo := repository.NewSosmedOrderRepo(db)
	orderSvc := NewSosmedOrderService(orderRepo, repository.NewSosmedServiceRepo(db), repository.NewNotificationRepo(db)).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	detail, err := orderSvc.Create(context.Background(), buyer.ID, CreateSosmedOrderInput{
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/example",
		Quantity:              5,
		TargetPublicConfirmed: true,
		IdempotencyKey:        "idem-wallet-paid-jap-order",
	})
	if err != nil {
		t.Fatalf("create wallet paid JAP order: %v", err)
	}

	if detail.Order.PaymentMethod != "wallet" || detail.Order.PaymentStatus != "paid" || detail.Order.OrderStatus != sosmedOrderStatusProcessing {
		t.Fatalf("unexpected paid order state: %+v", detail.Order)
	}
	if detail.Order.TotalPrice != 95000 {
		t.Fatalf("expected total price 95000, got %d", detail.Order.TotalPrice)
	}
	if detail.Order.ProviderOrderID != "JAP-7788" || detail.Order.ProviderStatus != "submitted" {
		t.Fatalf("provider order not stored: %+v", detail.Order)
	}
	if len(fakeJAP.inputs) != 1 {
		t.Fatalf("expected 1 JAP add call, got %d", len(fakeJAP.inputs))
	}
	if fakeJAP.inputs[0].ServiceID != "6331" || fakeJAP.inputs[0].Quantity != 5000 {
		t.Fatalf("unexpected JAP input: %+v", fakeJAP.inputs[0])
	}

	var userAfter model.User
	if err := db.First(&userAfter, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load user after order: %v", err)
	}
	if userAfter.WalletBalance != 5000 {
		t.Fatalf("expected wallet balance 5000, got %d", userAfter.WalletBalance)
	}

	var chargeCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("reference = ?", sosmedOrderWalletChargeRef(detail.Order.ID)).
		Count(&chargeCount).Error; err != nil {
		t.Fatalf("count wallet charge: %v", err)
	}
	if chargeCount != 1 {
		t.Fatalf("expected 1 charge ledger, got %d", chargeCount)
	}
}

func TestSosmedOrderService_CreateWalletOrderIdempotencyReturnsExistingOrder(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
		&model.Notification{},
	); err != nil {
		t.Fatalf("migrate wallet sosmed models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer Wallet Idempotent Sosmed",
		Email:         "buyer-wallet-idempotent-sosmed@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 100000,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{res: &JAPAddOrderResponse{Order: "JAP-IDEM-1001"}}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), repository.NewNotificationRepo(db)).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	input := CreateSosmedOrderInput{
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/idempotent-example",
		Quantity:              2,
		Notes:                 "first submit may timeout",
		TargetPublicConfirmed: true,
		IdempotencyKey:        "idem-sosmed-wallet-001",
	}

	first, err := orderSvc.Create(context.Background(), buyer.ID, input)
	if err != nil {
		t.Fatalf("first create wallet sosmed: %v", err)
	}
	second, err := orderSvc.Create(context.Background(), buyer.ID, input)
	if err != nil {
		t.Fatalf("second idempotent create wallet sosmed: %v", err)
	}

	if first.Order.ID != second.Order.ID {
		t.Fatalf("expected replay to return same order id, got %s then %s", first.Order.ID, second.Order.ID)
	}
	if len(fakeJAP.inputs) != 1 {
		t.Fatalf("expected one JAP add call, got %d", len(fakeJAP.inputs))
	}

	var userAfter model.User
	if err := db.First(&userAfter, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load user after replay: %v", err)
	}
	if userAfter.WalletBalance != 62000 {
		t.Fatalf("wallet should be debited once to 62000, got %d", userAfter.WalletBalance)
	}

	var purchaseLedgerCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("user_id = ? AND category = ? AND type = ?", buyer.ID, "sosmed_purchase", "debit").
		Count(&purchaseLedgerCount).Error; err != nil {
		t.Fatalf("count purchase ledgers: %v", err)
	}
	if purchaseLedgerCount != 1 {
		t.Fatalf("expected one wallet purchase ledger, got %d", purchaseLedgerCount)
	}
}

func TestSosmedOrderService_CreateWalletOrderIdempotencyRejectsInvalidKeyBeforeSideEffects(t *testing.T) {
	cases := []struct {
		name      string
		key       string
		wantError string
	}{
		{
			name:      "missing key",
			key:       "",
			wantError: "idempotency_key wajib diisi",
		},
		{
			name:      "overlong key",
			key:       strings.Repeat("x", maxSosmedOrderIdempotencyKeyLen+1),
			wantError: "idempotency_key maksimal 80 karakter",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := setupCoreDB(t)
			if err := db.AutoMigrate(
				&model.User{},
				&model.SosmedService{},
				&model.SosmedOrder{},
				&model.SosmedOrderEvent{},
				&model.SosmedOrderRefillAttempt{},
				&model.WalletLedger{},
			); err != nil {
				t.Fatalf("migrate wallet sosmed models: %v", err)
			}

			buyer := &model.User{
				ID:            uuid.New(),
				Name:          "Buyer Invalid Idempotency Sosmed",
				Email:         "buyer-invalid-idempotency-sosmed@example.com",
				Password:      "hashed",
				Role:          "user",
				IsActive:      true,
				WalletBalance: 100000,
			}
			if err := db.Create(buyer).Error; err != nil {
				t.Fatalf("create buyer: %v", err)
			}

			serviceItem := &model.SosmedService{
				ID:                uuid.New(),
				CategoryCode:      "followers",
				Code:              "jap-6331",
				Title:             "Instagram Followers Hemat",
				ProviderCode:      "jap",
				ProviderServiceID: "6331",
				CheckoutPrice:     19000,
				IsActive:          true,
			}
			if err := db.Create(serviceItem).Error; err != nil {
				t.Fatalf("create service: %v", err)
			}

			fakeJAP := &fakeSosmedJAPOrderProvider{res: &JAPAddOrderResponse{Order: "JAP-INVALID-IDEM"}}
			orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
				SetWalletRepo(repository.NewWalletRepo(db)).
				SetJAPOrderProvider(fakeJAP)

			_, err := orderSvc.Create(context.Background(), buyer.ID, CreateSosmedOrderInput{
				ServiceID:             serviceItem.ID.String(),
				TargetLink:            "https://instagram.com/invalid-idempotency",
				Quantity:              1,
				TargetPublicConfirmed: true,
				IdempotencyKey:        tc.key,
			})
			if err == nil || !strings.Contains(err.Error(), tc.wantError) {
				t.Fatalf("expected %q error, got: %v", tc.wantError, err)
			}
			if len(fakeJAP.inputs) != 0 {
				t.Fatalf("JAP should not be called for invalid idempotency key, got %d calls", len(fakeJAP.inputs))
			}

			var userAfter model.User
			if err := db.First(&userAfter, "id = ?", buyer.ID).Error; err != nil {
				t.Fatalf("load user after invalid key: %v", err)
			}
			if userAfter.WalletBalance != 100000 {
				t.Fatalf("wallet should remain 100000, got %d", userAfter.WalletBalance)
			}

			var orderCount int64
			if err := db.Model(&model.SosmedOrder{}).Where("user_id = ?", buyer.ID).Count(&orderCount).Error; err != nil {
				t.Fatalf("count orders: %v", err)
			}
			if orderCount != 0 {
				t.Fatalf("expected no orders for invalid idempotency key, got %d", orderCount)
			}

			var ledgerCount int64
			if err := db.Model(&model.WalletLedger{}).Where("user_id = ?", buyer.ID).Count(&ledgerCount).Error; err != nil {
				t.Fatalf("count wallet ledgers: %v", err)
			}
			if ledgerCount != 0 {
				t.Fatalf("expected no wallet ledgers for invalid idempotency key, got %d", ledgerCount)
			}
		})
	}
}

func TestSosmedOrderService_CreateWalletOrderIdempotencyRejectsPayloadMismatchBeforeSideEffects(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate wallet sosmed models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer Idempotency Mismatch Sosmed",
		Email:         "buyer-idempotency-mismatch-sosmed@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 100000,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{res: &JAPAddOrderResponse{Order: "JAP-IDEM-MISMATCH"}}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	firstInput := CreateSosmedOrderInput{
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/idempotency-mismatch",
		Quantity:              1,
		Notes:                 "first payload",
		TargetPublicConfirmed: true,
		IdempotencyKey:        "idem-sosmed-wallet-mismatch",
	}
	if _, err := orderSvc.Create(context.Background(), buyer.ID, firstInput); err != nil {
		t.Fatalf("first create wallet sosmed: %v", err)
	}

	mismatchInput := firstInput
	mismatchInput.Quantity = 2
	mismatchInput.Notes = "different payload"
	_, err := orderSvc.Create(context.Background(), buyer.ID, mismatchInput)
	if err == nil || !strings.Contains(err.Error(), "idempotency_key sudah dipakai untuk checkout sosmed berbeda") {
		t.Fatalf("expected idempotency mismatch error, got: %v", err)
	}
	if len(fakeJAP.inputs) != 1 {
		t.Fatalf("JAP should not be called again for idempotency mismatch, got %d calls", len(fakeJAP.inputs))
	}

	var userAfter model.User
	if err := db.First(&userAfter, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load user after mismatch: %v", err)
	}
	if userAfter.WalletBalance != 81000 {
		t.Fatalf("wallet should only include the first debit to 81000, got %d", userAfter.WalletBalance)
	}

	var orderCount int64
	if err := db.Model(&model.SosmedOrder{}).Where("user_id = ?", buyer.ID).Count(&orderCount).Error; err != nil {
		t.Fatalf("count orders: %v", err)
	}
	if orderCount != 1 {
		t.Fatalf("expected only the first order after mismatch, got %d", orderCount)
	}

	var purchaseLedgerCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("user_id = ? AND category = ? AND type = ?", buyer.ID, "sosmed_purchase", "debit").
		Count(&purchaseLedgerCount).Error; err != nil {
		t.Fatalf("count purchase ledgers: %v", err)
	}
	if purchaseLedgerCount != 1 {
		t.Fatalf("expected only the first wallet purchase ledger after mismatch, got %d", purchaseLedgerCount)
	}
}

func TestSosmedOrderService_CreateWalletPaidJAPFailureRefunds(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate wallet sosmed models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer Refund Sosmed",
		Email:         "buyer-refund-sosmed@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 20000,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{err: errors.New("JAP sedang bermasalah")}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	_, err := orderSvc.Create(context.Background(), buyer.ID, CreateSosmedOrderInput{
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/example",
		Quantity:              1,
		TargetPublicConfirmed: true,
		IdempotencyKey:        "idem-wallet-provider-failure",
	})
	if err == nil || !strings.Contains(err.Error(), "saldo wallet sudah direfund") {
		t.Fatalf("expected refunded provider error, got: %v", err)
	}

	var order model.SosmedOrder
	if err := db.First(&order, "user_id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load failed order: %v", err)
	}
	if order.PaymentStatus != "failed" || order.OrderStatus != sosmedOrderStatusFailed || order.ProviderStatus != "failed" {
		t.Fatalf("order not failed/refunded: %+v", order)
	}

	var userAfter model.User
	if err := db.First(&userAfter, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load user after refund: %v", err)
	}
	if userAfter.WalletBalance != 20000 {
		t.Fatalf("expected wallet restored to 20000, got %d", userAfter.WalletBalance)
	}

	var refundCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("reference = ?", sosmedOrderWalletRefundRef(order.ID)).
		Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledger: %v", err)
	}
	if refundCount != 1 {
		t.Fatalf("expected 1 refund ledger, got %d", refundCount)
	}
}

func TestSosmedOrderService_CreateWalletPaidInsufficientBalance(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate wallet sosmed models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer Insufficient Sosmed",
		Email:         "buyer-insufficient-sosmed@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 1000,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:            uuid.New(),
		CategoryCode:  "followers",
		Code:          "jap-6331",
		Title:         "Instagram Followers Hemat",
		CheckoutPrice: 19000,
		IsActive:      true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	_, err := orderSvc.Create(context.Background(), buyer.ID, CreateSosmedOrderInput{
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/example",
		Quantity:              1,
		TargetPublicConfirmed: true,
		IdempotencyKey:        "idem-wallet-insufficient-balance",
	})
	if err == nil || !strings.Contains(err.Error(), "saldo wallet tidak cukup") {
		t.Fatalf("expected insufficient wallet error, got: %v", err)
	}
	if len(fakeJAP.inputs) != 0 {
		t.Fatalf("JAP should not be called when wallet insufficient")
	}

	var orderCount int64
	if err := db.Model(&model.SosmedOrder{}).Where("user_id = ?", buyer.ID).Count(&orderCount).Error; err != nil {
		t.Fatalf("count orders: %v", err)
	}
	if orderCount != 0 {
		t.Fatalf("expected no order created, got %d", orderCount)
	}
}

func TestSosmedOrderService_AdminSyncProviderStatus(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
	); err != nil {
		t.Fatalf("migrate sync models: %v", err)
	}

	admin := &model.User{
		ID:       uuid.New(),
		Name:     "Admin Sync Sosmed",
		Email:    "admin-sync-sosmed@example.com",
		Password: "hashed",
		Role:     "admin",
		IsActive: true,
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            admin.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/example",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "JAP-7788",
		ProviderStatus:    "submitted",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{
		statusRes: &JAPOrderStatusResponse{
			Status:     "Completed",
			Charge:     "0.27819",
			StartCount: "3572",
			Remains:    "0",
			Currency:   "USD",
		},
	}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetJAPOrderProvider(fakeJAP)

	detail, err := orderSvc.AdminSyncProviderStatus(context.Background(), order.ID, admin.ID)
	if err != nil {
		t.Fatalf("admin sync provider status: %v", err)
	}

	if len(fakeJAP.statusInputs) != 1 || fakeJAP.statusInputs[0] != "JAP-7788" {
		t.Fatalf("unexpected status inputs: %+v", fakeJAP.statusInputs)
	}
	if detail.Order.OrderStatus != sosmedOrderStatusSuccess {
		t.Fatalf("expected success order after sync, got %s", detail.Order.OrderStatus)
	}
	if detail.Order.ProviderStatus != "Completed" {
		t.Fatalf("expected provider status Completed, got %q", detail.Order.ProviderStatus)
	}
	if detail.Order.ProviderSyncedAt == nil {
		t.Fatalf("provider_synced_at should be filled")
	}
	if detail.Order.StartCount != 3572 {
		t.Fatalf("expected supplier start count 3572 to be exposed, got %d", detail.Order.StartCount)
	}

	var persisted model.SosmedOrder
	if err := db.First(&persisted, "id = ?", order.ID).Error; err != nil {
		t.Fatalf("reload synced order: %v", err)
	}
	if persisted.StartCount != 3572 {
		t.Fatalf("expected persisted supplier start count 3572, got %d", persisted.StartCount)
	}

	var eventCount int64
	if err := db.Model(&model.SosmedOrderEvent{}).
		Where("order_id = ?", order.ID).
		Count(&eventCount).Error; err != nil {
		t.Fatalf("count sync events: %v", err)
	}
	if eventCount != 1 {
		t.Fatalf("expected 1 sync event, got %d", eventCount)
	}
}

func TestSosmedOrderService_AutoSyncStaleProviderOrdersSyncsOnlyStaleProcessingRows(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
	); err != nil {
		t.Fatalf("migrate auto-sync models: %v", err)
	}

	buyer := &model.User{
		ID:       uuid.New(),
		Name:     "Buyer Auto Sync Sosmed",
		Email:    "buyer-auto-sync-sosmed@example.com",
		Password: "hashed",
		Role:     "user",
		IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-auto-sync",
		Title:             "Instagram Auto Sync",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	now := time.Now()
	staleSyncedAt := now.Add(-2 * time.Hour)
	freshSyncedAt := now.Add(-5 * time.Minute)
	baseOrder := func(providerOrderID string) model.SosmedOrder {
		return model.SosmedOrder{
			ID:                uuid.New(),
			UserID:            buyer.ID,
			ServiceID:         serviceItem.ID,
			ServiceCode:       serviceItem.Code,
			ServiceTitle:      serviceItem.Title,
			TargetLink:        "https://instagram.com/auto-sync",
			Quantity:          1,
			UnitPrice:         19000,
			TotalPrice:        19000,
			PaymentMethod:     "wallet",
			PaymentStatus:     "paid",
			OrderStatus:       sosmedOrderStatusProcessing,
			ProviderCode:      "jap",
			ProviderServiceID: "6331",
			ProviderOrderID:   providerOrderID,
			ProviderStatus:    "In Progress",
		}
	}

	stale := baseOrder("JAP-STALE")
	stale.ProviderSyncedAt = &staleSyncedAt
	neverSynced := baseOrder("JAP-NEVER")
	fresh := baseOrder("JAP-FRESH")
	fresh.ProviderSyncedAt = &freshSyncedAt
	missingProviderID := baseOrder("")
	otherProvider := baseOrder("OTHER-STALE")
	otherProvider.ProviderCode = "other"
	otherProvider.ProviderSyncedAt = &staleSyncedAt
	failedOrder := baseOrder("JAP-FAILED")
	failedOrder.OrderStatus = sosmedOrderStatusFailed
	failedOrder.ProviderSyncedAt = &staleSyncedAt

	for _, order := range []model.SosmedOrder{stale, neverSynced, fresh, missingProviderID, otherProvider, failedOrder} {
		row := order
		if err := db.Create(&row).Error; err != nil {
			t.Fatalf("create auto-sync order: %v", err)
		}
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{
		statusByOrderID: map[string]*JAPOrderStatusResponse{
			"JAP-STALE": {Status: "Completed", StartCount: "111"},
			"JAP-NEVER": {Status: "In Progress", StartCount: "222"},
		},
	}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetJAPOrderProvider(fakeJAP)

	result, err := orderSvc.AutoSyncStaleProviderOrders(context.Background(), AutoSyncSosmedProviderInput{
		ProviderCode: "jap",
		StaleAfter:   30 * time.Minute,
		Limit:        10,
	})
	if err != nil {
		t.Fatalf("auto-sync stale provider orders: %v", err)
	}
	if result.Requested != 2 || result.Synced != 2 || result.Updated != 2 || result.Failed != 0 || result.Skipped != 0 {
		t.Fatalf("unexpected auto-sync result: %+v", result)
	}
	if strings.Join(fakeJAP.statusInputs, ",") != "JAP-NEVER,JAP-STALE" {
		t.Fatalf("expected only never/stale provider orders synced in oldest order, got %+v", fakeJAP.statusInputs)
	}
	if len(fakeJAP.inputs) != 0 {
		t.Fatalf("auto-sync must not submit/retry provider orders, got %d add calls", len(fakeJAP.inputs))
	}
	if len(fakeJAP.refillInputs) != 0 {
		t.Fatalf("auto-sync must not request refills, got %d refill calls", len(fakeJAP.refillInputs))
	}

	var freshAfter model.SosmedOrder
	if err := db.First(&freshAfter, "id = ?", fresh.ID).Error; err != nil {
		t.Fatalf("load fresh order: %v", err)
	}
	if !freshAfter.ProviderSyncedAt.Equal(freshSyncedAt) {
		t.Fatalf("fresh order should not be auto-synced, got synced_at=%v want %v", freshAfter.ProviderSyncedAt, freshSyncedAt)
	}

	var staleAfter model.SosmedOrder
	if err := db.First(&staleAfter, "id = ?", stale.ID).Error; err != nil {
		t.Fatalf("load stale order: %v", err)
	}
	if staleAfter.OrderStatus != sosmedOrderStatusSuccess || staleAfter.ProviderStatus != "Completed" || staleAfter.StartCount != 111 {
		t.Fatalf("stale order not updated from provider: %+v", staleAfter)
	}

	var systemEvent model.SosmedOrderEvent
	if err := db.First(&systemEvent, "order_id = ?", stale.ID).Error; err != nil {
		t.Fatalf("load system event: %v", err)
	}
	if systemEvent.ActorType != "system" || systemEvent.ActorID != nil {
		t.Fatalf("expected system actor event without actor id, got actor_type=%q actor_id=%v", systemEvent.ActorType, systemEvent.ActorID)
	}
}

func TestSosmedOrderService_ListByUserSyncsCanceledJAPProviderOrder(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate user list sync models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer User List Sync",
		Email:         "buyer-user-list-sync@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 905500,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-9274",
		Title:             "Facebook Profile Followers",
		ProviderCode:      "jap",
		ProviderServiceID: "9274",
		CheckoutPrice:     10500,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://www.facebook.com/fikriramaa",
		Quantity:          1,
		UnitPrice:         10500,
		TotalPrice:        10500,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      "jap",
		ProviderServiceID: "9274",
		ProviderOrderID:   "955388723",
		ProviderStatus:    "submitted",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	chargeLedger := &model.WalletLedger{
		ID:            uuid.New(),
		UserID:        buyer.ID,
		Type:          "debit",
		Category:      "sosmed_purchase",
		Amount:        10500,
		BalanceBefore: 916000,
		BalanceAfter:  905500,
		Reference:     sosmedOrderWalletChargeRef(order.ID),
		Description:   "Pembelian layanan sosmed order 6286E732 via wallet",
	}
	if err := db.Create(chargeLedger).Error; err != nil {
		t.Fatalf("create charge ledger: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{
		statusRes: &JAPOrderStatusResponse{
			Status:     "Canceled",
			Charge:     "0.00",
			StartCount: "0",
			Remains:    "1000",
			Currency:   "USD",
		},
	}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	orders, total, err := orderSvc.ListByUser(buyer.ID, 1, 10)
	if err != nil {
		t.Fatalf("list by user: %v", err)
	}
	if total != 1 || len(orders) != 1 {
		t.Fatalf("expected one order, total=%d len=%d", total, len(orders))
	}
	if len(fakeJAP.statusInputs) != 1 || fakeJAP.statusInputs[0] != "955388723" {
		t.Fatalf("expected list to sync provider status, inputs=%+v", fakeJAP.statusInputs)
	}
	if orders[0].OrderStatus != sosmedOrderStatusFailed {
		t.Fatalf("expected canceled supplier order -> failed, got %s", orders[0].OrderStatus)
	}
	if orders[0].ProviderStatus != "Canceled" {
		t.Fatalf("expected provider status Canceled, got %q", orders[0].ProviderStatus)
	}
	if orders[0].ProviderSyncedAt == nil {
		t.Fatalf("expected provider_synced_at to be set")
	}
	if orders[0].PaymentStatus != "failed" {
		t.Fatalf("expected payment status marked failed after wallet refund, got %s", orders[0].PaymentStatus)
	}

	var storedUser model.User
	if err := db.First(&storedUser, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("reload buyer: %v", err)
	}
	if storedUser.WalletBalance != 916000 {
		t.Fatalf("expected canceled supplier sync to refund wallet to 916000, got %d", storedUser.WalletBalance)
	}

	var refundLedger model.WalletLedger
	if err := db.First(&refundLedger, "reference = ?", sosmedOrderWalletRefundRef(order.ID)).Error; err != nil {
		t.Fatalf("expected wallet refund ledger: %v", err)
	}
	if refundLedger.Type != "credit" || refundLedger.Category != "sosmed_refund" || refundLedger.Amount != 10500 || refundLedger.BalanceBefore != 905500 || refundLedger.BalanceAfter != 916000 {
		t.Fatalf("unexpected refund ledger: %+v", refundLedger)
	}

	orders, _, err = orderSvc.ListByUser(buyer.ID, 1, 10)
	if err != nil {
		t.Fatalf("list by user second time: %v", err)
	}
	if orders[0].PaymentStatus != "failed" {
		t.Fatalf("expected second list to keep payment status failed, got %s", orders[0].PaymentStatus)
	}
	var refundCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", sosmedOrderWalletRefundRef(order.ID)).Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledgers: %v", err)
	}
	if refundCount != 1 {
		t.Fatalf("expected exactly one wallet refund ledger after repeated list, got %d", refundCount)
	}
	if err := db.First(&storedUser, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("reload buyer after repeated list: %v", err)
	}
	if storedUser.WalletBalance != 916000 {
		t.Fatalf("expected repeated list not to double refund wallet, got %d", storedUser.WalletBalance)
	}

	var event model.SosmedOrderEvent
	if err := db.First(&event, "order_id = ? AND reason LIKE ?", order.ID, "%provider status canceled%").Error; err != nil {
		t.Fatalf("expected provider sync event: %v", err)
	}
	if event.ActorType != "system" || event.FromStatus != sosmedOrderStatusProcessing || event.ToStatus != sosmedOrderStatusFailed {
		t.Fatalf("unexpected event after user-list sync: %+v", event)
	}
}

func TestSosmedOrderService_ListByUserRepairsFailedWalletPaidOrderRefund(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate failed refund repair models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer Failed Refund Repair",
		Email:         "buyer-failed-refund-repair@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 895000,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-9274",
		Title:             "Facebook Profile Followers",
		ProviderCode:      "jap",
		ProviderServiceID: "9274",
		CheckoutPrice:     10500,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://www.facebook.com/fikriramaa",
		Quantity:          1,
		UnitPrice:         10500,
		TotalPrice:        10500,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusFailed,
		ProviderCode:      "jap",
		ProviderServiceID: "9274",
		ProviderOrderID:   "955388723",
		ProviderStatus:    "Canceled",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	chargeLedger := &model.WalletLedger{
		ID:            uuid.New(),
		UserID:        buyer.ID,
		Type:          "debit",
		Category:      "sosmed_purchase",
		Amount:        10500,
		BalanceBefore: 916000,
		BalanceAfter:  905500,
		Reference:     sosmedOrderWalletChargeRef(order.ID),
		Description:   "Pembelian layanan sosmed order 6286E732 via wallet",
	}
	if err := db.Create(chargeLedger).Error; err != nil {
		t.Fatalf("create charge ledger: %v", err)
	}

	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetWalletRepo(repository.NewWalletRepo(db))

	orders, total, err := orderSvc.ListByUser(buyer.ID, 1, 10)
	if err != nil {
		t.Fatalf("list by user: %v", err)
	}
	if total != 1 || len(orders) != 1 {
		t.Fatalf("expected one order, total=%d len=%d", total, len(orders))
	}
	if orders[0].OrderStatus != sosmedOrderStatusFailed || orders[0].PaymentStatus != "failed" {
		t.Fatalf("expected failed order with failed payment status after refund repair, got order=%s payment=%s", orders[0].OrderStatus, orders[0].PaymentStatus)
	}

	var storedUser model.User
	if err := db.First(&storedUser, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("reload buyer: %v", err)
	}
	if storedUser.WalletBalance != 905500 {
		t.Fatalf("expected failed paid order repair to add one refund to current balance, got %d", storedUser.WalletBalance)
	}

	var refundLedger model.WalletLedger
	if err := db.First(&refundLedger, "reference = ?", sosmedOrderWalletRefundRef(order.ID)).Error; err != nil {
		t.Fatalf("expected refund ledger from failed order repair: %v", err)
	}
	if refundLedger.Type != "credit" || refundLedger.Category != "sosmed_refund" || refundLedger.Amount != 10500 || refundLedger.BalanceBefore != 895000 || refundLedger.BalanceAfter != 905500 {
		t.Fatalf("unexpected repair refund ledger: %+v", refundLedger)
	}

	orders, _, err = orderSvc.ListByUser(buyer.ID, 1, 10)
	if err != nil {
		t.Fatalf("list by user second time: %v", err)
	}
	if orders[0].PaymentStatus != "failed" {
		t.Fatalf("expected second list to keep payment status failed, got %s", orders[0].PaymentStatus)
	}
	var refundCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", sosmedOrderWalletRefundRef(order.ID)).Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledgers: %v", err)
	}
	if refundCount != 1 {
		t.Fatalf("expected exactly one refund ledger after repair retry, got %d", refundCount)
	}
	if err := db.First(&storedUser, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("reload buyer after retry: %v", err)
	}
	if storedUser.WalletBalance != 905500 {
		t.Fatalf("expected repair retry not to double refund, got %d", storedUser.WalletBalance)
	}
}

func TestSosmedOrderService_ListByUserRefundsLatestRetryChargeWhenProviderCancels(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate retry refund models: %v", err)
	}

	buyer := &model.User{
		ID:            uuid.New(),
		Name:          "Buyer Retry Refund",
		Email:         "buyer-retry-refund@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 89500,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-9274",
		Title:             "Facebook Profile Followers",
		ProviderCode:      "jap",
		ProviderServiceID: "9274",
		CheckoutPrice:     10500,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://www.facebook.com/fikriramaa",
		Quantity:          1,
		UnitPrice:         10500,
		TotalPrice:        10500,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      "jap",
		ProviderServiceID: "9274",
		ProviderOrderID:   "RETRY-JAP-1",
		ProviderStatus:    "submitted",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	ledgers := []*model.WalletLedger{
		{
			ID:            uuid.New(),
			UserID:        buyer.ID,
			Type:          "debit",
			Category:      "sosmed_purchase",
			Amount:        10500,
			BalanceBefore: 100000,
			BalanceAfter:  89500,
			Reference:     sosmedOrderWalletChargeRef(order.ID),
			Description:   "Pembelian awal layanan sosmed via wallet",
		},
		{
			ID:            uuid.New(),
			UserID:        buyer.ID,
			Type:          "credit",
			Category:      "sosmed_refund",
			Amount:        10500,
			BalanceBefore: 89500,
			BalanceAfter:  100000,
			Reference:     sosmedOrderWalletRefundRef(order.ID),
			Description:   "Refund awal layanan sosmed",
		},
		{
			ID:            uuid.New(),
			UserID:        buyer.ID,
			Type:          "debit",
			Category:      "sosmed_purchase",
			Amount:        10500,
			BalanceBefore: 100000,
			BalanceAfter:  89500,
			Reference:     sosmedOrderWalletRetryChargeRef(order.ID, 1),
			Description:   "Retry admin layanan sosmed via wallet",
		},
	}
	if err := db.Create(&ledgers).Error; err != nil {
		t.Fatalf("create ledgers: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{
		statusRes: &JAPOrderStatusResponse{Status: "Canceled"},
	}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	orders, total, err := orderSvc.ListByUser(buyer.ID, 1, 10)
	if err != nil {
		t.Fatalf("list by user: %v", err)
	}
	if total != 1 || len(orders) != 1 {
		t.Fatalf("expected one order, total=%d len=%d", total, len(orders))
	}
	if orders[0].OrderStatus != sosmedOrderStatusFailed || orders[0].PaymentStatus != "failed" {
		t.Fatalf("expected canceled retry order to become failed/failed, got order=%s payment=%s", orders[0].OrderStatus, orders[0].PaymentStatus)
	}

	var storedUser model.User
	if err := db.First(&storedUser, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("reload buyer: %v", err)
	}
	if storedUser.WalletBalance != 100000 {
		t.Fatalf("expected retry provider cancel to refund latest retry debit to 100000, got %d", storedUser.WalletBalance)
	}

	var originalRefundCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", sosmedOrderWalletRefundRef(order.ID)).Count(&originalRefundCount).Error; err != nil {
		t.Fatalf("count original refunds: %v", err)
	}
	if originalRefundCount != 1 {
		t.Fatalf("expected original refund ledger to remain exactly one, got %d", originalRefundCount)
	}

	var retryRefund model.WalletLedger
	if err := db.First(&retryRefund, "reference = ?", sosmedOrderWalletRetryRefundRef(order.ID, 1)).Error; err != nil {
		t.Fatalf("expected retry refund ledger: %v", err)
	}
	if retryRefund.Type != "credit" || retryRefund.Category != "sosmed_refund" || retryRefund.Amount != 10500 || retryRefund.BalanceBefore != 89500 || retryRefund.BalanceAfter != 100000 {
		t.Fatalf("unexpected retry refund ledger: %+v", retryRefund)
	}

	orders, _, err = orderSvc.ListByUser(buyer.ID, 1, 10)
	if err != nil {
		t.Fatalf("list by user second time: %v", err)
	}
	if orders[0].PaymentStatus != "failed" {
		t.Fatalf("expected second list to keep payment status failed, got %s", orders[0].PaymentStatus)
	}
	var retryRefundCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", sosmedOrderWalletRetryRefundRef(order.ID, 1)).Count(&retryRefundCount).Error; err != nil {
		t.Fatalf("count retry refunds: %v", err)
	}
	if retryRefundCount != 1 {
		t.Fatalf("expected exactly one retry refund ledger after repeated list, got %d", retryRefundCount)
	}
	if err := db.First(&storedUser, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("reload buyer after repeated list: %v", err)
	}
	if storedUser.WalletBalance != 100000 {
		t.Fatalf("expected repeated list not to double refund retry, got %d", storedUser.WalletBalance)
	}
}

func TestSosmedOrderService_AdminSyncProcessingProviderOrders(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
	); err != nil {
		t.Fatalf("migrate bulk sync models: %v", err)
	}

	admin := &model.User{
		ID:       uuid.New(),
		Name:     "Admin Bulk Sync Sosmed",
		Email:    "admin-bulk-sync-sosmed@example.com",
		Password: "hashed",
		Role:     "admin",
		IsActive: true,
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	orderCompleted := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            admin.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/completed",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "JAP-2001",
		ProviderStatus:    "submitted",
	}
	orderSame := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            admin.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/same",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "JAP-2002",
		ProviderStatus:    "In Progress",
	}
	orderFailed := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            admin.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/failed",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "JAP-2003",
		ProviderStatus:    "submitted",
	}
	for _, order := range []*model.SosmedOrder{orderCompleted, orderSame, orderFailed} {
		if err := db.Create(order).Error; err != nil {
			t.Fatalf("create bulk sync order %s: %v", order.ProviderOrderID, err)
		}
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{
		statusByOrderID: map[string]*JAPOrderStatusResponse{
			"JAP-2001": {Status: "Completed"},
			"JAP-2002": {Status: "In Progress"},
		},
		statusErrByOrderID: map[string]error{
			"JAP-2003": errors.New("provider timeout"),
		},
	}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetJAPOrderProvider(fakeJAP)

	result, err := orderSvc.AdminSyncProcessingProviderOrders(context.Background(), admin.ID, 10)
	if err != nil {
		t.Fatalf("admin bulk sync provider: %v", err)
	}

	if result.Requested != 3 || result.Synced != 2 || result.Updated != 1 || result.Skipped != 1 || result.Failed != 1 {
		t.Fatalf("unexpected bulk sync summary: %+v", result)
	}
	if len(result.Items) != 3 {
		t.Fatalf("expected 3 bulk sync items, got %d", len(result.Items))
	}

	var completedAfter model.SosmedOrder
	if err := db.First(&completedAfter, "id = ?", orderCompleted.ID).Error; err != nil {
		t.Fatalf("load completed order: %v", err)
	}
	if completedAfter.OrderStatus != sosmedOrderStatusSuccess {
		t.Fatalf("expected completed order -> success, got %s", completedAfter.OrderStatus)
	}

	var failedAfter model.SosmedOrder
	if err := db.First(&failedAfter, "id = ?", orderFailed.ID).Error; err != nil {
		t.Fatalf("load failed sync order: %v", err)
	}
	if !strings.Contains(failedAfter.ProviderError, "provider timeout") {
		t.Fatalf("expected provider error stored, got %q", failedAfter.ProviderError)
	}
	if failedAfter.ProviderSyncedAt == nil {
		t.Fatalf("failed sync should still store provider_synced_at")
	}
}

func TestSosmedOrderService_AdminOpsSummary(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
	); err != nil {
		t.Fatalf("migrate ops summary models: %v", err)
	}

	buyer := &model.User{ID: uuid.New(), Name: "Buyer Ops", Email: "buyer-ops@example.com", Password: "hashed", Role: "user", IsActive: true}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	now := time.Now()
	baseOrder := func(status string) model.SosmedOrder {
		return model.SosmedOrder{
			ID:                uuid.New(),
			UserID:            buyer.ID,
			ServiceID:         serviceItem.ID,
			ServiceCode:       serviceItem.Code,
			ServiceTitle:      serviceItem.Title,
			TargetLink:        "https://instagram.com/ops",
			Quantity:          1,
			UnitPrice:         19000,
			TotalPrice:        19000,
			PaymentMethod:     "wallet",
			PaymentStatus:     "paid",
			OrderStatus:       status,
			ProviderCode:      "jap",
			ProviderServiceID: "6331",
		}
	}

	syncableFresh := baseOrder(sosmedOrderStatusProcessing)
	syncableFresh.ProviderOrderID = "JAP-FRESH"
	syncableFresh.ProviderSyncedAt = &now

	syncableStale := baseOrder(sosmedOrderStatusProcessing)
	syncableStale.ProviderOrderID = "JAP-STALE"

	missingProviderID := baseOrder(sosmedOrderStatusProcessing)

	retryable := baseOrder(sosmedOrderStatusFailed)
	retryable.PaymentStatus = "failed"
	retryable.ProviderStatus = "failed"
	retryable.ProviderError = "first submit failed"

	successOrder := baseOrder(sosmedOrderStatusSuccess)
	successOrder.ProviderOrderID = "JAP-DONE"

	pendingOrder := baseOrder(sosmedOrderStatusPendingPayment)
	pendingOrder.PaymentStatus = "pending"
	pendingOrder.PaymentMethod = ""
	pendingOrder.ProviderCode = ""
	pendingOrder.ProviderServiceID = ""

	for _, order := range []model.SosmedOrder{
		syncableFresh,
		syncableStale,
		missingProviderID,
		retryable,
		successOrder,
		pendingOrder,
	} {
		item := order
		if err := db.Create(&item).Error; err != nil {
			t.Fatalf("create summary order: %v", err)
		}
	}

	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil)
	summary, err := orderSvc.AdminOpsSummary(30)
	if err != nil {
		t.Fatalf("admin ops summary: %v", err)
	}

	if summary.Total != 6 || summary.PendingPayment != 1 || summary.Processing != 3 || summary.Success != 1 || summary.Failed != 1 {
		t.Fatalf("unexpected status totals: %+v", summary)
	}
	if summary.Syncable != 2 || summary.StaleSync != 1 || summary.MissingProviderOrderID != 1 {
		t.Fatalf("unexpected provider ops totals: %+v", summary)
	}
	if summary.Retryable != 1 || summary.ProviderErrors != 1 || summary.StaleSyncMinutes != 30 {
		t.Fatalf("unexpected retry/error totals: %+v", summary)
	}
}

func TestSosmedOrderService_AdminRetryProviderOrderDebitsWalletAndSubmits(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate retry models: %v", err)
	}

	admin := &model.User{ID: uuid.New(), Name: "Admin Retry", Email: "admin-retry@example.com", Password: "hashed", Role: "admin", IsActive: true}
	buyer := &model.User{ID: uuid.New(), Name: "Buyer Retry", Email: "buyer-retry@example.com", Password: "hashed", Role: "user", IsActive: true, WalletBalance: 50000}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/retry",
		Quantity:          2,
		UnitPrice:         19000,
		TotalPrice:        38000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "failed",
		OrderStatus:       sosmedOrderStatusFailed,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderStatus:    "failed",
		ProviderError:     "first submit failed",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create failed order: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{res: &JAPAddOrderResponse{Order: "JAP-RETRY-7788"}}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	detail, err := orderSvc.AdminRetryProviderOrder(context.Background(), order.ID, admin.ID, AdminRetrySosmedProviderInput{
		Reason: "retry test",
	})
	if err != nil {
		t.Fatalf("admin retry provider order: %v", err)
	}

	if len(fakeJAP.inputs) != 1 {
		t.Fatalf("expected 1 JAP add call, got %d", len(fakeJAP.inputs))
	}
	if fakeJAP.inputs[0].ServiceID != "6331" || fakeJAP.inputs[0].Quantity != 2000 {
		t.Fatalf("unexpected JAP retry input: %+v", fakeJAP.inputs[0])
	}
	if detail.Order.ProviderOrderID != "JAP-RETRY-7788" || detail.Order.OrderStatus != sosmedOrderStatusProcessing || detail.Order.PaymentStatus != "paid" {
		t.Fatalf("unexpected retry order state: %+v", detail.Order)
	}

	var buyerAfter model.User
	if err := db.First(&buyerAfter, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load buyer after retry: %v", err)
	}
	if buyerAfter.WalletBalance != 12000 {
		t.Fatalf("expected wallet balance 12000, got %d", buyerAfter.WalletBalance)
	}

	var retryChargeCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("reference = ?", sosmedOrderWalletRetryChargeRef(order.ID, 1)).
		Count(&retryChargeCount).Error; err != nil {
		t.Fatalf("count retry charge: %v", err)
	}
	if retryChargeCount != 1 {
		t.Fatalf("expected 1 retry charge ledger, got %d", retryChargeCount)
	}
}

func TestSosmedOrderService_AdminRetryProviderOrderRefundsOnFailure(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.SosmedOrderRefillAttempt{},
		&model.WalletLedger{},
	); err != nil {
		t.Fatalf("migrate retry failure models: %v", err)
	}

	admin := &model.User{ID: uuid.New(), Name: "Admin Retry Fail", Email: "admin-retry-fail@example.com", Password: "hashed", Role: "admin", IsActive: true}
	buyer := &model.User{ID: uuid.New(), Name: "Buyer Retry Fail", Email: "buyer-retry-fail@example.com", Password: "hashed", Role: "user", IsActive: true, WalletBalance: 50000}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/retry-fail",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "failed",
		OrderStatus:       sosmedOrderStatusFailed,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderStatus:    "failed",
		ProviderError:     "first submit failed",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create failed order: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{err: errors.New("JAP retry timeout")}
	orderSvc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), repository.NewSosmedServiceRepo(db), nil).
		SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	_, err := orderSvc.AdminRetryProviderOrder(context.Background(), order.ID, admin.ID, AdminRetrySosmedProviderInput{
		Reason: "retry failure test",
	})
	if err == nil || !strings.Contains(err.Error(), "saldo wallet sudah direfund") {
		t.Fatalf("expected retry refund error, got: %v", err)
	}

	var buyerAfter model.User
	if err := db.First(&buyerAfter, "id = ?", buyer.ID).Error; err != nil {
		t.Fatalf("load buyer after retry failure: %v", err)
	}
	if buyerAfter.WalletBalance != 50000 {
		t.Fatalf("expected wallet balance restored to 50000, got %d", buyerAfter.WalletBalance)
	}

	var orderAfter model.SosmedOrder
	if err := db.First(&orderAfter, "id = ?", order.ID).Error; err != nil {
		t.Fatalf("load order after retry failure: %v", err)
	}
	if orderAfter.PaymentStatus != "failed" || orderAfter.OrderStatus != sosmedOrderStatusFailed || orderAfter.ProviderOrderID != "" {
		t.Fatalf("unexpected retry failure order state: %+v", orderAfter)
	}
	if !strings.Contains(orderAfter.ProviderError, "JAP retry timeout") {
		t.Fatalf("expected provider error stored, got %q", orderAfter.ProviderError)
	}

	var retryRefundCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("reference = ?", sosmedOrderWalletRetryRefundRef(order.ID, 1)).
		Count(&retryRefundCount).Error; err != nil {
		t.Fatalf("count retry refund: %v", err)
	}
	if retryRefundCount != 1 {
		t.Fatalf("expected 1 retry refund ledger, got %d", retryRefundCount)
	}
}
