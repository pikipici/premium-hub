package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type OrderService struct {
	orderRepo *repository.OrderRepo
	stockRepo *repository.StockRepo
	priceRepo *repository.ProductRepo
	notifRepo *repository.NotificationRepo
}

func NewOrderService(orderRepo *repository.OrderRepo, stockRepo *repository.StockRepo, priceRepo *repository.ProductRepo, notifRepo *repository.NotificationRepo) *OrderService {
	return &OrderService{orderRepo: orderRepo, stockRepo: stockRepo, priceRepo: priceRepo, notifRepo: notifRepo}
}

type CreateOrderInput struct {
	PriceID       string `json:"price_id" binding:"required"`
	PaymentMethod string `json:"payment_method"`
}

func (s *OrderService) Create(userID uuid.UUID, input CreateOrderInput) (*model.Order, error) {
	priceID, err := uuid.Parse(input.PriceID)
	if err != nil {
		return nil, errors.New("price_id tidak valid")
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(input.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "pakasir"
	}
	if paymentMethod != "pakasir" && paymentMethod != "wallet" {
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

func (s *OrderService) GetByID(id, userID uuid.UUID) (*model.Order, error) {
	order, err := s.orderRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("order tidak ditemukan")
	}
	if order.UserID != userID {
		return nil, errors.New("akses ditolak")
	}
	return order, nil
}

func (s *OrderService) ListByUser(userID uuid.UUID, page, limit int) ([]model.Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	return s.orderRepo.FindByUserID(userID, page, limit)
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

	// Assign stock
	stock, err := s.stockRepo.FindAvailable(order.Price.ProductID, order.Price.AccountType, order.Price.Duration)
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
		Message: fmt.Sprintf("Pembayaran untuk order %s berhasil. Akun kamu sudah aktif!", order.ID.String()[:8]),
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
