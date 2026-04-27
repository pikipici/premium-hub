package handler

import (
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type NavbarMenuSettingHandler struct {
	svc *service.NavbarMenuSettingService
}

func NewNavbarMenuSettingHandler(svc *service.NavbarMenuSettingService) *NavbarMenuSettingHandler {
	return &NavbarMenuSettingHandler{svc: svc}
}

func (h *NavbarMenuSettingHandler) PublicList(c *gin.Context) {
	items, err := h.svc.PublicList()
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", items)
}

func (h *NavbarMenuSettingHandler) AdminList(c *gin.Context) {
	items, err := h.svc.List()
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", items)
}

func (h *NavbarMenuSettingHandler) AdminUpdate(c *gin.Context) {
	var input service.UpdateNavbarMenuSettingsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	items, err := h.svc.Update(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Setting navbar diperbarui", items)
}
