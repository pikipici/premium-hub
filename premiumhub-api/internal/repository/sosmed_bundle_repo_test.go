package repository

import (
	"context"
	"fmt"
	"testing"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSosmedBundleRepoTestDB(t *testing.T) *gorm.DB {
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
		&model.User{},
		&model.SosmedService{},
		&model.SosmedBundlePackage{},
		&model.SosmedBundleVariant{},
		&model.SosmedBundleItem{},
		&model.SosmedBundleOrder{},
		&model.SosmedBundleOrderItem{},
	); err != nil {
		t.Fatalf("migrate bundle repo models: %v", err)
	}
	return db
}

func seedSosmedBundleRepoGraph(t *testing.T, db *gorm.DB) (*model.SosmedBundlePackage, *model.SosmedBundleVariant, *model.SosmedService) {
	t.Helper()

	service := &model.SosmedService{
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
		t.Fatalf("create service: %v", err)
	}

	pkg := &model.SosmedBundlePackage{
		Key:           "instagram-umkm",
		Title:         "Instagram UMKM",
		Platform:      "instagram",
		Badge:         "Terlaris",
		IsHighlighted: true,
		IsActive:      true,
		SortOrder:     20,
	}
	if err := db.Create(pkg).Error; err != nil {
		t.Fatalf("create package: %v", err)
	}

	variant := &model.SosmedBundleVariant{
		BundlePackageID: pkg.ID,
		Key:             "starter",
		Name:            "Starter",
		PriceMode:       "computed",
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(variant).Error; err != nil {
		t.Fatalf("create variant: %v", err)
	}

	item := &model.SosmedBundleItem{
		BundleVariantID: variant.ID,
		SosmedServiceID: service.ID,
		Label:           "Instagram Followers",
		QuantityUnits:   500,
		TargetStrategy:  "same_target",
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(item).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}

	inactivePkg := &model.SosmedBundlePackage{
		Key:       "inactive-package",
		Title:     "Inactive Package",
		Platform:  "instagram",
		SortOrder: 10,
	}
	if err := db.Create(inactivePkg).Error; err != nil {
		t.Fatalf("create inactive package: %v", err)
	}
	if err := db.Model(inactivePkg).Update("is_active", false).Error; err != nil {
		t.Fatalf("mark package inactive: %v", err)
	}

	return pkg, variant, service
}

func TestSosmedBundleRepoListAndLookupPreloadsActiveGraph(t *testing.T) {
	db := setupSosmedBundleRepoTestDB(t)
	_, _, service := seedSosmedBundleRepoGraph(t, db)

	repo := NewSosmedBundleRepo(db)
	bundles, err := repo.ListActiveBundles(context.Background())
	if err != nil {
		t.Fatalf("list active bundles: %v", err)
	}
	if len(bundles) != 1 {
		t.Fatalf("expected 1 active bundle, got %d", len(bundles))
	}
	if bundles[0].Key != "instagram-umkm" {
		t.Fatalf("expected instagram-umkm bundle, got %q", bundles[0].Key)
	}
	if len(bundles[0].Variants) != 1 {
		t.Fatalf("expected 1 variant preload, got %d", len(bundles[0].Variants))
	}
	if len(bundles[0].Variants[0].Items) != 1 {
		t.Fatalf("expected 1 item preload, got %d", len(bundles[0].Variants[0].Items))
	}
	if bundles[0].Variants[0].Items[0].Service.Code != service.Code {
		t.Fatalf("expected service code %q, got %q", service.Code, bundles[0].Variants[0].Items[0].Service.Code)
	}

	byKey, err := repo.GetBundleByKey(context.Background(), "instagram-umkm")
	if err != nil {
		t.Fatalf("get bundle by key: %v", err)
	}
	if byKey.ID != bundles[0].ID {
		t.Fatalf("expected same bundle ID from lookup")
	}

	variant, err := repo.GetVariantForCheckout(context.Background(), "instagram-umkm", "starter")
	if err != nil {
		t.Fatalf("get variant for checkout: %v", err)
	}
	if variant.Key != "starter" {
		t.Fatalf("expected starter variant, got %q", variant.Key)
	}
	if len(variant.Items) != 1 || variant.Items[0].Service.Code != service.Code {
		t.Fatalf("expected checkout variant to preload active item service")
	}
}

func TestSosmedBundleOrderRepoCreateAndLookupForUser(t *testing.T) {
	db := setupSosmedBundleRepoTestDB(t)
	pkg, variant, service := seedSosmedBundleRepoGraph(t, db)

	buyer := &model.User{
		ID:       uuid.New(),
		Name:     "Bundle Buyer",
		Email:    "bundle-buyer-repo@example.com",
		Password: "hashed",
		Role:     "user",
		IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	order := &model.SosmedBundleOrder{
		OrderNumber:        "SB-REPO-0001",
		UserID:             buyer.ID,
		BundlePackageID:    pkg.ID,
		BundleVariantID:    variant.ID,
		PackageKeySnapshot: pkg.Key,
		VariantKeySnapshot: variant.Key,
		TitleSnapshot:      "Instagram UMKM - Starter",
		TargetLink:         "https://instagram.com/example",
		SubtotalPrice:      3750,
		TotalPrice:         3750,
		Status:             "processing",
		PaymentMethod:      "wallet",
	}
	items := []model.SosmedBundleOrderItem{
		{
			SosmedServiceID:           service.ID,
			ServiceCodeSnapshot:       service.Code,
			ServiceTitleSnapshot:      service.Title,
			ProviderCodeSnapshot:      service.ProviderCode,
			ProviderServiceIDSnapshot: service.ProviderServiceID,
			QuantityUnits:             500,
			UnitPricePer1KSnapshot:    7500,
			LinePrice:                 3750,
			TargetLinkSnapshot:        order.TargetLink,
			Status:                    "queued",
		},
	}

	repo := NewSosmedBundleOrderRepo(db)
	if err := repo.CreateBundleOrderWithItems(context.Background(), order, items); err != nil {
		t.Fatalf("create bundle order with items: %v", err)
	}

	listed, total, err := repo.ListBundleOrdersByUser(context.Background(), buyer.ID, 1, 10)
	if err != nil {
		t.Fatalf("list orders by user: %v", err)
	}
	if total != 1 || len(listed) != 1 {
		t.Fatalf("expected one listed order, got total=%d len=%d", total, len(listed))
	}
	if len(listed[0].Items) != 1 {
		t.Fatalf("expected listed order to preload one item, got %d", len(listed[0].Items))
	}

	loaded, err := repo.GetBundleOrderByNumberForUser(context.Background(), buyer.ID, "SB-REPO-0001")
	if err != nil {
		t.Fatalf("get order by number for user: %v", err)
	}
	if loaded.ID != order.ID {
		t.Fatalf("expected loaded order ID %s, got %s", order.ID, loaded.ID)
	}
	if len(loaded.Items) != 1 || loaded.Items[0].Service.Code != service.Code {
		t.Fatalf("expected loaded order item service preload")
	}
}
