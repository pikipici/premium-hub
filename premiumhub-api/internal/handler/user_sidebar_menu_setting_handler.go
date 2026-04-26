package handler

import (
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type UserSidebarMenuSettingHandler struct {
	svc *service.UserSidebarMenuSettingService
}

func NewUserSidebarMenuSettingHandler(svc *service.UserSidebarMenuSettingService) *UserSidebarMenuSettingHandler {
	return &UserSidebarMenuSettingHandler{svc: svc}
}

func (h *UserSidebarMenuSettingHandler) List(c *gin.Context) {
	items, err := h.svc.List()
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", items)
}

func (h *UserSidebarMenuSettingHandler) AdminUpdate(c *gin.Context) {
	var input service.UpdateUserSidebarMenuSettingsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	items, err := h.svc.Update(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Setting menu user diperbarui", items)
}
