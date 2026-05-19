package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailAdminHandler bundles admin-only endpoints introduced in Round 5
// — inventory browser, pricing config, strike management, sales
// analytics. Verify queue handlers stay on GmailHandler (already wired
// in Round 1).
type GmailAdminHandler struct {
	gmailSvc     *service.GmailService
	pricingSvc   *service.GmailPricingService
	analyticsSvc *service.GmailAnalyticsService
}

func NewGmailAdminHandler(
	gmailSvc *service.GmailService,
	pricingSvc *service.GmailPricingService,
	analyticsSvc *service.GmailAnalyticsService,
) *GmailAdminHandler {
	return &GmailAdminHandler{
		gmailSvc:     gmailSvc,
		pricingSvc:   pricingSvc,
		analyticsSvc: analyticsSvc,
	}
}

// AdminListInventory: GET /admin/gmail/inventory?status=&page=&limit=
func (h *GmailAdminHandler) AdminListInventory(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)

	rows, total, err := h.gmailSvc.AdminListInventory(status, page, limit)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Gagal memuat inventory: "+err.Error())
		return
	}
	counts, err := h.gmailSvc.AdminInventoryCounts()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Gagal memuat ringkasan inventory: "+err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", gin.H{
		"items":  rows,
		"counts": counts,
	}, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: paginationTotalPages(total, limit),
	})
}

// AdminGetPricing: GET /admin/gmail/pricing
func (h *GmailAdminHandler) AdminGetPricing(c *gin.Context) {
	pricing, err := h.pricingSvc.GetActive()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Gagal memuat pricing: "+err.Error())
		return
	}
	response.Success(c, "OK", pricing)
}

// AdminUpdatePricing: PUT /admin/gmail/pricing
type adminUpdatePricingBody struct {
	BuyPrice              *int64                              `json:"buy_price"`
	SellPrice             *int64                              `json:"sell_price"`
	BulkDiscountEnabled   *bool                               `json:"bulk_discount_enabled"`
	BulkDiscountTiers     []service.GmailDiscountTier `json:"bulk_discount_tiers"`
	LowInventoryThreshold *int                                `json:"low_inventory_threshold"`
}

func (h *GmailAdminHandler) AdminUpdatePricing(c *gin.Context) {
	adminID, ok := c.MustGet("user_id").(uuid.UUID)
	if !ok {
		response.Unauthorized(c)
		return
	}
	var body adminUpdatePricingBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "Body tidak valid: "+err.Error())
		return
	}
	input := service.GmailPricingUpdateInput{
		BuyPrice:              body.BuyPrice,
		SellPrice:             body.SellPrice,
		BulkDiscountEnabled:   body.BulkDiscountEnabled,
		BulkDiscountTiers:     body.BulkDiscountTiers,
		LowInventoryThreshold: body.LowInventoryThreshold,
	}
	pricing, err := h.pricingSvc.AdminUpdate(adminID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Pricing diperbarui", pricing)
}

// AdminListStrikedUsers: GET /admin/gmail/strikes
func (h *GmailAdminHandler) AdminListStrikedUsers(c *gin.Context) {
	rows, err := h.gmailSvc.AdminListStrikedUsers()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Gagal memuat striked users: "+err.Error())
		return
	}
	response.Success(c, "OK", gin.H{"items": rows})
}

// AdminResetStrikes: POST /admin/gmail/strikes/:user_id/reset
func (h *GmailAdminHandler) AdminResetStrikes(c *gin.Context) {
	userID, err := uuid.Parse(strings.TrimSpace(c.Param("user_id")))
	if err != nil {
		response.BadRequest(c, "user_id tidak valid")
		return
	}
	if err := h.gmailSvc.AdminResetStrikes(userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "User tidak ditemukan")
			return
		}
		response.Error(c, http.StatusInternalServerError, "Gagal reset strike: "+err.Error())
		return
	}
	response.Success(c, "Strike user berhasil di-reset", nil)
}

// AdminAnalytics: GET /admin/gmail/analytics?weeks=8
func (h *GmailAdminHandler) AdminAnalytics(c *gin.Context) {
	weeks := 8
	if w := strings.TrimSpace(c.Query("weeks")); w != "" {
		if parsed, err := strconv.Atoi(w); err == nil && parsed > 0 && parsed <= 52 {
			weeks = parsed
		}
	}
	out, err := h.analyticsSvc.GetWeeklyOverview(weeks)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Gagal memuat analytics: "+err.Error())
		return
	}
	response.Success(c, "OK", out)
}

// paginationTotalPages avoids dependency on math.Ceil import elsewhere.
func paginationTotalPages(total int64, limit int) int {
	if limit <= 0 {
		return 0
	}
	pages := total / int64(limit)
	if total%int64(limit) != 0 {
		pages++
	}
	return int(pages)
}
