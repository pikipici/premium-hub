package handler

import (
	"encoding/json"
	"strings"
	"testing"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
)

func TestPublicSosmedServiceResponseOmitsProviderMetadata(t *testing.T) {
	item := model.SosmedService{
		ID:                uuid.New(),
		CategoryCode:      "followers",
		Code:              "instagram-followers-10242",
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
