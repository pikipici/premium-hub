package handler

import (
	"errors"
	"math"
	"strings"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailBuyHandler handles the buy-side endpoints. Kept separate from
// the sell-side GmailHandler because the dependencies are different:
// buy needs orderSvc + pricingSvc, sell needs gmailSvc.
type GmailBuyHandler struct {
	orderSvc   *service.GmailOrderService
	pricingSvc *service.GmailPricingService
	gmailSvc   *service.GmailService
}

func NewGmailBuyHandler(
	orderSvc *service.GmailOrderService,
	pricingSvc *service.GmailPricingService,
	gmailSvc *service.GmailService,
) *GmailBuyHandler {
	return &GmailBuyHandler{
		orderSvc:   orderSvc,
		pricingSvc: pricingSvc,
		gmailSvc:   gmailSvc,
	}
}

// ----- public endpoints -----

// PublicPricing handles GET /api/v1/public/gmail/pricing — returns
// sell_price + bulk discount tiers (if enabled). buy_price (admin-only)
// is NOT exposed.
func (h *GmailBuyHandler) PublicPricing(c *gin.Context) {
	preview, err := h.pricingSvc.PricingPreview()
	if err != nil {
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", preview)
}

// PublicAvailability handles GET /api/v1/public/gmail/availability —
// returns the verified-pool count. Cached 60s at the CDN layer to
// avoid leaking real-time stock to competitors.
func (h *GmailBuyHandler) PublicAvailability(c *gin.Context) {
	count, err := h.gmailSvc.CountVerifiedInventory()
	if err != nil {
		response.InternalError(c)
		return
	}
	c.Header("Cache-Control", "public, max-age=60")
	response.Success(c, "OK", gin.H{"available": count})
}

// ----- buyer endpoints -----

// BuyInput is the body for POST /api/v1/gmail/buy.
type BuyInput struct {
	Quantity int64 `json:"quantity" binding:"required,min=1"`
}

// Buy handles POST /api/v1/gmail/buy.
func (h *GmailBuyHandler) Buy(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input BuyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "Quantity wajib ≥ 1")
		return
	}
	res, err := h.orderSvc.Buy(userID, input.Quantity)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Pembelian sukses", res)
}

// ListMyOrders handles GET /api/v1/gmail/orders.
func (h *GmailBuyHandler) ListMyOrders(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, DefaultCustomerPageLimit, MaxPageLimit)
	rows, total, err := h.orderSvc.ListMyOrders(userID, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", gin.H{"items": rows}, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

// GetMyOrder handles GET /api/v1/gmail/orders/:id — returns order +
// decrypted credentials per item. Auth-scoped to caller.
func (h *GmailBuyHandler) GetMyOrder(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID order tidak valid")
		return
	}
	res, err := h.orderSvc.GetMyOrderWithCreds(userID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "Order tidak ditemukan")
			return
		}
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", res)
}
