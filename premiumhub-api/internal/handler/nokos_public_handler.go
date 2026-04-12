package handler

import (
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type NokosPublicHandler struct {
	svc *service.NokosLandingSummaryService
}

func NewNokosPublicHandler(svc *service.NokosLandingSummaryService) *NokosPublicHandler {
	return &NokosPublicHandler{svc: svc}
}

func (h *NokosPublicHandler) GetLandingSummary(c *gin.Context) {
	res, err := h.svc.GetPublicSummary(c.Request.Context())
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}
