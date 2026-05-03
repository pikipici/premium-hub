package service

import (
	"strings"
	"testing"

	"premiumhub-api/internal/model"
)

func TestSosmedBundlePricingProratesQuantityUnitsPerThousand(t *testing.T) {
	variant := sosmedBundlePricingVariant("computed", 0, 0, 0, []model.SosmedBundleItem{
		sosmedBundlePricingItem("Instagram Followers", 500, 7500, "", "1-1000", true),
	})

	result, err := CalculateSosmedBundlePricing(&variant)
	if err != nil {
		t.Fatalf("calculate pricing: %v", err)
	}

	if result.SubtotalPrice != 3750 {
		t.Fatalf("expected subtotal 3750 for 500 units at 7500/1K, got %d", result.SubtotalPrice)
	}
	if result.TotalPrice != 3750 {
		t.Fatalf("expected total 3750, got %d", result.TotalPrice)
	}
	if len(result.Items) != 1 || result.Items[0].LinePrice != 3750 {
		t.Fatalf("expected one line priced 3750, got %#v", result.Items)
	}
}

func TestSosmedBundlePricingRoundsUpSingleUnit(t *testing.T) {
	variant := sosmedBundlePricingVariant("computed", 0, 0, 0, []model.SosmedBundleItem{
		sosmedBundlePricingItem("Instagram Followers", 1, 7500, "", "1-1000", true),
	})

	result, err := CalculateSosmedBundlePricing(&variant)
	if err != nil {
		t.Fatalf("calculate pricing: %v", err)
	}

	if result.SubtotalPrice != 8 {
		t.Fatalf("expected 1 unit at 7500/1K to round up to 8, got %d", result.SubtotalPrice)
	}
}

func TestSosmedBundlePricingSumsComputedItems(t *testing.T) {
	variant := sosmedBundlePricingVariant("computed", 0, 0, 0, []model.SosmedBundleItem{
		sosmedBundlePricingItem("Instagram Followers", 500, 7500, "", "1-1000", true),
		sosmedBundlePricingItem("Instagram Likes", 1500, 1500, "", "1-2000", true),
	})

	result, err := CalculateSosmedBundlePricing(&variant)
	if err != nil {
		t.Fatalf("calculate pricing: %v", err)
	}

	if result.SubtotalPrice != 6000 {
		t.Fatalf("expected subtotal 6000, got %d", result.SubtotalPrice)
	}
	if result.TotalPrice != 6000 {
		t.Fatalf("expected total 6000, got %d", result.TotalPrice)
	}
}

func TestSosmedBundlePricingFixedPriceKeepsCalculatedCostSnapshot(t *testing.T) {
	variant := sosmedBundlePricingVariant("fixed", 8000, 0, 0, []model.SosmedBundleItem{
		sosmedBundlePricingItem("Instagram Followers", 1000, 10000, "4000", "1-1000", true),
	})

	result, err := CalculateSosmedBundlePricing(&variant)
	if err != nil {
		t.Fatalf("calculate pricing: %v", err)
	}

	if result.SubtotalPrice != 10000 {
		t.Fatalf("expected calculated subtotal 10000, got %d", result.SubtotalPrice)
	}
	if result.TotalPrice != 8000 {
		t.Fatalf("expected fixed total 8000, got %d", result.TotalPrice)
	}
	if result.CostPriceSnapshot != 4000 {
		t.Fatalf("expected cost snapshot 4000, got %d", result.CostPriceSnapshot)
	}
	if result.MarginSnapshot != 4000 {
		t.Fatalf("expected margin snapshot 4000, got %d", result.MarginSnapshot)
	}
}

func TestSosmedBundlePricingDiscountCannotMakeTotalNegative(t *testing.T) {
	variant := sosmedBundlePricingVariant("computed_with_discount", 0, 0, 999999, []model.SosmedBundleItem{
		sosmedBundlePricingItem("Instagram Followers", 1000, 7500, "", "1-1000", true),
	})

	result, err := CalculateSosmedBundlePricing(&variant)
	if err != nil {
		t.Fatalf("calculate pricing: %v", err)
	}

	if result.DiscountAmount != 7500 {
		t.Fatalf("expected discount capped at subtotal 7500, got %d", result.DiscountAmount)
	}
	if result.TotalPrice != 0 {
		t.Fatalf("expected non-negative total 0, got %d", result.TotalPrice)
	}
}

func TestSosmedBundlePricingRejectsInactiveService(t *testing.T) {
	variant := sosmedBundlePricingVariant("computed", 0, 0, 0, []model.SosmedBundleItem{
		sosmedBundlePricingItem("Instagram Followers", 500, 7500, "", "1-1000", false),
	})

	_, err := CalculateSosmedBundlePricing(&variant)
	if err == nil || !strings.Contains(err.Error(), "nonaktif") {
		t.Fatalf("expected inactive service error, got %v", err)
	}
}

func TestSosmedBundlePricingRejectsQuantityOutsideProviderMinMax(t *testing.T) {
	tests := []struct {
		name     string
		quantity int64
		wantErr  string
	}{
		{name: "below min", quantity: 99, wantErr: "minimum"},
		{name: "above max", quantity: 1001, wantErr: "maksimum"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			variant := sosmedBundlePricingVariant("computed", 0, 0, 0, []model.SosmedBundleItem{
				sosmedBundlePricingItem("Instagram Followers", tt.quantity, 7500, "", "Min: 100 Max: 1000", true),
			})

			_, err := CalculateSosmedBundlePricing(&variant)
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("expected %q error, got %v", tt.wantErr, err)
			}
		})
	}
}

func sosmedBundlePricingVariant(priceMode string, fixedPrice int64, discountPercent int, discountAmount int64, items []model.SosmedBundleItem) model.SosmedBundleVariant {
	return model.SosmedBundleVariant{
		Key:             "starter",
		Name:            "Starter",
		PriceMode:       priceMode,
		FixedPrice:      fixedPrice,
		DiscountPercent: discountPercent,
		DiscountAmount:  discountAmount,
		IsActive:        true,
		Items:           items,
	}
}

func sosmedBundlePricingItem(title string, quantityUnits int64, checkoutPrice int64, providerRate string, minOrder string, active bool) model.SosmedBundleItem {
	return model.SosmedBundleItem{
		Label:         title,
		QuantityUnits: quantityUnits,
		IsActive:      true,
		Service: model.SosmedService{
			Code:          strings.ToLower(strings.ReplaceAll(title, " ", "-")),
			Title:         title,
			CheckoutPrice: checkoutPrice,
			ProviderRate:  providerRate,
			MinOrder:      minOrder,
			IsActive:      active,
		},
	}
}
