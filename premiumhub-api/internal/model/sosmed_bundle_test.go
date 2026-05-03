package model

import (
	"fmt"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSosmedBundleModelsMigrateAndPersistGraph(t *testing.T) {
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}

	if err := db.AutoMigrate(
		&User{},
		&SosmedService{},
		&SosmedBundlePackage{},
		&SosmedBundleVariant{},
		&SosmedBundleItem{},
		&SosmedBundleOrder{},
		&SosmedBundleOrderItem{},
	); err != nil {
		t.Fatalf("migrate sosmed bundle models: %v", err)
	}

	buyer := &User{
		ID:       uuid.New(),
		Name:     "Bundle Buyer",
		Email:    "bundle-buyer@example.com",
		Password: "hashed",
		Role:     "user",
		IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	service := &SosmedService{
		CategoryCode:      "followers",
		Code:              "jap-ig-followers-test",
		Title:             "Instagram Followers Test",
		PlatformLabel:     "Instagram",
		CheckoutPrice:     7500,
		ProviderCode:      "jap",
		ProviderServiceID: "2989",
		MinOrder:          "100",
		IsActive:          true,
	}
	if err := db.Create(service).Error; err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	pkg := &SosmedBundlePackage{
		Key:           "instagram-umkm",
		Title:         "Instagram UMKM",
		Subtitle:      "Paket growth bisnis Instagram",
		Platform:      "instagram",
		Badge:         "Terlaris",
		IsHighlighted: true,
		IsActive:      true,
		SortOrder:     10,
	}
	if err := db.Create(pkg).Error; err != nil {
		t.Fatalf("create bundle package: %v", err)
	}

	variant := &SosmedBundleVariant{
		BundlePackageID: pkg.ID,
		Key:             "starter",
		Name:            "Starter",
		Description:     "Validasi awal social proof",
		PriceMode:       "computed",
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(variant).Error; err != nil {
		t.Fatalf("create bundle variant: %v", err)
	}

	item := &SosmedBundleItem{
		BundleVariantID: variant.ID,
		SosmedServiceID: service.ID,
		Label:           "Instagram Followers",
		QuantityUnits:   500,
		TargetStrategy:  "same_target",
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(item).Error; err != nil {
		t.Fatalf("create bundle item: %v", err)
	}

	order := &SosmedBundleOrder{
		OrderNumber:        "SB-TEST-0001",
		UserID:             buyer.ID,
		BundlePackageID:    pkg.ID,
		BundleVariantID:    variant.ID,
		PackageKeySnapshot: "instagram-umkm",
		VariantKeySnapshot: "starter",
		TitleSnapshot:      "Instagram UMKM - Starter",
		TargetLink:         "https://instagram.com/example",
		SubtotalPrice:      3750,
		DiscountAmount:     0,
		TotalPrice:         3750,
		Status:             "processing",
		PaymentMethod:      "wallet",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create bundle order: %v", err)
	}

	orderItem := &SosmedBundleOrderItem{
		BundleOrderID:             order.ID,
		SosmedServiceID:           service.ID,
		ServiceCodeSnapshot:       service.Code,
		ServiceTitleSnapshot:      service.Title,
		ProviderCodeSnapshot:      service.ProviderCode,
		ProviderServiceIDSnapshot: service.ProviderServiceID,
		QuantityUnits:             500,
		UnitPricePer1KSnapshot:    7500,
		LinePrice:                 3750,
		TargetLinkSnapshot:        order.TargetLink,
		Status:                    "submitted",
		ProviderOrderID:           "991122",
		ProviderStatus:            "In Progress",
	}
	if err := db.Create(orderItem).Error; err != nil {
		t.Fatalf("create bundle order item: %v", err)
	}

	var loaded SosmedBundlePackage
	if err := db.Preload("Variants.Items.Service").First(&loaded, "key = ?", "instagram-umkm").Error; err != nil {
		t.Fatalf("load package graph: %v", err)
	}
	if len(loaded.Variants) != 1 {
		t.Fatalf("expected 1 variant, got %d", len(loaded.Variants))
	}
	if len(loaded.Variants[0].Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(loaded.Variants[0].Items))
	}
	if loaded.Variants[0].Items[0].Service.Code != service.Code {
		t.Fatalf("expected preloaded service code %q, got %q", service.Code, loaded.Variants[0].Items[0].Service.Code)
	}

	var loadedOrder SosmedBundleOrder
	if err := db.Preload("Items.Service").First(&loadedOrder, "order_number = ?", "SB-TEST-0001").Error; err != nil {
		t.Fatalf("load order graph: %v", err)
	}
	if len(loadedOrder.Items) != 1 {
		t.Fatalf("expected 1 order item, got %d", len(loadedOrder.Items))
	}
	if loadedOrder.Items[0].LinePrice != 3750 {
		t.Fatalf("expected line price 3750, got %d", loadedOrder.Items[0].LinePrice)
	}
}
