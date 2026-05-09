package handler

import (
	"math"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type WalletHandler struct {
	walletSvc *service.WalletService
	reconSvc  *service.WalletReconciliationService
}

func NewWalletHandler(walletSvc *service.WalletService) *WalletHandler {
	return &WalletHandler{walletSvc: walletSvc}
}

func (h *WalletHandler) SetReconciliationService(reconSvc *service.WalletReconciliationService) *WalletHandler {
	h.reconSvc = reconSvc
	return h
}

func (h *WalletHandler) Balance(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.walletSvc.GetBalance(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *WalletHandler) CreateTopup(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateTopupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if strings.TrimSpace(input.IdempotencyKey) == "" {
		input.IdempotencyKey = c.GetHeader("Idempotency-Key")
	}

	res, err := h.walletSvc.CreateTopup(c.Request.Context(), userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Invoice topup dibuat", res)
}

func (h *WalletHandler) ListTopups(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)

	res, err := h.walletSvc.ListTopups(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMeta(c, "OK", res.Topups, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      res.Total,
		TotalPages: int(math.Ceil(float64(res.Total) / float64(limit))),
	})
}

func (h *WalletHandler) GetTopup(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	topupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID topup tidak valid")
		return
	}

	res, err := h.walletSvc.GetTopupByID(userID, topupID)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *WalletHandler) CheckTopup(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	topupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID topup tidak valid")
		return
	}

	res, err := h.walletSvc.CheckTopupStatus(c.Request.Context(), userID, topupID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Status topup diperbarui", res)
}

func (h *WalletHandler) ListLedger(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)

	res, err := h.walletSvc.ListLedger(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMeta(c, "OK", res.Ledgers, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      res.Total,
		TotalPages: int(math.Ceil(float64(res.Total) / float64(limit))),
	})
}

func (h *WalletHandler) AdminRecheckTopup(c *gin.Context) {
	topupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID topup tidak valid")
		return
	}

	res, err := h.walletSvc.AdminRecheckTopup(c.Request.Context(), topupID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Recheck topup selesai", res)
}

func (h *WalletHandler) ReconcilePending(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(DefaultAuditReportLimit)))
	if limit <= 0 {
		limit = DefaultAuditReportLimit
	}
	if limit > MaxBatchActionLimit {
		limit = MaxBatchActionLimit
	}

	res, err := h.walletSvc.ReconcilePending(c.Request.Context(), limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Rekonsiliasi selesai", res)
}

func (h *WalletHandler) AdminReconciliationReport(c *gin.Context) {
	if h.reconSvc == nil {
		response.BadRequest(c, "wallet reconciliation belum siap")
		return
	}
	filter, err := parseWalletReconciliationFilter(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	res, err := h.reconSvc.Report(filter)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *WalletHandler) AdminRepairReconciliation(c *gin.Context) {
	if h.reconSvc == nil {
		response.BadRequest(c, "wallet reconciliation belum siap")
		return
	}
	actorID := c.MustGet("user_id").(uuid.UUID)
	var input struct {
		IssueKey string `json:"issue_key" binding:"required"`
		Action   string `json:"action" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	res, err := h.reconSvc.Repair(input.IssueKey, input.Action, actorID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Repair selesai", res)
}

func parseWalletReconciliationFilter(c *gin.Context) (service.WalletReconciliationFilter, error) {
	limit := parseLimit(c, DefaultAuditReportLimit, MaxAuditReportLimit)
	filter := service.WalletReconciliationFilter{Limit: limit}
	if raw := strings.TrimSpace(c.Query("from")); raw != "" {
		from, err := parseWalletReconciliationTime(raw)
		if err != nil {
			return filter, err
		}
		filter.From = &from
	}
	if raw := strings.TrimSpace(c.Query("to")); raw != "" {
		to, err := parseWalletReconciliationTime(raw)
		if err != nil {
			return filter, err
		}
		filter.To = &to
	}
	if raw := strings.TrimSpace(c.Query("user_id")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return filter, err
		}
		filter.UserID = &id
	}
	if raw := strings.TrimSpace(c.Query("order_id")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return filter, err
		}
		filter.OrderID = &id
	}
	return filter, nil
}

func parseWalletReconciliationTime(raw string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return t, nil
	}
	return time.Time{}, strconv.ErrSyntax
}
