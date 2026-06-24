package handler

import (
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type PaymentMethodSettingHandler struct {
	svc *service.PaymentMethodSettingService
}

func NewPaymentMethodSettingHandler(svc *service.PaymentMethodSettingService) *PaymentMethodSettingHandler {
	return &PaymentMethodSettingHandler{svc: svc}
}

func (h *PaymentMethodSettingHandler) PublicList(c *gin.Context) {
	items, err := h.svc.PublicList()
	if err != nil {
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", items)
}

func (h *PaymentMethodSettingHandler) AdminList(c *gin.Context) {
	items, err := h.svc.List()
	if err != nil {
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", items)
}

func (h *PaymentMethodSettingHandler) AdminUpdate(c *gin.Context) {
	var input service.UpdatePaymentMethodSettingsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	items, err := h.svc.Update(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Setting metode pembayaran diperbarui", items)
}
