package handler

import (
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PaymentHandler struct {
	paymentSvc *service.PaymentService
	webhookSvc *service.PakasirWebhookService
}

func NewPaymentHandler(paymentSvc *service.PaymentService, webhookSvc *service.PakasirWebhookService) *PaymentHandler {
	return &PaymentHandler{paymentSvc: paymentSvc, webhookSvc: webhookSvc}
}

func (h *PaymentHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreatePaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	res, err := h.paymentSvc.CreateTransaction(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Transaksi dibuat", res)
}

func (h *PaymentHandler) Webhook(c *gin.Context) {
	var input service.WebhookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if h.webhookSvc != nil {
		if err := h.webhookSvc.Handle(c.Request.Context(), input); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		response.Success(c, "OK", gin.H{"acknowledged": true})
		return
	}

	if err := h.paymentSvc.HandleWebhook(input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", gin.H{"acknowledged": true})
}

func (h *PaymentHandler) GetStatus(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	order, err := h.paymentSvc.GetStatus(orderID, userID)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, "OK", gin.H{
		"order_id":       order.ID,
		"payment_status": order.PaymentStatus,
		"order_status":   order.OrderStatus,
		"total_price":    order.TotalPrice,
	})
}
