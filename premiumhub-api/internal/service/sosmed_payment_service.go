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
	pakasir   PakasirClient
}

func NewSosmedPaymentServiceWithGateway(
	cfg *config.Config,
	orderRepo *repository.SosmedOrderRepo,
	orderSvc *SosmedOrderService,
	pakasir PakasirClient,
) *SosmedPaymentService {
	if pakasir == nil {
		pakasir = NewPakasirClient(cfg)
	}
	return &SosmedPaymentService{
		orderRepo: orderRepo,
		orderSvc:  orderSvc,
		cfg:       cfg,
		pakasir:   pakasir,
	}
}

type CreateSosmedPaymentInput struct {
	OrderID       string `json:"order_id" binding:"required"`
	PaymentMethod string `json:"payment_method"`
}

func (s *SosmedPaymentService) pakasirConfigured() bool {
	if s == nil || s.cfg == nil || s.pakasir == nil {
		return false
	}
	return strings.TrimSpace(s.cfg.PakasirProject) != "" && strings.TrimSpace(s.cfg.PakasirAPIKey) != ""
}

func (s *SosmedPaymentService) CreateTransaction(userID uuid.UUID, input CreateSosmedPaymentInput) (*PaymentResponse, error) {
	if !s.pakasirConfigured() {
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

	method := NormalizePakasirPaymentMethod(input.PaymentMethod)
	if method == "" {
		method = "qris"
	}

	providerOrderID := buildPakasirOrderReference("SSM", order.ID.String())
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	created, _, err := s.pakasir.CreateTransaction(ctx, method, providerOrderID, order.TotalPrice)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat invoice pakasir: %w", err)
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
		OrderID:        order.ID.String(),
		Provider:       "pakasir",
		PaymentMethod:  order.PaymentMethod,
		PaymentNumber:  created.PaymentNumber,
		GatewayOrderID: created.OrderID,
		Amount:         order.TotalPrice,
		TotalPayment:   created.TotalPayment,
		ExpiresAt:      &expiresAt,
	}, nil
}

func (s *SosmedPaymentService) HandleWebhook(input WebhookInput) error {
	if !s.pakasirConfigured() {
		return fmt.Errorf("gateway payment belum dikonfigurasi")
	}

	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return fmt.Errorf("order_id wajib diisi")
	}

	if configuredProject := strings.TrimSpace(s.cfg.PakasirProject); configuredProject != "" {
		if incomingProject := strings.TrimSpace(input.Project); incomingProject != "" && !strings.EqualFold(incomingProject, configuredProject) {
			log.Printf("[pakasir-webhook][sosmed] ignored project_mismatch order_id=%s incoming=%s expected=%s", orderID, incomingProject, configuredProject)
			return nil
		}
	}

	status := NormalizePakasirStatus(strings.TrimSpace(input.Status))
	if !IsPakasirPaidStatus(status) {
		log.Printf("[pakasir-webhook][sosmed] ignored unpaid_status order_id=%s status=%s", orderID, status)
		return nil
	}

	order, err := s.orderRepo.FindByGatewayOrderID(orderID)
	if err != nil {
		return fmt.Errorf("order sosmed tidak ditemukan")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	verified, _, err := s.pakasir.TransactionDetail(ctx, orderID, order.TotalPrice)
	if err != nil {
		return fmt.Errorf("gagal verifikasi pembayaran pakasir: %w", err)
	}
	if !IsPakasirPaidStatus(verified.Status) {
		return nil
	}
	if verified.Amount > 0 && verified.Amount != order.TotalPrice {
		log.Printf("[pakasir-webhook][sosmed] amount_mismatch order_id=%s expected=%d actual=%d", orderID, order.TotalPrice, verified.Amount)
		return fmt.Errorf("nominal pembayaran tidak cocok")
	}

	method := verified.PaymentMethod
	if method == "" {
		method = NormalizePakasirPaymentMethod(input.PaymentMethod)
	}
	if method == "" {
		method = "qris"
	}

	order.PaymentMethod = method
	if err := s.orderRepo.Update(order); err != nil {
		return err
	}

	log.Printf("[pakasir-webhook][sosmed] confirmed order_id=%s method=%s", orderID, method)
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
