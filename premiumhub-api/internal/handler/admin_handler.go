package handler

import (
	"math"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminHandler struct {
	orderRepo *repository.OrderRepo
	claimRepo *repository.ClaimRepo
	userRepo  *repository.UserRepo
	notifSvc  *service.NotificationService
}

type AdminUserListItem struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	Email         string     `json:"email"`
	Phone         string     `json:"phone"`
	Role          string     `json:"role"`
	IsActive      bool       `json:"is_active"`
	WalletBalance int64      `json:"wallet_balance"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	TotalOrders   int64      `json:"total_orders"`
	PaidOrders    int64      `json:"paid_orders"`
	TotalSpent    int64      `json:"total_spent"`
	ActiveOrders  int64      `json:"active_orders"`
	LastOrderAt   *time.Time `json:"last_order_at"`
}

func NewAdminHandler(orderRepo *repository.OrderRepo, claimRepo *repository.ClaimRepo, userRepo *repository.UserRepo, notifSvc *service.NotificationService) *AdminHandler {
	return &AdminHandler{orderRepo: orderRepo, claimRepo: claimRepo, userRepo: userRepo, notifSvc: notifSvc}
}

func (h *AdminHandler) Dashboard(c *gin.Context) {
	activeOrders, _ := h.orderRepo.CountByStatus("active")
	pendingOrders, _ := h.orderRepo.CountByStatus("pending")
	completedOrders, _ := h.orderRepo.CountByStatus("completed")
	totalRevenue, _ := h.orderRepo.TotalRevenue()
	pendingClaims, _ := h.claimRepo.CountPending()

	response.Success(c, "OK", gin.H{
		"active_orders":    activeOrders,
		"pending_orders":   pendingOrders,
		"completed_orders": completedOrders,
		"total_revenue":    totalRevenue,
		"pending_claims":   pendingClaims,
	})
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, limit := parsePageLimit(c, 20, 100)
	search := strings.TrimSpace(c.Query("search"))
	status := strings.TrimSpace(c.Query("status"))

	users, total, err := h.userRepo.List(page, limit, search, status)
	if err != nil {
		response.InternalError(c)
		return
	}

	userIDs := make([]uuid.UUID, 0, len(users))
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	statsByUserID, err := h.orderRepo.StatsByUserIDs(userIDs)
	if err != nil {
		response.InternalError(c)
		return
	}

	payload := make([]AdminUserListItem, 0, len(users))
	for _, user := range users {
		stats := statsByUserID[user.ID]
		payload = append(payload, AdminUserListItem{
			ID:            user.ID,
			Name:          user.Name,
			Email:         user.Email,
			Phone:         user.Phone,
			Role:          user.Role,
			IsActive:      user.IsActive,
			WalletBalance: user.WalletBalance,
			CreatedAt:     user.CreatedAt,
			UpdatedAt:     user.UpdatedAt,
			TotalOrders:   stats.TotalOrders,
			PaidOrders:    stats.PaidOrders,
			TotalSpent:    stats.TotalSpent,
			ActiveOrders:  stats.ActiveOrders,
			LastOrderAt:   stats.LastOrderAt,
		})
	}

	response.SuccessWithMeta(c, "OK", payload, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *AdminHandler) BlockUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	user, err := h.userRepo.FindByID(id)
	if err != nil {
		response.NotFound(c, "User tidak ditemukan")
		return
	}
	user.IsActive = !user.IsActive
	h.userRepo.Update(user)
	status := "diblokir"
	if user.IsActive {
		status = "dibuka blokirnya"
	}
	response.Success(c, "User "+status, user)
}

type UserHandler struct {
	authSvc  *service.AuthService
	notifSvc *service.NotificationService
}

func NewUserHandler(authSvc *service.AuthService, notifSvc *service.NotificationService) *UserHandler {
	return &UserHandler{authSvc: authSvc, notifSvc: notifSvc}
}

func (h *UserHandler) GetNotifications(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	notifs, total, err := h.notifSvc.List(userID, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	unread, _ := h.notifSvc.CountUnread(userID)
	response.SuccessWithMeta(c, "OK", gin.H{
		"notifications": notifs,
		"unread_count":  unread,
	}, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *UserHandler) MarkNotificationRead(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.notifSvc.MarkRead(id, userID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Notifikasi ditandai sudah dibaca", nil)
}
