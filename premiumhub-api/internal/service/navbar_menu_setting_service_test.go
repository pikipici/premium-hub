package service

import (
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestNavbarMenuSettingServiceListPublicAndUpdate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&model.NavbarMenuSetting{}); err != nil {
		t.Fatalf("migrate navbar menu settings: %v", err)
	}

	svc := NewNavbarMenuSettingService(repository.NewNavbarMenuSettingRepo(db))

	items, err := svc.List()
	if err != nil {
		t.Fatalf("list navbar menu settings: %v", err)
	}
	if len(items) != 4 {
		t.Fatalf("expected 4 defaults, got %d", len(items))
	}
	defaultState := map[string]bool{}
	defaultLabels := map[string]string{}
	for _, item := range items {
		defaultState[item.Key] = item.IsVisible
		defaultLabels[item.Key] = item.Label
	}
	if defaultState[NavbarMenuApps] || defaultState[NavbarMenuConvert] {
		t.Fatalf("apps and convert navbar defaults should be hidden")
	}
	if !defaultState[NavbarMenuVirtual] || !defaultState[NavbarMenuSosmed] {
		t.Fatalf("nomor virtual and sosmed navbar defaults should be visible")
	}
	if defaultLabels[NavbarMenuSosmed] != "Paket Sosmed" {
		t.Fatalf("sosmed navbar label = %q, want Paket Sosmed", defaultLabels[NavbarMenuSosmed])
	}

	visible := true
	updated, err := svc.Update(UpdateNavbarMenuSettingsInput{
		Items: []UpdateNavbarMenuSettingItem{{Key: NavbarMenuConvert, IsVisible: &visible}},
	})
	if err != nil {
		t.Fatalf("update navbar menu settings: %v", err)
	}
	state := map[string]bool{}
	for _, item := range updated {
		state[item.Key] = item.IsVisible
	}
	if !state[NavbarMenuConvert] {
		t.Fatalf("convert navbar item should be visible after update")
	}
	if state[NavbarMenuApps] {
		t.Fatalf("apps navbar item should stay hidden by default")
	}
	if !state[NavbarMenuVirtual] || !state[NavbarMenuSosmed] {
		t.Fatalf("nomor virtual and sosmed defaults should stay visible")
	}

	publicItems, err := svc.PublicList()
	if err != nil {
		t.Fatalf("public list navbar menu settings: %v", err)
	}
	for _, item := range publicItems {
		if item.Key == NavbarMenuApps {
			t.Fatalf("public list should not include hidden apps navbar item")
		}
	}
	if len(publicItems) != 3 {
		t.Fatalf("expected 3 public items after enabling convert, got %d", len(publicItems))
	}
}

func TestNavbarMenuSettingServiceRejectsInvalidKey(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&model.NavbarMenuSetting{}); err != nil {
		t.Fatalf("migrate navbar menu settings: %v", err)
	}

	svc := NewNavbarMenuSettingService(repository.NewNavbarMenuSettingRepo(db))
	visible := false
	if _, err := svc.Update(UpdateNavbarMenuSettingsInput{
		Items: []UpdateNavbarMenuSettingItem{{Key: "admin", IsVisible: &visible}},
	}); err == nil {
		t.Fatalf("expected invalid navbar key error")
	}
}
