package service

import (
	"errors"
	"fmt"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type ClaimService struct {
	claimRepo *repository.ClaimRepo
	orderRepo *repository.OrderRepo
	stockRepo *repository.StockRepo
	notifRepo *repository.NotificationRepo
}

func NewClaimService(claimRepo *repository.ClaimRepo, orderRepo *repository.OrderRepo, stockRepo *repository.StockRepo, notifRepo *repository.NotificationRepo) *ClaimService {
	return &ClaimService{claimRepo: claimRepo, orderRepo: orderRepo, stockRepo: stockRepo, notifRepo: notifRepo}
}

type CreateClaimInput struct {
	OrderID       string `json:"order_id" binding:"required"`
	Reason        string `json:"reason" binding:"required"`
	Description   string `json:"description" binding:"required"`
	ScreenshotURL string `json:"screenshot_url"`
}

func (s *ClaimService) Create(userID uuid.UUID, input CreateClaimInput) (*model.Claim, error) {
	orderID, err := uuid.Parse(input.OrderID)
	if err != nil {
		return nil, errors.New("order_id tidak valid")
	}

	order, err := s.orderRepo.FindByID(orderID)
	if err != nil || order.UserID != userID {
		return nil, errors.New("order tidak ditemukan")
	}

	if order.OrderStatus != "active" {
		return nil, errors.New("order tidak aktif")
	}

	if order.ExpiresAt != nil && order.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("masa garansi sudah habis")
	}

	claim := &model.Claim{
		UserID:        userID,
		OrderID:       orderID,
		Reason:        input.Reason,
		Description:   input.Description,
		ScreenshotURL: input.ScreenshotURL,
		Status:        "pending",
	}

	if err := s.claimRepo.Create(claim); err != nil {
		return nil, errors.New("gagal membuat klaim")
	}
	return claim, nil
}

func (s *ClaimService) ListByUser(userID uuid.UUID, page, limit int) ([]model.Claim, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	return s.claimRepo.FindByUserID(userID, page, limit)
}

func (s *ClaimService) GetByID(id, userID uuid.UUID) (*model.Claim, error) {
	claim, err := s.claimRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("klaim tidak ditemukan")
	}
	if claim.UserID != userID {
		return nil, errors.New("akses ditolak")
	}
	return claim, nil
}

type AdminActionInput struct {
	AdminNote string `json:"admin_note"`
}

func (s *ClaimService) Approve(id uuid.UUID, input AdminActionInput) error {
	claim, err := s.claimRepo.FindByID(id)
	if err != nil {
		return errors.New("klaim tidak ditemukan")
	}

	order, _ := s.orderRepo.FindByID(claim.OrderID)

	// Find new stock
	newStock, err := s.stockRepo.FindAvailable(order.Price.ProductID, order.Price.AccountType, order.Price.Duration)
	if err != nil {
		return errors.New("stok pengganti tidak tersedia")
	}

	now := time.Now()
	claim.Status = "approved"
	claim.AdminNote = input.AdminNote
	claim.NewStockID = &newStock.ID
	claim.ResolvedAt = &now

	// Mark old stock as expired, assign new
	if order.Stock != nil {
		order.Stock.Status = "expired"
		s.stockRepo.Update(order.Stock)
	}

	newStock.Status = "used"
	newStock.UsedBy = &order.UserID
	newStock.UsedAt = &now
	expiry := now.AddDate(0, order.Price.Duration, 0)
	newStock.ExpiresAt = &expiry
	order.StockID = &newStock.ID
	order.ExpiresAt = &expiry

	s.stockRepo.Update(newStock)
	s.orderRepo.Update(order)
	s.claimRepo.Update(claim)

	s.notifRepo.Create(&model.Notification{
		UserID:  claim.UserID,
		Title:   "Klaim Disetujui",
		Message: fmt.Sprintf("Klaim garansi kamu telah disetujui. Akun baru sudah tersedia."),
		Type:    "claim",
	})

	return nil
}

func (s *ClaimService) Reject(id uuid.UUID, input AdminActionInput) error {
	claim, err := s.claimRepo.FindByID(id)
	if err != nil {
		return errors.New("klaim tidak ditemukan")
	}

	now := time.Now()
	claim.Status = "rejected"
	claim.AdminNote = input.AdminNote
	claim.ResolvedAt = &now

	s.claimRepo.Update(claim)

	s.notifRepo.Create(&model.Notification{
		UserID:  claim.UserID,
		Title:   "Klaim Ditolak",
		Message: fmt.Sprintf("Klaim garansi kamu ditolak. Alasan: %s", input.AdminNote),
		Type:    "claim",
	})

	return nil
}

func (s *ClaimService) AdminList(status string, page, limit int) ([]model.Claim, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	return s.claimRepo.AdminList(status, page, limit)
}
