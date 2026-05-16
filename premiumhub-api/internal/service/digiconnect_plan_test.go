package service

import (
	"testing"

	"premiumhub-api/config"
)

func TestDigiConnectPublicPlansViewSupportsPlanTabs(t *testing.T) {
	svc := NewDigiConnectService(&config.Config{DigiConnectEnabled: true}, nil)

	view := svc.PublicPlansView()

	if view.DefaultTab != "ppr_hemat" {
		t.Fatalf("expected default tab ppr_hemat, got %q", view.DefaultTab)
	}
	if len(view.Tabs) != 3 || len(view.Plans) != 3 {
		t.Fatalf("expected 3 tabs and 3 plans, got %d tabs and %d plans", len(view.Tabs), len(view.Plans))
	}

	expected := []struct {
		tabKey       string
		label        string
		planCode     string
		price        int64
		billingModel string
	}{
		{"ppr_hemat", "Rp150/request", "digiconnect_ppr_hemat", 150, "pay_per_request"},
		{"ppr_premium", "Rp200/request", "digiconnect_ppr_premium", 200, "pay_per_request"},
		{"package_2d", "Paket 2 hari", "digiconnect_2d", 15000, "duration_package"},
	}

	for i, want := range expected {
		tab := view.Tabs[i]
		plan := view.Plans[i]
		if tab.Key != want.tabKey || tab.Label != want.label || tab.PlanCode != want.planCode || tab.SortOrder != i+1 {
			t.Fatalf("unexpected tab %d: %#v", i, tab)
		}
		if plan.TabKey != want.tabKey || plan.Code != want.planCode || plan.Price != want.price || plan.BillingModel != want.billingModel {
			t.Fatalf("unexpected plan %d: %#v", i, plan)
		}
		if plan.ShortName == "" || plan.CTA == "" || len(plan.Features) == 0 || len(plan.ModelIDs) == 0 {
			t.Fatalf("plan %s missing tab UI metadata: %#v", plan.Code, plan)
		}
	}

	if view.Plans[2].DurationDays != 2 || view.Plans[2].DailyFairUseLimit != 1000 || !view.Plans[2].StockManaged {
		t.Fatalf("package tab missing duration/stock metadata: %#v", view.Plans[2])
	}
}

func TestDigiConnectPublicPlansRemainsBackwardCompatible(t *testing.T) {
	svc := NewDigiConnectService(&config.Config{DigiConnectEnabled: true}, nil)

	plans := svc.PublicPlans()

	if len(plans) != 3 {
		t.Fatalf("expected 3 plans, got %d", len(plans))
	}
	if plans[0].Code != "digiconnect_ppr_hemat" || plans[1].Code != "digiconnect_ppr_premium" || plans[2].Code != "digiconnect_2d" {
		t.Fatalf("unexpected plan order: %#v", plans)
	}
}
