package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type fakeHandlerJAPOrderProvider struct {
	inputs []service.JAPAddOrderInput
	err    error
}

func (f *fakeHandlerJAPOrderProvider) AddOrder(_ context.Context, input service.JAPAddOrderInput) (*service.JAPAddOrderResponse, error) {
	f.inputs = append(f.inputs, input)
	if f.err != nil {
		return nil, f.err
	}
	return &service.JAPAddOrderResponse{Order: "JAP-SMOKE-1001"}, nil
}

func (f *fakeHandlerJAPOrderProvider) GetOrderStatus(_ context.Context, _ string) (*service.JAPOrderStatusResponse, error) {
	return &service.JAPOrderStatusResponse{Status: "In Progress"}, nil
}

func (f *fakeHandlerJAPOrderProvider) RequestRefill(_ context.Context, _ string) (*service.JAPRefillResponse, error) {
	return &service.JAPRefillResponse{Refill: "REFILL-SMOKE-1001"}, nil
}

func (f *fakeHandlerJAPOrderProvider) GetRefillStatus(_ context.Context, _ string) (*service.JAPRefillStatusResponse, error) {
	return &service.JAPRefillStatusResponse{Status: "Processing"}, nil
}

type handlerSmokeEnvelope struct {
	Message string                    `json:"message"`
	Data    handlerSmokeOrderResponse `json:"data"`
}

type handlerSmokeOrderResponse struct {
	Order *model.SosmedOrder `json:"order"`
}

type handlerErrorEnvelope struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func setupSosmedOrderHandlerDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.WalletLedger{},
		&model.Notification{},
	); err != nil {
		t.Fatalf("migrate models: %v", err)
	}

	return db
}

func TestCreateSosmedOrderWalletJAPSmoke(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSosmedOrderHandlerDB(t)

	user := &model.User{
		ID:            uuid.New(),
		Name:          "Smoke User",
		Email:         "smoke-user@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 100000,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	serviceRow := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "instagram-followers-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceRow).Error; err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	fakeJAP := &fakeHandlerJAPOrderProvider{}
	orderSvc := service.NewSosmedOrderService(
		repository.NewSosmedOrderRepo(db),
		repository.NewSosmedServiceRepo(db),
		repository.NewNotificationRepo(db),
	).SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", user.ID)
		c.Next()
	})
	router.POST("/api/v1/sosmed/orders", NewSosmedOrderHandler(orderSvc).Create)

	body := `{"service_id":"` + serviceRow.ID.String() + `","target_link":"https://instagram.com/example","quantity":2,"notes":"smoke test wallet jap","target_public_confirmed":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sosmed/orders", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d body=%s", rec.Code, rec.Body.String())
	}

	var payload handlerSmokeEnvelope
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v body=%s", err, rec.Body.String())
	}

	if payload.Data.Order == nil {
		t.Fatalf("response order missing: %s", rec.Body.String())
	}
	if payload.Data.Order.PaymentMethod != "wallet" || payload.Data.Order.PaymentStatus != "paid" {
		t.Fatalf("unexpected payment state in response: %+v", payload.Data.Order)
	}
	if payload.Data.Order.ProviderOrderID != "JAP-SMOKE-1001" || payload.Data.Order.ProviderStatus != "submitted" {
		t.Fatalf("unexpected provider tracking in response: %+v", payload.Data.Order)
	}

	if len(fakeJAP.inputs) != 1 {
		t.Fatalf("expected 1 provider call, got %d", len(fakeJAP.inputs))
	}
	if fakeJAP.inputs[0].ServiceID != "6331" || fakeJAP.inputs[0].Quantity != 2000 {
		t.Fatalf("unexpected provider payload: %+v", fakeJAP.inputs[0])
	}

	var storedUser model.User
	if err := db.First(&storedUser, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if storedUser.WalletBalance != 62000 {
		t.Fatalf("expected wallet balance 62000, got %d", storedUser.WalletBalance)
	}

	var storedOrder model.SosmedOrder
	if err := db.First(&storedOrder, "id = ?", payload.Data.Order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if storedOrder.TotalPrice != 38000 || storedOrder.ProviderOrderID != "JAP-SMOKE-1001" {
		t.Fatalf("stored order mismatch: %+v", storedOrder)
	}

	var eventCount int64
	if err := db.Model(&model.SosmedOrderEvent{}).
		Where("order_id = ?", storedOrder.ID).
		Count(&eventCount).Error; err != nil {
		t.Fatalf("count events: %v", err)
	}
	if eventCount < 2 {
		t.Fatalf("expected at least 2 order events, got %d", eventCount)
	}

	var chargeCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("reference = ?", "sosmed_order:"+storedOrder.ID.String()+":charge").
		Count(&chargeCount).Error; err != nil {
		t.Fatalf("count charge ledger: %v", err)
	}
	if chargeCount != 1 {
		t.Fatalf("expected 1 wallet charge ledger, got %d", chargeCount)
	}
}

func TestCreateSosmedOrderWalletJAPRefundSmoke(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupSosmedOrderHandlerDB(t)

	user := &model.User{
		ID:            uuid.New(),
		Name:          "Refund Smoke User",
		Email:         "refund-smoke-user@example.com",
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 20000,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	serviceRow := &model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "instagram-followers-6331",
		Title:             "Instagram Followers Hemat",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		CheckoutPrice:     19000,
		IsActive:          true,
	}
	if err := db.Create(serviceRow).Error; err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	fakeJAP := &fakeHandlerJAPOrderProvider{err: errors.New("JAP lagi error smoke")}
	orderSvc := service.NewSosmedOrderService(
		repository.NewSosmedOrderRepo(db),
		repository.NewSosmedServiceRepo(db),
		repository.NewNotificationRepo(db),
	).SetWalletRepo(repository.NewWalletRepo(db)).
		SetJAPOrderProvider(fakeJAP)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", user.ID)
		c.Next()
	})
	router.POST("/api/v1/sosmed/orders", NewSosmedOrderHandler(orderSvc).Create)

	body := `{"service_id":"` + serviceRow.ID.String() + `","target_link":"https://instagram.com/example","quantity":1,"notes":"smoke test refund jap","target_public_confirmed":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sosmed/orders", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d body=%s", rec.Code, rec.Body.String())
	}

	var payload handlerErrorEnvelope
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode error response: %v body=%s", err, rec.Body.String())
	}
	if payload.Success {
		t.Fatalf("expected failed response, got success: %s", rec.Body.String())
	}
	if !strings.Contains(payload.Message, "saldo wallet sudah direfund") {
		t.Fatalf("expected refund message, got %q", payload.Message)
	}

	if len(fakeJAP.inputs) != 1 {
		t.Fatalf("expected 1 provider call, got %d", len(fakeJAP.inputs))
	}
	if fakeJAP.inputs[0].ServiceID != "6331" || fakeJAP.inputs[0].Quantity != 1000 {
		t.Fatalf("unexpected provider payload: %+v", fakeJAP.inputs[0])
	}

	var storedUser model.User
	if err := db.First(&storedUser, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if storedUser.WalletBalance != 20000 {
		t.Fatalf("expected wallet refunded to 20000, got %d", storedUser.WalletBalance)
	}

	var storedOrder model.SosmedOrder
	if err := db.First(&storedOrder, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if storedOrder.PaymentStatus != "failed" || storedOrder.OrderStatus != "failed" || storedOrder.ProviderStatus != "failed" {
		t.Fatalf("unexpected failed order state: %+v", storedOrder)
	}
	if !strings.Contains(storedOrder.ProviderError, "JAP lagi error smoke") {
		t.Fatalf("expected provider error to be stored, got %q", storedOrder.ProviderError)
	}
	if storedOrder.ProviderOrderID != "" {
		t.Fatalf("provider order id should stay empty on failure, got %q", storedOrder.ProviderOrderID)
	}

	var eventCount int64
	if err := db.Model(&model.SosmedOrderEvent{}).
		Where("order_id = ?", storedOrder.ID).
		Count(&eventCount).Error; err != nil {
		t.Fatalf("count events: %v", err)
	}
	if eventCount < 2 {
		t.Fatalf("expected at least 2 order events, got %d", eventCount)
	}

	var chargeCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("reference = ?", "sosmed_order:"+storedOrder.ID.String()+":charge").
		Count(&chargeCount).Error; err != nil {
		t.Fatalf("count charge ledger: %v", err)
	}
	if chargeCount != 1 {
		t.Fatalf("expected 1 wallet charge ledger, got %d", chargeCount)
	}

	var refundCount int64
	if err := db.Model(&model.WalletLedger{}).
		Where("reference = ?", "sosmed_order:"+storedOrder.ID.String()+":refund").
		Count(&refundCount).Error; err != nil {
		t.Fatalf("count refund ledger: %v", err)
	}
	if refundCount != 1 {
		t.Fatalf("expected 1 wallet refund ledger, got %d", refundCount)
	}
}
