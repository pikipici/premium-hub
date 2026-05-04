package handler

import (
	"encoding/json"
	"strings"
	"testing"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
)

func TestPublicSosmedServiceResponseSanitizesJAPRefillFalse(t *testing.T) {
	item := model.SosmedService{
		ID:                      uuid.New(),
		CategoryCode:            "followers",
		Code:                    "jap-6331",
		Title:                   "Instagram Followers [Guaranteed] [Refill: 30D] [Max: 200K]",
		Summary:                 "Paket followers Instagram refill 30 hari dengan garansi aktif dan harga paling ringan.",
		BadgeText:               "Auto Refill",
		ProviderCode:            "jap",
		ProviderServiceID:       "6331",
		ProviderRefillSupported: false,
		Refill:                  "30 Hari",
		TrustBadges:             []string{"No Password", "Refill 30 Hari", "Garansi 30 Hari", "Natural"},
		CheckoutPrice:           19000,
		IsActive:                true,
	}

	public := toPublicSosmedServiceResponse(item)
	if public.Refill != "Tidak Ada" {
		t.Fatalf("expected public refill to be sanitized to Tidak Ada, got %q", public.Refill)
	}
	badges := strings.Join(public.TrustBadges, " ")
	publicText := strings.ToLower(strings.Join([]string{public.Title, public.Summary, public.BadgeText, badges}, " "))
	for _, forbidden := range []string{"refill", "garansi", "guarantee", "guaranteed", "warranty"} {
		if strings.Contains(publicText, forbidden) {
			t.Fatalf("public response should not promise refill when JAP refill=false; found %q in title=%q summary=%q badge=%q trust=%v", forbidden, public.Title, public.Summary, public.BadgeText, public.TrustBadges)
		}
	}
}

func TestPublicSosmedServiceResponseOmitsProviderMetadata(t *testing.T) {
	item := model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "jap-10242",
		Title:             "Instagram Followers Prioritas",
		ProviderCode:      "jap",
		ProviderServiceID: "10242",
		ProviderTitle:     "Instagram Followers [supplier title]",
		ProviderRate:      "0.425",
		ProviderCurrency:  "USD",
		CheckoutPrice:     22000,
		IsActive:          true,
	}

	payload, err := json.Marshal(toPublicSosmedServiceResponse(item))
	if err != nil {
		t.Fatalf("marshal public sosmed service: %v", err)
	}

	body := string(payload)
	if strings.Contains(body, "provider_") || strings.Contains(body, "0.425") {
		t.Fatalf("public response leaked supplier metadata: %s", body)
	}
}
