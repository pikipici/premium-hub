package handler

import (
	"math"
	"strconv"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ClaimHandler struct {
	claimSvc *service.ClaimService
}

func NewClaimHandler(claimSvc *service.ClaimService) *ClaimHandler {
	return &ClaimHandler{claimSvc: claimSvc}
}

func (h *ClaimHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateClaimInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	claim, err := h.claimSvc.Create(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Klaim berhasil diajukan", claim)
}

func (h *ClaimHandler) List(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	claims, total, err := h.claimSvc.ListByUser(userID, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", claims, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *ClaimHandler) GetByID(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	claim, err := h.claimSvc.GetByID(id, userID)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, "OK", claim)
}

func (h *ClaimHandler) AdminList(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	claims, total, err := h.claimSvc.AdminList(status, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", claims, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *ClaimHandler) Approve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var input service.AdminActionInput
	c.ShouldBindJSON(&input)
	if err := h.claimSvc.Approve(id, input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Klaim disetujui", nil)
}

func (h *ClaimHandler) Reject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var input service.AdminActionInput
	c.ShouldBindJSON(&input)
	if err := h.claimSvc.Reject(id, input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Klaim ditolak", nil)
}
