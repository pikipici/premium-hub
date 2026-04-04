package handler

import (
	"math"
	"strconv"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ProductHandler struct {
	productSvc *service.ProductService
}

func NewProductHandler(productSvc *service.ProductService) *ProductHandler {
	return &ProductHandler{productSvc: productSvc}
}

func (h *ProductHandler) List(c *gin.Context) {
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "12"))

	products, total, err := h.productSvc.List(category, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.SuccessWithMeta(c, "OK", products, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *ProductHandler) GetBySlug(c *gin.Context) {
	slug := c.Param("slug")
	product, err := h.productSvc.GetBySlug(slug)
	if err != nil {
		response.NotFound(c, "Produk tidak ditemukan")
		return
	}
	response.Success(c, "OK", product)
}

func (h *ProductHandler) GetPrices(c *gin.Context) {
	slug := c.Param("slug")
	product, err := h.productSvc.GetBySlug(slug)
	if err != nil {
		response.NotFound(c, "Produk tidak ditemukan")
		return
	}
	response.Success(c, "OK", product.Prices)
}

func (h *ProductHandler) AdminList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	products, total, err := h.productSvc.AdminList(page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", products, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *ProductHandler) Create(c *gin.Context) {
	var input service.CreateProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	product, err := h.productSvc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Produk berhasil dibuat", product)
}

func (h *ProductHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var input service.UpdateProductInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	product, err := h.productSvc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Produk diperbarui", product)
}

func (h *ProductHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.productSvc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Produk dihapus", nil)
}
