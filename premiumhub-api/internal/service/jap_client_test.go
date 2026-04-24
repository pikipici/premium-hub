package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"premiumhub-api/config"
)

func TestJAPClientGetBalance(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		assertJAPFormValue(t, r.Form, "key", "secret-key")
		assertJAPFormValue(t, r.Form, "action", "balance")

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"balance":"100.84292","currency":"USD"}`))
	}))
	defer server.Close()

	client := NewJAPClient(&config.Config{
		JAPAPIURL:         server.URL,
		JAPAPIKey:         "secret-key",
		JAPHTTPTimeoutSec: "5",
	})

	res, err := client.GetBalance(context.Background())
	if err != nil {
		t.Fatalf("get balance: %v", err)
	}
	if res.Balance != "100.84292" {
		t.Fatalf("expected balance 100.84292, got %q", res.Balance)
	}
	if res.Currency != "USD" {
		t.Fatalf("expected currency USD, got %q", res.Currency)
	}
}

func TestJAPClientGetServices(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		assertJAPFormValue(t, r.Form, "key", "secret-key")
		assertJAPFormValue(t, r.Form, "action", "services")

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[
			{
				"service": 10164,
				"name": "TikTok Views Auto 30D",
				"type": "Default",
				"category": "TikTok Views",
				"rate": "0.0563",
				"min": "100",
				"max": "100000",
				"refill": true,
				"cancel": false
			}
		]`))
	}))
	defer server.Close()

	client := NewJAPClient(&config.Config{
		JAPAPIURL:         server.URL,
		JAPAPIKey:         "secret-key",
		JAPHTTPTimeoutSec: "5",
	})

	res, err := client.GetServices(context.Background())
	if err != nil {
		t.Fatalf("get services: %v", err)
	}
	if len(res) != 1 {
		t.Fatalf("expected 1 service, got %d", len(res))
	}
	if res[0].Service != "10164" {
		t.Fatalf("expected service id 10164, got %q", res[0].Service)
	}
	if res[0].Rate != "0.0563" {
		t.Fatalf("expected rate 0.0563, got %q", res[0].Rate)
	}
	if !res[0].Refill {
		t.Fatalf("expected refill true")
	}
}

func TestJAPClientRequiresAPIKey(t *testing.T) {
	client := NewJAPClient(&config.Config{
		JAPAPIURL:         "https://justanotherpanel.com/api/v2",
		JAPHTTPTimeoutSec: "5",
	})

	_, err := client.GetBalance(context.Background())
	if err == nil {
		t.Fatalf("expected missing api key error")
	}

	apiErr, ok := err.(*JAPAPIError)
	if !ok {
		t.Fatalf("expected JAPAPIError, got %T", err)
	}
	if apiErr.Message != "konfigurasi JAP_API_KEY belum diisi" {
		t.Fatalf("unexpected error message: %s", apiErr.Message)
	}
}

func assertJAPFormValue(t *testing.T, values url.Values, key, expected string) {
	t.Helper()
	if actual := values.Get(key); actual != expected {
		t.Fatalf("expected form %s=%q, got %q", key, expected, actual)
	}
}
