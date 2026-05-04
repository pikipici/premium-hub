package handler

import (
	"errors"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SosmedServiceHandler struct {
	svc *service.SosmedServiceService
}

type publicSosmedServiceResponse struct {
	ID            uuid.UUID `json:"id"`
	CategoryCode  string    `json:"category_code"`
	Code          string    `json:"code"`
	Title         string    `json:"title"`
	Summary       string    `json:"summary"`
	PlatformLabel string    `json:"platform_label"`
	BadgeText     string    `json:"badge_text"`
	Theme         string    `json:"theme"`
	MinOrder      string    `json:"min_order"`
	StartTime     string    `json:"start_time"`
	Refill        string    `json:"refill"`
	ETA           string    `json:"eta"`
	PriceStart    string    `json:"price_start"`
	PricePer1K    string    `json:"price_per_1k"`
	CheckoutPrice int64     `json:"checkout_price"`
	TrustBadges   []string  `json:"trust_badges,omitempty"`
	SortOrder     int       `json:"sort_order"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

var (
	publicSosmedRefillBracketPattern  = regexp.MustCompile(`(?i)\[[^\]]*(refill|garansi|guarantee|guaranteed|warranty)[^\]]*\]`)
	publicSosmedNoRefillPhrasePattern = regexp.MustCompile(`(?i)\b(no|tanpa|tidak ada|non)\s+refill\b`)
	publicSosmedRefillPhrasePattern   = regexp.MustCompile(`(?i)\b(auto[\s-]*)?refill\b\s*:?\s*[0-9]*\s*(d|day|days|hari)?`)
	publicSosmedGuaranteePattern      = regexp.MustCompile(`(?i)\b(garansi|guarantee|guaranteed|warranty)\b\s*:?\s*[0-9]*\s*(d|day|days|hari)?`)
)

func NewSosmedServiceHandler(svc *service.SosmedServiceService) *SosmedServiceHandler {
	return &SosmedServiceHandler{svc: svc}
}

func toPublicSosmedServiceResponse(item model.SosmedService) publicSosmedServiceResponse {
	title := item.Title
	summary := item.Summary
	badgeText := item.BadgeText
	refill := item.Refill
	trustBadges := item.TrustBadges
	if isPublicJAPRefillUnsupported(item) {
		title = stripPublicSosmedRefillClaims(title)
		summary = stripPublicSosmedRefillClaims(summary)
		badgeText = sanitizePublicSosmedRefillBadgeText(badgeText)
		refill = "Tidak Ada"
		trustBadges = filterPublicSosmedRefillBadges(trustBadges)
	}

	return publicSosmedServiceResponse{
		ID:            item.ID,
		CategoryCode:  item.CategoryCode,
		Code:          item.Code,
		Title:         title,
		Summary:       summary,
		PlatformLabel: item.PlatformLabel,
		BadgeText:     badgeText,
		Theme:         item.Theme,
		MinOrder:      item.MinOrder,
		StartTime:     item.StartTime,
		Refill:        refill,
		ETA:           item.ETA,
		PriceStart:    item.PriceStart,
		PricePer1K:    item.PricePer1K,
		CheckoutPrice: item.CheckoutPrice,
		TrustBadges:   trustBadges,
		SortOrder:     item.SortOrder,
		IsActive:      item.IsActive,
		CreatedAt:     item.CreatedAt,
		UpdatedAt:     item.UpdatedAt,
	}
}

func isPublicJAPRefillUnsupported(item model.SosmedService) bool {
	return strings.EqualFold(strings.TrimSpace(item.ProviderCode), "jap") &&
		strings.TrimSpace(item.ProviderServiceID) != "" &&
		!item.ProviderRefillSupported
}

func stripPublicSosmedRefillClaims(value string) string {
	cleaned := strings.TrimSpace(value)
	if cleaned == "" {
		return ""
	}
	cleaned = publicSosmedRefillBracketPattern.ReplaceAllString(cleaned, " ")
	cleaned = publicSosmedNoRefillPhrasePattern.ReplaceAllString(cleaned, " ")
	cleaned = publicSosmedRefillPhrasePattern.ReplaceAllString(cleaned, " ")
	cleaned = publicSosmedGuaranteePattern.ReplaceAllString(cleaned, " ")
	cleaned = strings.ReplaceAll(cleaned, "  ", " ")
	cleaned = strings.Trim(cleaned, " -•|,.;")
	return strings.Join(strings.Fields(cleaned), " ")
}

func sanitizePublicSosmedRefillBadgeText(value string) string {
	cleaned := stripPublicSosmedRefillClaims(value)
	if cleaned == "" && strings.TrimSpace(value) != "" {
		return "Rekomendasi"
	}
	return cleaned
}

func filterPublicSosmedRefillBadges(items []string) []string {
	filtered := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		normalized := strings.ToLower(trimmed)
		if strings.Contains(normalized, "refill") || strings.Contains(normalized, "garansi") {
			continue
		}
		filtered = append(filtered, trimmed)
	}
	return filtered
}

func (h *SosmedServiceHandler) PublicList(c *gin.Context) {
	items, err := h.svc.List(false)
	if err != nil {
		response.InternalError(c)
		return
	}

	publicItems := make([]publicSosmedServiceResponse, 0, len(items))
	for _, item := range items {
		publicItems = append(publicItems, toPublicSosmedServiceResponse(item))
	}

	response.Success(c, "OK", publicItems)
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

func (h *SosmedServiceHandler) PreviewSelectedFromJAP(c *gin.Context) {
	var input service.ImportSelectedJAPServicesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.PreviewSelectedFromJAP(c.Request.Context(), input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Preview layanan JAP selesai", res)
}

func (h *SosmedServiceHandler) ImportSelectedFromJAP(c *gin.Context) {
	var input service.ImportSelectedJAPServicesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.ImportSelectedFromJAP(c.Request.Context(), input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Import layanan JAP selesai", res)
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

func (h *SosmedServiceHandler) SyncJAPMetadata(c *gin.Context) {
	updated, err := h.svc.SyncAllJAPMetadata(c.Request.Context())
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, fmt.Sprintf("Berhasil sinkronisasi %d metadata layanan JAP", updated), gin.H{"updated": updated})
}
