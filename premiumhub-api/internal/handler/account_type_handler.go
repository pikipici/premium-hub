package handler

import (
	"strconv"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AccountTypeHandler struct {
	svc *service.AccountTypeService
}

func NewAccountTypeHandler(svc *service.AccountTypeService) *AccountTypeHandler {
	return &AccountTypeHandler{svc: svc}
}

func (h *AccountTypeHandler) List(c *gin.Context) {
	includeInactive := false
	if raw := c.Query("include_inactive"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err == nil {
			includeInactive = parsed
		}
	}

	items, err := h.svc.List(includeInactive)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", items)
}

func (h *AccountTypeHandler) Create(c *gin.Context) {
	var input service.CreateAccountTypeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	item, err := h.svc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Tipe akun berhasil dibuat", item)
}

func (h *AccountTypeHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	var input service.UpdateAccountTypeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	item, err := h.svc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Tipe akun diperbarui", item)
}

func (h *AccountTypeHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	if err := h.svc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Tipe akun dinonaktifkan", nil)
}
