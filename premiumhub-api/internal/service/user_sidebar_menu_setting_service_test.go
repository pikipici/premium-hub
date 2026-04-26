package service

import (
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

func TestUserSidebarMenuSettingServiceListAndUpdate(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.UserSidebarMenuSetting{}); err != nil {
		t.Fatalf("migrate user sidebar menu settings: %v", err)
	}

	svc := NewUserSidebarMenuSettingService(repository.NewUserSidebarMenuSettingRepo(db))

	items, err := svc.List()
	if err != nil {
		t.Fatalf("list settings: %v", err)
	}
	if len(items) != 4 {
		t.Fatalf("expected 4 default settings, got %d", len(items))
	}
	for _, item := range items {
		if item.IsVisible {
			t.Fatalf("default setting %s should start hidden", item.Key)
		}
	}

	visible := true
	updated, err := svc.Update(UpdateUserSidebarMenuSettingsInput{
		Items: []UpdateUserSidebarMenuSettingItem{
			{Key: UserSidebarMenuConvertHistory, IsVisible: &visible},
			{Key: UserSidebarMenuActiveAccounts, IsVisible: &visible},
		},
	})
	if err != nil {
		t.Fatalf("update settings: %v", err)
	}

	state := map[string]bool{}
	for _, item := range updated {
		state[item.Key] = item.IsVisible
	}
	if !state[UserSidebarMenuConvertHistory] {
		t.Fatalf("convert history should be visible")
	}
	if !state[UserSidebarMenuActiveAccounts] {
		t.Fatalf("active accounts should be visible")
	}
	if state[UserSidebarMenuOrderHistory] || state[UserSidebarMenuWarrantyClaim] {
		t.Fatalf("untouched menu items should stay hidden: %+v", state)
	}
}

func TestUserSidebarMenuSettingServiceRejectsInvalidKey(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.UserSidebarMenuSetting{}); err != nil {
		t.Fatalf("migrate user sidebar menu settings: %v", err)
	}

	svc := NewUserSidebarMenuSettingService(repository.NewUserSidebarMenuSettingRepo(db))
	visible := false
	if _, err := svc.Update(UpdateUserSidebarMenuSettingsInput{
		Items: []UpdateUserSidebarMenuSettingItem{{Key: "dashboard", IsVisible: &visible}},
	}); err == nil {
		t.Fatalf("expected invalid key error")
	}
}
