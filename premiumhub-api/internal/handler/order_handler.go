package handler

import (
	"math"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrderHandler struct {
	orderSvc *service.OrderService
}

func NewOrderHandler(orderSvc *service.OrderService) *OrderHandler {
	return &OrderHandler{orderSvc: orderSvc}
}

func (h *OrderHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	order, err := h.orderSvc.Create(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Order berhasil dibuat", order)
}

func (h *OrderHandler) CreateGuest(c *gin.Context) {
	var input service.CreateGuestOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	order, err := h.orderSvc.CreateGuest(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Order guest berhasil dibuat", order)
}

func (h *OrderHandler) List(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, DefaultCustomerPageLimit, MaxPageLimit)

	orders, total, err := h.orderSvc.ListByUser(userID, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", orders, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *OrderHandler) ResendGuestInvoice(c *gin.Context) {
	var input service.ResendGuestInvoiceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.orderSvc.ResendGuestInvoice(input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Jika data cocok, link invoice sudah dikirim", nil)
}

func (h *OrderHandler) GetGuestOrderStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	status, err := h.orderSvc.GetGuestOrderStatus(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, "OK", status)
}

func (h *OrderHandler) GetGuestByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	order, err := h.orderSvc.GetGuestByID(id, c.Query("token"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, "OK", order)
}

func (h *OrderHandler) GetByID(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	order, err := h.orderSvc.GetByID(id, userID)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, "OK", order)
}

func (h *OrderHandler) Cancel(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.orderSvc.Cancel(id, userID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Order dibatalkan", nil)
}

func (h *OrderHandler) AdminList(c *gin.Context) {
	status := c.Query("status")
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	orders, total, err := h.orderSvc.AdminList(status, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", orders, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *OrderHandler) Confirm(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.orderSvc.ConfirmPayment(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Order dikonfirmasi", nil)
}

func (h *OrderHandler) SendAccount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.orderSvc.ManualSendAccount(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Akun terkirim", nil)
}
