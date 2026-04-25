package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type fakeSosmedJAPOrderProvider struct {
	inputs []JAPAddOrderInput
	res    *JAPAddOrderResponse
	err    error
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

func TestSosmedOrderService_CreateAndConfirm(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.ProductCategory{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
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

	detail, err := orderSvc.Create(context.Background(), buyer.ID, CreateSosmedOrderInput{
		ServiceID:  createdService.ID.String(),
		TargetLink: "https://instagram.com/example",
		Quantity:   2,
		Notes:      "Campaign launch",
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
		ServiceID:  serviceItem.ID.String(),
		TargetLink: "https://instagram.com/example",
	})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}

	if err := orderSvc.Cancel(created.Order.ID, other.ID); err == nil || !strings.Contains(err.Error(), "akses ditolak") {
		t.Fatalf("expected access denied when other user cancel order, got: %v", err)
	}

	if err := orderSvc.Cancel(created.Order.ID, buyer.ID); err != nil {
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
		Code:              "instagram-followers-6331",
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
		ServiceID:  serviceItem.ID.String(),
		TargetLink: "https://instagram.com/example",
		Quantity:   5,
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

func TestSosmedOrderService_CreateWalletPaidJAPFailureRefunds(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
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
		Code:              "instagram-followers-6331",
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
		ServiceID:  serviceItem.ID.String(),
		TargetLink: "https://instagram.com/example",
		Quantity:   1,
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
		Code:          "instagram-followers-6331",
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
		ServiceID:  serviceItem.ID.String(),
		TargetLink: "https://instagram.com/example",
		Quantity:   1,
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
