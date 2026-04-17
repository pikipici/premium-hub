package service

import (
	"errors"
	"math"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

const (
	sosmedOrderStatusPendingPayment = "pending_payment"
	sosmedOrderStatusProcessing     = "processing"
	sosmedOrderStatusSuccess        = "success"
	sosmedOrderStatusFailed         = "failed"
	sosmedOrderStatusCanceled       = "canceled"
	sosmedOrderStatusExpired        = "expired"
)

var sosmedAdminTransitionMatrix = map[string]map[string]bool{
	sosmedOrderStatusPendingPayment: {
		sosmedOrderStatusProcessing: true,
		sosmedOrderStatusFailed:     true,
		sosmedOrderStatusCanceled:   true,
		sosmedOrderStatusExpired:    true,
	},
	sosmedOrderStatusProcessing: {
		sosmedOrderStatusSuccess:  true,
		sosmedOrderStatusFailed:   true,
		sosmedOrderStatusCanceled: true,
	},
}

type SosmedOrderService struct {
	repo        *repository.SosmedOrderRepo
	serviceRepo *repository.SosmedServiceRepo
	notifRepo   *repository.NotificationRepo
}

func NewSosmedOrderService(
	repo *repository.SosmedOrderRepo,
	serviceRepo *repository.SosmedServiceRepo,
	notifRepo *repository.NotificationRepo,
) *SosmedOrderService {
	return &SosmedOrderService{repo: repo, serviceRepo: serviceRepo, notifRepo: notifRepo}
}

type CreateSosmedOrderInput struct {
	ServiceID  string `json:"service_id" binding:"required"`
	TargetLink string `json:"target_link"`
	Quantity   int64  `json:"quantity"`
	Notes      string `json:"notes"`
}

type AdminUpdateSosmedOrderStatusInput struct {
	ToStatus     string `json:"to_status" binding:"required"`
	Reason       string `json:"reason"`
	InternalNote string `json:"internal_note"`
}

type SosmedOrderDetail struct {
	Order  *model.SosmedOrder       `json:"order"`
	Events []model.SosmedOrderEvent `json:"events"`
}

func normalizeSosmedOrderStatus(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func isValidSosmedOrderStatus(value string) bool {
	switch normalizeSosmedOrderStatus(value) {
	case sosmedOrderStatusPendingPayment,
		sosmedOrderStatusProcessing,
		sosmedOrderStatusSuccess,
		sosmedOrderStatusFailed,
		sosmedOrderStatusCanceled,
		sosmedOrderStatusExpired:
		return true
	default:
		return false
	}
}

func normalizeSosmedOrderTargetLink(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) > 255 {
		return strings.TrimSpace(trimmed[:255])
	}
	return trimmed
}

func (s *SosmedOrderService) buildDetail(order *model.SosmedOrder) (*SosmedOrderDetail, error) {
	events, err := s.repo.ListEventsByOrder(order.ID)
	if err != nil {
		return nil, errors.New("gagal memuat event order sosmed")
	}

	return &SosmedOrderDetail{Order: order, Events: events}, nil
}

func (s *SosmedOrderService) Create(userID uuid.UUID, input CreateSosmedOrderInput) (*SosmedOrderDetail, error) {
	serviceID, err := uuid.Parse(strings.TrimSpace(input.ServiceID))
	if err != nil {
		return nil, errors.New("service_id tidak valid")
	}

	sosmedService, err := s.serviceRepo.FindByID(serviceID)
	if err != nil {
		return nil, errors.New("layanan sosmed tidak ditemukan")
	}
	if !sosmedService.IsActive {
		return nil, errors.New("layanan sosmed sedang nonaktif")
	}
	if sosmedService.CheckoutPrice <= 0 {
		return nil, errors.New("harga checkout layanan belum dikonfigurasi")
	}

	quantity := input.Quantity
	if quantity <= 0 {
		quantity = 1
	}
	if quantity > 1000 {
		return nil, errors.New("quantity terlalu besar")
	}

	totalPriceFloat := float64(sosmedService.CheckoutPrice) * float64(quantity)
	if totalPriceFloat > math.MaxInt64 {
		return nil, errors.New("harga order melebihi batas sistem")
	}

	now := time.Now()
	expiresAt := now.Add(60 * time.Minute)
	order := &model.SosmedOrder{
		UserID:        userID,
		ServiceID:     sosmedService.ID,
		ServiceCode:   strings.TrimSpace(sosmedService.Code),
		ServiceTitle:  strings.TrimSpace(sosmedService.Title),
		TargetLink:    normalizeSosmedOrderTargetLink(input.TargetLink),
		Quantity:      quantity,
		UnitPrice:     sosmedService.CheckoutPrice,
		TotalPrice:    int64(totalPriceFloat),
		PaymentStatus: "pending",
		OrderStatus:   sosmedOrderStatusPendingPayment,
		Notes:         strings.TrimSpace(input.Notes),
		ExpiresAt:     &expiresAt,
	}

	if err := s.repo.Create(order); err != nil {
		return nil, errors.New("gagal membuat order sosmed")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: "",
		ToStatus:   sosmedOrderStatusPendingPayment,
		Reason:     "order dibuat",
		ActorType:  "user",
		ActorID:    &userID,
		CreatedAt:  now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return nil, errors.New("gagal mencatat event order sosmed")
	}

	stored, err := s.repo.FindByID(order.ID)
	if err != nil {
		return nil, errors.New("gagal memuat order sosmed")
	}
	return s.buildDetail(stored)
}

func (s *SosmedOrderService) GetByID(id, userID uuid.UUID) (*SosmedOrderDetail, error) {
	order, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("order sosmed tidak ditemukan")
	}
	if order.UserID != userID {
		return nil, errors.New("akses ditolak")
	}
	return s.buildDetail(order)
}

func (s *SosmedOrderService) ListByUser(userID uuid.UUID, page, limit int) ([]model.SosmedOrder, int64, error) {
	return s.repo.FindByUserID(userID, page, limit)
}

func (s *SosmedOrderService) Cancel(id, userID uuid.UUID) error {
	order, err := s.repo.FindByID(id)
	if err != nil {
		return errors.New("order sosmed tidak ditemukan")
	}
	if order.UserID != userID {
		return errors.New("akses ditolak")
	}
	if order.PaymentStatus != "pending" || order.OrderStatus != sosmedOrderStatusPendingPayment {
		return errors.New("order tidak bisa dibatalkan")
	}

	previousStatus := order.OrderStatus
	now := time.Now()
	order.PaymentStatus = "failed"
	order.OrderStatus = sosmedOrderStatusCanceled
	if err := s.repo.Update(order); err != nil {
		return errors.New("gagal membatalkan order sosmed")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: previousStatus,
		ToStatus:   sosmedOrderStatusCanceled,
		Reason:     "dibatalkan user",
		ActorType:  "user",
		ActorID:    &userID,
		CreatedAt:  now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return errors.New("gagal mencatat event cancel")
	}

	return nil
}

func (s *SosmedOrderService) ConfirmPayment(orderID uuid.UUID) error {
	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return errors.New("order sosmed tidak ditemukan")
	}

	if order.PaymentStatus == "paid" && (order.OrderStatus == sosmedOrderStatusProcessing || order.OrderStatus == sosmedOrderStatusSuccess) {
		return nil
	}

	previousStatus := order.OrderStatus
	now := time.Now()
	order.PaymentStatus = "paid"
	order.OrderStatus = sosmedOrderStatusProcessing
	order.PaidAt = &now
	if err := s.repo.Update(order); err != nil {
		return errors.New("gagal mengonfirmasi pembayaran sosmed")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: previousStatus,
		ToStatus:   sosmedOrderStatusProcessing,
		Reason:     "pembayaran terverifikasi",
		ActorType:  "system",
		CreatedAt:  now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return errors.New("gagal mencatat event pembayaran")
	}

	if s.notifRepo != nil {
		_ = s.notifRepo.Create(&model.Notification{
			UserID:  order.UserID,
			Title:   "Pembayaran Sosmed Berhasil",
			Message: "Order sosmed lu sudah masuk antrian proses.",
			Type:    "order",
		})
	}

	return nil
}

func (s *SosmedOrderService) AdminList(status string, page, limit int) ([]model.SosmedOrder, int64, error) {
	return s.repo.AdminList(normalizeSosmedOrderStatus(status), page, limit)
}

func (s *SosmedOrderService) AdminUpdateStatus(orderID uuid.UUID, actorID uuid.UUID, input AdminUpdateSosmedOrderStatusInput) (*SosmedOrderDetail, error) {
	toStatus := normalizeSosmedOrderStatus(input.ToStatus)
	if !isValidSosmedOrderStatus(toStatus) {
		return nil, errors.New("status order sosmed tidak valid")
	}

	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return nil, errors.New("order sosmed tidak ditemukan")
	}

	fromStatus := normalizeSosmedOrderStatus(order.OrderStatus)
	if fromStatus == toStatus {
		return s.buildDetail(order)
	}

	allowedTargets := sosmedAdminTransitionMatrix[fromStatus]
	if len(allowedTargets) == 0 || !allowedTargets[toStatus] {
		return nil, errors.New("transisi status tidak diizinkan")
	}

	order.OrderStatus = toStatus
	if toStatus == sosmedOrderStatusFailed || toStatus == sosmedOrderStatusCanceled || toStatus == sosmedOrderStatusExpired {
		if order.PaymentStatus == "pending" {
			order.PaymentStatus = "failed"
		}
	}
	if toStatus == sosmedOrderStatusSuccess && order.PaymentStatus == "pending" {
		order.PaymentStatus = "paid"
		now := time.Now()
		order.PaidAt = &now
	}

	if err := s.repo.Update(order); err != nil {
		return nil, errors.New("gagal update status order sosmed")
	}

	now := time.Now()
	event := &model.SosmedOrderEvent{
		OrderID:      order.ID,
		FromStatus:   fromStatus,
		ToStatus:     toStatus,
		Reason:       strings.TrimSpace(input.Reason),
		InternalNote: strings.TrimSpace(input.InternalNote),
		ActorType:    "admin",
		ActorID:      &actorID,
		CreatedAt:    now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return nil, errors.New("gagal mencatat event status order")
	}

	stored, err := s.repo.FindByID(order.ID)
	if err != nil {
		return nil, errors.New("gagal memuat order sosmed")
	}
	return s.buildDetail(stored)
}
