package handler

import (
	"strconv"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ProductCategoryHandler struct {
	svc *service.ProductCategoryService
}

func NewProductCategoryHandler(svc *service.ProductCategoryService) *ProductCategoryHandler {
	return &ProductCategoryHandler{svc: svc}
}

func (h *ProductCategoryHandler) List(c *gin.Context) {
	scope := c.Query("scope")
	includeInactive := false
	if raw := c.Query("include_inactive"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err == nil {
			includeInactive = parsed
		}
	}

	items, err := h.svc.List(scope, includeInactive)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", items)
}

func (h *ProductCategoryHandler) Create(c *gin.Context) {
	var input service.CreateProductCategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	item, err := h.svc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Kategori berhasil dibuat", item)
}

func (h *ProductCategoryHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	var input service.UpdateProductCategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	item, err := h.svc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Kategori diperbarui", item)
}

func (h *ProductCategoryHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	if err := h.svc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Kategori dinonaktifkan", nil)
}
