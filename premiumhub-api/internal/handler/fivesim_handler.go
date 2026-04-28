package handler

import (
	"context"
	"math"
	"strconv"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type FiveSimHandler struct {
	svc *service.FiveSimService
}

func NewFiveSimHandler(svc *service.FiveSimService) *FiveSimHandler {
	return &FiveSimHandler{svc: svc}
}

func (h *FiveSimHandler) GetCountries(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.GetCatalogCountries(c.Request.Context(), userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *FiveSimHandler) GetProducts(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	country := c.DefaultQuery("country", "any")
	operator := c.DefaultQuery("operator", "any")

	res, err := h.svc.GetCatalogProducts(c.Request.Context(), userID, country, operator)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *FiveSimHandler) GetPrices(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	country := c.Query("country")
	product := c.Query("product")

	res, err := h.svc.GetCatalogPrices(c.Request.Context(), userID, country, product)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *FiveSimHandler) BuyActivation(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.FiveSimBuyActivationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	localOrder, providerOrder, err := h.svc.BuyActivation(c.Request.Context(), userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Nomor virtual berhasil dibeli", gin.H{
		"local_order":    sanitizeFiveSimLocalOrder(localOrder),
		"provider_order": sanitizeFiveSimProviderOrder(providerOrder),
	})
}

func (h *FiveSimHandler) BuyHosting(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.FiveSimBuyHostingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	localOrder, providerOrder, err := h.svc.BuyHosting(c.Request.Context(), userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Nomor hosting berhasil dibeli", gin.H{
		"local_order":    sanitizeFiveSimLocalOrder(localOrder),
		"provider_order": sanitizeFiveSimProviderOrder(providerOrder),
	})
}

func (h *FiveSimHandler) ReuseNumber(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.FiveSimReuseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	localOrder, providerOrder, err := h.svc.ReuseNumber(c.Request.Context(), userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Reuse nomor berhasil", gin.H{
		"local_order":    sanitizeFiveSimLocalOrder(localOrder),
		"provider_order": sanitizeFiveSimProviderOrder(providerOrder),
	})
}

func (h *FiveSimHandler) ListOrders(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, 20, 100)

	rows, total, err := h.svc.ListLocalOrders(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMeta(c, "OK", sanitizeFiveSimLocalOrders(rows), response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *FiveSimHandler) CheckOrder(c *gin.Context) {
	h.runOrderAction(c, h.svc.CheckOrder, "Order berhasil disinkronkan")
}

func (h *FiveSimHandler) FinishOrder(c *gin.Context) {
	h.runOrderAction(c, h.svc.FinishOrder, "Order berhasil diselesaikan")
}

func (h *FiveSimHandler) CancelOrder(c *gin.Context) {
	h.runOrderAction(c, h.svc.CancelOrder, "Order berhasil dibatalkan")
}

func (h *FiveSimHandler) BanOrder(c *gin.Context) {
	h.runOrderAction(c, h.svc.BanOrder, "Order berhasil diblokir")
}

func (h *FiveSimHandler) GetSMSInbox(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	providerOrderID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || providerOrderID <= 0 {
		response.BadRequest(c, "id order tidak valid")
		return
	}

	inbox, err := h.svc.GetSMSInbox(c.Request.Context(), userID, providerOrderID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", inbox)
}

func (h *FiveSimHandler) GetProviderProfile(c *gin.Context) {
	res, err := h.svc.GetProviderProfile(c.Request.Context())
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *FiveSimHandler) GetProviderOrderHistory(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	reverse := c.DefaultQuery("reverse", "true")

	input := service.FiveSimProviderHistoryInput{
		Category: c.DefaultQuery("category", "activation"),
		Limit:    limit,
		Offset:   offset,
		Order:    c.DefaultQuery("order", "id"),
		Reverse:  reverse != "false",
	}

	res, err := h.svc.GetProviderOrderHistory(c.Request.Context(), input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *FiveSimHandler) runOrderAction(
	c *gin.Context,
	fn func(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *service.FiveSimOrderPayload, error),
	successMessage string,
) {
	userID := c.MustGet("user_id").(uuid.UUID)
	providerOrderID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || providerOrderID <= 0 {
		response.BadRequest(c, "id order tidak valid")
		return
	}

	localOrder, providerOrder, err := fn(c.Request.Context(), userID, providerOrderID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, successMessage, gin.H{
		"local_order":    sanitizeFiveSimLocalOrder(localOrder),
		"provider_order": sanitizeFiveSimProviderOrder(providerOrder),
	})
}

func sanitizeFiveSimLocalOrder(order *model.FiveSimOrder) *model.FiveSimOrder {
	if order == nil {
		return nil
	}

	safe := *order
	safe.ProviderPrice = 0
	safe.RawPayload = ""
	return &safe
}

func sanitizeFiveSimProviderOrder(order *service.FiveSimOrderPayload) *service.FiveSimOrderPayload {
	if order == nil {
		return nil
	}

	safe := *order
	safe.Price = 0
	return &safe
}

func sanitizeFiveSimLocalOrders(rows []model.FiveSimOrder) []model.FiveSimOrder {
	if len(rows) == 0 {
		return rows
	}

	safeRows := make([]model.FiveSimOrder, len(rows))
	for i := range rows {
		safeRows[i] = rows[i]
		safeRows[i].ProviderPrice = 0
		safeRows[i].RawPayload = ""
	}

	return safeRows
}
