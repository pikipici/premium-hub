package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type SosmedPaymentService struct {
	orderRepo *repository.SosmedOrderRepo
	orderSvc  *SosmedOrderService
	cfg       *config.Config
	gateway   PaymentGatewayClient
}

func NewSosmedPaymentServiceWithGateway(
	cfg *config.Config,
	orderRepo *repository.SosmedOrderRepo,
	orderSvc *SosmedOrderService,
	gateway PaymentGatewayClient,
) *SosmedPaymentService {
	if gateway == nil {
		gateway = NewPaymentGatewayClient(cfg)
	}
	return &SosmedPaymentService{
		orderRepo: orderRepo,
		orderSvc:  orderSvc,
		cfg:       cfg,
		gateway:   gateway,
	}
}

type CreateSosmedPaymentInput struct {
	OrderID       string `json:"order_id" binding:"required"`
	PaymentMethod string `json:"payment_method"`
}

func (s *SosmedPaymentService) gatewayConfigured() bool {
	if s == nil {
		return false
	}
	return gatewayConfigured(s.cfg, s.gateway)
}

func (s *SosmedPaymentService) CreateTransaction(userID uuid.UUID, input CreateSosmedPaymentInput) (*PaymentResponse, error) {
	if !s.gatewayConfigured() {
		return nil, fmt.Errorf("gateway payment belum dikonfigurasi")
	}

	orderID, err := uuid.Parse(strings.TrimSpace(input.OrderID))
	if err != nil {
		return nil, fmt.Errorf("order sosmed tidak ditemukan")
	}

	order, err := s.orderRepo.FindByID(orderID)
	if err != nil {
		return nil, fmt.Errorf("order sosmed tidak ditemukan")
	}
	if order.UserID != userID {
		return nil, fmt.Errorf("akses ditolak")
	}
	if order.PaymentStatus != "pending" {
		return nil, fmt.Errorf("order sosmed sudah diproses")
	}
	if order.TotalPrice <= 0 {
		return nil, fmt.Errorf("nominal order sosmed tidak valid")
	}

	provider := gatewayProviderLabel(s.cfg)
	method := NormalizePaymentGatewayMethodForProvider(provider, input.PaymentMethod)
	if method == "" {
		method = DefaultPaymentGatewayMethod(s.cfg)
	}

	providerOrderID := buildGatewayOrderReference("SSM", order.ID.String())
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	created, _, err := s.gateway.CreateTransaction(ctx, GatewayCreateTransactionInput{
		PaymentMethod:       method,
		OrderID:             providerOrderID,
		Amount:              order.TotalPrice,
		ProductDetails:      "Pembayaran layanan SMM DigiMarket",
		CustomerName:        order.User.Name,
		Email:               order.User.Email,
		PhoneNumber:         order.User.Phone,
		CallbackURL:         defaultGatewayCallbackURL(s.cfg),
		ReturnURL:           defaultGatewayReturnURL(s.cfg, "/dashboard/riwayat-order"),
		ExpiryPeriodMinutes: 15,
	})
	if err != nil {
		return nil, fmt.Errorf("gagal membuat invoice payment gateway: %w", err)
	}

	order.GatewayOrderID = created.OrderID
	order.PaymentPayload = created.PaymentNumber
	order.PaymentMethod = created.PaymentMethod
	if order.PaymentMethod == "" {
		order.PaymentMethod = method
	}
	if err := s.orderRepo.Update(order); err != nil {
		return nil, err
	}

	expiresAt := created.ExpiredAt
	return &PaymentResponse{
		OrderID:          order.ID.String(),
		Provider:         provider,
		PaymentMethod:    order.PaymentMethod,
		PaymentNumber:    created.PaymentNumber,
		PaymentURL:       created.PaymentURL,
		AppURL:           created.AppURL,
		GatewayOrderID:   created.OrderID,
		GatewayReference: created.Reference,
		Amount:           order.TotalPrice,
		TotalPayment:     created.TotalPayment,
		ExpiresAt:        &expiresAt,
	}, nil
}

func (s *SosmedPaymentService) HandleWebhook(input WebhookInput) error {
	if !s.gatewayConfigured() {
		return fmt.Errorf("gateway payment belum dikonfigurasi")
	}

	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return fmt.Errorf("order_id wajib diisi")
	}

	provider := PaymentGatewayProvider(s.cfg)
	expectedProject := configuredGatewayProject(s.cfg)
	incomingProject := strings.TrimSpace(input.Project)
	if provider == paymentGatewayProviderPakasir {
		if expectedProject == "" || incomingProject == "" || !strings.EqualFold(incomingProject, expectedProject) {
			log.Printf("[payment-webhook][sosmed] ignored project_mismatch order_id=%s incoming=%s expected=%s", orderID, incomingProject, expectedProject)
			return nil
		}
	} else {
		if expectedProject != "" {
			if incomingProject != "" && !strings.EqualFold(incomingProject, expectedProject) {
				log.Printf("[payment-webhook][sosmed] ignored merchant_mismatch order_id=%s incoming=%s expected=%s", orderID, incomingProject, expectedProject)
				return nil
			}
		}
		if !ValidateDuitkuCallbackSignature(s.cfg.DuitkuMerchantCode, input.Amount, orderID, s.cfg.DuitkuAPIKey, input.Signature) {
			return fmt.Errorf("signature callback tidak valid")
		}
	}

	status := NormalizePaymentGatewayStatus(strings.TrimSpace(input.Status))
	if !IsPaymentGatewayPaidStatus(status) {
		log.Printf("[payment-webhook][sosmed] ignored unpaid_status order_id=%s status=%s", orderID, status)
		return nil
	}

	order, err := s.orderRepo.FindByGatewayOrderID(orderID)
	if err != nil {
		return fmt.Errorf("order sosmed tidak ditemukan")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	verified, _, err := s.gateway.TransactionDetail(ctx, orderID, order.TotalPrice)
	if err != nil {
		return fmt.Errorf("gagal verifikasi pembayaran gateway: %w", err)
	}
	if !IsPaymentGatewayPaidStatus(verified.Status) {
		return nil
	}
	if verified.Amount > 0 && verified.Amount != order.TotalPrice {
		log.Printf("[payment-webhook][sosmed] amount_mismatch order_id=%s expected=%d actual=%d", orderID, order.TotalPrice, verified.Amount)
		return fmt.Errorf("nominal pembayaran tidak cocok")
	}

	method := verified.PaymentMethod
	if method == "" {
		method = NormalizePaymentGatewayMethodForProvider(provider, input.PaymentMethod)
	}
	if method == "" {
		method = DefaultPaymentGatewayMethod(s.cfg)
	}

	order.PaymentMethod = method
	if err := s.orderRepo.Update(order); err != nil {
		return err
	}

	log.Printf("[payment-webhook][sosmed] confirmed order_id=%s method=%s", orderID, method)
	return s.orderSvc.ConfirmPayment(order.ID)
}

func (s *SosmedPaymentService) GetStatus(orderID, userID uuid.UUID) (*model.SosmedOrder, error) {
	order, err := s.orderRepo.FindByID(orderID)
	if err != nil {
		return nil, fmt.Errorf("order sosmed tidak ditemukan")
	}
	if order.UserID != userID {
		return nil, fmt.Errorf("akses ditolak")
	}
	return order, nil
}
