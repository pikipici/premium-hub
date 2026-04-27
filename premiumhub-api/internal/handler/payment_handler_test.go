package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"premiumhub-api/config"
	"premiumhub-api/internal/service"

	"github.com/gin-gonic/gin"
)

type fakeHandlerPaymentGateway struct{}

func (f fakeHandlerPaymentGateway) CreateTransaction(context.Context, service.GatewayCreateTransactionInput) (*service.GatewayCreateResult, []byte, error) {
	return nil, nil, errors.New("not implemented")
}

func (f fakeHandlerPaymentGateway) TransactionDetail(context.Context, string, int64) (*service.GatewayDetailResult, []byte, error) {
	return nil, nil, errors.New("not implemented")
}

func (f fakeHandlerPaymentGateway) ListPaymentMethods(_ context.Context, amount int64) ([]service.GatewayPaymentMethod, []byte, error) {
	return []service.GatewayPaymentMethod{
		{Method: "SP", Name: "ShopeePay QRIS", Fee: "0"},
		{Method: "BR", Name: "BRI VA", Fee: "3000"},
	}, nil, nil
}

func TestPaymentHandlerListMethods(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentSvc := service.NewPaymentServiceWithGateway(&config.Config{
		DuitkuMerchantCode: "DS30020",
		DuitkuAPIKey:       "secret",
	}, nil, nil, fakeHandlerPaymentGateway{})
	handler := NewPaymentHandler(paymentSvc, nil)

	r := gin.New()
	r.GET("/methods", handler.ListMethods)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/methods?amount=25000", nil)
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var body struct {
		Success bool                            `json:"success"`
		Data    []service.PaymentMethodResponse `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("json decode: %v", err)
	}
	if !body.Success || len(body.Data) != 2 {
		t.Fatalf("unexpected response: %+v", body)
	}
	if body.Data[0].Method != "SP" || body.Data[1].Method != "BR" {
		t.Fatalf("unexpected methods: %+v", body.Data)
	}
}

func TestBindPaymentWebhookInputDuitkuForm(t *testing.T) {
	gin.SetMode(gin.TestMode)

	form := url.Values{}
	form.Set("merchantCode", "D123")
	form.Set("merchantOrderId", "ORD-ABC")
	form.Set("amount", "45000.00")
	form.Set("paymentCode", "SP")
	form.Set("resultCode", "00")
	form.Set("reference", "DUT-REF")
	form.Set("signature", "abc123")
	form.Set("settlementDate", "2026-04-27 10:00:00")

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/payment/webhook", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	ctx.Request = req

	input, err := bindPaymentWebhookInput(ctx)
	if err != nil {
		t.Fatalf("bindPaymentWebhookInput: %v", err)
	}

	if input.Project != "D123" || input.OrderID != "ORD-ABC" || input.Amount != 45000 || input.PaymentMethod != "SP" || input.Status != "00" {
		t.Fatalf("unexpected mapped webhook input: %+v", input)
	}
	if input.Reference != "DUT-REF" || input.Signature != "abc123" || input.CompletedAt == "" {
		t.Fatalf("expected Duitku metadata mapped, got: %+v", input)
	}
}
