package service

import (
	"fmt"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type PaymentService struct {
	orderRepo *repository.OrderRepo
	orderSvc  *OrderService
}

func NewPaymentService(orderRepo *repository.OrderRepo, orderSvc *OrderService) *PaymentService {
	return &PaymentService{orderRepo: orderRepo, orderSvc: orderSvc}
}

type CreatePaymentInput struct {
	OrderID string `json:"order_id" binding:"required"`
}

type PaymentResponse struct {
	OrderID    string `json:"order_id"`
	SnapToken  string `json:"snap_token"`
	MidtransID string `json:"midtrans_id"`
	Amount     int64  `json:"amount"`
}

func (s *PaymentService) CreateTransaction(userID uuid.UUID, input CreatePaymentInput) (*PaymentResponse, error) {
	orderID, _ := uuid.Parse(input.OrderID)
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

	// Mock Midtrans - generate fake snap token
	midtransID := fmt.Sprintf("PH-%s-%d", order.ID.String()[:8], time.Now().Unix())
	snapToken := fmt.Sprintf("mock-snap-%s", order.ID.String()[:12])

	order.MidtransID = midtransID
	order.SnapToken = snapToken
	s.orderRepo.Update(order)

	return &PaymentResponse{
		OrderID:    order.ID.String(),
		SnapToken:  snapToken,
		MidtransID: midtransID,
		Amount:     order.TotalPrice,
	}, nil
}

type WebhookInput struct {
	OrderID           string `json:"order_id"`
	TransactionStatus string `json:"transaction_status"`
	PaymentType       string `json:"payment_type"`
}

func (s *PaymentService) HandleWebhook(input WebhookInput) error {
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
