package service

import (
	"context"
	"errors"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"gorm.io/gorm"
)

type orderWebhookLookup interface {
	FindByGatewayOrderID(gatewayOrderID string) (*model.Order, error)
}

type walletWebhookLookup interface {
	FindTopupByGatewayRef(provider, gatewayRef string) (*model.WalletTopup, error)
}

type orderWebhookHandler interface {
	HandleWebhook(input WebhookInput) error
}

type walletWebhookHandler interface {
	HandlePakasirWebhook(ctx context.Context, input WalletPakasirWebhookInput) error
}

// PakasirWebhookService menangani 1 endpoint webhook untuk banyak flow
// (order checkout + wallet topup) dengan routing by order_id / lookup DB.
type PakasirWebhookService struct {
	orderLookup   orderWebhookLookup
	walletLookup  walletWebhookLookup
	orderHandler  orderWebhookHandler
	walletHandler walletWebhookHandler
}

func NewPakasirWebhookService(
	orderRepo *repository.OrderRepo,
	walletRepo *repository.WalletRepo,
	paymentSvc *PaymentService,
	walletSvc *WalletService,
) *PakasirWebhookService {
	return &PakasirWebhookService{
		orderLookup:   orderRepo,
		walletLookup:  walletRepo,
		orderHandler:  paymentSvc,
		walletHandler: walletSvc,
	}
}

func (s *PakasirWebhookService) Handle(ctx context.Context, input WebhookInput) error {
	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return errors.New("order_id wajib diisi")
	}

	upperID := strings.ToUpper(orderID)
	if strings.HasPrefix(upperID, "ORD-") {
		if s.orderHandler == nil {
			return errors.New("order webhook handler belum diinisialisasi")
		}
		return s.orderHandler.HandleWebhook(input)
	}
	if strings.HasPrefix(upperID, "WLT-") {
		if s.walletHandler == nil {
			return errors.New("wallet webhook handler belum diinisialisasi")
		}
		return s.walletHandler.HandlePakasirWebhook(ctx, toWalletWebhookInput(input))
	}

	// Fallback akurat: resolve dari data existing, bukan tebak prefix.
	if s.orderLookup != nil {
		if _, err := s.orderLookup.FindByGatewayOrderID(orderID); err == nil {
			if s.orderHandler == nil {
				return errors.New("order webhook handler belum diinisialisasi")
			}
			return s.orderHandler.HandleWebhook(input)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	}

	if s.walletLookup != nil {
		if _, err := s.walletLookup.FindTopupByGatewayRef("pakasir", orderID); err == nil {
			if s.walletHandler == nil {
				return errors.New("wallet webhook handler belum diinisialisasi")
			}
			return s.walletHandler.HandlePakasirWebhook(ctx, toWalletWebhookInput(input))
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	}

	// Unknown order_id: ack supaya provider tidak retry tanpa henti.
	return nil
}

func toWalletWebhookInput(input WebhookInput) WalletPakasirWebhookInput {
	return WalletPakasirWebhookInput{
		Amount:        input.Amount,
		OrderID:       input.OrderID,
		Project:       input.Project,
		Status:        input.Status,
		PaymentMethod: input.PaymentMethod,
		CompletedAt:   input.CompletedAt,
	}
}
