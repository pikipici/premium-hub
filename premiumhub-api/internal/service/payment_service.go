package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type PaymentService struct {
	orderRepo *repository.OrderRepo
	orderSvc  *OrderService
	cfg       *config.Config
	pakasir   PakasirClient
}

func NewPaymentService(orderRepo *repository.OrderRepo, orderSvc *OrderService) *PaymentService {
	return &PaymentService{orderRepo: orderRepo, orderSvc: orderSvc}
}

func NewPaymentServiceWithGateway(
	cfg *config.Config,
	orderRepo *repository.OrderRepo,
	orderSvc *OrderService,
	pakasir PakasirClient,
) *PaymentService {
	if pakasir == nil {
		pakasir = NewPakasirClient(cfg)
	}
	return &PaymentService{
		orderRepo: orderRepo,
		orderSvc:  orderSvc,
		cfg:       cfg,
		pakasir:   pakasir,
	}
}

type CreatePaymentInput struct {
	OrderID       string `json:"order_id" binding:"required"`
	PaymentMethod string `json:"payment_method"`
}

type PaymentResponse struct {
	OrderID        string     `json:"order_id"`
	Provider       string     `json:"provider"`
	PaymentMethod  string     `json:"payment_method"`
	PaymentNumber  string     `json:"payment_number"`
	GatewayOrderID string     `json:"gateway_order_id"`
	Amount         int64      `json:"amount"`
	TotalPayment   int64      `json:"total_payment,omitempty"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`

	// Legacy aliases (temporary for backward compatibility)
	SnapToken  string `json:"snap_token,omitempty"`
	MidtransID string `json:"midtrans_id,omitempty"`
}

func (s *PaymentService) pakasirConfigured() bool {
	if s == nil || s.cfg == nil || s.pakasir == nil {
		return false
	}
	return strings.TrimSpace(s.cfg.PakasirProject) != "" && strings.TrimSpace(s.cfg.PakasirAPIKey) != ""
}

func (s *PaymentService) CreateTransaction(userID uuid.UUID, input CreatePaymentInput) (*PaymentResponse, error) {
	orderID, err := uuid.Parse(strings.TrimSpace(input.OrderID))
	if err != nil {
		return nil, fmt.Errorf("order tidak ditemukan")
	}

	order, err := s.orderRepo.FindByID(orderID)
	if err != nil {
		return nil, fmt.Errorf("order tidak ditemukan")
	}
	if order.UserID != userID {
		return nil, fmt.Errorf("akses ditolak")
	}
	if order.PaymentStatus != "pending" {
		return nil, fmt.Errorf("order sudah diproses")
	}

	if s.pakasirConfigured() {
		method := NormalizePakasirPaymentMethod(input.PaymentMethod)
		if method == "" {
			method = "qris"
		}

		providerOrderID := buildPakasirOrderReference("ORD", order.ID.String())
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		created, _, err := s.pakasir.CreateTransaction(ctx, method, providerOrderID, order.TotalPrice)
		if err != nil {
			return nil, fmt.Errorf("gagal membuat invoice pakasir: %w", err)
		}

		order.MidtransID = created.OrderID
		order.SnapToken = created.PaymentNumber
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
			SnapToken:      created.PaymentNumber,
			MidtransID:     created.OrderID,
		}, nil
	}

	// Legacy fallback (non-pakasir mode)
	midtransID := fmt.Sprintf("PH-%s-%d", order.ID.String()[:8], time.Now().Unix())
	snapToken := fmt.Sprintf("mock-snap-%s", order.ID.String()[:12])

	order.MidtransID = midtransID
	order.SnapToken = snapToken
	s.orderRepo.Update(order)

	return &PaymentResponse{
		OrderID:       order.ID.String(),
		Provider:      "legacy",
		PaymentMethod: "qris",
		PaymentNumber: snapToken,
		Amount:        order.TotalPrice,
		SnapToken:     snapToken,
		MidtransID:    midtransID,
	}, nil
}

type WebhookInput struct {
	OrderID           string `json:"order_id"`
	TransactionStatus string `json:"transaction_status"`
	PaymentType       string `json:"payment_type"`

	// Pakasir fields
	Project       string `json:"project"`
	Status        string `json:"status"`
	PaymentMethod string `json:"payment_method"`
	Amount        int64  `json:"amount"`
	CompletedAt   string `json:"completed_at"`
}

func (s *PaymentService) HandleWebhook(input WebhookInput) error {
	if s.pakasirConfigured() {
		return s.handlePakasirWebhook(input)
	}

	order, err := s.orderRepo.FindByMidtransID(input.OrderID)
	if err != nil {
		return fmt.Errorf("order tidak ditemukan")
	}

	switch input.TransactionStatus {
	case "capture", "settlement":
		order.PaymentMethod = input.PaymentType
		s.orderRepo.Update(order)
		return s.orderSvc.ConfirmPayment(order.ID)
	case "deny", "cancel", "expire":
		order.PaymentStatus = "failed"
		order.OrderStatus = "failed"
		return s.orderRepo.Update(order)
	}
	return nil
}

func (s *PaymentService) handlePakasirWebhook(input WebhookInput) error {
	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return fmt.Errorf("order_id wajib diisi")
	}

	if configuredProject := strings.TrimSpace(s.cfg.PakasirProject); configuredProject != "" {
		if incomingProject := strings.TrimSpace(input.Project); incomingProject != "" && !strings.EqualFold(incomingProject, configuredProject) {
			return nil
		}
	}

	status := NormalizePakasirStatus(firstNonEmpty(strings.TrimSpace(input.Status), strings.TrimSpace(input.TransactionStatus)))
	if !IsPakasirPaidStatus(status) {
		return nil
	}

	order, err := s.orderRepo.FindByMidtransID(orderID)
	if err != nil {
		return fmt.Errorf("order tidak ditemukan")
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
		return fmt.Errorf("nominal pembayaran tidak cocok")
	}

	method := verified.PaymentMethod
	if method == "" {
		method = NormalizePakasirPaymentMethod(firstNonEmpty(input.PaymentMethod, input.PaymentType))
	}
	if method == "" {
		method = "qris"
	}

	order.PaymentMethod = method
	if err := s.orderRepo.Update(order); err != nil {
		return err
	}
	return s.orderSvc.ConfirmPayment(order.ID)
}

func (s *PaymentService) GetStatus(orderID, userID uuid.UUID) (*model.Order, error) {
	order, err := s.orderRepo.FindByID(orderID)
	if err != nil {
		return nil, fmt.Errorf("order tidak ditemukan")
	}
	if order.UserID != userID {
		return nil, fmt.Errorf("akses ditolak")
	}
	return order, nil
}

// SimulatePayment - for development/testing only, simulates successful payment
func (s *PaymentService) SimulatePayment(orderID uuid.UUID) error {
	if s.pakasirConfigured() {
		return fmt.Errorf("simulate payment dinonaktifkan saat pakasir aktif")
	}

	order, err := s.orderRepo.FindByID(orderID)
	if err != nil {
		return fmt.Errorf("order tidak ditemukan")
	}
	if order.PaymentStatus != "pending" {
		return fmt.Errorf("order sudah diproses")
	}
	order.PaymentMethod = "simulated"
	s.orderRepo.Update(order)
	return s.orderSvc.ConfirmPayment(order.ID)
}

func buildPakasirOrderReference(prefix, source string) string {
	sanitized := strings.ToUpper(strings.TrimSpace(source))
	sanitized = strings.ReplaceAll(sanitized, "-", "")
	if len(sanitized) > 40 {
		sanitized = sanitized[:40]
	}
	if prefix == "" {
		return sanitized
	}
	if sanitized == "" {
		return strings.ToUpper(prefix)
	}
	return strings.ToUpper(prefix) + "-" + sanitized
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v != "" {
			return v
		}
	}
	return ""
}
