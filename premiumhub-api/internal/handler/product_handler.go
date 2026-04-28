package handler

import (
	"math"
	"strings"

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
	page, limit := parsePageLimit(c, 12, 100)

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
	page, limit := parsePageLimit(c, 20, 100)
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

func (h *ProductHandler) UploadAsset(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}

	kind := strings.TrimSpace(c.PostForm("kind"))
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "file asset wajib diisi")
		return
	}

	assetURL, err := h.productSvc.UploadAsset(id, kind, file)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Asset produk berhasil diupload", gin.H{"url": assetURL})
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
	response.Success(c, "Produk diarsipkan", nil)
}

func (h *ProductHandler) DeletePermanent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.productSvc.DeletePermanent(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Produk dihapus permanen", nil)
}

func (h *ProductHandler) CreatePrice(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID produk tidak valid")
		return
	}

	var input service.CreateProductPriceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	price, err := h.productSvc.CreatePrice(productID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Harga produk berhasil dibuat", price)
}

func (h *ProductHandler) UpdatePrice(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID produk tidak valid")
		return
	}
	priceID, err := uuid.Parse(c.Param("priceId"))
	if err != nil {
		response.BadRequest(c, "ID harga tidak valid")
		return
	}

	var input service.UpdateProductPriceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	price, err := h.productSvc.UpdatePrice(productID, priceID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Harga produk diperbarui", price)
}

func (h *ProductHandler) DeletePrice(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID produk tidak valid")
		return
	}
	priceID, err := uuid.Parse(c.Param("priceId"))
	if err != nil {
		response.BadRequest(c, "ID harga tidak valid")
		return
	}

	if err := h.productSvc.DeletePrice(productID, priceID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Harga produk dinonaktifkan", nil)
}
