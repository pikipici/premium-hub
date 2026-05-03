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

type fakeBundleHandlerJAPOrderProvider struct {
	inputs []service.JAPAddOrderInput
	errors []error
}

func (f *fakeBundleHandlerJAPOrderProvider) AddOrder(_ context.Context, input service.JAPAddOrderInput) (*service.JAPAddOrderResponse, error) {
	f.inputs = append(f.inputs, input)
	idx := len(f.inputs) - 1
	if idx < len(f.errors) && f.errors[idx] != nil {
		return nil, f.errors[idx]
	}
	return &service.JAPAddOrderResponse{Order: service.JAPServiceID(fmt.Sprintf("BUNDLE-HANDLER-%d", len(f.inputs)))}, nil
}

func (f *fakeBundleHandlerJAPOrderProvider) GetOrderStatus(context.Context, string) (*service.JAPOrderStatusResponse, error) {
	return nil, nil
}

func (f *fakeBundleHandlerJAPOrderProvider) RequestRefill(context.Context, string) (*service.JAPRefillResponse, error) {
	return nil, nil
}

func (f *fakeBundleHandlerJAPOrderProvider) GetRefillStatus(context.Context, string) (*service.JAPRefillStatusResponse, error) {
	return nil, nil
}

type bundleOrderHandlerEnvelope struct {
	Success bool                    `json:"success"`
	Message string                  `json:"message"`
	Data    model.SosmedBundleOrder `json:"data"`
}

type userBundleOrderHandlerEnvelope struct {
	Success bool                          `json:"success"`
	Message string                        `json:"message"`
	Data    userSosmedBundleOrderResponse `json:"data"`
}

type bundleOrderHandlerListEnvelope struct {
	Success bool                       `json:"success"`
	Message string                     `json:"message"`
	Data    []model.SosmedBundleOrder  `json:"data"`
	Meta    bundleOrderHandlerListMeta `json:"meta"`
}

type userBundleOrderHandlerListEnvelope struct {
	Success bool                            `json:"success"`
	Message string                          `json:"message"`
	Data    []userSosmedBundleOrderResponse `json:"data"`
	Meta    bundleOrderHandlerListMeta      `json:"meta"`
}

type bundleOrderHandlerListMeta struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

func setupSosmedBundleOrderHandlerDB(t *testing.T) *gorm.DB {
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
		&model.WalletLedger{},
		&model.SosmedBundlePackage{},
		&model.SosmedBundleVariant{},
		&model.SosmedBundleItem{},
		&model.SosmedBundleOrder{},
		&model.SosmedBundleOrderItem{},
	); err != nil {
		t.Fatalf("migrate models: %v", err)
	}
	return db
}

func seedSosmedBundleOrderHandlerGraph(t *testing.T, db *gorm.DB) (*model.User, *model.SosmedBundlePackage, *model.SosmedBundleVariant) {
	t.Helper()
	buyer := &model.User{ID: uuid.New(), Name: "Bundle Handler User", Email: "bundle-handler@example.com", Password: "hashed", Role: "user", IsActive: true, WalletBalance: 10000}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	followers := &model.SosmedService{ID: uuid.New(), CategoryCode: "followers", Code: "jap-2989", Title: "Instagram Followers", ProviderCode: "jap", ProviderServiceID: "2989", ProviderRate: "2500", CheckoutPrice: 5000, IsActive: true}
	likes := &model.SosmedService{ID: uuid.New(), CategoryCode: "likes", Code: "jap-8216", Title: "Instagram Likes", ProviderCode: "jap", ProviderServiceID: "8216", ProviderRate: "1000", CheckoutPrice: 3000, IsActive: true}
	if err := db.Create([]*model.SosmedService{followers, likes}).Error; err != nil {
		t.Fatalf("create sosmed services: %v", err)
	}

	pkg := &model.SosmedBundlePackage{ID: uuid.New(), Key: "instagram-umkm", Title: "Instagram UMKM", Platform: "instagram", IsActive: true}
	if err := db.Create(pkg).Error; err != nil {
		t.Fatalf("create bundle package: %v", err)
	}
	variant := &model.SosmedBundleVariant{ID: uuid.New(), BundlePackageID: pkg.ID, Key: "starter", Name: "Starter", PriceMode: "computed_with_discount", DiscountAmount: 250, IsActive: true}
	if err := db.Create(variant).Error; err != nil {
		t.Fatalf("create bundle variant: %v", err)
	}
	items := []model.SosmedBundleItem{
		{ID: uuid.New(), BundleVariantID: variant.ID, SosmedServiceID: followers.ID, QuantityUnits: 500, TargetStrategy: "same_target", IsActive: true, SortOrder: 1},
		{ID: uuid.New(), BundleVariantID: variant.ID, SosmedServiceID: likes.ID, QuantityUnits: 100, TargetStrategy: "same_target", IsActive: true, SortOrder: 2},
	}
	if err := db.Create(&items).Error; err != nil {
		t.Fatalf("create bundle items: %v", err)
	}
	return buyer, pkg, variant
}

func newSosmedBundleOrderHandlerForTest(db *gorm.DB, provider service.SosmedJAPOrderProvider) *SosmedBundleOrderHandler {
	svc := service.NewSosmedBundleOrderService(
		repository.NewSosmedBundleRepo(db),
		repository.NewSosmedBundleOrderRepo(db),
		repository.NewWalletRepo(db),
	).SetJAPOrderProvider(provider)
	return NewSosmedBundleOrderHandler(svc)
}

func TestCreateSosmedBundleOrderHandlerSubmitsProviderAndReturnsOrder(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSosmedBundleOrderHandlerDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderHandlerGraph(t, db)
	fakeJAP := &fakeBundleHandlerJAPOrderProvider{}

	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("user_id", buyer.ID); c.Next() })
	router.POST("/api/v1/sosmed/bundle-orders", newSosmedBundleOrderHandlerForTest(db, fakeJAP).Create)

	body := `{"bundle_key":"` + pkg.Key + `","variant_key":"` + variant.Key + `","target_link":"https://instagram.com/example","payment_method":"wallet","idempotency_key":"` + uuid.NewString() + `","target_public_confirmed":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sosmed/bundle-orders", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d body=%s", rec.Code, rec.Body.String())
	}
	var payload userBundleOrderHandlerEnvelope
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v body=%s", err, rec.Body.String())
	}
	if payload.Data.OrderNumber == "" || payload.Data.Status != service.SosmedBundleOrderStatusProcessing || len(payload.Data.Items) != 2 {
		t.Fatalf("unexpected created bundle order response: %+v", payload.Data)
	}
	if payload.Data.TotalPrice != 2550 {
		t.Fatalf("expected total price 2550, got %d", payload.Data.TotalPrice)
	}
	if strings.Contains(rec.Body.String(), "provider_order_id") || strings.Contains(rec.Body.String(), "provider_error") || strings.Contains(rec.Body.String(), "cost_price_snapshot") || strings.Contains(rec.Body.String(), "margin_snapshot") {
		t.Fatalf("user create response leaked provider/cost fields: %s", rec.Body.String())
	}
	if len(fakeJAP.inputs) != 2 || fakeJAP.inputs[0].Quantity != 500 || fakeJAP.inputs[1].Quantity != 100 {
		t.Fatalf("unexpected provider inputs: %+v", fakeJAP.inputs)
	}
}

func TestListAndDetailSosmedBundleOrderHandlerReturnOnlyCurrentUserOrders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSosmedBundleOrderHandlerDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderHandlerGraph(t, db)
	fakeJAP := &fakeBundleHandlerJAPOrderProvider{}
	h := newSosmedBundleOrderHandlerForTest(db, fakeJAP)
	created, err := h.svc.Create(context.Background(), buyer.ID, service.CreateSosmedBundleOrderInput{BundleKey: pkg.Key, VariantKey: variant.Key, TargetLink: "https://instagram.com/example", PaymentMethod: "wallet", IdempotencyKey: uuid.NewString(), TargetPublicConfirmed: true})
	if err != nil {
		t.Fatalf("create order fixture: %v", err)
	}
	otherUser := &model.User{ID: uuid.New(), Name: "Other", Email: "other-bundle@example.com", Password: "hashed", Role: "user", IsActive: true, WalletBalance: 10000}
	if err := db.Create(otherUser).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}
	if _, err := h.svc.Create(context.Background(), otherUser.ID, service.CreateSosmedBundleOrderInput{BundleKey: pkg.Key, VariantKey: variant.Key, TargetLink: "https://instagram.com/other", PaymentMethod: "wallet", IdempotencyKey: uuid.NewString(), TargetPublicConfirmed: true}); err != nil {
		t.Fatalf("create other order fixture: %v", err)
	}

	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("user_id", buyer.ID); c.Next() })
	router.GET("/api/v1/sosmed/bundle-orders", h.List)
	router.GET("/api/v1/sosmed/bundle-orders/:order_number", h.GetByOrderNumber)

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/sosmed/bundle-orders?page=1&limit=10", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d body=%s", listRec.Code, listRec.Body.String())
	}
	var listPayload userBundleOrderHandlerListEnvelope
	if err := json.Unmarshal(listRec.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("decode list response: %v body=%s", err, listRec.Body.String())
	}
	if listPayload.Meta.Total != 1 || len(listPayload.Data) != 1 || listPayload.Data[0].OrderNumber != created.OrderNumber {
		t.Fatalf("expected only current user order, got payload=%+v", listPayload)
	}
	if strings.Contains(listRec.Body.String(), "provider_order_id") || strings.Contains(listRec.Body.String(), "provider_error") || strings.Contains(listRec.Body.String(), "cost_price_snapshot") || strings.Contains(listRec.Body.String(), "margin_snapshot") {
		t.Fatalf("user list response leaked provider/cost fields: %s", listRec.Body.String())
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/api/v1/sosmed/bundle-orders/"+created.OrderNumber, nil)
	detailRec := httptest.NewRecorder()
	router.ServeHTTP(detailRec, detailReq)
	if detailRec.Code != http.StatusOK {
		t.Fatalf("expected detail status 200, got %d body=%s", detailRec.Code, detailRec.Body.String())
	}
	var detailPayload userBundleOrderHandlerEnvelope
	if err := json.Unmarshal(detailRec.Body.Bytes(), &detailPayload); err != nil {
		t.Fatalf("decode detail response: %v body=%s", err, detailRec.Body.String())
	}
	if detailPayload.Data.OrderNumber != created.OrderNumber || len(detailPayload.Data.Items) != 2 {
		t.Fatalf("unexpected detail response: %+v", detailPayload.Data)
	}
	if strings.Contains(detailRec.Body.String(), "provider_order_id") || strings.Contains(detailRec.Body.String(), "provider_error") || strings.Contains(detailRec.Body.String(), "cost_price_snapshot") || strings.Contains(detailRec.Body.String(), "margin_snapshot") {
		t.Fatalf("user detail response leaked provider/cost fields: %s", detailRec.Body.String())
	}
}

func TestAdminSosmedBundleOrderHandlerListsAndDetailsFailedChildItems(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupSosmedBundleOrderHandlerDB(t)
	buyer, pkg, variant := seedSosmedBundleOrderHandlerGraph(t, db)
	fakeJAP := &fakeBundleHandlerJAPOrderProvider{errors: []error{nil, errors.New("provider timeout")}}
	h := newSosmedBundleOrderHandlerForTest(db, fakeJAP)
	created, err := h.svc.Create(context.Background(), buyer.ID, service.CreateSosmedBundleOrderInput{BundleKey: pkg.Key, VariantKey: variant.Key, TargetLink: "https://instagram.com/example", PaymentMethod: "wallet", IdempotencyKey: uuid.NewString(), TargetPublicConfirmed: true})
	if err != nil {
		t.Fatalf("create partial order fixture: %v", err)
	}
	if created.Status != service.SosmedBundleOrderStatusPartial {
		t.Fatalf("expected partial fixture, got %+v", created)
	}

	router := gin.New()
	router.GET("/api/v1/admin/sosmed/bundle-orders", h.AdminList)
	router.GET("/api/v1/admin/sosmed/bundle-orders/:order_number", h.AdminGetByOrderNumber)

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sosmed/bundle-orders?status=partial&page=1&limit=10", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected admin list status 200, got %d body=%s", listRec.Code, listRec.Body.String())
	}
	var listPayload bundleOrderHandlerListEnvelope
	if err := json.Unmarshal(listRec.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("decode admin list response: %v body=%s", err, listRec.Body.String())
	}
	if listPayload.Meta.Total != 1 || len(listPayload.Data) != 1 || listPayload.Data[0].OrderNumber != created.OrderNumber {
		t.Fatalf("expected partial bundle order in admin list, got %+v", listPayload)
	}
	if len(listPayload.Data[0].Items) != 2 || listPayload.Data[0].Items[1].Status != service.SosmedBundleOrderItemStatusFailed {
		t.Fatalf("expected failed child item visible in admin list, got %+v", listPayload.Data[0].Items)
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sosmed/bundle-orders/"+created.OrderNumber, nil)
	detailRec := httptest.NewRecorder()
	router.ServeHTTP(detailRec, detailReq)
	if detailRec.Code != http.StatusOK {
		t.Fatalf("expected admin detail status 200, got %d body=%s", detailRec.Code, detailRec.Body.String())
	}
	var detailPayload bundleOrderHandlerEnvelope
	if err := json.Unmarshal(detailRec.Body.Bytes(), &detailPayload); err != nil {
		t.Fatalf("decode admin detail response: %v body=%s", err, detailRec.Body.String())
	}
	if detailPayload.Data.OrderNumber != created.OrderNumber || detailPayload.Data.UserID != buyer.ID || len(detailPayload.Data.Items) != 2 {
		t.Fatalf("unexpected admin detail response: %+v", detailPayload.Data)
	}
	if detailPayload.Data.Items[1].Status != service.SosmedBundleOrderItemStatusFailed || !strings.Contains(detailPayload.Data.Items[1].ProviderError, "provider timeout") {
		t.Fatalf("expected failed child item provider error in admin detail, got %+v", detailPayload.Data.Items[1])
	}
}
