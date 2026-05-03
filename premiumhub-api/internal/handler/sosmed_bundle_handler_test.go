package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSosmedBundleHandlerTestDB(t *testing.T) *gorm.DB {
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
		&model.SosmedService{},
		&model.SosmedBundlePackage{},
		&model.SosmedBundleVariant{},
		&model.SosmedBundleItem{},
	); err != nil {
		t.Fatalf("migrate bundle handler models: %v", err)
	}
	return db
}

func seedSosmedBundleHandlerGraph(t *testing.T, db *gorm.DB) {
	t.Helper()

	followers := &model.SosmedService{
		CategoryCode:      "followers",
		Code:              "jap-ig-followers-test",
		Title:             "Instagram Followers Test",
		PlatformLabel:     "Instagram",
		CheckoutPrice:     7500,
		ProviderCode:      "jap",
		ProviderServiceID: "2989",
		ProviderRate:      "0.25",
		ProviderCurrency:  "USD",
		MinOrder:          "Min 100 Max 10000",
		IsActive:          true,
	}
	likes := &model.SosmedService{
		CategoryCode:      "likes",
		Code:              "jap-ig-likes-test",
		Title:             "Instagram Likes Test",
		PlatformLabel:     "Instagram",
		CheckoutPrice:     5000,
		ProviderCode:      "jap",
		ProviderServiceID: "8216",
		ProviderRate:      "0.10",
		ProviderCurrency:  "USD",
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
		Subtitle:      "Paket growth ringan",
		Description:   "Followers dan likes untuk UMKM",
		Platform:      "instagram",
		Badge:         "Terlaris",
		IsHighlighted: true,
		IsActive:      true,
		SortOrder:     10,
	}
	if err := db.Create(pkg).Error; err != nil {
		t.Fatalf("create package: %v", err)
	}

	starter := &model.SosmedBundleVariant{
		BundlePackageID: pkg.ID,
		Key:             "starter",
		Name:            "Starter",
		Description:     "Mulai dari sini",
		PriceMode:       "computed_with_discount",
		DiscountAmount:  500,
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(starter).Error; err != nil {
		t.Fatalf("create starter variant: %v", err)
	}
	if err := db.Create(&model.SosmedBundleItem{
		BundleVariantID: starter.ID,
		SosmedServiceID: followers.ID,
		Label:           "Followers",
		QuantityUnits:   500,
		TargetStrategy:  "same_target",
		IsActive:        true,
		SortOrder:       10,
	}).Error; err != nil {
		t.Fatalf("create followers item: %v", err)
	}
	if err := db.Create(&model.SosmedBundleItem{
		BundleVariantID: starter.ID,
		SosmedServiceID: likes.ID,
		Label:           "Likes",
		QuantityUnits:   100,
		TargetStrategy:  "same_target",
		IsActive:        true,
		SortOrder:       20,
	}).Error; err != nil {
		t.Fatalf("create likes item: %v", err)
	}

	inactiveVariant := &model.SosmedBundleVariant{
		BundlePackageID: pkg.ID,
		Key:             "draft",
		Name:            "Draft",
		PriceMode:       "computed",
		IsActive:        true,
		SortOrder:       20,
	}
	if err := db.Create(inactiveVariant).Error; err != nil {
		t.Fatalf("create inactive variant: %v", err)
	}
	if err := db.Model(inactiveVariant).Update("is_active", false).Error; err != nil {
		t.Fatalf("mark variant inactive: %v", err)
	}
}

func setupSosmedBundleHandlerRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewSosmedBundleHandler(repository.NewSosmedBundleRepo(db))
	r.GET("/api/v1/public/sosmed/bundles", h.PublicList)
	r.GET("/api/v1/public/sosmed/bundles/:key", h.PublicDetail)
	return r
}

func TestSosmedBundleHandlerPublicListReturnsCalculatedCatalogWithoutProviderMetadata(t *testing.T) {
	db := setupSosmedBundleHandlerTestDB(t)
	seedSosmedBundleHandlerGraph(t, db)
	r := setupSosmedBundleHandlerRouter(db)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/public/sosmed/bundles", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if strings.Contains(body, "provider_") || strings.Contains(body, "2989") || strings.Contains(body, "0.25") {
		t.Fatalf("public bundle response leaked provider metadata: %s", body)
	}

	var payload struct {
		Success bool `json:"success"`
		Data    []struct {
			Key      string `json:"key"`
			Title    string `json:"title"`
			Platform string `json:"platform"`
			Badge    string `json:"badge"`
			Variants []struct {
				Key            string `json:"key"`
				Name           string `json:"name"`
				SubtotalPrice  int64  `json:"subtotal_price"`
				DiscountAmount int64  `json:"discount_amount"`
				TotalPrice     int64  `json:"total_price"`
				OriginalPrice  int64  `json:"original_price"`
				Items          []struct {
					ServiceCode   string `json:"service_code"`
					Title         string `json:"title"`
					QuantityUnits int64  `json:"quantity_units"`
					LinePrice     int64  `json:"line_price"`
				} `json:"items"`
			} `json:"variants"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v body=%s", err, body)
	}
	if !payload.Success {
		t.Fatalf("expected success response")
	}
	if len(payload.Data) != 1 {
		t.Fatalf("expected one public bundle, got %d", len(payload.Data))
	}
	bundle := payload.Data[0]
	if bundle.Key != "instagram-umkm" || bundle.Title != "Instagram UMKM" || bundle.Platform != "instagram" || bundle.Badge != "Terlaris" {
		t.Fatalf("unexpected bundle summary: %+v", bundle)
	}
	if len(bundle.Variants) != 1 {
		t.Fatalf("expected inactive variant to be hidden and one active variant shown, got %d", len(bundle.Variants))
	}
	variant := bundle.Variants[0]
	if variant.Key != "starter" || variant.Name != "Starter" {
		t.Fatalf("unexpected variant summary: %+v", variant)
	}
	if variant.SubtotalPrice != 4250 || variant.DiscountAmount != 500 || variant.TotalPrice != 3750 || variant.OriginalPrice != 4250 {
		t.Fatalf("unexpected calculated pricing: %+v", variant)
	}
	if len(variant.Items) != 2 {
		t.Fatalf("expected two line items, got %d", len(variant.Items))
	}
	if variant.Items[0].ServiceCode != "jap-ig-followers-test" || variant.Items[0].QuantityUnits != 500 || variant.Items[0].LinePrice != 3750 {
		t.Fatalf("unexpected first line item: %+v", variant.Items[0])
	}
	if variant.Items[1].ServiceCode != "jap-ig-likes-test" || variant.Items[1].QuantityUnits != 100 || variant.Items[1].LinePrice != 500 {
		t.Fatalf("unexpected second line item: %+v", variant.Items[1])
	}
}

func TestSosmedBundleHandlerPublicDetailReturnsOneBundleAnd404ForMissingKey(t *testing.T) {
	db := setupSosmedBundleHandlerTestDB(t)
	seedSosmedBundleHandlerGraph(t, db)
	r := setupSosmedBundleHandlerRouter(db)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/public/sosmed/bundles/instagram-umkm", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected detail 200, got %d body=%s", w.Code, w.Body.String())
	}
	var payload struct {
		Data struct {
			Key      string `json:"key"`
			Variants []struct {
				Key string `json:"key"`
			} `json:"variants"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode detail response: %v", err)
	}
	if payload.Data.Key != "instagram-umkm" || len(payload.Data.Variants) != 1 || payload.Data.Variants[0].Key != "starter" {
		t.Fatalf("unexpected detail payload: %+v", payload.Data)
	}

	missing := httptest.NewRecorder()
	missingReq := httptest.NewRequest(http.MethodGet, "/api/v1/public/sosmed/bundles/missing-bundle", nil)
	r.ServeHTTP(missing, missingReq)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("expected missing detail 404, got %d body=%s", missing.Code, missing.Body.String())
	}
}
