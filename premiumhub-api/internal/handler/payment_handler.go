package handler

import (
	"strconv"
	"strings"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PaymentHandler struct {
	paymentSvc *service.PaymentService
	webhookSvc *service.PaymentWebhookService
}

func NewPaymentHandler(paymentSvc *service.PaymentService, webhookSvc *service.PaymentWebhookService) *PaymentHandler {
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
	input, err := bindPaymentWebhookInput(c)
	if err != nil {
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

func bindPaymentWebhookInput(c *gin.Context) (service.WebhookInput, error) {
	contentType := strings.ToLower(c.GetHeader("Content-Type"))
	if strings.Contains(contentType, "application/x-www-form-urlencoded") || strings.Contains(contentType, "multipart/form-data") {
		if err := c.Request.ParseForm(); err != nil {
			return service.WebhookInput{}, err
		}
		amount, err := parsePaymentWebhookAmount(c.PostForm("amount"))
		if err != nil {
			return service.WebhookInput{}, err
		}
		return service.WebhookInput{
			Amount:        amount,
			OrderID:       c.PostForm("merchantOrderId"),
			Project:       c.PostForm("merchantCode"),
			Status:        c.PostForm("resultCode"),
			PaymentMethod: c.PostForm("paymentCode"),
			CompletedAt:   c.PostForm("settlementDate"),
			Reference:     c.PostForm("reference"),
			Signature:     c.PostForm("signature"),
		}, nil
	}

	var input service.WebhookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		return service.WebhookInput{}, err
	}
	return input, nil
}

func parsePaymentWebhookAmount(raw string) (int64, error) {
	value := strings.TrimSpace(raw)
	if dot := strings.Index(value, "."); dot >= 0 {
		value = value[:dot]
	}
	return strconv.ParseInt(value, 10, 64)
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
