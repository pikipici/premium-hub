package handler

import (
	"strconv"
	"strings"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MaintenanceHandler struct {
	svc *service.MaintenanceService
}

func NewMaintenanceHandler(svc *service.MaintenanceService) *MaintenanceHandler {
	return &MaintenanceHandler{svc: svc}
}

func (h *MaintenanceHandler) Evaluate(c *gin.Context) {
	path := strings.TrimSpace(c.Query("path"))

	result, err := h.svc.Evaluate(path, false)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", result)
}

func (h *MaintenanceHandler) AdminList(c *gin.Context) {
	includeInactive := true
	if raw := c.Query("include_inactive"); strings.TrimSpace(raw) != "" {
		parsed, err := strconv.ParseBool(raw)
		if err == nil {
			includeInactive = parsed
		}
	}

	rows, err := h.svc.List(includeInactive)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", rows)
}

func (h *MaintenanceHandler) AdminCreate(c *gin.Context) {
	var input service.CreateMaintenanceRuleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	row, err := h.svc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Rule maintenance berhasil dibuat", row)
}

func (h *MaintenanceHandler) AdminUpdate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	var input service.UpdateMaintenanceRuleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	row, err := h.svc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Rule maintenance diperbarui", row)
}

func (h *MaintenanceHandler) AdminDelete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	if err := h.svc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Rule maintenance dihapus", nil)
}
