package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type fakeSosmedJAPOrderProvider struct {
	inputs             []JAPAddOrderInput
	res                *JAPAddOrderResponse
	err                error
	statusInputs       []string
	statusRes          *JAPOrderStatusResponse
	statusErr          error
	statusByOrderID    map[string]*JAPOrderStatusResponse
	statusErrByOrderID map[string]error
	refillInputs       []string
	refillErr          error
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

func (f *fakeSosmedJAPOrderProvider) RequestRefill(_ context.Context, orderID string) error {
	f.refillInputs = append(f.refillInputs, orderID)
	return f.refillErr
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
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/example",
		Quantity:              5,
		TargetPublicConfirmed: true,
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
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/example",
		Quantity:              1,
		TargetPublicConfirmed: true,
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
		ServiceID:             serviceItem.ID.String(),
		TargetLink:            "https://instagram.com/example",
		Quantity:              1,
		TargetPublicConfirmed: true,
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

func TestSosmedOrderService_AdminSyncProcessingProviderOrders(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
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
