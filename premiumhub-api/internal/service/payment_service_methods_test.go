package service

import (
	"context"
	"errors"
	"testing"

	"premiumhub-api/config"
)

type fakePaymentMethodGateway struct {
	amount  int64
	methods []GatewayPaymentMethod
	err     error
}

func (f *fakePaymentMethodGateway) CreateTransaction(context.Context, GatewayCreateTransactionInput) (*GatewayCreateResult, []byte, error) {
	return nil, nil, errors.New("not implemented")
}

func (f *fakePaymentMethodGateway) TransactionDetail(context.Context, string, int64) (*GatewayDetailResult, []byte, error) {
	return nil, nil, errors.New("not implemented")
}

func (f *fakePaymentMethodGateway) ListPaymentMethods(_ context.Context, amount int64) ([]GatewayPaymentMethod, []byte, error) {
	f.amount = amount
	if f.err != nil {
		return nil, nil, f.err
	}
	return f.methods, nil, nil
}

func TestPaymentServiceListPaymentMethods(t *testing.T) {
	gateway := &fakePaymentMethodGateway{
		methods: []GatewayPaymentMethod{
			{Method: "SP", Name: "ShopeePay QRIS", Image: " https://example.test/sp.png ", Fee: "0"},
			{Method: "BR", Name: "BRI VA", Fee: "3000"},
			{Method: "DQ", Name: "DANA QRIS"},
			{Method: "BR", Name: "BRI VA Duplicate"},
			{Method: "UNKNOWN", Name: "Ignored"},
			{Method: "BNC_QRIS", Name: "BNC QRIS Alias"},
		},
	}
	svc := NewPaymentServiceWithGateway(&config.Config{
		DuitkuMerchantCode: "DS30020",
		DuitkuAPIKey:       "secret",
	}, nil, nil, gateway)

	methods, err := svc.ListPaymentMethods(context.Background(), 25000)
	if err != nil {
		t.Fatalf("ListPaymentMethods: %v", err)
	}
	if gateway.amount != 25000 {
		t.Fatalf("gateway amount = %d, want 25000", gateway.amount)
	}

	wantCodes := []string{"SP", "BR", "DQ", "BQ"}
	if len(methods) != len(wantCodes) {
		t.Fatalf("method len = %d, want %d: %+v", len(methods), len(wantCodes), methods)
	}
	for i, want := range wantCodes {
		if methods[i].Method != want {
			t.Fatalf("method[%d] = %s, want %s: %+v", i, methods[i].Method, want, methods)
		}
	}
	if methods[0].Image != "https://example.test/sp.png" || methods[0].Fee != "0" {
		t.Fatalf("expected trimmed image and fee, got %+v", methods[0])
	}
}

func TestPaymentServiceListPaymentMethodsDefaultAmount(t *testing.T) {
	gateway := &fakePaymentMethodGateway{
		methods: []GatewayPaymentMethod{{Method: "SP", Name: "ShopeePay QRIS"}},
	}
	svc := NewPaymentServiceWithGateway(&config.Config{
		DuitkuMerchantCode: "DS30020",
		DuitkuAPIKey:       "secret",
	}, nil, nil, gateway)

	if _, err := svc.ListPaymentMethods(context.Background(), 0); err != nil {
		t.Fatalf("ListPaymentMethods: %v", err)
	}
	if gateway.amount != 10000 {
		t.Fatalf("gateway amount = %d, want default 10000", gateway.amount)
	}
}

func TestPaymentServiceListPaymentMethodsRequiresGatewayConfig(t *testing.T) {
	svc := NewPaymentServiceWithGateway(&config.Config{}, nil, nil, &fakePaymentMethodGateway{})

	if _, err := svc.ListPaymentMethods(context.Background(), 10000); err == nil {
		t.Fatalf("expected error for missing gateway config")
	}
}
