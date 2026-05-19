package handler

import (
	"math"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// WalletWithdrawalHandler exposes the user-facing + admin-facing
// HTTP surface for the wallet withdrawal flow. State transitions and
// money movement live entirely in the service layer; this handler is
// only request decoding + response shaping.
type WalletWithdrawalHandler struct {
	svc *service.WalletWithdrawalService
}

func NewWalletWithdrawalHandler(svc *service.WalletWithdrawalService) *WalletWithdrawalHandler {
	return &WalletWithdrawalHandler{svc: svc}
}

// ----- User endpoints -----

// Create handles POST /api/v1/wallet/withdrawals.
func (h *WalletWithdrawalHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateWithdrawalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	w, err := h.svc.CreateRequest(c.Request.Context(), userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Permintaan withdraw dibuat", w)
}

// ListMine handles GET /api/v1/wallet/withdrawals.
func (h *WalletWithdrawalHandler) ListMine(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	rows, total, err := h.svc.ListMine(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", rows, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

// GetMine handles GET /api/v1/wallet/withdrawals/:id.
func (h *WalletWithdrawalHandler) GetMine(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "id tidak valid")
		return
	}
	w, err := h.svc.GetMine(userID, id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, "OK", w)
}

// Cancel handles POST /api/v1/wallet/withdrawals/:id/cancel.
func (h *WalletWithdrawalHandler) Cancel(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "id tidak valid")
		return
	}
	w, err := h.svc.Cancel(c.Request.Context(), userID, id)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Permintaan withdraw dibatalkan", w)
}

// Destinations handles GET /api/v1/wallet/withdrawals/destinations.
// Returns the static list of supported banks + e-wallets along with
// the daily limit / fee policy so the frontend doesn't have to
// hardcode anything. Policy values come from the service so they
// reflect runtime config (env-tunable).
func (h *WalletWithdrawalHandler) Destinations(c *gin.Context) {
	response.Success(c, "OK", gin.H{
		"destinations": model.SupportedWithdrawalDestinations(),
		"policy":       h.svc.Policy(),
	})
}

// ----- Admin endpoints -----

// AdminList handles GET /api/v1/admin/wallet/withdrawals.
func (h *WalletWithdrawalHandler) AdminList(c *gin.Context) {
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	filters := repository.AdminListFilters{
		Status: strings.TrimSpace(c.Query("status")),
	}
	if uidStr := strings.TrimSpace(c.Query("user_id")); uidStr != "" {
		if uid, err := uuid.Parse(uidStr); err == nil {
			filters.UserID = &uid
		}
	}
	rows, total, err := h.svc.ListAdmin(filters, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", rows, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

// AdminGet handles GET /api/v1/admin/wallet/withdrawals/:id.
func (h *WalletWithdrawalHandler) AdminGet(c *gin.Context) {
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "id tidak valid")
		return
	}
	w, err := h.svc.GetAdmin(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, "OK", w)
}

type adminWithdrawalNoteInput struct {
	Note string `json:"note"`
}

type adminWithdrawalReasonInput struct {
	Reason string `json:"reason" binding:"required"`
}

type adminWithdrawalMarkPaidInput struct {
	PayoutRailKind string `json:"payout_rail_kind"`
	PayoutRailRef  string `json:"payout_rail_ref"`
}

// AdminApprove handles POST /api/v1/admin/wallet/withdrawals/:id/approve.
func (h *WalletWithdrawalHandler) AdminApprove(c *gin.Context) {
	adminID, id, ok := h.parseAdminAndID(c)
	if !ok {
		return
	}
	var input adminWithdrawalNoteInput
	_ = c.ShouldBindJSON(&input)
	w, err := h.svc.Approve(c.Request.Context(), adminID, id, input.Note)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Withdraw disetujui", w)
}

// AdminReject handles POST /api/v1/admin/wallet/withdrawals/:id/reject.
func (h *WalletWithdrawalHandler) AdminReject(c *gin.Context) {
	adminID, id, ok := h.parseAdminAndID(c)
	if !ok {
		return
	}
	var input adminWithdrawalReasonInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "alasan penolakan wajib diisi")
		return
	}
	w, err := h.svc.Reject(c.Request.Context(), adminID, id, input.Reason)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Withdraw ditolak", w)
}

// AdminMarkProcessing handles POST /api/v1/admin/wallet/withdrawals/:id/mark-processing.
func (h *WalletWithdrawalHandler) AdminMarkProcessing(c *gin.Context) {
	adminID, id, ok := h.parseAdminAndID(c)
	if !ok {
		return
	}
	w, err := h.svc.MarkProcessing(c.Request.Context(), adminID, id)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Withdraw sedang diproses", w)
}

// AdminMarkPaid handles POST /api/v1/admin/wallet/withdrawals/:id/mark-paid.
func (h *WalletWithdrawalHandler) AdminMarkPaid(c *gin.Context) {
	adminID, id, ok := h.parseAdminAndID(c)
	if !ok {
		return
	}
	var input adminWithdrawalMarkPaidInput
	_ = c.ShouldBindJSON(&input)
	w, err := h.svc.MarkPaid(c.Request.Context(), adminID, id, input.PayoutRailKind, input.PayoutRailRef)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Withdraw berhasil dicairkan", w)
}

// AdminMarkFailed handles POST /api/v1/admin/wallet/withdrawals/:id/mark-failed.
func (h *WalletWithdrawalHandler) AdminMarkFailed(c *gin.Context) {
	adminID, id, ok := h.parseAdminAndID(c)
	if !ok {
		return
	}
	var input adminWithdrawalReasonInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "alasan kegagalan wajib diisi")
		return
	}
	w, err := h.svc.MarkFailed(c.Request.Context(), adminID, id, input.Reason)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Withdraw ditandai gagal", w)
}

// parseAdminAndID extracts admin user_id (from JWT) + :id from the URL.
// Returns ok=false and writes the response itself if either is invalid.
func (h *WalletWithdrawalHandler) parseAdminAndID(c *gin.Context) (uuid.UUID, uuid.UUID, bool) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "id tidak valid")
		return uuid.Nil, uuid.Nil, false
	}
	return adminID, id, true
}
