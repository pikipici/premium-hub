package service

import (
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

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

	detail, err := orderSvc.Create(buyer.ID, CreateSosmedOrderInput{
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
	created, err := orderSvc.Create(buyer.ID, CreateSosmedOrderInput{ServiceID: serviceItem.ID.String()})
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
