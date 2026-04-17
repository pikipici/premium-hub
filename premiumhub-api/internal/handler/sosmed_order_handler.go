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

type SosmedOrderHandler struct {
	svc *service.SosmedOrderService
}

func NewSosmedOrderHandler(svc *service.SosmedOrderService) *SosmedOrderHandler {
	return &SosmedOrderHandler{svc: svc}
}

func (h *SosmedOrderHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateSosmedOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	detail, err := h.svc.Create(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Order sosmed berhasil dibuat", detail)
}

func (h *SosmedOrderHandler) List(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	orders, total, err := h.svc.ListByUser(userID, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}

	if limit < 1 {
		limit = 10
	}

	response.SuccessWithMeta(c, "OK", orders, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *SosmedOrderHandler) GetByID(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	detail, err := h.svc.GetByID(id, userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", detail)
}

func (h *SosmedOrderHandler) Cancel(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	if err := h.svc.Cancel(id, userID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Order sosmed dibatalkan", nil)
}

func (h *SosmedOrderHandler) AdminList(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	orders, total, err := h.svc.AdminList(status, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}

	if limit < 1 {
		limit = 20
	}

	response.SuccessWithMeta(c, "OK", orders, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *SosmedOrderHandler) AdminUpdateStatus(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	var input service.AdminUpdateSosmedOrderStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	detail, err := h.svc.AdminUpdateStatus(orderID, adminID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Status order sosmed diperbarui", detail)
}
