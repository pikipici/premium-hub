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

func TestJAPClientAddOrder(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		assertJAPFormValue(t, r.Form, "key", "secret-key")
		assertJAPFormValue(t, r.Form, "action", "add")
		assertJAPFormValue(t, r.Form, "service", "6331")
		assertJAPFormValue(t, r.Form, "link", "https://instagram.com/example")
		assertJAPFormValue(t, r.Form, "quantity", "5000")

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"order": 991122}`))
	}))
	defer server.Close()

	client := NewJAPClient(&config.Config{
		JAPAPIURL:         server.URL,
		JAPAPIKey:         "secret-key",
		JAPHTTPTimeoutSec: "5",
	})

	res, err := client.AddOrder(context.Background(), JAPAddOrderInput{
		ServiceID: "6331",
		Link:      "https://instagram.com/example",
		Quantity:  5000,
	})
	if err != nil {
		t.Fatalf("add order: %v", err)
	}
	if res.Order != "991122" {
		t.Fatalf("expected order 991122, got %q", res.Order)
	}
}

func TestJAPClientGetOrderStatus(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		assertJAPFormValue(t, r.Form, "key", "secret-key")
		assertJAPFormValue(t, r.Form, "action", "status")
		assertJAPFormValue(t, r.Form, "order", "991122")

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"charge":"0.27819","start_count":"3572","status":"Completed","remains":"0","currency":"USD"}`))
	}))
	defer server.Close()

	client := NewJAPClient(&config.Config{
		JAPAPIURL:         server.URL,
		JAPAPIKey:         "secret-key",
		JAPHTTPTimeoutSec: "5",
	})

	res, err := client.GetOrderStatus(context.Background(), "991122")
	if err != nil {
		t.Fatalf("get order status: %v", err)
	}
	if res.Status != "Completed" {
		t.Fatalf("expected status Completed, got %q", res.Status)
	}
	if res.Remains != "0" {
		t.Fatalf("expected remains 0, got %q", res.Remains)
	}
}

func TestJAPClientRequestRefill(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		assertJAPFormValue(t, r.Form, "key", "secret-key")
		assertJAPFormValue(t, r.Form, "action", "refill")
		assertJAPFormValue(t, r.Form, "order", "991122")

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"refill": 776655}`))
	}))
	defer server.Close()

	client := NewJAPClient(&config.Config{
		JAPAPIURL:         server.URL,
		JAPAPIKey:         "secret-key",
		JAPHTTPTimeoutSec: "5",
	})

	res, err := client.RequestRefill(context.Background(), "991122")
	if err != nil {
		t.Fatalf("request refill: %v", err)
	}
	if res.Refill != "776655" {
		t.Fatalf("expected refill id 776655, got %q", res.Refill)
	}
}

func TestJAPClientGetRefillStatus(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		assertJAPFormValue(t, r.Form, "key", "secret-key")
		assertJAPFormValue(t, r.Form, "action", "refill_status")
		assertJAPFormValue(t, r.Form, "refill", "776655")

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"Completed"}`))
	}))
	defer server.Close()

	client := NewJAPClient(&config.Config{
		JAPAPIURL:         server.URL,
		JAPAPIKey:         "secret-key",
		JAPHTTPTimeoutSec: "5",
	})

	res, err := client.GetRefillStatus(context.Background(), "776655")
	if err != nil {
		t.Fatalf("get refill status: %v", err)
	}
	if res.Status != "Completed" {
		t.Fatalf("expected status Completed, got %q", res.Status)
	}
}

func TestJAPClientRequestRefillErrorPayload(t *testing.T) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error":"Incorrect order ID"}`))
	}))
	defer server.Close()

	client := NewJAPClient(&config.Config{
		JAPAPIURL:         server.URL,
		JAPAPIKey:         "secret-key",
		JAPHTTPTimeoutSec: "5",
	})

	if _, err := client.RequestRefill(context.Background(), "991122"); err == nil {
		t.Fatalf("expected refill error")
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
