package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/smtp"
	"net/url"
	"regexp"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/credential"

	"github.com/google/uuid"
)

type OrderService struct {
	orderRepo             *repository.OrderRepo
	stockRepo             *repository.StockRepo
	priceRepo             *repository.ProductRepo
	notifRepo             *repository.NotificationRepo
	userRepo              *repository.UserRepo
	stockCredentialCipher *credential.StockCipher
	cfg                   *config.Config
}

func NewOrderService(orderRepo *repository.OrderRepo, stockRepo *repository.StockRepo, priceRepo *repository.ProductRepo, notifRepo *repository.NotificationRepo) *OrderService {
	return &OrderService{orderRepo: orderRepo, stockRepo: stockRepo, priceRepo: priceRepo, notifRepo: notifRepo}
}

func (s *OrderService) SetConfig(cfg *config.Config) *OrderService {
	s.cfg = cfg
	return s
}

func (s *OrderService) SetUserRepo(userRepo *repository.UserRepo) *OrderService {
	s.userRepo = userRepo
	return s
}

func (s *OrderService) SetStockCredentialCipher(cipher *credential.StockCipher) *OrderService {
	s.stockCredentialCipher = cipher
	return s
}

func (s *OrderService) exposeStockPassword(stock *model.Stock) {
	if stock == nil {
		return
	}
	if strings.TrimSpace(stock.FulfillmentType) == "" {
		stock.FulfillmentType = model.FulfillmentTypeCredential
	}
	if strings.TrimSpace(stock.DeliveryLabel) == "" {
		stock.DeliveryLabel = "Email / Password"
	}
	if strings.TrimSpace(stock.DeliveryValue) == "" {
		stock.DeliveryValue = stock.Email
	}

	if strings.TrimSpace(stock.Password) == "" {
		return
	}

	if s.stockCredentialCipher == nil {
		if !credential.IsEncryptedStockCredential(stock.Password) && !credential.IsBcryptHash(stock.Password) {
			stock.PlainPassword = stock.Password
		}
		if !credential.IsEncryptedStockCredential(stock.DeliverySecret) && !credential.IsBcryptHash(stock.DeliverySecret) {
			stock.PlainDeliverySecret = stock.DeliverySecret
		}
		return
	}

	plain, err := s.stockCredentialCipher.Decrypt(stock.Password)
	if err != nil {
		return
	}

	stock.PlainPassword = plain
	if strings.TrimSpace(stock.DeliverySecret) != "" {
		if secret, err := s.stockCredentialCipher.Decrypt(stock.DeliverySecret); err == nil {
			stock.PlainDeliverySecret = secret
		}
	}
}

type CreateOrderInput struct {
	PriceID       string `json:"price_id" binding:"required"`
	PaymentMethod string `json:"payment_method"`
}

type CreateGuestOrderInput struct {
	PriceID       string `json:"price_id" binding:"required"`
	PaymentMethod string `json:"payment_method"`
	Email         string `json:"email" binding:"required"`
	Phone         string `json:"phone"`
}

type ResendGuestInvoiceInput struct {
	OrderID string `json:"order_id" binding:"required"`
	Email   string `json:"email" binding:"required"`
}

func (s *OrderService) Create(userID uuid.UUID, input CreateOrderInput) (*model.Order, error) {
	priceID, err := uuid.Parse(input.PriceID)
	if err != nil {
		return nil, errors.New("price_id tidak valid")
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(input.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "duitku"
	}
	if paymentMethod == "pakasir" {
		paymentMethod = "duitku"
	}
	if paymentMethod != "duitku" && paymentMethod != "wallet" {
		return nil, errors.New("metode pembayaran tidak didukung")
	}

	order := &model.Order{
		UserID:        userID,
		PriceID:       priceID,
		TotalPrice:    0,
		PaymentMethod: paymentMethod,
		PaymentStatus: "pending",
		OrderStatus:   "pending",
	}

	if err := s.orderRepo.Create(order); err != nil {
		return nil, errors.New("gagal membuat order")
	}

	// Reload with relations
	order, _ = s.orderRepo.FindByID(order.ID)
	order.TotalPrice = order.Price.Price
	s.orderRepo.Update(order)

	return order, nil
}

func newGuestAccessToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func hashGuestToken(token string) string {
	if token == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func guestAccessExpiry() time.Time {
	return time.Now().Add(30 * 24 * time.Hour)
}

func (s *OrderService) ValidateGuestAccess(order *model.Order, token string) bool {
	if order == nil || order.User.Role != "guest" || strings.TrimSpace(token) == "" {
		return false
	}
	if order.GuestAccessExpiresAt == nil || time.Now().After(*order.GuestAccessExpiresAt) {
		return false
	}
	if order.GuestAccessTokenHash != "" {
		if hashGuestToken(token) == order.GuestAccessTokenHash {
			return true
		}
	}
	// backward compat: plaintext match
	if token == order.GuestAccessToken {
		return true
	}
	return false
}

var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func (s *OrderService) CreateGuest(input CreateGuestOrderInput) (*model.Order, error) {
	if s.userRepo == nil {
		return nil, errors.New("guest checkout belum tersedia")
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" || !emailRegex.MatchString(email) {
		return nil, errors.New("email tidak valid")
	}
	paymentMethod := strings.ToLower(strings.TrimSpace(input.PaymentMethod))
	if paymentMethod == "wallet" {
		return nil, errors.New("wallet hanya tersedia untuk user login")
	}
	if paymentMethod == "" {
		paymentMethod = "duitku"
	}

	guest, err := s.userRepo.FindOrCreateGuest(email, input.Phone)
	if err != nil {
		return nil, errors.New("gagal menyiapkan buyer guest")
	}

	order, err := s.Create(guest.ID, CreateOrderInput{
		PriceID:       input.PriceID,
		PaymentMethod: paymentMethod,
	})
	if err != nil {
		return nil, err
	}
	token, err := newGuestAccessToken()
	if err != nil {
		return nil, errors.New("gagal membuat token guest")
	}
	order.GuestAccessToken = token
	order.GuestAccessTokenHash = hashGuestToken(token)
	expiresAt := guestAccessExpiry()
	order.GuestAccessExpiresAt = &expiresAt
	if err := s.orderRepo.Update(order); err != nil {
		return nil, errors.New("gagal menyimpan token guest")
	}
	if err := s.SendGuestInvoiceLink(order); err != nil {
		fmt.Printf("[guest-checkout] failed to send invoice email for order %s: %v\n", order.ID.String(), err)
	}
	return order, nil
}

func (s *OrderService) guestInvoiceURL(order *model.Order) string {
	base := "http://localhost:3000"
	if s.cfg != nil && strings.TrimSpace(s.cfg.FrontendURL) != "" {
		base = strings.TrimRight(strings.TrimSpace(s.cfg.FrontendURL), "/")
	}
	path := "/product/prem-apps/checkout/invoice"
	if order != nil && s.priceRepo != nil {
		if product, err := s.priceRepo.FindByID(order.Price.ProductID); err == nil && strings.Contains(strings.ToLower(product.Slug), "digi") {
			path = "/product/digiproduct/checkout/invoice"
		}
	}
	q := url.Values{}
	q.Set("order_id", order.ID.String())
	q.Set("token", order.GuestAccessToken)
	return base + path + "?" + q.Encode()
}

func (s *OrderService) SendGuestInvoiceLink(order *model.Order) error {
	if s.cfg == nil || strings.TrimSpace(s.cfg.SMTPHost) == "" || strings.TrimSpace(s.cfg.SMTPUser) == "" || strings.TrimSpace(s.cfg.SMTPPass) == "" {
		return errors.New("konfigurasi SMTP tidak tersedia")
	}
	if order == nil || order.User.Role != "guest" || strings.TrimSpace(order.User.Email) == "" || strings.TrimSpace(order.GuestAccessToken) == "" || order.GuestAccessExpiresAt == nil {
		return errors.New("data order tidak lengkap untuk kirim email")
	}
	addr := strings.TrimSpace(s.cfg.SMTPHost) + ":" + strings.TrimSpace(s.cfg.SMTPPort)
	auth := smtp.PlainAuth("", strings.TrimSpace(s.cfg.SMTPUser), strings.TrimSpace(s.cfg.SMTPPass), strings.TrimSpace(s.cfg.SMTPHost))
	body := fmt.Sprintf("Halo,\n\nIni link invoice order kamu:\n%s\n\nLink ini berlaku sampai %s. Jangan bagikan link ini ke orang lain.\n\nDigiMarket", s.guestInvoiceURL(order), order.GuestAccessExpiresAt.Format(time.RFC1123))
	msg := []byte("To: " + order.User.Email + "\r\n" + "Subject: Link invoice DigiMarket\r\n" + "Content-Type: text/plain; charset=UTF-8\r\n\r\n" + body)
	return smtp.SendMail(addr, auth, strings.TrimSpace(s.cfg.SMTPUser), []string{order.User.Email}, msg)
}

func (s *OrderService) ResendGuestInvoice(input ResendGuestInvoiceInput) error {
	orderID, err := uuid.Parse(strings.TrimSpace(input.OrderID))
	if err != nil {
		return nil
	}
	order, err := s.orderRepo.FindByID(orderID)
	if err != nil || order.User.Role != "guest" || !strings.EqualFold(strings.TrimSpace(input.Email), strings.TrimSpace(order.User.Email)) {
		return nil
	}
	if strings.TrimSpace(order.GuestAccessToken) == "" || order.GuestAccessExpiresAt == nil || time.Now().After(*order.GuestAccessExpiresAt) {
		token, err := newGuestAccessToken()
		if err != nil {
			return nil
		}
		expiresAt := guestAccessExpiry()
		order.GuestAccessToken = token
		order.GuestAccessTokenHash = hashGuestToken(token)
		order.GuestAccessExpiresAt = &expiresAt
		if err := s.orderRepo.Update(order); err != nil {
			return nil
		}
	}
	_ = s.SendGuestInvoiceLink(order)
	return nil
}

// GuestOrderStatusResponse is a minimal public response for order tracking
// without exposing stock/credentials.
type GuestOrderStatusResponse struct {
	OrderID       string  `json:"order_id"`
	OrderStatus   string  `json:"order_status"`
	PaymentStatus string  `json:"payment_status"`
	TotalPrice    int64   `json:"total_price"`
	ProductName   string  `json:"product_name"`
	CreatedAt     string  `json:"created_at"`
	PaidAt        *string `json:"paid_at,omitempty"`
}

// GetGuestOrderStatus returns basic order status for a guest order
// using only the order ID. No stock details are exposed.
func (s *OrderService) GetGuestOrderStatus(id uuid.UUID) (*GuestOrderStatusResponse, error) {
	order, err := s.orderRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("order tidak ditemukan")
	}

	productName := ""
	if s.priceRepo != nil {
		if product, productErr := s.priceRepo.FindByID(order.Price.ProductID); productErr == nil {
			productName = product.Name
		}
	}

	res := &GuestOrderStatusResponse{
		OrderID:       order.ID.String(),
		OrderStatus:   order.OrderStatus,
		PaymentStatus: order.PaymentStatus,
		TotalPrice:    order.TotalPrice,
		ProductName:   productName,
		CreatedAt:     order.CreatedAt.Format(time.RFC3339),
	}
	if order.PaidAt != nil {
		paid := order.PaidAt.Format(time.RFC3339)
		res.PaidAt = &paid
	}
	return res, nil
}

func (s *OrderService) GetGuestByID(id uuid.UUID, token string) (*model.Order, error) {
	order, err := s.orderRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("order tidak ditemukan")
	}
	if !s.ValidateGuestAccess(order, token) {
		return nil, errors.New("order tidak ditemukan")
	}

	s.exposeStockPassword(order.Stock)
	return order, nil
}

func (s *OrderService) GetByID(id, userID uuid.UUID) (*model.Order, error) {
	order, err := s.orderRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("order tidak ditemukan")
	}
	if order.UserID != userID {
		return nil, errors.New("akses ditolak")
	}

	s.exposeStockPassword(order.Stock)
	return order, nil
}

func (s *OrderService) ListByUser(userID uuid.UUID, page, limit int) ([]model.Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	orders, total, err := s.orderRepo.FindByUserID(userID, page, limit)
	if err != nil {
		return nil, 0, err
	}

	for index := range orders {
		s.exposeStockPassword(orders[index].Stock)
	}

	return orders, total, nil
}

func (s *OrderService) Cancel(id, userID uuid.UUID) error {
	order, err := s.orderRepo.FindByID(id)
	if err != nil {
		return errors.New("order tidak ditemukan")
	}
	if order.UserID != userID {
		return errors.New("akses ditolak")
	}
	if order.PaymentStatus != "pending" {
		return errors.New("order tidak bisa dibatalkan")
	}
	order.PaymentStatus = "failed"
	order.OrderStatus = "failed"
	return s.orderRepo.Update(order)
}

func (s *OrderService) ConfirmPayment(orderID uuid.UUID) error {
	order, err := s.orderRepo.FindByID(orderID)
	if err != nil {
		return errors.New("order tidak ditemukan")
	}

	if order.PaymentStatus == "paid" && order.OrderStatus == "active" && order.StockID != nil {
		return nil
	}

	now := time.Now()
	order.PaymentStatus = "paid"
	order.OrderStatus = "active"
	order.PaidAt = &now

	fulfillmentType := model.FulfillmentTypeCredential
	if s.priceRepo != nil {
		if product, err := s.priceRepo.FindByID(order.Price.ProductID); err == nil {
			if product.FulfillmentType != "" {
				fulfillmentType = product.FulfillmentType
			}
		}
	}

	stock, err := s.stockRepo.FindAvailable(order.Price.ProductID, order.Price.AccountType, order.Price.Duration, fulfillmentType)
	if err != nil {
		return errors.New("stok tidak tersedia")
	}

	stock.Status = "used"
	stock.UsedBy = &order.UserID
	stock.UsedAt = &now
	expiry := now.AddDate(0, order.Price.Duration, 0)
	stock.ExpiresAt = &expiry
	order.ExpiresAt = &expiry
	order.StockID = &stock.ID

	if err := s.stockRepo.Update(stock); err != nil {
		return err
	}
	if err := s.orderRepo.Update(order); err != nil {
		return err
	}

	// Create notification
	s.notifRepo.Create(&model.Notification{
		UserID:  order.UserID,
		Title:   "Pembayaran Berhasil",
		Message: fmt.Sprintf("Pembayaran untuk order %s berhasil. Akses produk kamu sudah aktif!", order.ID.String()[:8]),
		Type:    "order",
	})

	return nil
}

func (s *OrderService) AdminList(status string, page, limit int) ([]model.Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	return s.orderRepo.AdminList(status, page, limit)
}

func (s *OrderService) AdminGetByID(id uuid.UUID) (*model.Order, error) {
	return s.orderRepo.FindByID(id)
}

func (s *OrderService) ManualSendAccount(orderID uuid.UUID) error {
	return s.ConfirmPayment(orderID)
}
