package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"premiumhub-api/config"
)

func TestDuitkuSignatureHelpersAndNormalization(t *testing.T) {
	merchant := "D123"
	apiKey := "secret"
	orderID := "ORD-1"
	amount := int64(25000)

	inquirySig := BuildDuitkuInquirySignature(merchant, orderID, amount, apiKey)
	if inquirySig != "a201e1b24d94c6e2eaf2210850329fc8" {
		t.Fatalf("unexpected inquiry signature: %s", inquirySig)
	}

	callbackSig := BuildDuitkuCallbackSignature(merchant, amount, orderID, apiKey)
	if !ValidateDuitkuCallbackSignature(merchant, amount, orderID, apiKey, callbackSig) {
		t.Fatalf("expected callback signature to validate")
	}
	if ValidateDuitkuCallbackSignature(merchant, amount+1, orderID, apiKey, callbackSig) {
		t.Fatalf("callback signature should reject amount mismatch")
	}

	cases := map[string]string{
		"qris":       "SP",
		"bri_va":     "BR",
		"BNI-VA":     "I1",
		"permata va": "BT",
		"SP":         "SP",
		"zz":         "ZZ",
	}
	for raw, want := range cases {
		if got := NormalizePaymentGatewayMethod(raw); got != want {
			t.Fatalf("NormalizePaymentGatewayMethod(%q) = %q, want %q", raw, got, want)
		}
	}

	pakasirCases := map[string]string{
		"qris":           "qris",
		"SP":             "qris",
		"BR":             "bri_va",
		"bri-va":         "bri_va",
		"BNI VA":         "bni_va",
		"cimb_niaga_va":  "cimb_niaga_va",
		"ATM_BERSAMA_VA": "atm_bersama_va",
		"paypal":         "paypal",
	}
	for raw, want := range pakasirCases {
		if got := NormalizePaymentGatewayMethodForProvider(paymentGatewayProviderPakasir, raw); got != want {
			t.Fatalf("NormalizePaymentGatewayMethodForProvider(pakasir, %q) = %q, want %q", raw, got, want)
		}
	}
}

func TestDuitkuClientCreateTransaction(t *testing.T) {
	var captured duitkuInquiryRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/webapi/api/merchant/v2/inquiry" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"merchantCode": "D123",
			"reference": "DUT-REF-1",
			"paymentUrl": "https://pay.example.test/invoice",
			"qrString": "000201010212",
			"amount": "25000",
			"statusCode": "00"
		}`))
	}))
	defer server.Close()

	client := NewDuitkuClient(&config.Config{
		DuitkuBaseURL:        server.URL,
		DuitkuMerchantCode:   "D123",
		DuitkuAPIKey:         "secret",
		DuitkuHTTPTimeoutSec: "5",
	})

	result, _, err := client.CreateTransaction(context.Background(), GatewayCreateTransactionInput{
		PaymentMethod:       "qris",
		OrderID:             "ORD-1",
		Amount:              25000,
		ProductDetails:      "Top up saldo",
		CustomerName:        "Buyer Test",
		Email:               "buyer@example.com",
		CallbackURL:         "https://api.example.test/webhook",
		ReturnURL:           "https://app.example.test/wallet",
		ExpiryPeriodMinutes: 20,
	})
	if err != nil {
		t.Fatalf("CreateTransaction: %v", err)
	}

	if captured.PaymentMethod != "SP" {
		t.Fatalf("expected normalized Duitku method SP, got %s", captured.PaymentMethod)
	}
	if captured.Signature != BuildDuitkuInquirySignature("D123", "ORD-1", 25000, "secret") {
		t.Fatalf("unexpected request signature: %s", captured.Signature)
	}
	if result.Reference != "DUT-REF-1" || result.PaymentNumber != "000201010212" || result.TotalPayment != 25000 {
		t.Fatalf("unexpected create result: %+v", result)
	}
}

func TestDuitkuClientCreateTransactionProviderFailureWithEmptyAmount(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/webapi/api/merchant/v2/inquiry" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"merchantCode": "D123",
			"reference": "DUT-REF-FAIL",
			"paymentUrl": "",
			"amount": "",
			"statusCode": -100,
			"statusMessage": "Failed to generate Payment URL Dana"
		}`))
	}))
	defer server.Close()

	client := NewDuitkuClient(&config.Config{
		DuitkuBaseURL:        server.URL,
		DuitkuMerchantCode:   "D123",
		DuitkuAPIKey:         "secret",
		DuitkuHTTPTimeoutSec: "5",
	})

	_, _, err := client.CreateTransaction(context.Background(), GatewayCreateTransactionInput{
		PaymentMethod:       "DA",
		OrderID:             "ORD-FAIL",
		Amount:              10000,
		ProductDetails:      "Top up saldo",
		CustomerName:        "Buyer Test",
		Email:               "buyer@example.com",
		CallbackURL:         "https://api.example.test/webhook",
		ReturnURL:           "https://app.example.test/wallet",
		ExpiryPeriodMinutes: 20,
	})
	if err == nil {
		t.Fatalf("expected provider failure")
	}
	if !strings.Contains(err.Error(), "duitku inquiry gagal: Failed to generate Payment URL Dana") {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(err.Error(), "response duitku inquiry tidak valid") {
		t.Fatalf("error should surface provider failure, got: %v", err)
	}
}

func TestDuitkuClientListPaymentMethods(t *testing.T) {
	var captured duitkuPaymentMethodRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/webapi/api/merchant/paymentmethod/getpaymentmethod" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"paymentFee": [
				{"paymentMethod": "SP", "paymentName": "QRIS", "paymentImage": "https://example.test/qris.png", "totalFee": "0"},
				{"paymentMethod": "BR", "paymentName": "BRI VA", "paymentImage": "", "totalFee": "3000"}
			],
			"responseCode": "00"
		}`))
	}))
	defer server.Close()

	client := NewDuitkuClient(&config.Config{
		DuitkuBaseURL:        server.URL,
		DuitkuMerchantCode:   "D123",
		DuitkuAPIKey:         "secret",
		DuitkuHTTPTimeoutSec: "5",
	})

	methods, _, err := client.ListPaymentMethods(context.Background(), 10000)
	if err != nil {
		t.Fatalf("ListPaymentMethods: %v", err)
	}

	if captured.Signature != BuildDuitkuPaymentMethodSignature("D123", 10000, captured.Datetime, "secret") {
		t.Fatalf("unexpected payment method signature: %s", captured.Signature)
	}
	if len(methods) != 2 || methods[0].Method != "SP" || methods[1].Method != "BR" {
		t.Fatalf("unexpected payment methods: %+v", methods)
	}
}
