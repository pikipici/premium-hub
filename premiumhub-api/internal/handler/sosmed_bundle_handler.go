package handler

import (
	"errors"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedBundleHandler struct {
	repo *repository.SosmedBundleRepo
}

type publicSosmedBundlePackageResponse struct {
	ID            uuid.UUID                           `json:"id"`
	Key           string                              `json:"key"`
	Title         string                              `json:"title"`
	Subtitle      string                              `json:"subtitle,omitempty"`
	Description   string                              `json:"description,omitempty"`
	Platform      string                              `json:"platform"`
	Badge         string                              `json:"badge,omitempty"`
	IsHighlighted bool                                `json:"is_highlighted"`
	SortOrder     int                                 `json:"sort_order"`
	Variants      []publicSosmedBundleVariantResponse `json:"variants"`
	CreatedAt     time.Time                           `json:"created_at"`
	UpdatedAt     time.Time                           `json:"updated_at"`
}

type publicSosmedBundleVariantResponse struct {
	ID             uuid.UUID                        `json:"id"`
	Key            string                           `json:"key"`
	Name           string                           `json:"name"`
	Description    string                           `json:"description,omitempty"`
	SubtotalPrice  int64                            `json:"subtotal_price"`
	DiscountAmount int64                            `json:"discount_amount"`
	TotalPrice     int64                            `json:"total_price"`
	OriginalPrice  int64                            `json:"original_price"`
	Items          []publicSosmedBundleItemResponse `json:"items"`
	SortOrder      int                              `json:"sort_order"`
}

type publicSosmedBundleItemResponse struct {
	ID             string `json:"id,omitempty"`
	ServiceID      string `json:"service_id,omitempty"`
	ServiceCode    string `json:"service_code"`
	Title          string `json:"title"`
	QuantityUnits  int64  `json:"quantity_units"`
	LinePrice      int64  `json:"line_price"`
	TargetStrategy string `json:"target_strategy"`
}

func NewSosmedBundleHandler(repo *repository.SosmedBundleRepo) *SosmedBundleHandler {
	return &SosmedBundleHandler{repo: repo}
}

func (h *SosmedBundleHandler) PublicList(c *gin.Context) {
	bundles, err := h.repo.ListActiveBundles(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}

	items := make([]publicSosmedBundlePackageResponse, 0, len(bundles))
	for _, bundle := range bundles {
		items = append(items, toPublicSosmedBundlePackageResponse(bundle))
	}
	response.Success(c, "OK", items)
}

func (h *SosmedBundleHandler) PublicDetail(c *gin.Context) {
	key := strings.TrimSpace(c.Param("key"))
	if key == "" {
		response.NotFound(c, "Paket sosmed tidak ditemukan")
		return
	}

	bundle, err := h.repo.GetBundleByKey(c.Request.Context(), key)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "Paket sosmed tidak ditemukan")
			return
		}
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", toPublicSosmedBundlePackageResponse(*bundle))
}

func toPublicSosmedBundlePackageResponse(bundle model.SosmedBundlePackage) publicSosmedBundlePackageResponse {
	variants := make([]publicSosmedBundleVariantResponse, 0, len(bundle.Variants))
	for _, variant := range bundle.Variants {
		variantResponse, ok := toPublicSosmedBundleVariantResponse(variant)
		if ok {
			variants = append(variants, variantResponse)
		}
	}

	return publicSosmedBundlePackageResponse{
		ID:            bundle.ID,
		Key:           bundle.Key,
		Title:         bundle.Title,
		Subtitle:      bundle.Subtitle,
		Description:   bundle.Description,
		Platform:      bundle.Platform,
		Badge:         bundle.Badge,
		IsHighlighted: bundle.IsHighlighted,
		SortOrder:     bundle.SortOrder,
		Variants:      variants,
		CreatedAt:     bundle.CreatedAt,
		UpdatedAt:     bundle.UpdatedAt,
	}
}

func toPublicSosmedBundleVariantResponse(variant model.SosmedBundleVariant) (publicSosmedBundleVariantResponse, bool) {
	pricing, err := service.CalculateSosmedBundlePricing(&variant)
	if err != nil {
		return publicSosmedBundleVariantResponse{}, false
	}

	items := make([]publicSosmedBundleItemResponse, 0, len(pricing.Items))
	for idx, line := range pricing.Items {
		item := publicSosmedBundleItemResponse{
			ID:            line.BundleItemID,
			ServiceID:     line.SosmedServiceID,
			ServiceCode:   line.ServiceCodeSnapshot,
			Title:         line.ServiceTitleSnapshot,
			QuantityUnits: line.QuantityUnits,
			LinePrice:     line.LinePrice,
		}
		if idx < len(variant.Items) {
			item.TargetStrategy = variant.Items[idx].TargetStrategy
		}
		items = append(items, item)
	}

	originalPrice := pricing.SubtotalPrice
	if pricing.DiscountAmount <= 0 {
		originalPrice = pricing.TotalPrice
	}

	return publicSosmedBundleVariantResponse{
		ID:             variant.ID,
		Key:            variant.Key,
		Name:           variant.Name,
		Description:    variant.Description,
		SubtotalPrice:  pricing.SubtotalPrice,
		DiscountAmount: pricing.DiscountAmount,
		TotalPrice:     pricing.TotalPrice,
		OriginalPrice:  originalPrice,
		Items:          items,
		SortOrder:      variant.SortOrder,
	}, true
}
