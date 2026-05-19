package handler

import (
	"errors"
	"strings"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailWarrantyHandler handles 1×24h warranty endpoints.
//
// Auto-resolve flow: POST returns either replacement creds or refund
// confirmation atomically. Buyer never sees a "pending" state.
type GmailWarrantyHandler struct {
	svc *service.GmailWarrantyService
}

func NewGmailWarrantyHandler(svc *service.GmailWarrantyService) *GmailWarrantyHandler {
	return &GmailWarrantyHandler{svc: svc}
}

type CreateClaimInput struct {
	GmailAccountID string `json:"gmail_account_id" binding:"required"`
	Reason         string `json:"reason" binding:"required,min=3,max=255"`
}

// CreateClaim handles POST /api/v1/gmail/orders/:order_id/claims.
func (h *GmailWarrantyHandler) CreateClaim(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("order_id")))
	if err != nil {
		response.BadRequest(c, "ID order tidak valid")
		return
	}
	var input CreateClaimInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "Body request tidak valid (gmail_account_id + reason wajib)")
		return
	}
	gmailID, err := uuid.Parse(strings.TrimSpace(input.GmailAccountID))
	if err != nil {
		response.BadRequest(c, "gmail_account_id tidak valid")
		return
	}
	res, err := h.svc.CreateClaim(userID, orderID, gmailID, input.Reason)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Klaim diproses", res)
}

// ListByOrder handles GET /api/v1/gmail/orders/:order_id/claims.
func (h *GmailWarrantyHandler) ListByOrder(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("order_id")))
	if err != nil {
		response.BadRequest(c, "ID order tidak valid")
		return
	}
	rows, err := h.svc.ListByOrder(userID, orderID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "Order tidak ditemukan")
			return
		}
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", gin.H{"items": rows})
}
