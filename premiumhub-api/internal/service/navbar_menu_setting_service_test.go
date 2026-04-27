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
	for _, item := range items {
		if !item.IsVisible {
			t.Fatalf("default navbar item %s should be visible", item.Key)
		}
	}

	hidden := false
	updated, err := svc.Update(UpdateNavbarMenuSettingsInput{
		Items: []UpdateNavbarMenuSettingItem{{Key: NavbarMenuConvert, IsVisible: &hidden}},
	})
	if err != nil {
		t.Fatalf("update navbar menu settings: %v", err)
	}
	state := map[string]bool{}
	for _, item := range updated {
		state[item.Key] = item.IsVisible
	}
	if state[NavbarMenuConvert] {
		t.Fatalf("convert navbar item should be hidden")
	}
	if !state[NavbarMenuApps] || !state[NavbarMenuVirtual] || !state[NavbarMenuSosmed] {
		t.Fatalf("other navbar defaults should stay visible")
	}

	publicItems, err := svc.PublicList()
	if err != nil {
		t.Fatalf("public list navbar menu settings: %v", err)
	}
	for _, item := range publicItems {
		if item.Key == NavbarMenuConvert {
			t.Fatalf("public list should not include hidden navbar item")
		}
	}
	if len(publicItems) != 3 {
		t.Fatalf("expected 3 public items after hiding one, got %d", len(publicItems))
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
