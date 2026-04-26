package handler

import (
	"context"
	"encoding/json"
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
}

func (f *fakeHandlerJAPOrderProvider) AddOrder(_ context.Context, input service.JAPAddOrderInput) (*service.JAPAddOrderResponse, error) {
	f.inputs = append(f.inputs, input)
	return &service.JAPAddOrderResponse{Order: "JAP-SMOKE-1001"}, nil
}

type handlerSmokeEnvelope struct {
	Message string                    `json:"message"`
	Data    handlerSmokeOrderResponse `json:"data"`
}

type handlerSmokeOrderResponse struct {
	Order *model.SosmedOrder `json:"order"`
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

	body := `{"service_id":"` + serviceRow.ID.String() + `","target_link":"https://instagram.com/example","quantity":2,"notes":"smoke test wallet jap"}`
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
