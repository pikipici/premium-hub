package config

import (
	"testing"

	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

func TestEnsureDefaultSosmedBundlePackagesSeedsIdempotently(t *testing.T) {
	db := openBundleSeedTestDB(t)
	seedBundleServiceFixtures(t, db, defaultSosmedBundleSeedServiceCodes()...)

	if err := ensureDefaultSosmedBundlePackages(db); err != nil {
		t.Fatalf("seed default bundles: %v", err)
	}
	if err := ensureDefaultSosmedBundlePackages(db); err != nil {
		t.Fatalf("seed default bundles second run: %v", err)
	}

	var packageCount int64
	if err := db.Model(&model.SosmedBundlePackage{}).Count(&packageCount).Error; err != nil {
		t.Fatalf("count bundle packages: %v", err)
	}
	if packageCount != 4 {
		t.Fatalf("expected 4 default bundle packages, got %d", packageCount)
	}

	var variantCount int64
	if err := db.Model(&model.SosmedBundleVariant{}).Count(&variantCount).Error; err != nil {
		t.Fatalf("count bundle variants: %v", err)
	}
	if variantCount != 12 {
		t.Fatalf("expected 12 default bundle variants, got %d", variantCount)
	}

	var itemCount int64
	if err := db.Model(&model.SosmedBundleItem{}).Count(&itemCount).Error; err != nil {
		t.Fatalf("count bundle items: %v", err)
	}
	if itemCount != 36 {
		t.Fatalf("expected 36 default bundle items, got %d", itemCount)
	}

	var pkg model.SosmedBundlePackage
	if err := db.Preload("Variants.Items.Service").Where("key = ?", "umkm-starter").First(&pkg).Error; err != nil {
		t.Fatalf("load umkm bundle: %v", err)
	}
	if !pkg.IsActive || pkg.Title != "UMKM Starter" || len(pkg.Variants) != 3 {
		t.Fatalf("unexpected umkm package: active=%v title=%q variants=%d", pkg.IsActive, pkg.Title, len(pkg.Variants))
	}
	for _, variant := range pkg.Variants {
		if !variant.IsActive {
			t.Fatalf("expected seeded variant %s active when services exist", variant.Key)
		}
		if variant.PriceMode != "computed" {
			t.Fatalf("expected computed price mode, got %s", variant.PriceMode)
		}
		if len(variant.Items) != 3 {
			t.Fatalf("expected variant %s to have 3 items, got %d", variant.Key, len(variant.Items))
		}
		for _, item := range variant.Items {
			if item.Service.Code == "" || !item.Service.IsActive {
				t.Fatalf("expected active service preload for item %#v", item)
			}
		}
	}
}

func TestEnsureDefaultSosmedBundlePackagesDoesNotOverwriteExistingAdminManagedBundles(t *testing.T) {
	db := openBundleSeedTestDB(t)
	seedBundleServiceFixtures(t, db, defaultSosmedBundleSeedServiceCodes()...)

	if err := ensureDefaultSosmedBundlePackages(db); err != nil {
		t.Fatalf("seed default bundles: %v", err)
	}

	var pkg model.SosmedBundlePackage
	if err := db.Where("key = ?", "umkm-starter").First(&pkg).Error; err != nil {
		t.Fatalf("load seeded package: %v", err)
	}
	if err := db.Model(&pkg).Updates(map[string]interface{}{
		"title":          "Admin Edited UMKM",
		"badge":          "Manual Admin",
		"is_highlighted": false,
		"is_active":      false,
		"sort_order":     777,
	}).Error; err != nil {
		t.Fatalf("apply admin package edits: %v", err)
	}

	var variant model.SosmedBundleVariant
	if err := db.Where("bundle_package_id = ? AND key = ?", pkg.ID, "starter").First(&variant).Error; err != nil {
		t.Fatalf("load seeded variant: %v", err)
	}
	if err := db.Model(&variant).Updates(map[string]interface{}{
		"name":             "Admin Starter Manual",
		"price_mode":       "fixed",
		"fixed_price":      int64(123456),
		"discount_percent": 0,
		"discount_amount":  int64(0),
		"is_active":        false,
		"sort_order":       778,
	}).Error; err != nil {
		t.Fatalf("apply admin variant edits: %v", err)
	}

	var item model.SosmedBundleItem
	if err := db.Where("bundle_variant_id = ?", variant.ID).Order("sort_order ASC").First(&item).Error; err != nil {
		t.Fatalf("load seeded item: %v", err)
	}
	if err := db.Model(&item).Updates(map[string]interface{}{
		"label":          "Admin Manual Item",
		"quantity_units": int64(4242),
		"sort_order":     779,
		"is_active":      false,
	}).Error; err != nil {
		t.Fatalf("apply admin item edits: %v", err)
	}

	if err := ensureDefaultSosmedBundlePackages(db); err != nil {
		t.Fatalf("seed default bundles second run: %v", err)
	}

	var gotPkg model.SosmedBundlePackage
	if err := db.Where("id = ?", pkg.ID).First(&gotPkg).Error; err != nil {
		t.Fatalf("reload admin edited package: %v", err)
	}
	if gotPkg.Title != "Admin Edited UMKM" || gotPkg.Badge != "Manual Admin" || gotPkg.IsHighlighted || gotPkg.IsActive || gotPkg.SortOrder != 777 {
		t.Fatalf("admin package edits were overwritten: title=%q badge=%q highlighted=%v active=%v sort=%d", gotPkg.Title, gotPkg.Badge, gotPkg.IsHighlighted, gotPkg.IsActive, gotPkg.SortOrder)
	}

	var gotVariant model.SosmedBundleVariant
	if err := db.Where("id = ?", variant.ID).First(&gotVariant).Error; err != nil {
		t.Fatalf("reload admin edited variant: %v", err)
	}
	if gotVariant.Name != "Admin Starter Manual" || gotVariant.PriceMode != "fixed" || gotVariant.FixedPrice != 123456 || gotVariant.DiscountPercent != 0 || gotVariant.DiscountAmount != 0 || gotVariant.IsActive || gotVariant.SortOrder != 778 {
		t.Fatalf("admin variant edits were overwritten: name=%q mode=%q fixed=%d discount_percent=%d discount_amount=%d active=%v sort=%d", gotVariant.Name, gotVariant.PriceMode, gotVariant.FixedPrice, gotVariant.DiscountPercent, gotVariant.DiscountAmount, gotVariant.IsActive, gotVariant.SortOrder)
	}

	var gotItem model.SosmedBundleItem
	if err := db.Where("id = ?", item.ID).First(&gotItem).Error; err != nil {
		t.Fatalf("reload admin edited item: %v", err)
	}
	if gotItem.Label != "Admin Manual Item" || gotItem.QuantityUnits != 4242 || gotItem.SortOrder != 779 || gotItem.IsActive {
		t.Fatalf("admin item edits were overwritten: label=%q quantity=%d active=%v sort=%d", gotItem.Label, gotItem.QuantityUnits, gotItem.IsActive, gotItem.SortOrder)
	}
}

func TestEnsureDefaultSosmedBundlePackagesDisablesVariantWhenServiceMissing(t *testing.T) {
	db := openBundleSeedTestDB(t)
	seedBundleServiceFixtures(t, db,
		"jap-2989",
		"jap-8216",
		// intentionally omit jap-9333 story views required by UMKM variants
	)

	if err := ensureDefaultSosmedBundlePackages(db); err != nil {
		t.Fatalf("seed default bundles: %v", err)
	}

	var variant model.SosmedBundleVariant
	if err := db.Joins("Package").Where("Package.key = ? AND sosmed_bundle_variants.key = ?", "umkm-starter", "starter").First(&variant).Error; err != nil {
		t.Fatalf("load starter variant: %v", err)
	}
	if variant.IsActive {
		t.Fatalf("expected starter variant disabled when required service is missing")
	}

	var itemCount int64
	if err := db.Model(&model.SosmedBundleItem{}).Where("bundle_variant_id = ?", variant.ID).Count(&itemCount).Error; err != nil {
		t.Fatalf("count disabled variant items: %v", err)
	}
	if itemCount != 0 {
		t.Fatalf("expected disabled missing-service variant to have no broken items, got %d", itemCount)
	}

	seedBundleServiceFixtures(t, db, "jap-9333")
	if err := ensureDefaultSosmedBundlePackages(db); err != nil {
		t.Fatalf("seed default bundles after missing service appears: %v", err)
	}

	var repaired model.SosmedBundleVariant
	if err := db.Preload("Items.Service").Joins("Package").Where("Package.key = ? AND sosmed_bundle_variants.key = ?", "umkm-starter", "starter").First(&repaired).Error; err != nil {
		t.Fatalf("reload repaired starter variant: %v", err)
	}
	if !repaired.IsActive {
		t.Fatalf("expected seeded empty starter variant to become active after missing service appears")
	}
	if len(repaired.Items) != 3 {
		t.Fatalf("expected repaired starter variant to backfill 3 seed items, got %d", len(repaired.Items))
	}
	for _, item := range repaired.Items {
		if item.Service.Code == "" || !item.Service.IsActive {
			t.Fatalf("expected repaired item to link an active service, got %#v", item)
		}
	}

	var variantCount int64
	if err := db.Model(&model.SosmedBundleVariant{}).Where("bundle_package_id = ? AND key = ?", repaired.BundlePackageID, "starter").Count(&variantCount).Error; err != nil {
		t.Fatalf("count repaired starter variants: %v", err)
	}
	if variantCount != 1 {
		t.Fatalf("expected repair to reuse existing starter variant, got %d rows", variantCount)
	}
}

func openBundleSeedTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := openTestDB(t)
	if err := db.AutoMigrate(
		&model.SosmedBundlePackage{},
		&model.SosmedBundleVariant{},
		&model.SosmedBundleItem{},
	); err != nil {
		t.Fatalf("migrate bundle seed models: %v", err)
	}
	return db
}

func seedBundleServiceFixtures(t *testing.T, db *gorm.DB, codes ...string) {
	t.Helper()
	for index, code := range codes {
		service := model.SosmedService{
			CategoryCode:      "bundle-test",
			Code:              code,
			Title:             "Seed Fixture " + code,
			PlatformLabel:     "Bundle",
			MinOrder:          "1-10000000",
			CheckoutPrice:     int64(1000 + index),
			ProviderCode:      "jap",
			ProviderServiceID: code,
			ProviderRate:      "500",
			ProviderCurrency:  "IDR",
			ProviderTitle:     "Provider " + code,
			ProviderCategory:  "Bundle",
			ProviderType:      "Default",
			SortOrder:         index + 1,
			IsActive:          true,
		}
		if err := db.Create(&service).Error; err != nil {
			t.Fatalf("seed service fixture %s: %v", code, err)
		}
	}
}
