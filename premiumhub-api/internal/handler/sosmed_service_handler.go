package handler

import (
	"errors"
	"io"
	"strconv"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SosmedServiceHandler struct {
	svc *service.SosmedServiceService
}

func NewSosmedServiceHandler(svc *service.SosmedServiceService) *SosmedServiceHandler {
	return &SosmedServiceHandler{svc: svc}
}

func (h *SosmedServiceHandler) PublicList(c *gin.Context) {
	items, err := h.svc.List(false)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", items)
}

func (h *SosmedServiceHandler) AdminList(c *gin.Context) {
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

func (h *SosmedServiceHandler) Create(c *gin.Context) {
	var input service.CreateSosmedServiceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	item, err := h.svc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Layanan sosmed berhasil dibuat", item)
}

func (h *SosmedServiceHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	var input service.UpdateSosmedServiceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	item, err := h.svc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Layanan sosmed diperbarui", item)
}

func (h *SosmedServiceHandler) RepriceReseller(c *gin.Context) {
	var input service.RepriceSosmedResellerInput
	if err := c.ShouldBindJSON(&input); err != nil && !errors.Is(err, io.EOF) {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.RepriceResellerToIDR(c.Request.Context(), input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Sinkronisasi harga reseller selesai", res)
}

func (h *SosmedServiceHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	if err := h.svc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Layanan sosmed dinonaktifkan", nil)
}
