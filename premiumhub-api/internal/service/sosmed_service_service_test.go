package service

import (
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

func seedSosmedCategory(t *testing.T, repo *repository.ProductCategoryRepo, code, label string, sortOrder int) {
	t.Helper()

	svc := NewProductCategoryService(repo)
	_, err := svc.Create(CreateProductCategoryInput{
		Scope:     model.ProductCategoryScopeSosmed,
		Code:      code,
		Label:     label,
		SortOrder: intPtr(sortOrder),
		IsActive:  boolPtr(true),
	})
	if err != nil && !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("seed sosmed category %s: %v", code, err)
	}
}

func TestSosmedService_CreateAndValidation(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo)

	created, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode:  "followers",
		Code:          "IG Followers",
		Title:         "IG Followers Indonesia Aktif",
		Summary:       "Boost social proof dengan delivery bertahap.",
		PlatformLabel: "Instagram",
		BadgeText:     "Best Seller",
		Theme:         "blue",
		MinOrder:      "100",
		StartTime:     "5-15 menit",
		Refill:        "30 hari",
		ETA:           "2-12 jam",
		PriceStart:    "Rp 28.000",
		PricePer1K:    "≈ Rp 28 / 1K",
		TrustBadges:   []string{"No Password", "Refill 30 Hari", "No Password"},
		SortOrder:     intPtr(10),
		IsActive:      boolPtr(true),
	})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	if created.Code != "ig-followers" {
		t.Fatalf("expected normalized code ig-followers, got %s", created.Code)
	}
	if created.Theme != "blue" {
		t.Fatalf("expected theme blue, got %s", created.Theme)
	}
	if len(created.TrustBadges) != 2 {
		t.Fatalf("expected deduplicated trust badges, got %d", len(created.TrustBadges))
	}

	if _, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "followers",
		Code:         "ig-followers",
		Title:        "Duplicate",
	}); err == nil || !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("expected duplicate code error, got: %v", err)
	}

	if _, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "unknown",
		Code:         "invalid-category",
		Title:        "Invalid Category",
	}); err == nil || !strings.Contains(err.Error(), "kategori") {
		t.Fatalf("expected category validation error, got: %v", err)
	}
}

func TestSosmedService_UpdateAndDelete(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)
	seedSosmedCategory(t, categoryRepo, "likes", "Likes", 20)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo)

	created, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "followers",
		Code:         "ig-followers",
		Title:        "IG Followers Indonesia Aktif",
		Theme:        "blue",
		SortOrder:    intPtr(10),
	})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	nextCode := "new-code"
	if _, err := svc.Update(created.ID, UpdateSosmedServiceInput{Code: &nextCode}); err == nil || !strings.Contains(err.Error(), "tidak bisa diubah") {
		t.Fatalf("expected immutable code error, got: %v", err)
	}

	nextCategory := "likes"
	nextTitle := "IG Likes Premium"
	nextTheme := "pink"
	nextTrustBadges := []string{"No Password", "High Retention"}
	nextSort := 25
	updated, err := svc.Update(created.ID, UpdateSosmedServiceInput{
		CategoryCode: &nextCategory,
		Title:        &nextTitle,
		Theme:        &nextTheme,
		TrustBadges:  &nextTrustBadges,
		SortOrder:    &nextSort,
	})
	if err != nil {
		t.Fatalf("update sosmed service: %v", err)
	}
	if updated.CategoryCode != "likes" {
		t.Fatalf("expected category likes, got %s", updated.CategoryCode)
	}
	if updated.Theme != "pink" {
		t.Fatalf("expected theme pink, got %s", updated.Theme)
	}
	if updated.SortOrder != 25 {
		t.Fatalf("expected sort order 25, got %d", updated.SortOrder)
	}

	if err := svc.Delete(created.ID); err != nil {
		t.Fatalf("delete sosmed service: %v", err)
	}

	stored, err := repo.FindByID(created.ID)
	if err != nil {
		t.Fatalf("find sosmed service: %v", err)
	}
	if stored.IsActive {
		t.Fatalf("expected sosmed service to be inactive after delete")
	}
}
