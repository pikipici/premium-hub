package handler

import (
	"errors"
	"math"
	"strings"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailHandler exposes the sell-side flow + admin verify queue. Buy-side
// will be added in Round 2 alongside the Product/Order integration.
type GmailHandler struct {
	svc *service.GmailService
}

func NewGmailHandler(svc *service.GmailService) *GmailHandler {
	return &GmailHandler{svc: svc}
}

// ----- user endpoints -----

// RequestSlot handles POST /api/v1/gmail/slots — generates a fresh
// (email, password) pair the user must use when manually creating a
// gmail account at Google. Plain password is shown ONCE.
func (h *GmailHandler) RequestSlot(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.RequestSlot(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Slot setor gmail siap. Buat akun pakai kredensial ini lalu submit.", res)
}

// SubmitSlot handles POST /api/v1/gmail/slots/:id/submit — moves the
// slot from pending_create to pending_verify (admin queue).
func (h *GmailHandler) SubmitSlot(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID slot tidak valid")
		return
	}
	res, err := h.svc.SubmitSlot(userID, id)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Setoran masuk antrian verifikasi", res)
}

// ListMine handles GET /api/v1/gmail/slots — paginated history with
// optional ?status= filter.
func (h *GmailHandler) ListMine(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, DefaultCustomerPageLimit, MaxPageLimit)
	status := strings.TrimSpace(c.Query("status"))
	rows, total, err := h.svc.ListMySlots(userID, status, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", gin.H{"items": rows}, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

// GetMine handles GET /api/v1/gmail/slots/:id — scoped lookup.
func (h *GmailHandler) GetMine(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID slot tidak valid")
		return
	}
	g, err := h.svc.GetMine(userID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "Slot tidak ditemukan")
			return
		}
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", g)
}

// ----- admin endpoints -----

// AdminListPendingVerify handles GET /api/v1/admin/gmail/queue.
func (h *GmailHandler) AdminListPendingVerify(c *gin.Context) {
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	rows, total, err := h.svc.AdminListPendingVerify(page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", gin.H{"items": rows}, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

// AdminGetByID handles GET /api/v1/admin/gmail/:id — returns full row.
// Use AdminGetCredentials for the decrypted creds.
func (h *GmailHandler) AdminGetByID(c *gin.Context) {
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	g, err := h.svc.AdminGetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "Gmail tidak ditemukan")
			return
		}
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", g)
}

// AdminGetCredentials handles GET /api/v1/admin/gmail/:id/credentials —
// returns decrypted (email, password) for admin verification login.
func (h *GmailHandler) AdminGetCredentials(c *gin.Context) {
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	email, pw, err := h.svc.AdminGetCredentials(id)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", gin.H{"email": email, "password": pw})
}

// AdminVerifyInput is the body for verify — admin must supply the new
// password they rotated to (typed manually after login + recovery
// check).
type AdminVerifyInput struct {
	NewPassword string `json:"new_password" binding:"required"`
}

// AdminVerify handles POST /api/v1/admin/gmail/:id/verify.
func (h *GmailHandler) AdminVerify(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var input AdminVerifyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "Password baru wajib diisi")
		return
	}
	g, err := h.svc.AdminVerify(adminID, id, input.NewPassword)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Akun terverifikasi", g)
}

// AdminRejectInput is the body for reject — reason from enum + free
// note.
type AdminRejectInput struct {
	Reason string `json:"reason" binding:"required"`
	Note   string `json:"note"`
}

// AdminReject handles POST /api/v1/admin/gmail/:id/reject.
func (h *GmailHandler) AdminReject(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var input AdminRejectInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "Reason wajib diisi")
		return
	}
	g, err := h.svc.AdminReject(adminID, id, input.Reason, input.Note)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Setoran ditolak", g)
}
