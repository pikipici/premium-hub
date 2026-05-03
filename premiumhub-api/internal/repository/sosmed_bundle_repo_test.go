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

	inactiveItem := &model.SosmedBundleItem{
		BundleVariantID: variant.ID,
		SosmedServiceID: service.ID,
		Label:           "Inactive Instagram Views",
		QuantityUnits:   250,
		TargetStrategy:  "same_target",
		SortOrder:       20,
	}
	if err := db.Create(inactiveItem).Error; err != nil {
		t.Fatalf("create inactive item: %v", err)
	}
	if err := db.Model(inactiveItem).Update("is_active", false).Error; err != nil {
		t.Fatalf("mark item inactive: %v", err)
	}

	inactiveVariant := &model.SosmedBundleVariant{
		BundlePackageID: pkg.ID,
		Key:             "archived",
		Name:            "Archived Variant",
		PriceMode:       "fixed",
		FixedPrice:      99000,
		SortOrder:       20,
	}
	if err := db.Create(inactiveVariant).Error; err != nil {
		t.Fatalf("create inactive variant: %v", err)
	}
	if err := db.Model(inactiveVariant).Update("is_active", false).Error; err != nil {
		t.Fatalf("mark variant inactive: %v", err)
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

	inactivePkgVariant := &model.SosmedBundleVariant{
		BundlePackageID: inactivePkg.ID,
		Key:             "inactive-package-variant",
		Name:            "Inactive Package Variant",
		PriceMode:       "computed",
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(inactivePkgVariant).Error; err != nil {
		t.Fatalf("create inactive package variant: %v", err)
	}
	inactivePkgItem := &model.SosmedBundleItem{
		BundleVariantID: inactivePkgVariant.ID,
		SosmedServiceID: service.ID,
		Label:           "Inactive Package Item",
		QuantityUnits:   100,
		TargetStrategy:  "same_target",
		IsActive:        true,
		SortOrder:       10,
	}
	if err := db.Create(inactivePkgItem).Error; err != nil {
		t.Fatalf("create inactive package item: %v", err)
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

func TestSosmedBundleRepoAdminListAndLookupPreloadsFullGraph(t *testing.T) {
	db := setupSosmedBundleRepoTestDB(t)
	pkg, _, service := seedSosmedBundleRepoGraph(t, db)

	repo := NewSosmedBundleRepo(db)
	bundles, err := repo.ListAdminBundles(context.Background(), true)
	if err != nil {
		t.Fatalf("list admin bundles with inactive rows: %v", err)
	}
	if len(bundles) != 2 {
		t.Fatalf("expected active and inactive package, got %d", len(bundles))
	}
	if bundles[0].Key != "inactive-package" || bundles[0].IsActive {
		t.Fatalf("expected inactive package sorted first, got key=%q active=%v", bundles[0].Key, bundles[0].IsActive)
	}
	if len(bundles[0].Variants) != 1 || len(bundles[0].Variants[0].Items) != 1 {
		t.Fatalf("expected inactive package to preload its variant and item")
	}
	if bundles[0].Variants[0].Items[0].Service.Code != service.Code {
		t.Fatalf("expected inactive package item service preload")
	}

	activeBundle := bundles[1]
	if activeBundle.Key != "instagram-umkm" {
		t.Fatalf("expected active package sorted second, got %q", activeBundle.Key)
	}
	if len(activeBundle.Variants) != 2 {
		t.Fatalf("expected active and inactive variants in admin graph, got %d", len(activeBundle.Variants))
	}
	if activeBundle.Variants[0].Key != "starter" || !activeBundle.Variants[0].IsActive {
		t.Fatalf("expected active starter variant first, got key=%q active=%v", activeBundle.Variants[0].Key, activeBundle.Variants[0].IsActive)
	}
	if activeBundle.Variants[1].Key != "archived" || activeBundle.Variants[1].IsActive {
		t.Fatalf("expected inactive archived variant second, got key=%q active=%v", activeBundle.Variants[1].Key, activeBundle.Variants[1].IsActive)
	}
	if len(activeBundle.Variants[0].Items) != 2 {
		t.Fatalf("expected active and inactive items in admin graph, got %d", len(activeBundle.Variants[0].Items))
	}
	if activeBundle.Variants[0].Items[0].Label != "Instagram Followers" || !activeBundle.Variants[0].Items[0].IsActive {
		t.Fatalf("expected active item first, got label=%q active=%v", activeBundle.Variants[0].Items[0].Label, activeBundle.Variants[0].Items[0].IsActive)
	}
	if activeBundle.Variants[0].Items[1].Label != "Inactive Instagram Views" || activeBundle.Variants[0].Items[1].IsActive {
		t.Fatalf("expected inactive item second, got label=%q active=%v", activeBundle.Variants[0].Items[1].Label, activeBundle.Variants[0].Items[1].IsActive)
	}

	withoutInactivePackages, err := repo.ListAdminBundles(context.Background(), false)
	if err != nil {
		t.Fatalf("list admin bundles without inactive packages: %v", err)
	}
	if len(withoutInactivePackages) != 1 || withoutInactivePackages[0].Key != "instagram-umkm" {
		t.Fatalf("expected inactive packages hidden, got %+v", withoutInactivePackages)
	}
	if len(withoutInactivePackages[0].Variants) != 2 {
		t.Fatalf("expected admin list to keep full child graph for active packages, got %d variants", len(withoutInactivePackages[0].Variants))
	}

	detail, err := repo.GetAdminBundleByID(context.Background(), pkg.ID, true)
	if err != nil {
		t.Fatalf("get admin bundle by ID: %v", err)
	}
	if detail.Key != "instagram-umkm" || len(detail.Variants) != 2 || len(detail.Variants[0].Items) != 2 {
		t.Fatalf("expected full graph from admin detail, got key=%q variants=%d items=%d", detail.Key, len(detail.Variants), len(detail.Variants[0].Items))
	}

	inactiveByKey, err := repo.FindBundleByKeyIncludingInactive(context.Background(), " inactive-package ")
	if err != nil {
		t.Fatalf("find inactive bundle by key: %v", err)
	}
	if inactiveByKey.Key != "inactive-package" || inactiveByKey.IsActive {
		t.Fatalf("expected inactive package lookup, got key=%q active=%v", inactiveByKey.Key, inactiveByKey.IsActive)
	}
}

func TestSosmedBundleRepoAdminMutationsPersistRows(t *testing.T) {
	db := setupSosmedBundleRepoTestDB(t)
	_, _, service := seedSosmedBundleRepoGraph(t, db)

	repo := NewSosmedBundleRepo(db)
	pkg := &model.SosmedBundlePackage{
		Key:       "manual-bundle",
		Title:     "Manual Bundle",
		Platform:  "tiktok",
		IsActive:  false,
		SortOrder: 30,
	}
	if err := repo.CreateBundlePackage(context.Background(), pkg); err != nil {
		t.Fatalf("create bundle package: %v", err)
	}
	loadedPkg, err := repo.FindBundleByKeyIncludingInactive(context.Background(), "manual-bundle")
	if err != nil {
		t.Fatalf("load created package: %v", err)
	}
	if loadedPkg.ID == uuid.Nil || loadedPkg.IsActive {
		t.Fatalf("expected created inactive package with ID, got id=%s active=%v", loadedPkg.ID, loadedPkg.IsActive)
	}

	loadedPkg.Title = "Manual Bundle Updated"
	loadedPkg.Badge = "Manual"
	loadedPkg.IsHighlighted = true
	loadedPkg.IsActive = true
	loadedPkg.SortOrder = 31
	if err := repo.UpdateBundlePackage(context.Background(), loadedPkg); err != nil {
		t.Fatalf("update bundle package: %v", err)
	}
	updatedPkg, err := repo.FindBundleByKeyIncludingInactive(context.Background(), "manual-bundle")
	if err != nil {
		t.Fatalf("reload updated package: %v", err)
	}
	if updatedPkg.Title != "Manual Bundle Updated" || updatedPkg.Badge != "Manual" || !updatedPkg.IsHighlighted || !updatedPkg.IsActive || updatedPkg.SortOrder != 31 {
		t.Fatalf("package update was not persisted: %+v", updatedPkg)
	}

	variant := &model.SosmedBundleVariant{
		BundlePackageID: updatedPkg.ID,
		Key:             "pro",
		Name:            "Pro",
		PriceMode:       "fixed",
		FixedPrice:      100000,
		IsActive:        false,
		SortOrder:       3,
	}
	if err := repo.CreateBundleVariant(context.Background(), variant); err != nil {
		t.Fatalf("create bundle variant: %v", err)
	}
	createdGraph, err := repo.GetAdminBundleByID(context.Background(), updatedPkg.ID, true)
	if err != nil {
		t.Fatalf("load graph after variant create: %v", err)
	}
	if len(createdGraph.Variants) != 1 || createdGraph.Variants[0].Key != "pro" || createdGraph.Variants[0].IsActive {
		t.Fatalf("expected created inactive variant in graph, got %+v", createdGraph.Variants)
	}

	variant.Name = "Pro Updated"
	variant.FixedPrice = 125000
	variant.IsActive = true
	variant.SortOrder = 4
	if err := repo.UpdateBundleVariant(context.Background(), variant); err != nil {
		t.Fatalf("update bundle variant: %v", err)
	}

	item := &model.SosmedBundleItem{
		BundleVariantID: variant.ID,
		SosmedServiceID: service.ID,
		Label:           "Manual Followers",
		QuantityUnits:   333,
		TargetStrategy:  "same_target",
		IsActive:        false,
		SortOrder:       7,
	}
	if err := repo.CreateBundleItem(context.Background(), item); err != nil {
		t.Fatalf("create bundle item: %v", err)
	}
	item.Label = "Manual Followers Updated"
	item.QuantityUnits = 444
	item.IsActive = true
	item.SortOrder = 8
	if err := repo.UpdateBundleItem(context.Background(), item); err != nil {
		t.Fatalf("update bundle item: %v", err)
	}

	finalGraph, err := repo.GetAdminBundleByID(context.Background(), updatedPkg.ID, true)
	if err != nil {
		t.Fatalf("load final graph: %v", err)
	}
	if len(finalGraph.Variants) != 1 {
		t.Fatalf("expected one variant in final graph, got %d", len(finalGraph.Variants))
	}
	finalVariant := finalGraph.Variants[0]
	if finalVariant.Name != "Pro Updated" || finalVariant.FixedPrice != 125000 || !finalVariant.IsActive || finalVariant.SortOrder != 4 {
		t.Fatalf("variant update was not persisted: %+v", finalVariant)
	}
	if len(finalVariant.Items) != 1 {
		t.Fatalf("expected one item in final graph, got %d", len(finalVariant.Items))
	}
	finalItem := finalVariant.Items[0]
	if finalItem.Label != "Manual Followers Updated" || finalItem.QuantityUnits != 444 || !finalItem.IsActive || finalItem.SortOrder != 8 || finalItem.Service.Code != service.Code {
		t.Fatalf("item update was not persisted or service not preloaded: %+v", finalItem)
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
