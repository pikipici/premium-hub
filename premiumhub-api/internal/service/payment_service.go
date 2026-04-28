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

type walletOrderCheckoutService interface {
	PayOrderWithWallet(ctx context.Context, userID, orderID uuid.UUID) (*WalletOrderPaymentResult, error)
}

type PaymentService struct {
	orderRepo *repository.OrderRepo
	orderSvc  *OrderService
	walletSvc walletOrderCheckoutService
	cfg       *config.Config
	gateway   PaymentGatewayClient
}

func NewPaymentService(orderRepo *repository.OrderRepo, orderSvc *OrderService) *PaymentService {
	return &PaymentService{orderRepo: orderRepo, orderSvc: orderSvc}
}

func (s *PaymentService) SetWalletService(walletSvc walletOrderCheckoutService) *PaymentService {
	s.walletSvc = walletSvc
	return s
}

func NewPaymentServiceWithGateway(
	cfg *config.Config,
	orderRepo *repository.OrderRepo,
	orderSvc *OrderService,
	gateway PaymentGatewayClient,
) *PaymentService {
	if gateway == nil {
		gateway = NewPaymentGatewayClient(cfg)
	}
	return &PaymentService{
		orderRepo: orderRepo,
		orderSvc:  orderSvc,
		cfg:       cfg,
		gateway:   gateway,
	}
}

type CreatePaymentInput struct {
	OrderID       string `json:"order_id" binding:"required"`
	PaymentMethod string `json:"payment_method"`
}

type PaymentResponse struct {
	OrderID             string     `json:"order_id"`
	Provider            string     `json:"provider"`
	PaymentMethod       string     `json:"payment_method"`
	PaymentNumber       string     `json:"payment_number"`
	PaymentURL          string     `json:"payment_url,omitempty"`
	AppURL              string     `json:"app_url,omitempty"`
	GatewayOrderID      string     `json:"gateway_order_id"`
	GatewayReference    string     `json:"gateway_reference,omitempty"`
	Amount              int64      `json:"amount"`
	TotalPayment        int64      `json:"total_payment,omitempty"`
	ExpiresAt           *time.Time `json:"expires_at,omitempty"`
	PaymentStatus       string     `json:"payment_status,omitempty"`
	OrderStatus         string     `json:"order_status,omitempty"`
	WalletBalanceBefore *int64     `json:"wallet_balance_before,omitempty"`
	WalletBalanceAfter  *int64     `json:"wallet_balance_after,omitempty"`
}

type PaymentMethodResponse struct {
	Method string `json:"method"`
	Name   string `json:"name"`
	Image  string `json:"image,omitempty"`
	Fee    string `json:"fee,omitempty"`
}

func (s *PaymentService) gatewayConfigured() bool {
	if s == nil {
		return false
	}
	return gatewayConfigured(s.cfg, s.gateway)
}

func (s *PaymentService) ListPaymentMethods(ctx context.Context, amount int64) ([]PaymentMethodResponse, error) {
	if !s.gatewayConfigured() {
		return nil, fmt.Errorf("gateway payment belum dikonfigurasi")
	}
	if amount <= 0 {
		amount = 10000
	}

	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	methods, _, err := s.gateway.ListPaymentMethods(ctx, amount)
	if err != nil {
		return nil, fmt.Errorf("gagal memuat metode pembayaran: %w", err)
	}

	seen := make(map[string]struct{}, len(methods))
	out := make([]PaymentMethodResponse, 0, len(methods))
	provider := PaymentGatewayProvider(s.cfg)
	for _, method := range methods {
		code := NormalizePaymentGatewayMethodForProvider(provider, method.Method)
		if code == "" {
			continue
		}
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}

		name := strings.TrimSpace(method.Name)
		if name == "" {
			name = code
		}
		out = append(out, PaymentMethodResponse{
			Method: code,
			Name:   name,
			Image:  strings.TrimSpace(method.Image),
			Fee:    strings.TrimSpace(method.Fee),
		})
	}

	return out, nil
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

	requestedMethod := strings.ToLower(strings.TrimSpace(input.PaymentMethod))
	if requestedMethod == "wallet" {
		if s.walletSvc == nil {
			return nil, fmt.Errorf("wallet checkout belum tersedia")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		walletRes, err := s.walletSvc.PayOrderWithWallet(ctx, userID, orderID)
		if err != nil {
			return nil, err
		}

		balanceBefore := walletRes.BalanceBefore
		balanceAfter := walletRes.BalanceAfter
		return &PaymentResponse{
			OrderID:             order.ID.String(),
			Provider:            "wallet",
			PaymentMethod:       "wallet",
			PaymentNumber:       "",
			GatewayOrderID:      walletRes.Reference,
			Amount:              walletRes.Amount,
			PaymentStatus:       "paid",
			OrderStatus:         "active",
			WalletBalanceBefore: &balanceBefore,
			WalletBalanceAfter:  &balanceAfter,
		}, nil
	}

	if order.PaymentStatus != "pending" {
		return nil, fmt.Errorf("order sudah diproses")
	}

	if !s.gatewayConfigured() {
		return nil, fmt.Errorf("gateway payment belum dikonfigurasi")
	}

	provider := gatewayProviderLabel(s.cfg)
	method := NormalizePaymentGatewayMethodForProvider(provider, input.PaymentMethod)
	if method == "" {
		method = DefaultPaymentGatewayMethod(s.cfg)
	}

	providerOrderID := buildGatewayOrderReference("ORD", order.ID.String())
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	created, _, err := s.gateway.CreateTransaction(ctx, GatewayCreateTransactionInput{
		PaymentMethod:       method,
		OrderID:             providerOrderID,
		Amount:              order.TotalPrice,
		ProductDetails:      "Pembayaran produk premium DigiMarket",
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

type WebhookInput struct {
	OrderID       string `json:"order_id"`
	Project       string `json:"project"`
	Status        string `json:"status"`
	PaymentMethod string `json:"payment_method"`
	Amount        int64  `json:"amount"`
	CompletedAt   string `json:"completed_at"`
	Reference     string `json:"reference"`
	Signature     string `json:"signature"`
}

func (s *PaymentService) HandleWebhook(input WebhookInput) error {
	if !s.gatewayConfigured() {
		return fmt.Errorf("gateway payment belum dikonfigurasi")
	}
	return s.handleGatewayWebhook(input)
}

func (s *PaymentService) handleGatewayWebhook(input WebhookInput) error {
	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return fmt.Errorf("order_id wajib diisi")
	}

	provider := PaymentGatewayProvider(s.cfg)
	expectedProject := configuredGatewayProject(s.cfg)
	incomingProject := strings.TrimSpace(input.Project)
	if provider == paymentGatewayProviderPakasir {
		if expectedProject == "" || incomingProject == "" || !strings.EqualFold(incomingProject, expectedProject) {
			log.Printf("[payment-webhook][order] ignored project_mismatch order_id=%s incoming=%s expected=%s", orderID, incomingProject, expectedProject)
			return nil
		}
	} else {
		if expectedProject != "" {
			if incomingProject != "" && !strings.EqualFold(incomingProject, expectedProject) {
				log.Printf("[payment-webhook][order] ignored merchant_mismatch order_id=%s incoming=%s expected=%s", orderID, incomingProject, expectedProject)
				return nil
			}
		}
		if !ValidateDuitkuCallbackSignature(s.cfg.DuitkuMerchantCode, input.Amount, orderID, s.cfg.DuitkuAPIKey, input.Signature) {
			return fmt.Errorf("signature callback tidak valid")
		}
	}

	status := NormalizePaymentGatewayStatus(strings.TrimSpace(input.Status))
	if !IsPaymentGatewayPaidStatus(status) {
		log.Printf("[payment-webhook][order] ignored unpaid_status order_id=%s status=%s", orderID, status)
		return nil
	}

	order, err := s.orderRepo.FindByGatewayOrderID(orderID)
	if err != nil {
		return fmt.Errorf("order tidak ditemukan")
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
		log.Printf("[payment-webhook][order] amount_mismatch order_id=%s expected=%d actual=%d", orderID, order.TotalPrice, verified.Amount)
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
	log.Printf("[payment-webhook][order] confirmed order_id=%s method=%s", orderID, method)
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

func buildGatewayOrderReference(prefix, source string) string {
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
