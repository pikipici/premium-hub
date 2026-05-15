package service

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestBuildDigiConnectAPIKeyMaterial(t *testing.T) {
	material := BuildDigiConnectAPIKeyMaterial("dc_live_abcdefghijklmnopqrstuvwxyz")
	if material.Plain == "" || material.Hash == "" || material.Prefix == "" || material.Masked == "" {
		t.Fatalf("expected key material to be populated: %#v", material)
	}
	if material.Prefix != "dc_live_abcdefgh" {
		t.Fatalf("unexpected prefix: %q", material.Prefix)
	}
	if len(material.Hash) != 64 {
		t.Fatalf("expected sha256 hex hash length 64, got %d", len(material.Hash))
	}
	if strings.Contains(material.Masked, "mnopqrstuvwxyz") {
		t.Fatalf("masked key leaks too much secret: %q", material.Masked)
	}
}

func TestCheckDigiConnectIdempotency(t *testing.T) {
	if err := CheckDigiConnectIdempotency("same", "same"); err != nil {
		t.Fatalf("same payload should replay cleanly: %v", err)
	}
	if err := CheckDigiConnectIdempotency("old", "new"); !errors.Is(err, ErrDigiConnectIdempotencyConflict) {
		t.Fatalf("expected idempotency conflict, got %v", err)
	}
}

func TestDecideDigiConnectBillingPrefersActiveDurationPackage(t *testing.T) {
	now := time.Date(2026, 5, 15, 10, 0, 0, 0, time.UTC)
	expires := now.Add(48 * time.Hour)
	decision := DecideDigiConnectBilling(now, &DigiConnectEntitlementState{Status: "active", ExpiresAt: &expires, PayPerRequestEnabled: true}, 0, 100, false)
	if !decision.Allowed || decision.Source != DigiConnectBillingSourceDurationPackage || decision.Decision != DigiConnectBillingDecisionIncludedInPackage {
		t.Fatalf("expected duration package to be preferred, got %#v", decision)
	}
}

func TestDecideDigiConnectBillingUsesOverageOnlyWhenEnabled(t *testing.T) {
	now := time.Date(2026, 5, 15, 10, 0, 0, 0, time.UTC)
	expires := now.Add(48 * time.Hour)
	withoutOverage := DecideDigiConnectBilling(now, &DigiConnectEntitlementState{Status: "active", ExpiresAt: &expires}, 500, 100, true)
	if withoutOverage.Allowed || withoutOverage.Reason != "fair_use_limit_reached" {
		t.Fatalf("expected fair-use reject without overage, got %#v", withoutOverage)
	}
	withOverage := DecideDigiConnectBilling(now, &DigiConnectEntitlementState{Status: "active", ExpiresAt: &expires, OveragePayPerRequestEnabled: true}, 500, 100, true)
	if !withOverage.Allowed || withOverage.Source != DigiConnectBillingSourceWallet || withOverage.Amount != 100 {
		t.Fatalf("expected wallet overage billing, got %#v", withOverage)
	}
}

func TestDecideDigiConnectBillingPayPerRequestInsufficientBalance(t *testing.T) {
	decision := DecideDigiConnectBilling(time.Now(), &DigiConnectEntitlementState{PayPerRequestEnabled: true}, 50, 100, false)
	if decision.Allowed || decision.Reason != "insufficient_balance" || decision.Source != DigiConnectBillingSourceWallet {
		t.Fatalf("expected insufficient balance reject, got %#v", decision)
	}
}

func TestMapDigiConnectPublicError(t *testing.T) {
	cases := []struct {
		internal string
		code     string
		status   int
	}{
		{"INVALID_API_KEY", "UNAUTHORIZED", 401},
		{"MISSING_INPUT", "INVALID_PAYLOAD", 400},
		{"WALLET_BALANCE_INSUFFICIENT", "INSUFFICIENT_BALANCE", 402},
		{"RATE_LIMITED", "RATE_LIMITED", 429},
		{"ABUSE_SUSPECTED", "SERVICE_BUSY", 503},
		{"NINEROUTER_TIMEOUT", "REQUEST_PENDING_VERIFICATION", 202},
		{"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD", "IDEMPOTENCY_CONFLICT", 409},
	}
	for _, tc := range cases {
		got := MapDigiConnectPublicError(tc.internal)
		if got.Code != tc.code || got.HTTPStatus != tc.status || got.Message == "" {
			t.Fatalf("MapDigiConnectPublicError(%q) = %#v", tc.internal, got)
		}
	}
}
