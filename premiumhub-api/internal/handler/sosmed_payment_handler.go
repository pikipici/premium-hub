package handler

import (
	"strings"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SosmedPaymentHandler struct {
	svc *service.SosmedPaymentService
}

func NewSosmedPaymentHandler(svc *service.SosmedPaymentService) *SosmedPaymentHandler {
	return &SosmedPaymentHandler{svc: svc}
}

func (h *SosmedPaymentHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateSosmedPaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.CreateTransaction(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Transaksi sosmed dibuat", res)
}

func (h *SosmedPaymentHandler) GetStatus(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("orderId")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	order, err := h.svc.GetStatus(orderID, userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", gin.H{
		"order_id":       order.ID,
		"payment_status": order.PaymentStatus,
		"order_status":   order.OrderStatus,
		"total_price":    order.TotalPrice,
	})
}
