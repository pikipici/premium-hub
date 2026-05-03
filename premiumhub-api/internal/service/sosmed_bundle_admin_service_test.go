package service

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupSosmedBundleAdminServiceTest(t *testing.T) (*gorm.DB, *SosmedBundleAdminService, *repository.SosmedBundleRepo) {
	t.Helper()

	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.SosmedService{},
		&model.SosmedBundlePackage{},
		&model.SosmedBundleVariant{},
		&model.SosmedBundleItem{},
	); err != nil {
		t.Fatalf("migrate sosmed bundle admin service models: %v", err)
	}

	bundleRepo := repository.NewSosmedBundleRepo(db)
	svc := NewSosmedBundleAdminService(bundleRepo, repository.NewSosmedServiceRepo(db))
	return db, svc, bundleRepo
}

func sosmedBundleAdminBoolPtr(v bool) *bool {
	return &v
}

func sosmedBundleAdminIntPtr(v int) *int {
	return &v
}

func sosmedBundleAdminInt64Ptr(v int64) *int64 {
	return &v
}

func sosmedBundleAdminStringPtr(v string) *string {
	return &v
}

func createSosmedBundleAdminPackageForVariantTest(t *testing.T, ctx context.Context, svc *SosmedBundleAdminService, key string) *model.SosmedBundlePackage {
	t.Helper()

	pkg, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      key,
		Title:    "Package " + key,
		Platform: "instagram",
	})
	if err != nil {
		t.Fatalf("create package %s for variant test: %v", key, err)
	}
	return pkg
}

func findSosmedBundleAdminTestVariant(pkg *model.SosmedBundlePackage, key string) *model.SosmedBundleVariant {
	if pkg == nil {
		return nil
	}
	for i := range pkg.Variants {
		if pkg.Variants[i].Key == key {
			return &pkg.Variants[i]
		}
	}
	return nil
}

func createSosmedBundleAdminServiceFixture(t *testing.T, db *gorm.DB, code, title, minOrder string, active bool) model.SosmedService {
	t.Helper()

	service := model.SosmedService{
		CategoryCode:      "instagram",
		Code:              code,
		Title:             title,
		ProviderCode:      "jap",
		ProviderServiceID: code + "-provider",
		ProviderRate:      "5000",
		MinOrder:          minOrder,
		CheckoutPrice:     12000,
		IsActive:          active,
		SortOrder:         10,
	}
	if err := db.Create(&service).Error; err != nil {
		t.Fatalf("create sosmed service fixture %s: %v", code, err)
	}
	if !active {
		if err := db.Model(&service).Update("is_active", false).Error; err != nil {
			t.Fatalf("force inactive sosmed service fixture %s: %v", code, err)
		}
		service.IsActive = false
	}
	return service
}

func findSosmedBundleAdminTestItem(variant *model.SosmedBundleVariant, id uuid.UUID) *model.SosmedBundleItem {
	if variant == nil {
		return nil
	}
	for i := range variant.Items {
		if variant.Items[i].ID == id {
			return &variant.Items[i]
		}
	}
	return nil
}

func TestSosmedBundleAdminServiceCreatePackageSucceedsWithDefaults(t *testing.T) {
	ctx := context.Background()
	_, svc, bundleRepo := setupSosmedBundleAdminServiceTest(t)

	created, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      " custom-bundle ",
		Title:    "  Custom Paket  ",
		Platform: " instagram ",
	})
	if err != nil {
		t.Fatalf("create package with defaults: %v", err)
	}

	if created.ID.String() == "00000000-0000-0000-0000-000000000000" {
		t.Fatalf("expected package ID to be generated")
	}
	if created.Key != "custom-bundle" {
		t.Fatalf("expected trimmed key custom-bundle, got %q", created.Key)
	}
	if created.Title != "Custom Paket" || created.Platform != "instagram" {
		t.Fatalf("expected trimmed title/platform, got title=%q platform=%q", created.Title, created.Platform)
	}
	if created.SortOrder != 100 {
		t.Fatalf("expected default sort_order=100, got %d", created.SortOrder)
	}
	if !created.IsActive {
		t.Fatalf("expected default is_active=true")
	}
	if created.IsHighlighted {
		t.Fatalf("expected default is_highlighted=false")
	}

	stored, err := bundleRepo.GetAdminBundleByID(ctx, created.ID, true)
	if err != nil {
		t.Fatalf("load created package: %v", err)
	}
	if stored.Key != "custom-bundle" || !stored.IsActive || stored.SortOrder != 100 {
		t.Fatalf("created package was not persisted with defaults: %+v", stored)
	}

	inactive, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:           "inactive-bundle",
		Title:         "Inactive Bundle",
		Platform:      "tiktok",
		IsHighlighted: sosmedBundleAdminBoolPtr(true),
		IsActive:      sosmedBundleAdminBoolPtr(false),
		SortOrder:     sosmedBundleAdminIntPtr(9),
	})
	if err != nil {
		t.Fatalf("create inactive package: %v", err)
	}
	if inactive.IsActive || !inactive.IsHighlighted || inactive.SortOrder != 9 {
		t.Fatalf("expected explicit inactive/highlight/sort to persist, got %+v", inactive)
	}
	storedInactive, err := bundleRepo.GetAdminBundleByID(ctx, inactive.ID, true)
	if err != nil {
		t.Fatalf("load inactive package: %v", err)
	}
	if storedInactive.IsActive {
		t.Fatalf("expected explicit inactive package to stay inactive after create")
	}
}

func TestSosmedBundleAdminServiceListAndGetPackagesIncludeInactiveWhenRequested(t *testing.T) {
	ctx := context.Background()
	_, svc, _ := setupSosmedBundleAdminServiceTest(t)

	active, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      "active-list-package",
		Title:    "Active List Package",
		Platform: "instagram",
	})
	if err != nil {
		t.Fatalf("create active package: %v", err)
	}
	inactive, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      "inactive-list-package",
		Title:    "Inactive List Package",
		Platform: "instagram",
		IsActive: sosmedBundleAdminBoolPtr(false),
	})
	if err != nil {
		t.Fatalf("create inactive package: %v", err)
	}

	activeOnly, err := svc.ListPackages(ctx, false)
	if err != nil {
		t.Fatalf("list active-only packages: %v", err)
	}
	if len(activeOnly) != 1 || activeOnly[0].ID != active.ID {
		t.Fatalf("expected only active package in active-only list, got %+v", activeOnly)
	}

	allPackages, err := svc.ListPackages(ctx, true)
	if err != nil {
		t.Fatalf("list all packages: %v", err)
	}
	if len(allPackages) != 2 {
		t.Fatalf("expected active and inactive packages, got %d", len(allPackages))
	}

	loadedInactive, err := svc.GetPackage(ctx, inactive.ID, true)
	if err != nil {
		t.Fatalf("get inactive package with includeInactive=true: %v", err)
	}
	if loadedInactive.ID != inactive.ID || loadedInactive.IsActive {
		t.Fatalf("expected inactive package detail, got %+v", loadedInactive)
	}

	_, err = svc.GetPackage(ctx, inactive.ID, false)
	if err == nil || !strings.Contains(err.Error(), "paket bundle sosmed tidak ditemukan") {
		t.Fatalf("expected inactive package hidden when includeInactive=false, got %v", err)
	}
}

func TestSosmedBundleAdminServiceCreatePackageRejectsDuplicateKey(t *testing.T) {
	ctx := context.Background()
	_, svc, _ := setupSosmedBundleAdminServiceTest(t)

	if _, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      "duplicate-bundle",
		Title:    "Duplicate Bundle",
		Platform: "instagram",
	}); err != nil {
		t.Fatalf("seed duplicate package: %v", err)
	}

	_, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      " duplicate-bundle ",
		Title:    "Duplicate Again",
		Platform: "instagram",
	})
	if err == nil || !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("expected duplicate key error, got %v", err)
	}
}

func TestSosmedBundleAdminServiceCreatePackageRejectsInvalidKey(t *testing.T) {
	ctx := context.Background()
	_, svc, _ := setupSosmedBundleAdminServiceTest(t)

	badKeys := []string{"A-B", "x", "-bad", "bad key", strings.Repeat("a", 100)}
	for _, key := range badKeys {
		_, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
			Key:      key,
			Title:    "Invalid Key Bundle",
			Platform: "instagram",
		})
		if err == nil || !strings.Contains(err.Error(), "key paket tidak valid") {
			t.Fatalf("expected invalid key error for %q, got %v", key, err)
		}
	}
}

func TestSosmedBundleAdminServiceCreatePackageRejectsBlankTitleAndPlatform(t *testing.T) {
	ctx := context.Background()
	_, svc, _ := setupSosmedBundleAdminServiceTest(t)

	_, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      "blank-title",
		Title:    "   ",
		Platform: "instagram",
	})
	if err == nil || !strings.Contains(err.Error(), "judul paket wajib diisi") {
		t.Fatalf("expected blank title error, got %v", err)
	}

	_, err = svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      "blank-platform",
		Title:    "Blank Platform",
		Platform: "   ",
	})
	if err == nil || !strings.Contains(err.Error(), "platform paket wajib diisi") {
		t.Fatalf("expected blank platform error, got %v", err)
	}
}

func TestSosmedBundleAdminServiceUpdatePackageChangesFieldsAndKeepsKeyImmutable(t *testing.T) {
	ctx := context.Background()
	_, svc, bundleRepo := setupSosmedBundleAdminServiceTest(t)

	created, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      "immutable-package",
		Title:    "Original Package",
		Platform: "instagram",
	})
	if err != nil {
		t.Fatalf("create package: %v", err)
	}

	if _, exists := reflect.TypeOf(UpdateSosmedBundlePackageInput{}).FieldByName("Key"); exists {
		t.Fatalf("update package input must not expose key because bundle keys are immutable")
	}

	updated, err := svc.UpdatePackage(ctx, created.ID, UpdateSosmedBundlePackageInput{
		Title:         sosmedBundleAdminStringPtr("  Edited Package  "),
		Subtitle:      sosmedBundleAdminStringPtr("  Paket buat launch  "),
		Description:   sosmedBundleAdminStringPtr("  Deskripsi baru  "),
		Platform:      sosmedBundleAdminStringPtr(" tiktok "),
		Badge:         sosmedBundleAdminStringPtr(" Promo "),
		IsHighlighted: sosmedBundleAdminBoolPtr(true),
		IsActive:      sosmedBundleAdminBoolPtr(false),
		SortOrder:     sosmedBundleAdminIntPtr(7),
	})
	if err != nil {
		t.Fatalf("update package: %v", err)
	}

	if updated.Key != "immutable-package" {
		t.Fatalf("expected immutable key to remain immutable-package, got %q", updated.Key)
	}
	if updated.Title != "Edited Package" || updated.Subtitle != "Paket buat launch" || updated.Description != "Deskripsi baru" {
		t.Fatalf("expected trimmed text fields, got %+v", updated)
	}
	if updated.Platform != "tiktok" || updated.Badge != "Promo" {
		t.Fatalf("expected updated platform/badge, got platform=%q badge=%q", updated.Platform, updated.Badge)
	}
	if !updated.IsHighlighted || updated.IsActive || updated.SortOrder != 7 {
		t.Fatalf("expected highlight=true active=false sort=7, got %+v", updated)
	}

	stored, err := bundleRepo.FindBundleByKeyIncludingInactive(ctx, " immutable-package ")
	if err != nil {
		t.Fatalf("reload updated package by immutable key: %v", err)
	}
	if stored.Key != "immutable-package" || stored.IsActive || stored.SortOrder != 7 || stored.Title != "Edited Package" {
		t.Fatalf("updated package was not persisted correctly: %+v", stored)
	}

	_, err = svc.UpdatePackage(ctx, created.ID, UpdateSosmedBundlePackageInput{Title: sosmedBundleAdminStringPtr("   ")})
	if err == nil || !strings.Contains(err.Error(), "judul paket wajib diisi") {
		t.Fatalf("expected blank title update error, got %v", err)
	}
	_, err = svc.UpdatePackage(ctx, created.ID, UpdateSosmedBundlePackageInput{Platform: sosmedBundleAdminStringPtr("   ")})
	if err == nil || !strings.Contains(err.Error(), "platform paket wajib diisi") {
		t.Fatalf("expected blank platform update error, got %v", err)
	}
}

func TestSosmedBundleAdminServiceDeactivatePackageSoftDisablesWithoutHardDelete(t *testing.T) {
	ctx := context.Background()
	_, svc, bundleRepo := setupSosmedBundleAdminServiceTest(t)

	created, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      "deactivate-package",
		Title:    "Deactivate Package",
		Platform: "instagram",
	})
	if err != nil {
		t.Fatalf("create package: %v", err)
	}

	if err := svc.DeactivatePackage(ctx, created.ID); err != nil {
		t.Fatalf("deactivate package: %v", err)
	}

	stored, err := bundleRepo.FindBundleByKeyIncludingInactive(ctx, "deactivate-package")
	if err != nil {
		t.Fatalf("expected deactivated package row to still exist: %v", err)
	}
	if stored.IsActive {
		t.Fatalf("expected package to be inactive after deactivate")
	}
	if stored.DeletedAt.Valid {
		t.Fatalf("expected package not to be hard-deleted/soft-deleted with DeletedAt")
	}

	activeOnly, err := bundleRepo.ListAdminBundles(ctx, false)
	if err != nil {
		t.Fatalf("list active packages: %v", err)
	}
	for _, pkg := range activeOnly {
		if pkg.ID == created.ID {
			t.Fatalf("expected deactivated package to be hidden from active-only admin list")
		}
	}

	allPackages, err := bundleRepo.ListAdminBundles(ctx, true)
	if err != nil {
		t.Fatalf("list all packages: %v", err)
	}
	found := false
	for _, pkg := range allPackages {
		if pkg.ID == created.ID {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected deactivated package to remain visible when includeInactive=true")
	}

	deleteAlias, err := svc.CreatePackage(ctx, CreateSosmedBundlePackageInput{
		Key:      "delete-alias-package",
		Title:    "Delete Alias Package",
		Platform: "instagram",
	})
	if err != nil {
		t.Fatalf("create delete alias package: %v", err)
	}
	if err := svc.DeletePackage(ctx, deleteAlias.ID); err != nil {
		t.Fatalf("delete package should use deactivate semantics: %v", err)
	}
	storedAlias, err := bundleRepo.FindBundleByKeyIncludingInactive(ctx, "delete-alias-package")
	if err != nil {
		t.Fatalf("expected delete alias package row to still exist: %v", err)
	}
	if storedAlias.IsActive || storedAlias.DeletedAt.Valid {
		t.Fatalf("expected delete alias to deactivate without deleting row, got %+v", storedAlias)
	}
}

func TestSosmedBundleAdminServiceCreateVariantUnderPackageSucceedsWithDefaults(t *testing.T) {
	ctx := context.Background()
	_, svc, bundleRepo := setupSosmedBundleAdminServiceTest(t)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "variant-create-package")

	created, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:         " starter ",
		Name:        "  Starter Variant  ",
		Description: "  Untuk mulai  ",
	})
	if err != nil {
		t.Fatalf("create variant with defaults: %v", err)
	}
	if created.ID.String() == "00000000-0000-0000-0000-000000000000" {
		t.Fatalf("expected variant ID to be generated")
	}
	if created.BundlePackageID != pkg.ID {
		t.Fatalf("expected variant package ID %s, got %s", pkg.ID, created.BundlePackageID)
	}
	if created.Key != "starter" || created.Name != "Starter Variant" || created.Description != "Untuk mulai" {
		t.Fatalf("expected trimmed key/name/description, got %+v", created)
	}
	if created.PriceMode != SosmedBundlePriceModeComputed || created.FixedPrice != 0 || created.DiscountPercent != 0 || created.DiscountAmount != 0 {
		t.Fatalf("expected computed pricing defaults, got %+v", created)
	}
	if !created.IsActive || created.SortOrder != 100 {
		t.Fatalf("expected active variant with default sort_order=100, got %+v", created)
	}

	storedPkg, err := bundleRepo.GetAdminBundleByID(ctx, pkg.ID, true)
	if err != nil {
		t.Fatalf("load package with created variant: %v", err)
	}
	if stored := findSosmedBundleAdminTestVariant(storedPkg, "starter"); stored == nil || stored.ID != created.ID {
		t.Fatalf("expected created variant to be persisted in package graph, got %+v", storedPkg.Variants)
	}

	inactive, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:        "inactive-fixed",
		Name:       "Inactive Fixed",
		PriceMode:  SosmedBundlePriceModeFixed,
		FixedPrice: 25000,
		IsActive:   sosmedBundleAdminBoolPtr(false),
		SortOrder:  sosmedBundleAdminIntPtr(8),
	})
	if err != nil {
		t.Fatalf("create inactive fixed variant: %v", err)
	}
	if inactive.IsActive || inactive.PriceMode != SosmedBundlePriceModeFixed || inactive.FixedPrice != 25000 || inactive.SortOrder != 8 {
		t.Fatalf("expected inactive fixed variant values to persist, got %+v", inactive)
	}
	storedPkg, err = bundleRepo.GetAdminBundleByID(ctx, pkg.ID, true)
	if err != nil {
		t.Fatalf("reload package with inactive variant: %v", err)
	}
	storedInactive := findSosmedBundleAdminTestVariant(storedPkg, "inactive-fixed")
	if storedInactive == nil || storedInactive.IsActive {
		t.Fatalf("expected inactive variant to stay inactive after create, got %+v", storedInactive)
	}
}

func TestSosmedBundleAdminServiceListAndGetVariantsIncludeInactiveWhenRequested(t *testing.T) {
	ctx := context.Background()
	_, svc, _ := setupSosmedBundleAdminServiceTest(t)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "variant-list-package")

	active, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:  "active-variant",
		Name: "Active Variant",
	})
	if err != nil {
		t.Fatalf("create active variant: %v", err)
	}
	inactive, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:      "inactive-variant",
		Name:     "Inactive Variant",
		IsActive: sosmedBundleAdminBoolPtr(false),
	})
	if err != nil {
		t.Fatalf("create inactive variant: %v", err)
	}

	activeOnly, err := svc.ListVariants(ctx, pkg.ID, false)
	if err != nil {
		t.Fatalf("list active-only variants: %v", err)
	}
	if len(activeOnly) != 1 || activeOnly[0].ID != active.ID {
		t.Fatalf("expected only active variant, got %+v", activeOnly)
	}

	allVariants, err := svc.ListVariants(ctx, pkg.ID, true)
	if err != nil {
		t.Fatalf("list all variants: %v", err)
	}
	if len(allVariants) != 2 {
		t.Fatalf("expected active and inactive variants, got %d", len(allVariants))
	}

	loadedInactive, err := svc.GetVariant(ctx, inactive.ID, true)
	if err != nil {
		t.Fatalf("get inactive variant with includeInactive=true: %v", err)
	}
	if loadedInactive.ID != inactive.ID || loadedInactive.IsActive {
		t.Fatalf("expected inactive variant detail, got %+v", loadedInactive)
	}

	_, err = svc.GetVariant(ctx, inactive.ID, false)
	if err == nil || !strings.Contains(err.Error(), "variant bundle sosmed tidak ditemukan") {
		t.Fatalf("expected inactive variant hidden when includeInactive=false, got %v", err)
	}
}

func TestSosmedBundleAdminServiceCreateVariantRejectsDuplicateKeyOnlyWithinSamePackage(t *testing.T) {
	ctx := context.Background()
	_, svc, _ := setupSosmedBundleAdminServiceTest(t)
	firstPkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "variant-duplicate-one")
	secondPkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "variant-duplicate-two")

	if _, err := svc.CreateVariant(ctx, firstPkg.ID, CreateSosmedBundleVariantInput{
		Key:      "duplicate-variant",
		Name:     "Duplicate Variant",
		IsActive: sosmedBundleAdminBoolPtr(false),
	}); err != nil {
		t.Fatalf("seed duplicate variant: %v", err)
	}

	_, err := svc.CreateVariant(ctx, firstPkg.ID, CreateSosmedBundleVariantInput{
		Key:  " duplicate-variant ",
		Name: "Duplicate Again",
	})
	if err == nil || !strings.Contains(err.Error(), "key variant sudah dipakai") {
		t.Fatalf("expected duplicate variant key error in same package, got %v", err)
	}

	if _, err := svc.CreateVariant(ctx, secondPkg.ID, CreateSosmedBundleVariantInput{
		Key:  "duplicate-variant",
		Name: "Duplicate Variant In Other Package",
	}); err != nil {
		t.Fatalf("expected same variant key allowed in different package, got %v", err)
	}
}

func TestSosmedBundleAdminServiceCreateVariantRejectsInvalidKeyAndBlankName(t *testing.T) {
	ctx := context.Background()
	_, svc, _ := setupSosmedBundleAdminServiceTest(t)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "variant-validation-package")

	badKeys := []string{"A-B", "x", "-bad", "bad key", strings.Repeat("a", 100)}
	for _, key := range badKeys {
		_, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
			Key:  key,
			Name: "Invalid Key Variant",
		})
		if err == nil || !strings.Contains(err.Error(), "key variant tidak valid") {
			t.Fatalf("expected invalid variant key error for %q, got %v", key, err)
		}
	}

	_, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:  "blank-name",
		Name: "   ",
	})
	if err == nil || !strings.Contains(err.Error(), "nama variant wajib diisi") {
		t.Fatalf("expected blank variant name error, got %v", err)
	}
}

func TestSosmedBundleAdminServiceCreateVariantRejectsInvalidPricing(t *testing.T) {
	ctx := context.Background()
	_, svc, _ := setupSosmedBundleAdminServiceTest(t)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "variant-pricing-package")

	cases := []struct {
		name      string
		input     CreateSosmedBundleVariantInput
		wantError string
	}{
		{
			name: "invalid price mode",
			input: CreateSosmedBundleVariantInput{
				Key:       "bad-mode",
				Name:      "Bad Mode",
				PriceMode: "manual",
			},
			wantError: "mode harga variant tidak valid",
		},
		{
			name: "fixed zero",
			input: CreateSosmedBundleVariantInput{
				Key:       "fixed-zero",
				Name:      "Fixed Zero",
				PriceMode: SosmedBundlePriceModeFixed,
			},
			wantError: "harga fixed variant wajib lebih dari 0",
		},
		{
			name: "fixed negative",
			input: CreateSosmedBundleVariantInput{
				Key:        "fixed-negative",
				Name:       "Fixed Negative",
				PriceMode:  SosmedBundlePriceModeFixed,
				FixedPrice: -1,
			},
			wantError: "harga fixed variant wajib lebih dari 0",
		},
		{
			name: "discount percent negative",
			input: CreateSosmedBundleVariantInput{
				Key:             "discount-negative",
				Name:            "Discount Negative",
				PriceMode:       SosmedBundlePriceModeComputedWithDiscount,
				DiscountPercent: -1,
			},
			wantError: "diskon persen variant harus 0 sampai 100",
		},
		{
			name: "discount percent too high",
			input: CreateSosmedBundleVariantInput{
				Key:             "discount-too-high",
				Name:            "Discount Too High",
				PriceMode:       SosmedBundlePriceModeComputedWithDiscount,
				DiscountPercent: 101,
			},
			wantError: "diskon persen variant harus 0 sampai 100",
		},
		{
			name: "discount amount negative",
			input: CreateSosmedBundleVariantInput{
				Key:            "amount-negative",
				Name:           "Amount Negative",
				PriceMode:      SosmedBundlePriceModeComputedWithDiscount,
				DiscountAmount: -1,
			},
			wantError: "diskon nominal variant tidak boleh negatif",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.CreateVariant(ctx, pkg.ID, tc.input)
			if err == nil || !strings.Contains(err.Error(), tc.wantError) {
				t.Fatalf("expected %q error, got %v", tc.wantError, err)
			}
		})
	}
}

func TestSosmedBundleAdminServiceUpdateVariantChangesPricingAndKeepsKeyImmutable(t *testing.T) {
	ctx := context.Background()
	_, svc, bundleRepo := setupSosmedBundleAdminServiceTest(t)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "variant-update-package")
	created, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:        "immutable-variant",
		Name:       "Original Variant",
		PriceMode:  SosmedBundlePriceModeFixed,
		FixedPrice: 30000,
	})
	if err != nil {
		t.Fatalf("create variant: %v", err)
	}

	if _, exists := reflect.TypeOf(UpdateSosmedBundleVariantInput{}).FieldByName("Key"); exists {
		t.Fatalf("update variant input must not expose key because variant keys are immutable")
	}

	updated, err := svc.UpdateVariant(ctx, created.ID, UpdateSosmedBundleVariantInput{
		Name:            sosmedBundleAdminStringPtr("  Edited Variant  "),
		Description:     sosmedBundleAdminStringPtr("  Deskripsi variant baru  "),
		PriceMode:       sosmedBundleAdminStringPtr(SosmedBundlePriceModeComputedWithDiscount),
		FixedPrice:      sosmedBundleAdminInt64Ptr(0),
		DiscountPercent: sosmedBundleAdminIntPtr(25),
		DiscountAmount:  sosmedBundleAdminInt64Ptr(5000),
		IsActive:        sosmedBundleAdminBoolPtr(false),
		SortOrder:       sosmedBundleAdminIntPtr(0),
	})
	if err != nil {
		t.Fatalf("update variant: %v", err)
	}
	if updated.Key != "immutable-variant" {
		t.Fatalf("expected immutable variant key to remain immutable-variant, got %q", updated.Key)
	}
	if updated.Name != "Edited Variant" || updated.Description != "Deskripsi variant baru" {
		t.Fatalf("expected trimmed variant text fields, got %+v", updated)
	}
	if updated.PriceMode != SosmedBundlePriceModeComputedWithDiscount || updated.FixedPrice != 0 || updated.DiscountPercent != 25 || updated.DiscountAmount != 5000 {
		t.Fatalf("expected updated pricing fields, got %+v", updated)
	}
	if updated.IsActive || updated.SortOrder != 0 {
		t.Fatalf("expected active=false and sort_order=0 to persist, got %+v", updated)
	}

	storedPkg, err := bundleRepo.GetAdminBundleByID(ctx, pkg.ID, true)
	if err != nil {
		t.Fatalf("reload package after variant update: %v", err)
	}
	stored := findSosmedBundleAdminTestVariant(storedPkg, "immutable-variant")
	if stored == nil || stored.IsActive || stored.SortOrder != 0 || stored.DiscountPercent != 25 || stored.DiscountAmount != 5000 {
		t.Fatalf("updated variant was not persisted correctly: %+v", stored)
	}

	_, err = svc.UpdateVariant(ctx, created.ID, UpdateSosmedBundleVariantInput{Name: sosmedBundleAdminStringPtr("   ")})
	if err == nil || !strings.Contains(err.Error(), "nama variant wajib diisi") {
		t.Fatalf("expected blank variant name update error, got %v", err)
	}
	_, err = svc.UpdateVariant(ctx, created.ID, UpdateSosmedBundleVariantInput{PriceMode: sosmedBundleAdminStringPtr("manual")})
	if err == nil || !strings.Contains(err.Error(), "mode harga variant tidak valid") {
		t.Fatalf("expected invalid price mode update error, got %v", err)
	}
}

func TestSosmedBundleAdminServiceDeactivateVariantSoftDisablesWithoutHardDeleteAndHidesCheckout(t *testing.T) {
	ctx := context.Background()
	_, svc, bundleRepo := setupSosmedBundleAdminServiceTest(t)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "variant-checkout-package")

	created, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:  "checkout-variant",
		Name: "Checkout Variant",
	})
	if err != nil {
		t.Fatalf("create checkout variant: %v", err)
	}
	if _, err := bundleRepo.GetVariantForCheckout(ctx, pkg.Key, created.Key); err != nil {
		t.Fatalf("expected active variant to be available for checkout lookup before deactivate: %v", err)
	}

	if err := svc.DeactivateVariant(ctx, created.ID); err != nil {
		t.Fatalf("deactivate variant: %v", err)
	}
	if _, err := bundleRepo.GetVariantForCheckout(ctx, pkg.Key, created.Key); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected deactivated variant hidden from checkout lookup, got %v", err)
	}

	stored, err := svc.GetVariant(ctx, created.ID, true)
	if err != nil {
		t.Fatalf("load deactivated variant: %v", err)
	}
	if stored.IsActive || stored.DeletedAt.Valid {
		t.Fatalf("expected variant inactive without hard/soft delete, got %+v", stored)
	}

	activeOnly, err := svc.ListVariants(ctx, pkg.ID, false)
	if err != nil {
		t.Fatalf("list active variants after deactivate: %v", err)
	}
	for _, variant := range activeOnly {
		if variant.ID == created.ID {
			t.Fatalf("expected deactivated variant hidden from active-only variant list")
		}
	}

	deleteAlias, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:  "delete-alias-variant",
		Name: "Delete Alias Variant",
	})
	if err != nil {
		t.Fatalf("create delete alias variant: %v", err)
	}
	if err := svc.DeleteVariant(ctx, deleteAlias.ID); err != nil {
		t.Fatalf("delete variant should use deactivate semantics: %v", err)
	}
	storedAlias, err := svc.GetVariant(ctx, deleteAlias.ID, true)
	if err != nil {
		t.Fatalf("expected delete alias variant row to still exist: %v", err)
	}
	if storedAlias.IsActive || storedAlias.DeletedAt.Valid {
		t.Fatalf("expected delete alias variant to deactivate without deleting row, got %+v", storedAlias)
	}
}

func TestSosmedBundleAdminServiceCreateItemUnderVariantSucceedsWithDefaults(t *testing.T) {
	ctx := context.Background()
	db, svc, bundleRepo := setupSosmedBundleAdminServiceTest(t)
	serviceItem := createSosmedBundleAdminServiceFixture(t, db, "item-create-service", "Instagram Followers", "Min: 100 Max: 1000", true)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "item-create-package")
	variant, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{
		Key:  "item-create-variant",
		Name: "Item Create Variant",
	})
	if err != nil {
		t.Fatalf("create variant for item: %v", err)
	}

	created, err := svc.CreateItem(ctx, variant.ID, CreateSosmedBundleItemInput{
		SosmedServiceID: serviceItem.ID,
		Label:           "  Followers Starter  ",
		QuantityUnits:   500,
	})
	if err != nil {
		t.Fatalf("create item with defaults: %v", err)
	}
	if created.ID.String() == "00000000-0000-0000-0000-000000000000" {
		t.Fatalf("expected item ID to be generated")
	}
	if created.BundleVariantID != variant.ID || created.SosmedServiceID != serviceItem.ID {
		t.Fatalf("expected item linked to variant/service, got %+v", created)
	}
	if created.Label != "Followers Starter" || created.QuantityUnits != 500 {
		t.Fatalf("expected trimmed label and quantity=500, got %+v", created)
	}
	if created.TargetStrategy != "same_target" || !created.IsActive || created.SortOrder != 100 {
		t.Fatalf("expected default target=same_target active=true sort=100, got %+v", created)
	}

	storedVariant, err := svc.GetVariant(ctx, variant.ID, true)
	if err != nil {
		t.Fatalf("load variant with created item: %v", err)
	}
	stored := findSosmedBundleAdminTestItem(storedVariant, created.ID)
	if stored == nil || stored.Service.ID != serviceItem.ID || stored.Service.Title != "Instagram Followers" {
		t.Fatalf("expected created item with service preload in admin variant graph, got %+v", storedVariant.Items)
	}

	checkoutVariant, err := bundleRepo.GetVariantForCheckout(ctx, pkg.Key, variant.Key)
	if err != nil {
		t.Fatalf("expected active item available through public checkout graph: %v", err)
	}
	if len(checkoutVariant.Items) != 1 || checkoutVariant.Items[0].ID != created.ID {
		t.Fatalf("expected public checkout graph to include active item only, got %+v", checkoutVariant.Items)
	}

	inactive, err := svc.CreateItem(ctx, variant.ID, CreateSosmedBundleItemInput{
		SosmedServiceID: serviceItem.ID,
		Label:           "Inactive Item",
		QuantityUnits:   300,
		TargetStrategy:  "same_target",
		IsActive:        sosmedBundleAdminBoolPtr(false),
		SortOrder:       sosmedBundleAdminIntPtr(8),
	})
	if err != nil {
		t.Fatalf("create explicit inactive item: %v", err)
	}
	if inactive.IsActive || inactive.TargetStrategy != "same_target" || inactive.SortOrder != 8 {
		t.Fatalf("expected explicit inactive item values to persist, got %+v", inactive)
	}
	storedVariant, err = svc.GetVariant(ctx, variant.ID, true)
	if err != nil {
		t.Fatalf("reload variant with inactive item: %v", err)
	}
	storedInactive := findSosmedBundleAdminTestItem(storedVariant, inactive.ID)
	if storedInactive == nil || storedInactive.IsActive {
		t.Fatalf("expected inactive item to stay inactive after create, got %+v", storedInactive)
	}
}

func TestSosmedBundleAdminServiceListAndGetItemsIncludeInactiveWhenRequested(t *testing.T) {
	ctx := context.Background()
	db, svc, _ := setupSosmedBundleAdminServiceTest(t)
	serviceItem := createSosmedBundleAdminServiceFixture(t, db, "item-list-service", "Instagram Likes", "1-1000", true)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "item-list-package")
	variant, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{Key: "item-list-variant", Name: "Item List Variant"})
	if err != nil {
		t.Fatalf("create variant: %v", err)
	}
	active, err := svc.CreateItem(ctx, variant.ID, CreateSosmedBundleItemInput{
		SosmedServiceID: serviceItem.ID,
		Label:           "Active Item",
		QuantityUnits:   250,
	})
	if err != nil {
		t.Fatalf("create active item: %v", err)
	}
	inactive, err := svc.CreateItem(ctx, variant.ID, CreateSosmedBundleItemInput{
		SosmedServiceID: serviceItem.ID,
		Label:           "Inactive Item",
		QuantityUnits:   300,
		IsActive:        sosmedBundleAdminBoolPtr(false),
	})
	if err != nil {
		t.Fatalf("create inactive item: %v", err)
	}

	activeOnly, err := svc.ListItems(ctx, variant.ID, false)
	if err != nil {
		t.Fatalf("list active-only items: %v", err)
	}
	if len(activeOnly) != 1 || activeOnly[0].ID != active.ID {
		t.Fatalf("expected only active item, got %+v", activeOnly)
	}
	allItems, err := svc.ListItems(ctx, variant.ID, true)
	if err != nil {
		t.Fatalf("list all items: %v", err)
	}
	if len(allItems) != 2 {
		t.Fatalf("expected active and inactive items, got %d", len(allItems))
	}

	loadedInactive, err := svc.GetItem(ctx, inactive.ID, true)
	if err != nil {
		t.Fatalf("get inactive item with includeInactive=true: %v", err)
	}
	if loadedInactive.ID != inactive.ID || loadedInactive.IsActive {
		t.Fatalf("expected inactive item detail, got %+v", loadedInactive)
	}
	_, err = svc.GetItem(ctx, inactive.ID, false)
	if err == nil || !strings.Contains(err.Error(), "item bundle sosmed tidak ditemukan") {
		t.Fatalf("expected inactive item hidden when includeInactive=false, got %v", err)
	}
}

func TestSosmedBundleAdminServiceCreateItemValidatesServiceQuantityAndTargetStrategy(t *testing.T) {
	ctx := context.Background()
	db, svc, _ := setupSosmedBundleAdminServiceTest(t)
	activeService := createSosmedBundleAdminServiceFixture(t, db, "item-valid-service", "Instagram Views", "Min: 100 Max: 1000", true)
	inactiveService := createSosmedBundleAdminServiceFixture(t, db, "item-inactive-service", "Inactive Service", "1-1000", false)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "item-validation-package")
	variant, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{Key: "item-validation-variant", Name: "Item Validation Variant"})
	if err != nil {
		t.Fatalf("create variant: %v", err)
	}

	cases := []struct {
		name      string
		input     CreateSosmedBundleItemInput
		wantError string
	}{
		{
			name: "missing service",
			input: CreateSosmedBundleItemInput{
				SosmedServiceID: uuid.New(),
				Label:           "Missing Service",
				QuantityUnits:   500,
			},
			wantError: "layanan sosmed tidak ditemukan",
		},
		{
			name: "inactive service",
			input: CreateSosmedBundleItemInput{
				SosmedServiceID: inactiveService.ID,
				Label:           "Inactive Service",
				QuantityUnits:   500,
			},
			wantError: "layanan sosmed sedang nonaktif",
		},
		{
			name: "zero quantity",
			input: CreateSosmedBundleItemInput{
				SosmedServiceID: activeService.ID,
				Label:           "Zero Quantity",
				QuantityUnits:   0,
			},
			wantError: "quantity item wajib lebih dari 0",
		},
		{
			name: "below minimum",
			input: CreateSosmedBundleItemInput{
				SosmedServiceID: activeService.ID,
				Label:           "Below Min",
				QuantityUnits:   99,
			},
			wantError: "minimum 100",
		},
		{
			name: "above maximum",
			input: CreateSosmedBundleItemInput{
				SosmedServiceID: activeService.ID,
				Label:           "Above Max",
				QuantityUnits:   1001,
			},
			wantError: "maksimum 1000",
		},
		{
			name: "unsupported target strategy",
			input: CreateSosmedBundleItemInput{
				SosmedServiceID: activeService.ID,
				Label:           "Target Strategy",
				QuantityUnits:   500,
				TargetStrategy:  "per_item_target",
			},
			wantError: "target strategy item tidak valid",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.CreateItem(ctx, variant.ID, tc.input)
			if err == nil || !strings.Contains(err.Error(), tc.wantError) {
				t.Fatalf("expected %q error, got %v", tc.wantError, err)
			}
		})
	}
}

func TestSosmedBundleAdminServiceUpdateItemChangesServiceFieldsAndKeepsRowEditable(t *testing.T) {
	ctx := context.Background()
	db, svc, _ := setupSosmedBundleAdminServiceTest(t)
	firstService := createSosmedBundleAdminServiceFixture(t, db, "item-update-first", "Instagram Followers", "100-1000", true)
	secondService := createSosmedBundleAdminServiceFixture(t, db, "item-update-second", "Instagram Likes", "50-2000", true)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "item-update-package")
	variant, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{Key: "item-update-variant", Name: "Item Update Variant"})
	if err != nil {
		t.Fatalf("create variant: %v", err)
	}
	created, err := svc.CreateItem(ctx, variant.ID, CreateSosmedBundleItemInput{
		SosmedServiceID: firstService.ID,
		Label:           "Original Item",
		QuantityUnits:   500,
	})
	if err != nil {
		t.Fatalf("create item: %v", err)
	}

	updated, err := svc.UpdateItem(ctx, created.ID, UpdateSosmedBundleItemInput{
		SosmedServiceID: &secondService.ID,
		Label:           sosmedBundleAdminStringPtr("  Edited Item  "),
		QuantityUnits:   sosmedBundleAdminInt64Ptr(50),
		TargetStrategy:  sosmedBundleAdminStringPtr(" same_target "),
		IsActive:        sosmedBundleAdminBoolPtr(false),
		SortOrder:       sosmedBundleAdminIntPtr(0),
	})
	if err != nil {
		t.Fatalf("update item: %v", err)
	}
	if updated.SosmedServiceID != secondService.ID || updated.Service.ID != secondService.ID {
		t.Fatalf("expected item linked to second service, got %+v", updated)
	}
	if updated.Label != "Edited Item" || updated.QuantityUnits != 50 || updated.TargetStrategy != "same_target" {
		t.Fatalf("expected trimmed label/quantity/target updates, got %+v", updated)
	}
	if updated.IsActive || updated.SortOrder != 0 {
		t.Fatalf("expected active=false and sort_order=0 to persist, got %+v", updated)
	}

	stored, err := svc.GetItem(ctx, created.ID, true)
	if err != nil {
		t.Fatalf("reload updated item: %v", err)
	}
	if stored.SosmedServiceID != secondService.ID || stored.Label != "Edited Item" || stored.QuantityUnits != 50 || stored.IsActive {
		t.Fatalf("updated item was not persisted correctly: %+v", stored)
	}

	_, err = svc.UpdateItem(ctx, created.ID, UpdateSosmedBundleItemInput{QuantityUnits: sosmedBundleAdminInt64Ptr(0)})
	if err == nil || !strings.Contains(err.Error(), "quantity item wajib lebih dari 0") {
		t.Fatalf("expected invalid quantity update error, got %v", err)
	}
	_, err = svc.UpdateItem(ctx, created.ID, UpdateSosmedBundleItemInput{TargetStrategy: sosmedBundleAdminStringPtr("per_item_target")})
	if err == nil || !strings.Contains(err.Error(), "target strategy item tidak valid") {
		t.Fatalf("expected invalid target strategy update error, got %v", err)
	}
}

func TestSosmedBundleAdminServiceDeactivateItemSoftDisablesWithoutHardDeleteAndBreaksCheckoutPricing(t *testing.T) {
	ctx := context.Background()
	db, svc, bundleRepo := setupSosmedBundleAdminServiceTest(t)
	serviceItem := createSosmedBundleAdminServiceFixture(t, db, "item-checkout-service", "Instagram Saves", "1-1000", true)
	pkg := createSosmedBundleAdminPackageForVariantTest(t, ctx, svc, "item-checkout-package")
	variant, err := svc.CreateVariant(ctx, pkg.ID, CreateSosmedBundleVariantInput{Key: "item-checkout-variant", Name: "Item Checkout Variant"})
	if err != nil {
		t.Fatalf("create variant: %v", err)
	}
	created, err := svc.CreateItem(ctx, variant.ID, CreateSosmedBundleItemInput{
		SosmedServiceID: serviceItem.ID,
		Label:           "Checkout Item",
		QuantityUnits:   500,
	})
	if err != nil {
		t.Fatalf("create checkout item: %v", err)
	}
	checkoutVariant, err := bundleRepo.GetVariantForCheckout(ctx, pkg.Key, variant.Key)
	if err != nil {
		t.Fatalf("expected checkout variant before item deactivate: %v", err)
	}
	if len(checkoutVariant.Items) != 1 {
		t.Fatalf("expected one active checkout item before deactivate, got %+v", checkoutVariant.Items)
	}
	if _, err := CalculateSosmedBundlePricing(checkoutVariant); err != nil {
		t.Fatalf("expected checkout pricing before item deactivate: %v", err)
	}

	if err := svc.DeactivateItem(ctx, created.ID); err != nil {
		t.Fatalf("deactivate item: %v", err)
	}
	stored, err := svc.GetItem(ctx, created.ID, true)
	if err != nil {
		t.Fatalf("load deactivated item: %v", err)
	}
	if stored.IsActive || stored.DeletedAt.Valid {
		t.Fatalf("expected item inactive without hard/soft delete, got %+v", stored)
	}

	checkoutVariant, err = bundleRepo.GetVariantForCheckout(ctx, pkg.Key, variant.Key)
	if err != nil {
		t.Fatalf("checkout variant should still load while inactive item is filtered out: %v", err)
	}
	if len(checkoutVariant.Items) != 0 {
		t.Fatalf("expected deactivated item hidden from public checkout graph, got %+v", checkoutVariant.Items)
	}
	_, err = CalculateSosmedBundlePricing(checkoutVariant)
	if err == nil || !strings.Contains(err.Error(), "belum memiliki item layanan") {
		t.Fatalf("expected clear pricing error for zero active checkout items, got %v", err)
	}

	deleteAlias, err := svc.CreateItem(ctx, variant.ID, CreateSosmedBundleItemInput{
		SosmedServiceID: serviceItem.ID,
		Label:           "Delete Alias Item",
		QuantityUnits:   300,
	})
	if err != nil {
		t.Fatalf("create delete alias item: %v", err)
	}
	if err := svc.DeleteItem(ctx, deleteAlias.ID); err != nil {
		t.Fatalf("delete item should use deactivate semantics: %v", err)
	}
	storedAlias, err := svc.GetItem(ctx, deleteAlias.ID, true)
	if err != nil {
		t.Fatalf("expected delete alias item row to still exist: %v", err)
	}
	if storedAlias.IsActive || storedAlias.DeletedAt.Valid {
		t.Fatalf("expected delete alias item to deactivate without deleting row, got %+v", storedAlias)
	}
}
