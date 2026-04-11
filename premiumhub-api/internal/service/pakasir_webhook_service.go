package service

import (
	"context"
	"errors"
	"strings"

	"premiumhub-api/internal/repository"

	"gorm.io/gorm"
)

// PakasirWebhookService menangani 1 endpoint webhook untuk banyak flow
// (order checkout + wallet topup) dengan routing by order_id / lookup DB.
type PakasirWebhookService struct {
	orderRepo  *repository.OrderRepo
	walletRepo *repository.WalletRepo
	paymentSvc *PaymentService
	walletSvc  *WalletService
}

func NewPakasirWebhookService(
	orderRepo *repository.OrderRepo,
	walletRepo *repository.WalletRepo,
	paymentSvc *PaymentService,
	walletSvc *WalletService,
) *PakasirWebhookService {
	return &PakasirWebhookService{
		orderRepo:  orderRepo,
		walletRepo: walletRepo,
		paymentSvc: paymentSvc,
		walletSvc:  walletSvc,
	}
}

func (s *PakasirWebhookService) Handle(ctx context.Context, input WebhookInput) error {
	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return errors.New("order_id wajib diisi")
	}

	upperID := strings.ToUpper(orderID)
	if strings.HasPrefix(upperID, "ORD-") {
		return s.paymentSvc.HandleWebhook(input)
	}
	if strings.HasPrefix(upperID, "WLT-") {
		return s.walletSvc.HandlePakasirWebhook(ctx, toWalletWebhookInput(input))
	}

	// Fallback akurat: resolve dari data existing, bukan tebak prefix.
	if _, err := s.orderRepo.FindByGatewayOrderID(orderID); err == nil {
		return s.paymentSvc.HandleWebhook(input)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if _, err := s.walletRepo.FindTopupByGatewayRef("pakasir", orderID); err == nil {
		return s.walletSvc.HandlePakasirWebhook(ctx, toWalletWebhookInput(input))
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
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
