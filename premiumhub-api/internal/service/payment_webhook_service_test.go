package service

import (
	"context"
	"errors"
	"testing"

	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

type stubOrderWebhookLookup struct {
	records map[string]bool
	err     error
	calls   int
	lastID  string
}

func (s *stubOrderWebhookLookup) FindByGatewayOrderID(gatewayOrderID string) (*model.Order, error) {
	s.calls++
	s.lastID = gatewayOrderID
	if s.err != nil {
		return nil, s.err
	}
	if s.records != nil && s.records[gatewayOrderID] {
		return &model.Order{GatewayOrderID: gatewayOrderID}, nil
	}
	return nil, gorm.ErrRecordNotFound
}

type stubSosmedWebhookLookup struct {
	records map[string]bool
	err     error
	calls   int
	lastID  string
}

func (s *stubSosmedWebhookLookup) FindByGatewayOrderID(gatewayOrderID string) (*model.SosmedOrder, error) {
	s.calls++
	s.lastID = gatewayOrderID
	if s.err != nil {
		return nil, s.err
	}
	if s.records != nil && s.records[gatewayOrderID] {
		return &model.SosmedOrder{GatewayOrderID: gatewayOrderID}, nil
	}
	return nil, gorm.ErrRecordNotFound
}

type stubWalletWebhookLookup struct {
	records map[string]bool
	err     error
	calls   int
	lastID  string
}

func (s *stubWalletWebhookLookup) FindTopupByGatewayRef(_ string, gatewayRef string) (*model.WalletTopup, error) {
	s.calls++
	s.lastID = gatewayRef
	if s.err != nil {
		return nil, s.err
	}
	if s.records != nil && s.records[gatewayRef] {
		return &model.WalletTopup{GatewayRef: gatewayRef, Provider: "duitku"}, nil
	}
	return nil, gorm.ErrRecordNotFound
}

type stubOrderWebhookHandler struct {
	err       error
	calls     int
	lastInput WebhookInput
}

func (s *stubOrderWebhookHandler) HandleWebhook(input WebhookInput) error {
	s.calls++
	s.lastInput = input
	return s.err
}

type stubSosmedWebhookHandler struct {
	err       error
	calls     int
	lastInput WebhookInput
}

func (s *stubSosmedWebhookHandler) HandleWebhook(input WebhookInput) error {
	s.calls++
	s.lastInput = input
	return s.err
}

type stubWalletWebhookHandler struct {
	err       error
	calls     int
	lastInput WalletGatewayWebhookInput
}

func (s *stubWalletWebhookHandler) HandleGatewayWebhook(_ context.Context, input WalletGatewayWebhookInput) error {
	s.calls++
	s.lastInput = input
	return s.err
}

func TestPaymentWebhookService_RouteByPrefixOrder(t *testing.T) {
	orderHandler := &stubOrderWebhookHandler{}
	sosmedHandler := &stubSosmedWebhookHandler{}
	walletHandler := &stubWalletWebhookHandler{}

	svc := &PaymentWebhookService{
		orderHandler:  orderHandler,
		sosmedHandler: sosmedHandler,
		walletHandler: walletHandler,
	}

	input := WebhookInput{OrderID: "ORD-123", Status: "completed"}
	if err := svc.Handle(context.Background(), input); err != nil {
		t.Fatalf("handle webhook: %v", err)
	}
	if orderHandler.calls != 1 {
		t.Fatalf("expected order handler called once, got %d", orderHandler.calls)
	}
	if sosmedHandler.calls != 0 {
		t.Fatalf("expected sosmed handler not called, got %d", sosmedHandler.calls)
	}
	if walletHandler.calls != 0 {
		t.Fatalf("expected wallet handler not called, got %d", walletHandler.calls)
	}
}

func TestPaymentWebhookService_RouteByPrefixSosmed(t *testing.T) {
	orderHandler := &stubOrderWebhookHandler{}
	sosmedHandler := &stubSosmedWebhookHandler{}
	walletHandler := &stubWalletWebhookHandler{}

	svc := &PaymentWebhookService{
		orderHandler:  orderHandler,
		sosmedHandler: sosmedHandler,
		walletHandler: walletHandler,
	}

	input := WebhookInput{OrderID: "ssm-abc", Status: "completed"}
	if err := svc.Handle(context.Background(), input); err != nil {
		t.Fatalf("handle webhook: %v", err)
	}
	if sosmedHandler.calls != 1 {
		t.Fatalf("expected sosmed handler called once, got %d", sosmedHandler.calls)
	}
	if orderHandler.calls != 0 {
		t.Fatalf("expected order handler not called, got %d", orderHandler.calls)
	}
	if walletHandler.calls != 0 {
		t.Fatalf("expected wallet handler not called, got %d", walletHandler.calls)
	}
}

func TestPaymentWebhookService_RouteByPrefixWallet(t *testing.T) {
	orderHandler := &stubOrderWebhookHandler{}
	sosmedHandler := &stubSosmedWebhookHandler{}
	walletHandler := &stubWalletWebhookHandler{}

	svc := &PaymentWebhookService{
		orderHandler:  orderHandler,
		sosmedHandler: sosmedHandler,
		walletHandler: walletHandler,
	}

	input := WebhookInput{OrderID: "wlt-abc", Status: "completed", Amount: 10000, PaymentMethod: "SP"}
	if err := svc.Handle(context.Background(), input); err != nil {
		t.Fatalf("handle webhook: %v", err)
	}
	if walletHandler.calls != 1 {
		t.Fatalf("expected wallet handler called once, got %d", walletHandler.calls)
	}
	if walletHandler.lastInput.OrderID != input.OrderID || walletHandler.lastInput.Amount != input.Amount {
		t.Fatalf("wallet input mapping mismatch: %+v", walletHandler.lastInput)
	}
	if orderHandler.calls != 0 {
		t.Fatalf("expected order handler not called, got %d", orderHandler.calls)
	}
	if sosmedHandler.calls != 0 {
		t.Fatalf("expected sosmed handler not called, got %d", sosmedHandler.calls)
	}
}

func TestPaymentWebhookService_FallbackLookupOrderSosmedWallet(t *testing.T) {
	orderLookup := &stubOrderWebhookLookup{records: map[string]bool{"X-ORDER": true}}
	sosmedLookup := &stubSosmedWebhookLookup{records: map[string]bool{"X-SOSMED": true}}
	walletLookup := &stubWalletWebhookLookup{records: map[string]bool{"X-WALLET": true}}
	orderHandler := &stubOrderWebhookHandler{}
	sosmedHandler := &stubSosmedWebhookHandler{}
	walletHandler := &stubWalletWebhookHandler{}

	svc := &PaymentWebhookService{
		orderLookup:   orderLookup,
		sosmedLookup:  sosmedLookup,
		walletLookup:  walletLookup,
		orderHandler:  orderHandler,
		sosmedHandler: sosmedHandler,
		walletHandler: walletHandler,
	}

	if err := svc.Handle(context.Background(), WebhookInput{OrderID: "X-ORDER", Status: "completed"}); err != nil {
		t.Fatalf("fallback order handle: %v", err)
	}
	if orderHandler.calls != 1 || sosmedHandler.calls != 0 || walletHandler.calls != 0 {
		t.Fatalf("unexpected handler calls order=%d sosmed=%d wallet=%d", orderHandler.calls, sosmedHandler.calls, walletHandler.calls)
	}

	if err := svc.Handle(context.Background(), WebhookInput{OrderID: "X-SOSMED", Status: "completed"}); err != nil {
		t.Fatalf("fallback sosmed handle: %v", err)
	}
	if sosmedHandler.calls != 1 {
		t.Fatalf("expected sosmed handler once, got %d", sosmedHandler.calls)
	}

	if err := svc.Handle(context.Background(), WebhookInput{OrderID: "X-WALLET", Status: "completed"}); err != nil {
		t.Fatalf("fallback wallet handle: %v", err)
	}
	if walletHandler.calls != 1 {
		t.Fatalf("expected wallet handler once, got %d", walletHandler.calls)
	}
}

func TestPaymentWebhookService_UnknownOrderIDAck(t *testing.T) {
	svc := &PaymentWebhookService{
		orderLookup:   &stubOrderWebhookLookup{},
		sosmedLookup:  &stubSosmedWebhookLookup{},
		walletLookup:  &stubWalletWebhookLookup{},
		orderHandler:  &stubOrderWebhookHandler{},
		sosmedHandler: &stubSosmedWebhookHandler{},
		walletHandler: &stubWalletWebhookHandler{},
	}

	if err := svc.Handle(context.Background(), WebhookInput{OrderID: "UNKNOWN-001", Status: "completed"}); err != nil {
		t.Fatalf("unknown order id should ack nil, got: %v", err)
	}
}

func TestPaymentWebhookService_ErrorPropagation(t *testing.T) {
	t.Run("order handler error", func(t *testing.T) {
		expected := errors.New("order failed")
		svc := &PaymentWebhookService{orderHandler: &stubOrderWebhookHandler{err: expected}}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "ORD-1", Status: "completed"})
		if !errors.Is(err, expected) {
			t.Fatalf("expected %v, got %v", expected, err)
		}
	})

	t.Run("sosmed handler error", func(t *testing.T) {
		expected := errors.New("sosmed failed")
		svc := &PaymentWebhookService{sosmedHandler: &stubSosmedWebhookHandler{err: expected}}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "SSM-1", Status: "completed"})
		if !errors.Is(err, expected) {
			t.Fatalf("expected %v, got %v", expected, err)
		}
	})

	t.Run("wallet handler error", func(t *testing.T) {
		expected := errors.New("wallet failed")
		svc := &PaymentWebhookService{walletHandler: &stubWalletWebhookHandler{err: expected}}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "WLT-1", Status: "completed"})
		if !errors.Is(err, expected) {
			t.Fatalf("expected %v, got %v", expected, err)
		}
	})

	t.Run("order lookup error", func(t *testing.T) {
		expected := errors.New("db order error")
		svc := &PaymentWebhookService{
			orderLookup:  &stubOrderWebhookLookup{err: expected},
			sosmedLookup: &stubSosmedWebhookLookup{},
			walletLookup: &stubWalletWebhookLookup{},
		}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "X-1", Status: "completed"})
		if !errors.Is(err, expected) {
			t.Fatalf("expected %v, got %v", expected, err)
		}
	})

	t.Run("sosmed lookup error", func(t *testing.T) {
		expected := errors.New("db sosmed error")
		svc := &PaymentWebhookService{
			orderLookup:  &stubOrderWebhookLookup{},
			sosmedLookup: &stubSosmedWebhookLookup{err: expected},
			walletLookup: &stubWalletWebhookLookup{},
		}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "X-2", Status: "completed"})
		if !errors.Is(err, expected) {
			t.Fatalf("expected %v, got %v", expected, err)
		}
	})

	t.Run("wallet lookup error", func(t *testing.T) {
		expected := errors.New("db wallet error")
		svc := &PaymentWebhookService{
			orderLookup:  &stubOrderWebhookLookup{},
			sosmedLookup: &stubSosmedWebhookLookup{},
			walletLookup: &stubWalletWebhookLookup{err: expected},
		}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "X-3", Status: "completed"})
		if !errors.Is(err, expected) {
			t.Fatalf("expected %v, got %v", expected, err)
		}
	})
}

func TestPaymentWebhookService_ValidationAndNilHandlers(t *testing.T) {
	t.Run("missing order id", func(t *testing.T) {
		svc := &PaymentWebhookService{}
		err := svc.Handle(context.Background(), WebhookInput{})
		if err == nil || err.Error() != "order_id wajib diisi" {
			t.Fatalf("expected order_id validation error, got: %v", err)
		}
	})

	t.Run("missing order handler on ORD prefix", func(t *testing.T) {
		svc := &PaymentWebhookService{}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "ORD-77"})
		if err == nil || err.Error() != "order webhook handler belum diinisialisasi" {
			t.Fatalf("expected missing order handler error, got: %v", err)
		}
	})

	t.Run("missing sosmed handler on SSM prefix", func(t *testing.T) {
		svc := &PaymentWebhookService{}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "SSM-77"})
		if err == nil || err.Error() != "sosmed webhook handler belum diinisialisasi" {
			t.Fatalf("expected missing sosmed handler error, got: %v", err)
		}
	})

	t.Run("missing wallet handler on WLT prefix", func(t *testing.T) {
		svc := &PaymentWebhookService{}
		err := svc.Handle(context.Background(), WebhookInput{OrderID: "WLT-77"})
		if err == nil || err.Error() != "wallet webhook handler belum diinisialisasi" {
			t.Fatalf("expected missing wallet handler error, got: %v", err)
		}
	})
}
