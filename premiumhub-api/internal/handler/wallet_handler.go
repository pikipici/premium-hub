package handler

import (
	"math"
	"strconv"
	"strings"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type WalletHandler struct {
	walletSvc *service.WalletService
}

func NewWalletHandler(walletSvc *service.WalletService) *WalletHandler {
	return &WalletHandler{walletSvc: walletSvc}
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
	page, limit := parsePagination(c, 20, 100)

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
	page, limit := parsePagination(c, 20, 100)

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
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "200"))
	if limit <= 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}

	res, err := h.walletSvc.ReconcilePending(c.Request.Context(), limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Rekonsiliasi selesai", res)
}

func (h *WalletHandler) PakasirWebhook(c *gin.Context) {
	var input service.WalletPakasirWebhookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if err := h.walletSvc.HandlePakasirWebhook(c.Request.Context(), input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", gin.H{"acknowledged": true})
}

func parsePagination(c *gin.Context, defaultLimit, maxLimit int) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(defaultLimit)))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	return page, limit
}
