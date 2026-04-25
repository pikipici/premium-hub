package config

import (
	"strings"
	"testing"

	"premiumhub-api/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func openTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "requires cgo") {
			t.Skipf("sqlite test driver unavailable in this environment: %v", err)
		}
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed_services: %v", err)
	}

	return db
}

func TestEnsureDefaultSosmedServicesSeedsEmptyDatabase(t *testing.T) {
	db := openTestDB(t)

	if err := ensureDefaultSosmedServices(db); err != nil {
		t.Fatalf("seed defaults: %v", err)
	}

	var count int64
	if err := db.Model(&model.SosmedService{}).Count(&count).Error; err != nil {
		t.Fatalf("count sosmed services: %v", err)
	}
	if count != 5 {
		t.Fatalf("expected 5 default sosmed services, got %d", count)
	}
}

func TestEnsureDefaultSosmedServicesSkipsWhenCatalogAlreadyManaged(t *testing.T) {
	db := openTestDB(t)

	existing := &model.SosmedService{
		CategoryCode:  "followers",
		Code:          "custom-service",
		Title:         "Custom Service",
		CheckoutPrice: 12345,
		IsActive:      true,
	}
	if err := db.Create(existing).Error; err != nil {
		t.Fatalf("create existing service: %v", err)
	}

	if err := ensureDefaultSosmedServices(db); err != nil {
		t.Fatalf("ensure defaults with managed catalog: %v", err)
	}

	var count int64
	if err := db.Model(&model.SosmedService{}).Count(&count).Error; err != nil {
		t.Fatalf("count sosmed services: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected existing catalog to stay at 1 row, got %d", count)
	}

	var defaults int64
	if err := db.Model(&model.SosmedService{}).Where("code = ?", "ig-followers-id").Count(&defaults).Error; err != nil {
		t.Fatalf("count default code: %v", err)
	}
	if defaults != 0 {
		t.Fatalf("expected no default sosmed service to be recreated, got %d", defaults)
	}
}
