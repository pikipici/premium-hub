package handler

import (
	"math"
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
	stockRepo *repository.StockRepo
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

func NewAdminHandler(orderRepo *repository.OrderRepo, claimRepo *repository.ClaimRepo, userRepo *repository.UserRepo, stockRepo *repository.StockRepo, notifSvc *service.NotificationService) *AdminHandler {
	return &AdminHandler{orderRepo: orderRepo, claimRepo: claimRepo, userRepo: userRepo, stockRepo: stockRepo, notifSvc: notifSvc}
}

func (h *AdminHandler) Dashboard(c *gin.Context) {
	activeOrders, _ := h.orderRepo.CountByStatus("active")
	pendingOrders, _ := h.orderRepo.CountByStatus("pending")
	completedOrders, _ := h.orderRepo.CountByStatus("completed")
	totalRevenue, _ := h.orderRepo.TotalRevenue()
	pendingClaimsTotal, _ := h.claimRepo.CountPending()

	today := startOfDay(time.Now())
	monthStart := startOfMonth(today)
	analyticsSince := today.AddDate(0, 0, -120)

	recentOrders, err := h.orderRepo.AdminRecent(5)
	if err != nil {
		response.InternalError(c)
		return
	}

	analyticsOrders, err := h.orderRepo.AdminAnalyticsSince(analyticsSince)
	if err != nil {
		response.InternalError(c)
		return
	}

	pendingClaims, _, err := h.claimRepo.AdminList("pending", 1, 5)
	if err != nil {
		response.InternalError(c)
		return
	}

	monthlyClaimsCount, err := h.claimRepo.CountSince(monthStart)
	if err != nil {
		response.InternalError(c)
		return
	}

	stockSummary, err := h.stockRepo.AvailableSummaryByProduct()
	if err != nil {
		response.InternalError(c)
		return
	}

	_, activeUsersTotal, err := h.userRepo.List(1, 1, "", "active")
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", gin.H{
		"active_orders":        activeOrders,
		"pending_orders":       pendingOrders,
		"completed_orders":     completedOrders,
		"total_revenue":        totalRevenue,
		"pending_claims":       pendingClaimsTotal,
		"recent_orders":        recentOrders,
		"analytics_orders":     analyticsOrders,
		"pending_claim_rows":   pendingClaims,
		"monthly_claims_count": monthlyClaimsCount,
		"stock_summary":        stockSummary,
		"active_users_total":   activeUsersTotal,
	})
}

func startOfDay(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, value.Location())
}

func startOfMonth(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), 1, 0, 0, 0, 0, value.Location())
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
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
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
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
