package handler

import (
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type JAPHandler struct {
	svc *service.JAPService
}

func NewJAPHandler(svc *service.JAPService) *JAPHandler {
	return &JAPHandler{svc: svc}
}

func (h *JAPHandler) GetBalance(c *gin.Context) {
	res, err := h.svc.GetBalance(c.Request.Context())
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", res)
}

func (h *JAPHandler) GetServices(c *gin.Context) {
	res, err := h.svc.GetServices(c.Request.Context())
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", res)
}
