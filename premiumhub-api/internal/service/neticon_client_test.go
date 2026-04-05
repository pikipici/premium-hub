package service

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"premiumhub-api/config"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

type errReadCloser struct{}

func (errReadCloser) Read(_ []byte) (int, error) {
	return 0, errors.New("forced read error")
}

func (errReadCloser) Close() error {
	return nil
}

func TestNewNeticonClientDefaults(t *testing.T) {
	client := NewNeticonClient(&config.Config{})
	httpClient, ok := client.(*neticonHTTPClient)
	if !ok {
		t.Fatalf("unexpected client type")
	}

	if httpClient.endpoint != "https://qris.neticonpay.my.id/qris.php" {
		t.Fatalf("unexpected default endpoint: %s", httpClient.endpoint)
	}
	if httpClient.client.Timeout != 10*time.Second {
		t.Fatalf("unexpected default timeout: %s", httpClient.client.Timeout)
	}
}

func TestNeticonRequestDepositSuccessAndPayload(t *testing.T) {
	var got neticonRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"result":true,"trx_id":"TRX-123","amount":0}`))
	}))
	defer server.Close()

	client := NewNeticonClient(&config.Config{
		NeticonBaseURL: server.URL,
		NeticonAPIKey:  "NP_123",
		NeticonUserID:  "MERCHANT_01",
	})

	res, raw, err := client.RequestDeposit(context.Background(), 50234)
	if err != nil {
		t.Fatalf("request deposit: %v", err)
	}
	if !strings.Contains(string(raw), "trx_id") {
		t.Fatalf("raw response should contain trx_id")
	}
	if res.TrxID != "TRX-123" {
		t.Fatalf("unexpected trx id: %s", res.TrxID)
	}
	if res.Amount != 50234 {
		t.Fatalf("amount should fallback to request amount, got %d", res.Amount)
	}

	if got.Action != "request_deposit" || got.APIKey != "NP_123" || got.UserID != "MERCHANT_01" || got.Amount != 50234 {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

func TestNeticonRequestDepositErrors(t *testing.T) {
	t.Run("missing config", func(t *testing.T) {
		client := NewNeticonClient(&config.Config{})
		_, _, err := client.RequestDeposit(context.Background(), 50000)
		if err == nil || !strings.Contains(err.Error(), "konfigurasi") {
			t.Fatalf("expected config error, got: %v", err)
		}
	})

	t.Run("provider reject with message", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"result":false,"message":"kredensial tidak valid"}`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		_, _, err := client.RequestDeposit(context.Background(), 50000)
		if err == nil || !strings.Contains(err.Error(), "kredensial tidak valid") {
			t.Fatalf("expected provider reject error, got: %v", err)
		}
	})

	t.Run("provider reject with default message", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"result":false,"message":"   "}`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		_, _, err := client.RequestDeposit(context.Background(), 50000)
		if err == nil || !strings.Contains(err.Error(), "request deposit ditolak") {
			t.Fatalf("expected default reject message, got: %v", err)
		}
	})

	t.Run("missing trx id", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"result":true,"trx_id":"   ","amount":50000}`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		_, _, err := client.RequestDeposit(context.Background(), 50000)
		if err == nil || !strings.Contains(err.Error(), "trx_id dari neticon kosong") {
			t.Fatalf("expected missing trx_id error, got: %v", err)
		}
	})

	t.Run("invalid json response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`not-json`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		_, _, err := client.RequestDeposit(context.Background(), 50000)
		if err == nil || !strings.Contains(err.Error(), "response neticon tidak valid") {
			t.Fatalf("expected invalid response error, got: %v", err)
		}
	})

	t.Run("http status error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`unauthorized`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		_, _, err := client.RequestDeposit(context.Background(), 50000)
		if err == nil || !strings.Contains(err.Error(), "neticon error 401") {
			t.Fatalf("expected http error, got: %v", err)
		}
	})
}

func TestNeticonCheckStatusSuccessAndErrors(t *testing.T) {
	t.Run("status normalized", func(t *testing.T) {
		var got neticonRequest
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer r.Body.Close()
			body, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(body, &got)
			_, _ = w.Write([]byte(`{"result":true,"status":" SUCCESS "}`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		res, _, err := client.CheckStatus(context.Background(), "TRX-001")
		if err != nil {
			t.Fatalf("check status: %v", err)
		}
		if res.Status != "success" {
			t.Fatalf("expected success, got %s", res.Status)
		}
		if got.Action != "check_status" || got.TrxID != "TRX-001" {
			t.Fatalf("unexpected payload: %+v", got)
		}
	})

	t.Run("empty status defaults pending", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"result":true,"status":"   "}`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		res, _, err := client.CheckStatus(context.Background(), "TRX-002")
		if err != nil {
			t.Fatalf("check status: %v", err)
		}
		if res.Status != "pending" {
			t.Fatalf("expected pending, got %s", res.Status)
		}
	})

	t.Run("provider reject with default message", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"result":false,"message":""}`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		_, _, err := client.CheckStatus(context.Background(), "TRX-003")
		if err == nil || !strings.Contains(err.Error(), "check status ditolak") {
			t.Fatalf("expected default reject message, got: %v", err)
		}
	})

	t.Run("invalid json response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`not-json`))
		}))
		defer server.Close()

		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: server.URL,
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})

		_, _, err := client.CheckStatus(context.Background(), "TRX-JSON")
		if err == nil || !strings.Contains(err.Error(), "response status neticon tidak valid") {
			t.Fatalf("expected invalid response error, got: %v", err)
		}
	})

	t.Run("post json transport error", func(t *testing.T) {
		client := NewNeticonClient(&config.Config{
			NeticonBaseURL: "https://example.com/qris",
			NeticonAPIKey:  "NP_123",
			NeticonUserID:  "MERCHANT_01",
		})
		httpClient := client.(*neticonHTTPClient)
		httpClient.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return nil, errors.New("network fail")
		})}

		_, _, err := client.CheckStatus(context.Background(), "TRX-ERR")
		if err == nil || !strings.Contains(err.Error(), "gagal menghubungi neticon") {
			t.Fatalf("expected transport error, got: %v", err)
		}
	})

	t.Run("missing config", func(t *testing.T) {
		client := NewNeticonClient(&config.Config{})
		_, _, err := client.CheckStatus(context.Background(), "TRX-004")
		if err == nil || !strings.Contains(err.Error(), "konfigurasi") {
			t.Fatalf("expected config error, got: %v", err)
		}
	})
}

func TestNeticonPostJSONInternalErrors(t *testing.T) {
	client := NewNeticonClient(&config.Config{
		NeticonBaseURL: "https://example.com/qris",
		NeticonAPIKey:  "NP_123",
		NeticonUserID:  "MERCHANT_01",
	}).(*neticonHTTPClient)

	t.Run("marshal error", func(t *testing.T) {
		_, err := client.postJSON(context.Background(), map[string]interface{}{"bad": func() {}})
		if err == nil {
			t.Fatalf("expected marshal error")
		}
	})

	t.Run("request build error", func(t *testing.T) {
		client.endpoint = "http://[::1"
		_, err := client.postJSON(context.Background(), map[string]interface{}{"ok": true})
		if err == nil {
			t.Fatalf("expected request build error")
		}
		client.endpoint = "https://example.com/qris"
	})

	t.Run("do error", func(t *testing.T) {
		client.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return nil, errors.New("dial fail")
		})}
		_, err := client.postJSON(context.Background(), map[string]interface{}{"ok": true})
		if err == nil || !strings.Contains(err.Error(), "gagal menghubungi neticon") {
			t.Fatalf("expected do error, got: %v", err)
		}
	})

	t.Run("read body error", func(t *testing.T) {
		client.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: 200, Body: errReadCloser{}}, nil
		})}
		_, err := client.postJSON(context.Background(), map[string]interface{}{"ok": true})
		if err == nil || !strings.Contains(err.Error(), "gagal membaca response neticon") {
			t.Fatalf("expected read error, got: %v", err)
		}
	})
}
