package handler

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

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
