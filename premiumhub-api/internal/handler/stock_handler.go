package handler

import (
	"math"
	"strconv"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type StockHandler struct {
	stockSvc *service.StockService
}

func NewStockHandler(stockSvc *service.StockService) *StockHandler {
	return &StockHandler{stockSvc: stockSvc}
}

func (h *StockHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")

	var productID *uuid.UUID
	if pid := c.Query("product_id"); pid != "" {
		if id, err := uuid.Parse(pid); err == nil {
			productID = &id
		}
	}

	stocks, total, err := h.stockSvc.List(productID, status, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", stocks, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *StockHandler) Create(c *gin.Context) {
	var input service.CreateStockInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	stock, err := h.stockSvc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Stok ditambahkan", stock)
}

func (h *StockHandler) CreateBulk(c *gin.Context) {
	var input service.BulkStockInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	count, err := h.stockSvc.CreateBulk(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Stok bulk ditambahkan", gin.H{"count": count})
}

func (h *StockHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var input service.CreateStockInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	stock, err := h.stockSvc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Stok diperbarui", stock)
}

func (h *StockHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.stockSvc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Stok dihapus", nil)
}
