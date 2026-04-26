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

	detail, err := h.svc.Create(c.Request.Context(), userID, input)
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

func (h *SosmedOrderHandler) AdminOpsSummary(c *gin.Context) {
	staleMinutes, _ := strconv.Atoi(c.DefaultQuery("stale_minutes", "30"))

	summary, err := h.svc.AdminOpsSummary(staleMinutes)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", summary)
}

func (h *SosmedOrderHandler) AdminGetByID(c *gin.Context) {
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	detail, err := h.svc.AdminGetByID(orderID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", detail)
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

func (h *SosmedOrderHandler) AdminSyncProvider(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	detail, err := h.svc.AdminSyncProviderStatus(c.Request.Context(), orderID, adminID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Status provider berhasil disinkronkan", detail)
}

func (h *SosmedOrderHandler) AdminSyncProcessingProviders(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	result, err := h.svc.AdminSyncProcessingProviderOrders(c.Request.Context(), adminID, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Sync provider selesai", result)
}

func (h *SosmedOrderHandler) AdminRetryProvider(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	var input service.AdminRetrySosmedProviderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	detail, err := h.svc.AdminRetryProviderOrder(c.Request.Context(), orderID, adminID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Retry provider berhasil dikirim", detail)
}

func (h *SosmedOrderHandler) RequestRefill(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	detail, err := h.svc.UserRequestRefill(c.Request.Context(), orderID, userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Permintaan refill berhasil dikirim ke supplier", detail)
}

func (h *SosmedOrderHandler) AdminTriggerRefill(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	detail, err := h.svc.AdminTriggerRefill(c.Request.Context(), orderID, adminID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Refill admin berhasil dikirim ke supplier", detail)
}
