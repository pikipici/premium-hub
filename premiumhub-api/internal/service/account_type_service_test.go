package service

import (
	"strings"
	"testing"

	"premiumhub-api/internal/repository"
)

func boolPtr(value bool) *bool { return &value }
func intPtr(value int) *int    { return &value }

func TestAccountTypeService_CreateAndValidate(t *testing.T) {
	db := setupCoreDB(t)
	repo := repository.NewAccountTypeRepo(db)
	if err := repo.EnsureDefaults(); err != nil {
		t.Fatalf("ensure defaults: %v", err)
	}

	svc := NewAccountTypeService(repo)

	created, err := svc.Create(CreateAccountTypeInput{
		Code:           "Family 5",
		Label:          "Family · 5 User",
		Description:    "Untuk 5 user",
		SortOrder:      intPtr(30),
		BadgeBgColor:   "#f5f3ff",
		BadgeTextColor: "#7c3aed",
		IsActive:       boolPtr(true),
	})
	if err != nil {
		t.Fatalf("create account type: %v", err)
	}

	if created.Code != "family-5" {
		t.Fatalf("expected normalized code family-5, got %s", created.Code)
	}
	if created.BadgeBgColor != "#F5F3FF" {
		t.Fatalf("expected normalized bg color #F5F3FF, got %s", created.BadgeBgColor)
	}

	if _, err := svc.Create(CreateAccountTypeInput{Code: "family-5", Label: "Dup"}); err == nil || !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("expected duplicate code error, got: %v", err)
	}

	if _, err := svc.ValidateActiveCode(" Family-5 "); err != nil {
		t.Fatalf("validate active code: %v", err)
	}
}

func TestAccountTypeService_DeactivateBlockedWhenUsed(t *testing.T) {
	db := setupCoreDB(t)
	repo := repository.NewAccountTypeRepo(db)
	if err := repo.EnsureDefaults(); err != nil {
		t.Fatalf("ensure defaults: %v", err)
	}
	svc := NewAccountTypeService(repo)

	product, _ := seedProductAndPrice(t, db, "Shared Product", "streaming", "shared", 10000, 1)
	seedStock(t, db, product.ID, "shared", "available")

	shared, err := repo.FindByCode("shared")
	if err != nil {
		t.Fatalf("find shared: %v", err)
	}

	_, err = svc.Update(shared.ID, UpdateAccountTypeInput{IsActive: boolPtr(false)})
	if err == nil || !strings.Contains(err.Error(), "masih dipakai") {
		t.Fatalf("expected usage blocking error, got: %v", err)
	}
}

func TestAccountTypeService_DeleteNonSystemSoftDeactivates(t *testing.T) {
	db := setupCoreDB(t)
	repo := repository.NewAccountTypeRepo(db)
	if err := repo.EnsureDefaults(); err != nil {
		t.Fatalf("ensure defaults: %v", err)
	}
	svc := NewAccountTypeService(repo)

	created, err := svc.Create(CreateAccountTypeInput{Code: "semi-private", Label: "Semi Private"})
	if err != nil {
		t.Fatalf("create account type: %v", err)
	}

	if err := svc.Delete(created.ID); err != nil {
		t.Fatalf("delete account type: %v", err)
	}

	stored, err := repo.FindByID(created.ID)
	if err != nil {
		t.Fatalf("find account type: %v", err)
	}
	if stored.IsActive {
		t.Fatalf("expected account type to be inactive after delete")
	}
}
