package service

import (
	"strings"
	"testing"
	"time"

	"premiumhub-api/internal/repository"
)

func TestMaintenanceService_EvaluatePriorityAndMatching(t *testing.T) {
	db := setupCoreDB(t)
	repo := repository.NewMaintenanceRuleRepo(db)
	svc := NewMaintenanceService(repo)

	active := true

	if _, err := svc.Create(CreateMaintenanceRuleInput{
		Name:       "global",
		TargetType: MaintenanceTargetGlobal,
		Title:      "Global",
		Message:    "global msg",
		IsActive:   &active,
	}); err != nil {
		t.Fatalf("create global: %v", err)
	}

	if _, err := svc.Create(CreateMaintenanceRuleInput{
		Name:       "prefix",
		TargetType: MaintenanceTargetPrefix,
		TargetPath: "/product",
		Title:      "Prefix",
		Message:    "prefix msg",
		IsActive:   &active,
	}); err != nil {
		t.Fatalf("create prefix: %v", err)
	}

	exact, err := svc.Create(CreateMaintenanceRuleInput{
		Name:       "exact",
		TargetType: MaintenanceTargetExact,
		TargetPath: "/product/prem-apps",
		Title:      "Exact",
		Message:    "exact msg",
		IsActive:   &active,
	})
	if err != nil {
		t.Fatalf("create exact: %v", err)
	}

	matchedExact, err := svc.Evaluate("/product/prem-apps", false)
	if err != nil {
		t.Fatalf("evaluate exact: %v", err)
	}
	if !matchedExact.Active || matchedExact.Rule == nil || matchedExact.Rule.ID != exact.ID {
		t.Fatalf("expected exact rule to win, got %#v", matchedExact)
	}

	matchedPrefix, err := svc.Evaluate("/product/prem-apps/checkout", false)
	if err != nil {
		t.Fatalf("evaluate prefix: %v", err)
	}
	if !matchedPrefix.Active || matchedPrefix.Rule == nil || matchedPrefix.Rule.TargetType != MaintenanceTargetPrefix {
		t.Fatalf("expected prefix rule to win, got %#v", matchedPrefix)
	}

	matchedGlobal, err := svc.Evaluate("/faq", false)
	if err != nil {
		t.Fatalf("evaluate global: %v", err)
	}
	if !matchedGlobal.Active || matchedGlobal.Rule == nil || matchedGlobal.Rule.TargetType != MaintenanceTargetGlobal {
		t.Fatalf("expected global rule to win, got %#v", matchedGlobal)
	}
}

func TestMaintenanceService_EvaluateHonorsScheduleAndAdminBypass(t *testing.T) {
	db := setupCoreDB(t)
	repo := repository.NewMaintenanceRuleRepo(db)
	svc := NewMaintenanceService(repo)

	active := true
	allowAdmin := true
	now := time.Now().UTC()

	futureStart := now.Add(2 * time.Hour)
	if _, err := svc.Create(CreateMaintenanceRuleInput{
		Name:       "future",
		TargetType: MaintenanceTargetExact,
		TargetPath: "/dashboard",
		IsActive:   &active,
		StartsAt:   &futureStart,
	}); err != nil {
		t.Fatalf("create future rule: %v", err)
	}

	futureEval, err := svc.Evaluate("/dashboard", false)
	if err != nil {
		t.Fatalf("evaluate future rule: %v", err)
	}
	if futureEval.Active {
		t.Fatalf("expected future rule to be inactive now")
	}

	pastStart := now.Add(-2 * time.Hour)
	futureEnd := now.Add(2 * time.Hour)
	if _, err := svc.Create(CreateMaintenanceRuleInput{
		Name:             "active-window",
		TargetType:       MaintenanceTargetExact,
		TargetPath:       "/dashboard",
		IsActive:         &active,
		AllowAdminBypass: &allowAdmin,
		StartsAt:         &pastStart,
		EndsAt:           &futureEnd,
	}); err != nil {
		t.Fatalf("create active window rule: %v", err)
	}

	userEval, err := svc.Evaluate("/dashboard", false)
	if err != nil {
		t.Fatalf("evaluate user: %v", err)
	}
	if !userEval.Active {
		t.Fatalf("expected maintenance active for normal user")
	}

	adminEval, err := svc.Evaluate("/dashboard", true)
	if err != nil {
		t.Fatalf("evaluate admin: %v", err)
	}
	if adminEval.Active {
		t.Fatalf("expected admin bypass to skip maintenance")
	}
}

func TestMaintenanceService_CreateValidation(t *testing.T) {
	db := setupCoreDB(t)
	repo := repository.NewMaintenanceRuleRepo(db)
	svc := NewMaintenanceService(repo)

	active := true
	starts := time.Now().UTC()
	ends := starts.Add(-time.Minute)

	if _, err := svc.Create(CreateMaintenanceRuleInput{
		Name:       "invalid-window",
		TargetType: MaintenanceTargetExact,
		TargetPath: "/faq",
		IsActive:   &active,
		StartsAt:   &starts,
		EndsAt:     &ends,
	}); err == nil || !strings.Contains(err.Error(), "ends_at") {
		t.Fatalf("expected invalid window error, got: %v", err)
	}

	if _, err := svc.Create(CreateMaintenanceRuleInput{
		Name:       "invalid-target",
		TargetType: "regex",
		TargetPath: "/faq",
	}); err == nil || !strings.Contains(err.Error(), "target_type") {
		t.Fatalf("expected target_type validation error, got: %v", err)
	}

	if _, err := svc.Create(CreateMaintenanceRuleInput{
		Name:       "invalid-exact-root",
		TargetType: MaintenanceTargetExact,
		TargetPath: "/",
	}); err == nil || !strings.Contains(err.Error(), "target_path") {
		t.Fatalf("expected target_path validation error, got: %v", err)
	}
}
