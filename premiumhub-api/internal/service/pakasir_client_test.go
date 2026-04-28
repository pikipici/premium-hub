package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"premiumhub-api/config"
)

func TestPakasirClientCreateTransaction(t *testing.T) {
	var captured pakasirCreateRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/transactioncreate/qris" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"payment": {
				"project": "digimarket",
				"order_id": "WLT-1",
				"amount": 50000,
				"fee": 1000,
				"total_payment": 51000,
				"payment_method": "qris",
				"payment_number": "000201010212",
				"expired_at": "2026-04-28T02:30:00Z"
			}
		}`))
	}))
	defer server.Close()

	client := NewPakasirClient(&config.Config{
		PakasirBaseURL:        server.URL,
		PakasirProject:        "digimarket",
		PakasirAPIKey:         "secret",
		PakasirHTTPTimeoutSec: "5",
	})

	result, _, err := client.CreateTransaction(context.Background(), GatewayCreateTransactionInput{
		PaymentMethod:       "SP",
		OrderID:             "WLT-1",
		Amount:              50000,
		ExpiryPeriodMinutes: 20,
	})
	if err != nil {
		t.Fatalf("CreateTransaction: %v", err)
	}

	if captured.Project != "digimarket" || captured.OrderID != "WLT-1" || captured.Amount != 50000 || captured.APIKey != "secret" {
		t.Fatalf("unexpected request payload: %+v", captured)
	}
	if result.OrderID != "WLT-1" || result.Reference != "WLT-1" || result.PaymentMethod != "qris" {
		t.Fatalf("unexpected create result identity: %+v", result)
	}
	if result.PaymentNumber != "000201010212" || result.Amount != 50000 || result.Fee != 1000 || result.TotalPayment != 51000 {
		t.Fatalf("unexpected create result amount/payment: %+v", result)
	}
	if got := result.ExpiredAt.Format(time.RFC3339); got != "2026-04-28T02:30:00Z" {
		t.Fatalf("expired_at = %s", got)
	}
}

func TestPakasirClientTransactionDetail(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/transactiondetail" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("project") != "digimarket" || q.Get("order_id") != "WLT-1" || q.Get("amount") != "50000" || q.Get("api_key") != "secret" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"transaction": {
				"project": "digimarket",
				"order_id": "WLT-1",
				"amount": 50000,
				"status": "completed",
				"payment_method": "bni_va",
				"completed_at": "2026-04-28T02:10:00Z"
			}
		}`))
	}))
	defer server.Close()

	client := NewPakasirClient(&config.Config{
		PakasirBaseURL:        server.URL,
		PakasirProject:        "digimarket",
		PakasirAPIKey:         "secret",
		PakasirHTTPTimeoutSec: "5",
	})

	result, _, err := client.TransactionDetail(context.Background(), "WLT-1", 50000)
	if err != nil {
		t.Fatalf("TransactionDetail: %v", err)
	}
	if result.OrderID != "WLT-1" || result.Amount != 50000 || result.Status != "COMPLETED" || result.PaymentMethod != "bni_va" {
		t.Fatalf("unexpected detail result: %+v", result)
	}
	if result.CompletedAt == nil || result.CompletedAt.Format(time.RFC3339) != "2026-04-28T02:10:00Z" {
		t.Fatalf("unexpected completed_at: %+v", result.CompletedAt)
	}
}

func TestPakasirClientListPaymentMethods(t *testing.T) {
	client := NewPakasirClient(&config.Config{
		PakasirProject: "digimarket",
		PakasirAPIKey:  "secret",
	})

	methods, _, err := client.ListPaymentMethods(context.Background(), 10000)
	if err != nil {
		t.Fatalf("ListPaymentMethods: %v", err)
	}
	if len(methods) < 10 {
		t.Fatalf("expected static pakasir methods, got %+v", methods)
	}
	if methods[0].Method != "qris" || methods[1].Method != "maybank_va" {
		t.Fatalf("unexpected method order: %+v", methods[:2])
	}
}
