package service

import (
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

func TestProductCategoryService_CreateAndValidate(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}); err != nil {
		t.Fatalf("migrate product category: %v", err)
	}

	repo := repository.NewProductCategoryRepo(db)
	svc := NewProductCategoryService(repo)

	created, err := svc.Create(CreateProductCategoryInput{
		Scope:       "prem-apps",
		Code:        "Video Boost",
		Label:       "Video Boost",
		Description: "Dorong performa konten video",
		SortOrder:   intPtr(25),
		IsActive:    boolPtr(true),
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	if created.Scope != model.ProductCategoryScopePremApps {
		t.Fatalf("expected scope %s, got %s", model.ProductCategoryScopePremApps, created.Scope)
	}
	if created.Code != "video-boost" {
		t.Fatalf("expected normalized code video-boost, got %s", created.Code)
	}

	if _, err := svc.Create(CreateProductCategoryInput{Scope: "prem_apps", Code: "video-boost", Label: "Dup"}); err == nil || !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("expected duplicate code error, got: %v", err)
	}

	if _, err := svc.ValidateActiveCode(model.ProductCategoryScopePremApps, " Video-Boost "); err != nil {
		t.Fatalf("validate active code: %v", err)
	}
}

func TestProductCategoryService_UpdateAndDelete(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}); err != nil {
		t.Fatalf("migrate product category: %v", err)
	}

	repo := repository.NewProductCategoryRepo(db)
	svc := NewProductCategoryService(repo)

	created, err := svc.Create(CreateProductCategoryInput{
		Scope: model.ProductCategoryScopeSosmed,
		Code:  "shares",
		Label: "Share",
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	nextLabel := "Share & Save"
	updated, err := svc.Update(created.ID, UpdateProductCategoryInput{
		Label:     &nextLabel,
		SortOrder: intPtr(12),
	})
	if err != nil {
		t.Fatalf("update category: %v", err)
	}
	if updated.Label != nextLabel {
		t.Fatalf("expected label %q, got %q", nextLabel, updated.Label)
	}
	if updated.SortOrder != 12 {
		t.Fatalf("expected sort_order 12, got %d", updated.SortOrder)
	}

	nextCode := "share-save"
	if _, err := svc.Update(created.ID, UpdateProductCategoryInput{Code: &nextCode}); err == nil || !strings.Contains(err.Error(), "tidak bisa diubah") {
		t.Fatalf("expected immutable code error, got: %v", err)
	}

	if err := svc.Delete(created.ID); err != nil {
		t.Fatalf("delete category: %v", err)
	}

	stored, err := repo.FindByID(created.ID)
	if err != nil {
		t.Fatalf("find category: %v", err)
	}
	if stored.IsActive {
		t.Fatalf("expected category to be inactive after delete")
	}

	if _, err := svc.ValidateActiveCode(model.ProductCategoryScopeSosmed, stored.Code); err == nil || !strings.Contains(err.Error(), "nonaktif") {
		t.Fatalf("expected inactive category validation error, got: %v", err)
	}
}
