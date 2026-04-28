package service

import (
	"context"
	"errors"
	"log"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"gorm.io/gorm"
)

type orderWebhookLookup interface {
	FindByGatewayOrderID(gatewayOrderID string) (*model.Order, error)
}

type sosmedWebhookLookup interface {
	FindByGatewayOrderID(gatewayOrderID string) (*model.SosmedOrder, error)
}

type walletWebhookLookup interface {
	FindTopupByGatewayRef(provider, gatewayRef string) (*model.WalletTopup, error)
}

type orderWebhookHandler interface {
	HandleWebhook(input WebhookInput) error
}

type sosmedWebhookHandler interface {
	HandleWebhook(input WebhookInput) error
}

type walletWebhookHandler interface {
	HandleGatewayWebhook(ctx context.Context, input WalletGatewayWebhookInput) error
}

// PaymentWebhookService routes one gateway callback endpoint to premium order,
// sosmed order, or wallet topup flows.
type PaymentWebhookService struct {
	orderLookup   orderWebhookLookup
	sosmedLookup  sosmedWebhookLookup
	walletLookup  walletWebhookLookup
	orderHandler  orderWebhookHandler
	sosmedHandler sosmedWebhookHandler
	walletHandler walletWebhookHandler
}

func NewPaymentWebhookService(
	orderRepo *repository.OrderRepo,
	sosmedOrderRepo *repository.SosmedOrderRepo,
	walletRepo *repository.WalletRepo,
	paymentSvc *PaymentService,
	sosmedPaymentSvc *SosmedPaymentService,
	walletSvc *WalletService,
) *PaymentWebhookService {
	return &PaymentWebhookService{
		orderLookup:   orderRepo,
		sosmedLookup:  sosmedOrderRepo,
		walletLookup:  walletRepo,
		orderHandler:  paymentSvc,
		sosmedHandler: sosmedPaymentSvc,
		walletHandler: walletSvc,
	}
}

func (s *PaymentWebhookService) Handle(ctx context.Context, input WebhookInput) error {
	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return errors.New("order_id wajib diisi")
	}

	log.Printf("[payment-webhook] received order_id=%s status=%s project=%s", orderID, strings.TrimSpace(input.Status), strings.TrimSpace(input.Project))

	upperID := strings.ToUpper(orderID)
	if strings.HasPrefix(upperID, "ORD-") {
		if s.orderHandler == nil {
			return errors.New("order webhook handler belum diinisialisasi")
		}
		log.Printf("[payment-webhook] route=order by_prefix order_id=%s", orderID)
		return s.orderHandler.HandleWebhook(input)
	}
	if strings.HasPrefix(upperID, "SSM-") {
		if s.sosmedHandler == nil {
			return errors.New("sosmed webhook handler belum diinisialisasi")
		}
		log.Printf("[payment-webhook] route=sosmed by_prefix order_id=%s", orderID)
		return s.sosmedHandler.HandleWebhook(input)
	}
	if strings.HasPrefix(upperID, "WLT-") {
		if s.walletHandler == nil {
			return errors.New("wallet webhook handler belum diinisialisasi")
		}
		log.Printf("[payment-webhook] route=wallet by_prefix order_id=%s", orderID)
		return s.walletHandler.HandleGatewayWebhook(ctx, toWalletWebhookInput(input))
	}

	// Fallback akurat: resolve dari data existing, bukan tebak prefix.
	if s.orderLookup != nil {
		if _, err := s.orderLookup.FindByGatewayOrderID(orderID); err == nil {
			if s.orderHandler == nil {
				return errors.New("order webhook handler belum diinisialisasi")
			}
			log.Printf("[payment-webhook] route=order by_lookup order_id=%s", orderID)
			return s.orderHandler.HandleWebhook(input)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("[payment-webhook] lookup_error target=order order_id=%s err=%v", orderID, err)
			return err
		}
	}

	if s.sosmedLookup != nil {
		if _, err := s.sosmedLookup.FindByGatewayOrderID(orderID); err == nil {
			if s.sosmedHandler == nil {
				return errors.New("sosmed webhook handler belum diinisialisasi")
			}
			log.Printf("[payment-webhook] route=sosmed by_lookup order_id=%s", orderID)
			return s.sosmedHandler.HandleWebhook(input)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("[payment-webhook] lookup_error target=sosmed order_id=%s err=%v", orderID, err)
			return err
		}
	}

	if s.walletLookup != nil {
		for _, provider := range []string{paymentGatewayProviderPakasir, paymentGatewayProviderDuitku} {
			if _, err := s.walletLookup.FindTopupByGatewayRef(provider, orderID); err == nil {
				if s.walletHandler == nil {
					return errors.New("wallet webhook handler belum diinisialisasi")
				}
				log.Printf("[payment-webhook] route=wallet by_lookup provider=%s order_id=%s", provider, orderID)
				return s.walletHandler.HandleGatewayWebhook(ctx, toWalletWebhookInput(input))
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				log.Printf("[payment-webhook] lookup_error target=wallet provider=%s order_id=%s err=%v", provider, orderID, err)
				return err
			}
		}
	}

	// Unknown order_id: ack supaya provider tidak retry tanpa henti.
	log.Printf("[payment-webhook] route=unknown ack order_id=%s", orderID)
	return nil
}

func toWalletWebhookInput(input WebhookInput) WalletGatewayWebhookInput {
	return WalletGatewayWebhookInput{
		Amount:        input.Amount,
		OrderID:       input.OrderID,
		Project:       input.Project,
		Status:        input.Status,
		PaymentMethod: input.PaymentMethod,
		CompletedAt:   input.CompletedAt,
		Reference:     input.Reference,
		Signature:     input.Signature,
	}
}
