package handler

import (
	"bytes"
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
	"gorm.io/gorm"
)

type sosmedBundleAdminHandlerFixture struct {
	Package         model.SosmedBundlePackage
	InactivePackage model.SosmedBundlePackage
	Variant         model.SosmedBundleVariant
	InactiveVariant model.SosmedBundleVariant
	Item            model.SosmedBundleItem
	InactiveItem    model.SosmedBundleItem
	Followers       model.SosmedService
	Likes           model.SosmedService
}

type adminHandlerListItemPayload struct {
	ID              uuid.UUID `json:"id"`
	BundleVariantID uuid.UUID `json:"bundle_variant_id"`
	SosmedServiceID uuid.UUID `json:"sosmed_service_id"`
	ServiceCode     string    `json:"service_code"`
	ServiceTitle    string    `json:"service_title"`
	Label           string    `json:"label"`
	QuantityUnits   int64     `json:"quantity_units"`
	LinePrice       int64     `json:"line_price"`
	TargetStrategy  string    `json:"target_strategy"`
	IsActive        bool      `json:"is_active"`
	ServiceIsActive bool      `json:"service_is_active"`
}

type adminHandlerListVariantPayload struct {
	ID                       uuid.UUID                     `json:"id"`
	BundlePackageID          uuid.UUID                     `json:"bundle_package_id"`
	Key                      string                        `json:"key"`
	PriceMode                string                        `json:"price_mode"`
	SubtotalPrice            int64                         `json:"subtotal_price"`
	DiscountAmount           int64                         `json:"discount_amount"`
	DiscountAmountCalculated int64                         `json:"discount_amount_calculated"`
	TotalPrice               int64                         `json:"total_price"`
	OriginalPrice            int64                         `json:"original_price"`
	IsActive                 bool                          `json:"is_active"`
	Items                    []adminHandlerListItemPayload `json:"items"`
}

type adminHandlerListPackagePayload struct {
	ID       uuid.UUID                        `json:"id"`
	Key      string                           `json:"key"`
	Title    string                           `json:"title"`
	Platform string                           `json:"platform"`
	IsActive bool                             `json:"is_active"`
	Variants []adminHandlerListVariantPayload `json:"variants"`
}

func setupSosmedBundleAdminHandlerRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	bundleRepo := repository.NewSosmedBundleRepo(db)
	serviceRepo := repository.NewSosmedServiceRepo(db)
	h := NewSosmedBundleAdminHandler(service.NewSosmedBundleAdminService(bundleRepo, serviceRepo))

	r.GET("/api/v1/admin/sosmed/bundles", h.AdminList)
	r.POST("/api/v1/admin/sosmed/bundles", h.AdminCreatePackage)
	r.PUT("/api/v1/admin/sosmed/bundles/:id", h.AdminUpdatePackage)
	r.DELETE("/api/v1/admin/sosmed/bundles/:id", h.AdminDeletePackage)
	r.POST("/api/v1/admin/sosmed/bundles/:id/variants", h.AdminCreateVariant)
	r.PUT("/api/v1/admin/sosmed/bundle-variants/:variant_id", h.AdminUpdateVariant)
	r.DELETE("/api/v1/admin/sosmed/bundle-variants/:variant_id", h.AdminDeleteVariant)
	r.POST("/api/v1/admin/sosmed/bundle-variants/:variant_id/items", h.AdminCreateItem)
	r.PUT("/api/v1/admin/sosmed/bundle-items/:item_id", h.AdminUpdateItem)
	r.DELETE("/api/v1/admin/sosmed/bundle-items/:item_id", h.AdminDeleteItem)
	return r
}

func seedSosmedBundleAdminHandlerFixture(t *testing.T, db *gorm.DB) sosmedBundleAdminHandlerFixture {
	t.Helper()

	followers := model.SosmedService{
		CategoryCode:      "followers",
		Code:              "admin-ig-followers",
		Title:             "Admin Instagram Followers",
		PlatformLabel:     "Instagram",
		CheckoutPrice:     7500,
		ProviderCode:      "jap",
		ProviderServiceID: "987654",
		ProviderRate:      "0.25",
		ProviderCurrency:  "USD",
		MinOrder:          "Min 100 Max 10000",
		IsActive:          true,
	}
	likes := model.SosmedService{
		CategoryCode:      "likes",
		Code:              "admin-ig-likes",
		Title:             "Admin Instagram Likes",
		PlatformLabel:     "Instagram",
		CheckoutPrice:     5000,
		ProviderCode:      "jap",
		ProviderServiceID: "123456",
		ProviderRate:      "0.10",
		ProviderCurrency:  "USD",
		MinOrder:          "Min 50 Max 10000",
		IsActive:          true,
	}
	if err := db.Create(&followers).Error; err != nil {
		t.Fatalf("create followers service: %v", err)
	}
	if err := db.Create(&likes).Error; err != nil {
		t.Fatalf("create likes service: %v", err)
	}

	pkg := model.SosmedBundlePackage{
		Key:           "admin-instagram-growth",
		Title:         "Admin Instagram Growth",
		Subtitle:      "Paket admin",
		Description:   "Editable dari admin",
		Platform:      "instagram",
		Badge:         "Admin",
		IsHighlighted: true,
		IsActive:      true,
		SortOrder:     10,
	}
	if err := db.Create(&pkg).Error; err != nil {
		t.Fatalf("create package: %v", err)
	}

	inactivePackage := model.SosmedBundlePackage{
		Key:       "admin-inactive-package",
		Title:     "Admin Inactive Package",
		Platform:  "instagram",
		IsActive:  true,
		SortOrder: 20,
	}
	if err := db.Create(&inactivePackage).Error; err != nil {
		t.Fatalf("create inactive package: %v", err)
	}
	if err := db.Model(&inactivePackage).Update("is_active", false).Error; err != nil {
		t.Fatalf("mark package inactive: %v", err)
	}
	inactivePackage.IsActive = false

	variant := model.SosmedBundleVariant{
		BundlePackageID: pkg.ID,
		Key:             "starter",
		Name:            "Starter",
		Description:     "Mulai aman",
		PriceMode:       "computed_with_discount",
		DiscountAmount:  500,
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(&variant).Error; err != nil {
		t.Fatalf("create variant: %v", err)
	}

	inactiveVariant := model.SosmedBundleVariant{
		BundlePackageID: pkg.ID,
		Key:             "draft",
		Name:            "Draft",
		PriceMode:       "computed",
		IsActive:        true,
		SortOrder:       20,
	}
	if err := db.Create(&inactiveVariant).Error; err != nil {
		t.Fatalf("create inactive variant: %v", err)
	}
	if err := db.Model(&inactiveVariant).Update("is_active", false).Error; err != nil {
		t.Fatalf("mark variant inactive: %v", err)
	}
	inactiveVariant.IsActive = false

	item := model.SosmedBundleItem{
		BundleVariantID: variant.ID,
		SosmedServiceID: followers.ID,
		Service:         followers,
		Label:           "Followers",
		QuantityUnits:   500,
		TargetStrategy:  "same_target",
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}

	inactiveItem := model.SosmedBundleItem{
		BundleVariantID: variant.ID,
		SosmedServiceID: likes.ID,
		Service:         likes,
		Label:           "Likes Draft",
		QuantityUnits:   100,
		TargetStrategy:  "same_target",
		IsActive:        true,
		SortOrder:       20,
	}
	if err := db.Create(&inactiveItem).Error; err != nil {
		t.Fatalf("create inactive item: %v", err)
	}
	if err := db.Model(&inactiveItem).Update("is_active", false).Error; err != nil {
		t.Fatalf("mark item inactive: %v", err)
	}
	inactiveItem.IsActive = false

	variant.Items = []model.SosmedBundleItem{item, inactiveItem}
	inactiveVariant.Items = []model.SosmedBundleItem{}
	pkg.Variants = []model.SosmedBundleVariant{variant, inactiveVariant}

	return sosmedBundleAdminHandlerFixture{
		Package:         pkg,
		InactivePackage: inactivePackage,
		Variant:         variant,
		InactiveVariant: inactiveVariant,
		Item:            item,
		InactiveItem:    inactiveItem,
		Followers:       followers,
		Likes:           likes,
	}
}

func adminHandlerJSONRequest(t *testing.T, method, path string, payload any) *http.Request {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal request payload: %v", err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestSosmedBundleAdminResponseDTOIncludesAdminFieldsWithoutProviderSecrets(t *testing.T) {
	followers := model.SosmedService{
		ID:                uuid.New(),
		Code:              "dto-followers",
		Title:             "DTO Followers",
		CheckoutPrice:     8000,
		ProviderCode:      "jap",
		ProviderServiceID: "secret-provider-id",
		ProviderRate:      "0.33",
		ProviderCurrency:  "USD",
		MinOrder:          "Min 100 Max 10000",
		IsActive:          true,
	}
	item := model.SosmedBundleItem{
		ID:              uuid.New(),
		SosmedServiceID: followers.ID,
		Service:         followers,
		Label:           "Followers",
		QuantityUnits:   500,
		TargetStrategy:  "same_target",
		IsActive:        true,
		SortOrder:       10,
	}
	variant := model.SosmedBundleVariant{
		ID:              uuid.New(),
		BundlePackageID: uuid.New(),
		Key:             "starter",
		Name:            "Starter",
		PriceMode:       "computed_with_discount",
		DiscountAmount:  500,
		IsActive:        true,
		SortOrder:       10,
		Items:           []model.SosmedBundleItem{item},
	}
	pkg := model.SosmedBundlePackage{
		ID:            variant.BundlePackageID,
		Key:           "dto-package",
		Title:         "DTO Package",
		Platform:      "instagram",
		IsHighlighted: true,
		IsActive:      true,
		SortOrder:     1,
		Variants:      []model.SosmedBundleVariant{variant},
	}

	payload := toAdminSosmedBundlePackageResponse(pkg)
	if payload.ID != pkg.ID || payload.Key != "dto-package" || !payload.IsActive || !payload.IsHighlighted {
		t.Fatalf("unexpected package DTO summary: %+v", payload)
	}
	if len(payload.Variants) != 1 {
		t.Fatalf("expected one variant DTO, got %d", len(payload.Variants))
	}
	variantDTO := payload.Variants[0]
	if variantDTO.BundlePackageID != pkg.ID || variantDTO.PriceMode != "computed_with_discount" || variantDTO.SubtotalPrice != 4000 || variantDTO.DiscountAmountCalculated != 500 || variantDTO.TotalPrice != 3500 || variantDTO.OriginalPrice != 4000 {
		t.Fatalf("unexpected variant DTO pricing: %+v", variantDTO)
	}
	if len(variantDTO.Items) != 1 {
		t.Fatalf("expected one item DTO, got %d", len(variantDTO.Items))
	}
	itemDTO := variantDTO.Items[0]
	if itemDTO.SosmedServiceID != followers.ID || itemDTO.ServiceCode != "dto-followers" || itemDTO.ServiceTitle != "DTO Followers" || itemDTO.LinePrice != 4000 || !itemDTO.ServiceIsActive {
		t.Fatalf("unexpected item DTO: %+v", itemDTO)
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal admin bundle DTO: %v", err)
	}
	body := string(encoded)
	if strings.Contains(body, "provider_") || strings.Contains(body, "secret-provider-id") || strings.Contains(body, "0.33") {
		t.Fatalf("admin bundle DTO leaked raw provider secret fields: %s", body)
	}
}

func TestSosmedBundleAdminHandlerListDefaultsToInactiveGraphAndCalculatedFields(t *testing.T) {
	db := setupSosmedBundleHandlerTestDB(t)
	fixture := seedSosmedBundleAdminHandlerFixture(t, db)
	r := setupSosmedBundleAdminHandlerRouter(db)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sosmed/bundles", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if strings.Contains(body, "provider_") || strings.Contains(body, "987654") || strings.Contains(body, "0.25") {
		t.Fatalf("admin bundle response leaked raw provider metadata: %s", body)
	}

	var payload struct {
		Success bool                             `json:"success"`
		Data    []adminHandlerListPackagePayload `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode list response: %v body=%s", err, body)
	}
	if !payload.Success {
		t.Fatalf("expected success payload")
	}

	active := findAdminHandlerPackagePayload(payload.Data, fixture.Package.Key)
	if active == nil {
		t.Fatalf("active package %s not found in payload: %+v", fixture.Package.Key, payload.Data)
	}
	inactive := findAdminHandlerPackagePayload(payload.Data, fixture.InactivePackage.Key)
	if inactive == nil || inactive.IsActive {
		t.Fatalf("expected inactive package included with is_active=false, got %+v", inactive)
	}
	starter := findAdminHandlerVariantPayload(active.Variants, "starter")
	if starter == nil {
		t.Fatalf("starter variant not found in active payload: %+v", active.Variants)
	}
	if starter.BundlePackageID != fixture.Package.ID || starter.SubtotalPrice != 3750 || starter.DiscountAmount != 500 || starter.DiscountAmountCalculated != 500 || starter.TotalPrice != 3250 || starter.OriginalPrice != 3750 {
		t.Fatalf("unexpected starter pricing: %+v", starter)
	}
	draft := findAdminHandlerVariantPayload(active.Variants, "draft")
	if draft == nil || draft.IsActive {
		t.Fatalf("expected inactive draft variant included, got %+v", draft)
	}
	inactiveLine := findAdminHandlerItemPayload(starter.Items, fixture.InactiveItem.ID)
	if inactiveLine == nil || inactiveLine.IsActive {
		t.Fatalf("expected inactive item included, got %+v", inactiveLine)
	}
	activeLine := findAdminHandlerItemPayload(starter.Items, fixture.Item.ID)
	if activeLine == nil || activeLine.BundleVariantID != fixture.Variant.ID || activeLine.SosmedServiceID != fixture.Followers.ID || activeLine.ServiceCode != fixture.Followers.Code || activeLine.ServiceTitle != fixture.Followers.Title || activeLine.LinePrice != 3750 || !activeLine.ServiceIsActive {
		t.Fatalf("unexpected active line item: %+v", activeLine)
	}
}

func TestSosmedBundleAdminHandlerCreateUpdateAndDeletePackage(t *testing.T) {
	db := setupSosmedBundleHandlerTestDB(t)
	r := setupSosmedBundleAdminHandlerRouter(db)

	createBody := map[string]any{
		"key":            "handler-package",
		"title":          "Handler Package",
		"subtitle":       "Dari handler",
		"description":    "Editable admin",
		"platform":       "tiktok",
		"badge":          "Baru",
		"is_highlighted": true,
		"is_active":      false,
		"sort_order":     77,
	}
	created := httptest.NewRecorder()
	r.ServeHTTP(created, adminHandlerJSONRequest(t, http.MethodPost, "/api/v1/admin/sosmed/bundles", createBody))
	if created.Code != http.StatusCreated {
		t.Fatalf("expected create package 201, got %d body=%s", created.Code, created.Body.String())
	}
	var createPayload struct {
		Data struct {
			ID            uuid.UUID `json:"id"`
			Key           string    `json:"key"`
			Title         string    `json:"title"`
			Platform      string    `json:"platform"`
			IsHighlighted bool      `json:"is_highlighted"`
			IsActive      bool      `json:"is_active"`
			SortOrder     int       `json:"sort_order"`
			Variants      []any     `json:"variants"`
		} `json:"data"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode create package response: %v", err)
	}
	if createPayload.Data.ID == uuid.Nil || createPayload.Data.Key != "handler-package" || createPayload.Data.Title != "Handler Package" || createPayload.Data.Platform != "tiktok" || !createPayload.Data.IsHighlighted || createPayload.Data.IsActive || createPayload.Data.SortOrder != 77 || len(createPayload.Data.Variants) != 0 {
		t.Fatalf("unexpected create package data: %+v", createPayload.Data)
	}

	updateBody := map[string]any{
		"title":          "Handler Package Updated",
		"platform":       "instagram",
		"is_highlighted": false,
		"is_active":      true,
		"sort_order":     7,
	}
	updated := httptest.NewRecorder()
	updatePath := fmt.Sprintf("/api/v1/admin/sosmed/bundles/%s", createPayload.Data.ID)
	r.ServeHTTP(updated, adminHandlerJSONRequest(t, http.MethodPut, updatePath, updateBody))
	if updated.Code != http.StatusOK {
		t.Fatalf("expected update package 200, got %d body=%s", updated.Code, updated.Body.String())
	}
	var updatePayload struct {
		Data struct {
			ID            uuid.UUID `json:"id"`
			Key           string    `json:"key"`
			Title         string    `json:"title"`
			Platform      string    `json:"platform"`
			IsHighlighted bool      `json:"is_highlighted"`
			IsActive      bool      `json:"is_active"`
			SortOrder     int       `json:"sort_order"`
		} `json:"data"`
	}
	if err := json.Unmarshal(updated.Body.Bytes(), &updatePayload); err != nil {
		t.Fatalf("decode update package response: %v", err)
	}
	if updatePayload.Data.ID != createPayload.Data.ID || updatePayload.Data.Key != "handler-package" || updatePayload.Data.Title != "Handler Package Updated" || updatePayload.Data.Platform != "instagram" || updatePayload.Data.IsHighlighted || !updatePayload.Data.IsActive || updatePayload.Data.SortOrder != 7 {
		t.Fatalf("unexpected update package data: %+v", updatePayload.Data)
	}

	deleted := httptest.NewRecorder()
	r.ServeHTTP(deleted, httptest.NewRequest(http.MethodDelete, updatePath, nil))
	if deleted.Code != http.StatusOK {
		t.Fatalf("expected delete package 200, got %d body=%s", deleted.Code, deleted.Body.String())
	}
	var stored model.SosmedBundlePackage
	if err := db.Unscoped().First(&stored, "id = ?", createPayload.Data.ID).Error; err != nil {
		t.Fatalf("expected deleted package row to remain: %v", err)
	}
	if stored.IsActive || stored.DeletedAt.Valid {
		t.Fatalf("expected delete package to only deactivate row, got %+v", stored)
	}
}

func TestSosmedBundleAdminHandlerCreateUpdateAndDeleteVariant(t *testing.T) {
	db := setupSosmedBundleHandlerTestDB(t)
	fixture := seedSosmedBundleAdminHandlerFixture(t, db)
	r := setupSosmedBundleAdminHandlerRouter(db)

	created := httptest.NewRecorder()
	createPath := fmt.Sprintf("/api/v1/admin/sosmed/bundles/%s/variants", fixture.Package.ID)
	r.ServeHTTP(created, adminHandlerJSONRequest(t, http.MethodPost, createPath, map[string]any{
		"key":         "handler-variant",
		"name":        "Handler Variant",
		"price_mode":  "computed",
		"is_active":   true,
		"sort_order":  30,
		"description": "Varian baru",
	}))
	if created.Code != http.StatusCreated {
		t.Fatalf("expected create variant 201, got %d body=%s", created.Code, created.Body.String())
	}
	var createPayload struct {
		Data struct {
			ID              uuid.UUID `json:"id"`
			BundlePackageID uuid.UUID `json:"bundle_package_id"`
			Key             string    `json:"key"`
			Name            string    `json:"name"`
			PriceMode       string    `json:"price_mode"`
			IsActive        bool      `json:"is_active"`
			SortOrder       int       `json:"sort_order"`
		} `json:"data"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode create variant response: %v", err)
	}
	if createPayload.Data.ID == uuid.Nil || createPayload.Data.BundlePackageID != fixture.Package.ID || createPayload.Data.Key != "handler-variant" || createPayload.Data.Name != "Handler Variant" || createPayload.Data.PriceMode != "computed" || !createPayload.Data.IsActive || createPayload.Data.SortOrder != 30 {
		t.Fatalf("unexpected create variant data: %+v", createPayload.Data)
	}

	updated := httptest.NewRecorder()
	updatePath := fmt.Sprintf("/api/v1/admin/sosmed/bundle-variants/%s", fixture.Variant.ID)
	r.ServeHTTP(updated, adminHandlerJSONRequest(t, http.MethodPut, updatePath, map[string]any{
		"name":            "Starter Updated",
		"price_mode":      "fixed",
		"fixed_price":     3200,
		"discount_amount": 0,
		"is_active":       true,
		"sort_order":      5,
	}))
	if updated.Code != http.StatusOK {
		t.Fatalf("expected update variant 200, got %d body=%s", updated.Code, updated.Body.String())
	}
	var updatePayload struct {
		Data struct {
			ID                       uuid.UUID `json:"id"`
			Key                      string    `json:"key"`
			Name                     string    `json:"name"`
			PriceMode                string    `json:"price_mode"`
			FixedPrice               int64     `json:"fixed_price"`
			SubtotalPrice            int64     `json:"subtotal_price"`
			DiscountAmountCalculated int64     `json:"discount_amount_calculated"`
			TotalPrice               int64     `json:"total_price"`
			OriginalPrice            int64     `json:"original_price"`
			SortOrder                int       `json:"sort_order"`
			Items                    []any     `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(updated.Body.Bytes(), &updatePayload); err != nil {
		t.Fatalf("decode update variant response: %v", err)
	}
	if updatePayload.Data.ID != fixture.Variant.ID || updatePayload.Data.Key != "starter" || updatePayload.Data.Name != "Starter Updated" || updatePayload.Data.PriceMode != "fixed" || updatePayload.Data.FixedPrice != 3200 || updatePayload.Data.SubtotalPrice != 3750 || updatePayload.Data.DiscountAmountCalculated != 550 || updatePayload.Data.TotalPrice != 3200 || updatePayload.Data.OriginalPrice != 3750 || updatePayload.Data.SortOrder != 5 || len(updatePayload.Data.Items) != 1 {
		t.Fatalf("unexpected update variant data: %+v", updatePayload.Data)
	}

	deleted := httptest.NewRecorder()
	deletePath := fmt.Sprintf("/api/v1/admin/sosmed/bundle-variants/%s", fixture.Variant.ID)
	r.ServeHTTP(deleted, httptest.NewRequest(http.MethodDelete, deletePath, nil))
	if deleted.Code != http.StatusOK {
		t.Fatalf("expected delete variant 200, got %d body=%s", deleted.Code, deleted.Body.String())
	}
	var stored model.SosmedBundleVariant
	if err := db.Unscoped().First(&stored, "id = ?", fixture.Variant.ID).Error; err != nil {
		t.Fatalf("expected deleted variant row to remain: %v", err)
	}
	if stored.IsActive || stored.DeletedAt.Valid {
		t.Fatalf("expected delete variant to only deactivate row, got %+v", stored)
	}
}

func TestSosmedBundleAdminHandlerCreateUpdateAndDeleteItem(t *testing.T) {
	db := setupSosmedBundleHandlerTestDB(t)
	fixture := seedSosmedBundleAdminHandlerFixture(t, db)
	r := setupSosmedBundleAdminHandlerRouter(db)

	created := httptest.NewRecorder()
	createPath := fmt.Sprintf("/api/v1/admin/sosmed/bundle-variants/%s/items", fixture.Variant.ID)
	r.ServeHTTP(created, adminHandlerJSONRequest(t, http.MethodPost, createPath, map[string]any{
		"sosmed_service_id": fixture.Likes.ID,
		"label":             "Likes Baru",
		"quantity_units":    150,
		"target_strategy":   "same_target",
		"is_active":         true,
		"sort_order":        30,
	}))
	if created.Code != http.StatusCreated {
		t.Fatalf("expected create item 201, got %d body=%s", created.Code, created.Body.String())
	}
	var createPayload struct {
		Data struct {
			ID              uuid.UUID `json:"id"`
			BundleVariantID uuid.UUID `json:"bundle_variant_id"`
			SosmedServiceID uuid.UUID `json:"sosmed_service_id"`
			ServiceCode     string    `json:"service_code"`
			ServiceTitle    string    `json:"service_title"`
			Label           string    `json:"label"`
			QuantityUnits   int64     `json:"quantity_units"`
			LinePrice       int64     `json:"line_price"`
			TargetStrategy  string    `json:"target_strategy"`
			IsActive        bool      `json:"is_active"`
			SortOrder       int       `json:"sort_order"`
			ServiceIsActive bool      `json:"service_is_active"`
		} `json:"data"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode create item response: %v", err)
	}
	if createPayload.Data.ID == uuid.Nil || createPayload.Data.BundleVariantID != fixture.Variant.ID || createPayload.Data.SosmedServiceID != fixture.Likes.ID || createPayload.Data.ServiceCode != fixture.Likes.Code || createPayload.Data.ServiceTitle != fixture.Likes.Title || createPayload.Data.Label != "Likes Baru" || createPayload.Data.QuantityUnits != 150 || createPayload.Data.LinePrice != 750 || createPayload.Data.TargetStrategy != "same_target" || !createPayload.Data.IsActive || createPayload.Data.SortOrder != 30 || !createPayload.Data.ServiceIsActive {
		t.Fatalf("unexpected create item data: %+v", createPayload.Data)
	}

	updated := httptest.NewRecorder()
	updatePath := fmt.Sprintf("/api/v1/admin/sosmed/bundle-items/%s", createPayload.Data.ID)
	r.ServeHTTP(updated, adminHandlerJSONRequest(t, http.MethodPut, updatePath, map[string]any{
		"sosmed_service_id": fixture.Followers.ID,
		"label":             "Followers Updated",
		"quantity_units":    250,
		"is_active":         false,
		"sort_order":        4,
	}))
	if updated.Code != http.StatusOK {
		t.Fatalf("expected update item 200, got %d body=%s", updated.Code, updated.Body.String())
	}
	var updatePayload struct {
		Data struct {
			ID              uuid.UUID `json:"id"`
			SosmedServiceID uuid.UUID `json:"sosmed_service_id"`
			ServiceCode     string    `json:"service_code"`
			Label           string    `json:"label"`
			QuantityUnits   int64     `json:"quantity_units"`
			LinePrice       int64     `json:"line_price"`
			IsActive        bool      `json:"is_active"`
			SortOrder       int       `json:"sort_order"`
		} `json:"data"`
	}
	if err := json.Unmarshal(updated.Body.Bytes(), &updatePayload); err != nil {
		t.Fatalf("decode update item response: %v", err)
	}
	if updatePayload.Data.ID != createPayload.Data.ID || updatePayload.Data.SosmedServiceID != fixture.Followers.ID || updatePayload.Data.ServiceCode != fixture.Followers.Code || updatePayload.Data.Label != "Followers Updated" || updatePayload.Data.QuantityUnits != 250 || updatePayload.Data.LinePrice != 1875 || updatePayload.Data.IsActive || updatePayload.Data.SortOrder != 4 {
		t.Fatalf("unexpected update item data: %+v", updatePayload.Data)
	}

	deleted := httptest.NewRecorder()
	r.ServeHTTP(deleted, httptest.NewRequest(http.MethodDelete, updatePath, nil))
	if deleted.Code != http.StatusOK {
		t.Fatalf("expected delete item 200, got %d body=%s", deleted.Code, deleted.Body.String())
	}
	var stored model.SosmedBundleItem
	if err := db.Unscoped().First(&stored, "id = ?", createPayload.Data.ID).Error; err != nil {
		t.Fatalf("expected deleted item row to remain: %v", err)
	}
	if stored.IsActive || stored.DeletedAt.Valid {
		t.Fatalf("expected delete item to only deactivate row, got %+v", stored)
	}
}

func TestSosmedBundleAdminHandlerRejectsBadUUIDAndMissingRecord(t *testing.T) {
	db := setupSosmedBundleHandlerTestDB(t)
	r := setupSosmedBundleAdminHandlerRouter(db)

	badUUID := httptest.NewRecorder()
	r.ServeHTTP(badUUID, adminHandlerJSONRequest(t, http.MethodPut, "/api/v1/admin/sosmed/bundles/not-a-uuid", map[string]any{"title": "Nope"}))
	if badUUID.Code != http.StatusBadRequest {
		t.Fatalf("expected bad UUID 400, got %d body=%s", badUUID.Code, badUUID.Body.String())
	}

	missing := httptest.NewRecorder()
	missingPath := fmt.Sprintf("/api/v1/admin/sosmed/bundle-items/%s", uuid.New())
	r.ServeHTTP(missing, httptest.NewRequest(http.MethodDelete, missingPath, nil))
	if missing.Code != http.StatusBadRequest {
		t.Fatalf("expected missing record 400, got %d body=%s", missing.Code, missing.Body.String())
	}
	if !strings.Contains(strings.ToLower(missing.Body.String()), "tidak ditemukan") {
		t.Fatalf("expected friendly missing message, got body=%s", missing.Body.String())
	}
}

func findAdminHandlerPackagePayload(items []adminHandlerListPackagePayload, key string) *adminHandlerListPackagePayload {
	for i := range items {
		if items[i].Key == key {
			return &items[i]
		}
	}
	return nil
}

func findAdminHandlerVariantPayload(items []adminHandlerListVariantPayload, key string) *adminHandlerListVariantPayload {
	for i := range items {
		if items[i].Key == key {
			return &items[i]
		}
	}
	return nil
}

func findAdminHandlerItemPayload(items []adminHandlerListItemPayload, id uuid.UUID) *adminHandlerListItemPayload {
	for i := range items {
		if items[i].ID == id {
			return &items[i]
		}
	}
	return nil
}
