package handler

import (
	"math"
	"strconv"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SosmedBundleAdminHandler struct {
	svc *service.SosmedBundleAdminService
}

type adminSosmedBundlePackageResponse struct {
	ID            uuid.UUID                          `json:"id"`
	Key           string                             `json:"key"`
	Title         string                             `json:"title"`
	Subtitle      string                             `json:"subtitle"`
	Description   string                             `json:"description"`
	Platform      string                             `json:"platform"`
	Badge         string                             `json:"badge"`
	IsHighlighted bool                               `json:"is_highlighted"`
	IsActive      bool                               `json:"is_active"`
	SortOrder     int                                `json:"sort_order"`
	Variants      []adminSosmedBundleVariantResponse `json:"variants"`
	CreatedAt     time.Time                          `json:"created_at"`
	UpdatedAt     time.Time                          `json:"updated_at"`
}

type adminSosmedBundleVariantResponse struct {
	ID                       uuid.UUID                       `json:"id"`
	BundlePackageID          uuid.UUID                       `json:"bundle_package_id"`
	Key                      string                          `json:"key"`
	Name                     string                          `json:"name"`
	Description              string                          `json:"description"`
	PriceMode                string                          `json:"price_mode"`
	FixedPrice               int64                           `json:"fixed_price"`
	DiscountPercent          int                             `json:"discount_percent"`
	DiscountAmount           int64                           `json:"discount_amount"`
	SubtotalPrice            int64                           `json:"subtotal_price"`
	DiscountAmountCalculated int64                           `json:"discount_amount_calculated"`
	TotalPrice               int64                           `json:"total_price"`
	OriginalPrice            int64                           `json:"original_price"`
	IsActive                 bool                            `json:"is_active"`
	SortOrder                int                             `json:"sort_order"`
	Items                    []adminSosmedBundleItemResponse `json:"items"`
	CreatedAt                time.Time                       `json:"created_at"`
	UpdatedAt                time.Time                       `json:"updated_at"`
}

type adminSosmedBundleItemResponse struct {
	ID              uuid.UUID `json:"id"`
	BundleVariantID uuid.UUID `json:"bundle_variant_id"`
	SosmedServiceID uuid.UUID `json:"sosmed_service_id"`
	ServiceCode     string    `json:"service_code"`
	ServiceTitle    string    `json:"service_title"`
	Label           string    `json:"label"`
	QuantityUnits   int64     `json:"quantity_units"`
	LinePrice       int64     `json:"line_price"`
	TargetStrategy  string    `json:"target_strategy"`
	IsActive        bool      `json:"is_active"`
	SortOrder       int       `json:"sort_order"`
	ServiceIsActive bool      `json:"service_is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func NewSosmedBundleAdminHandler(svc *service.SosmedBundleAdminService) *SosmedBundleAdminHandler {
	return &SosmedBundleAdminHandler{svc: svc}
}

func toAdminSosmedBundlePackagesResponse(packages []model.SosmedBundlePackage) []adminSosmedBundlePackageResponse {
	return toAdminSosmedBundlePackagesResponseWithInactive(packages, true)
}

func toAdminSosmedBundlePackagesResponseWithInactive(packages []model.SosmedBundlePackage, includeInactive bool) []adminSosmedBundlePackageResponse {
	items := make([]adminSosmedBundlePackageResponse, 0, len(packages))
	for _, pkg := range packages {
		if includeInactive || pkg.IsActive {
			items = append(items, toAdminSosmedBundlePackageResponseWithInactive(pkg, includeInactive))
		}
	}
	return items
}

func toAdminSosmedBundlePackageResponse(pkg model.SosmedBundlePackage) adminSosmedBundlePackageResponse {
	return toAdminSosmedBundlePackageResponseWithInactive(pkg, true)
}

func toAdminSosmedBundlePackageResponseWithInactive(pkg model.SosmedBundlePackage, includeInactive bool) adminSosmedBundlePackageResponse {
	variants := make([]adminSosmedBundleVariantResponse, 0, len(pkg.Variants))
	for _, variant := range pkg.Variants {
		if includeInactive || variant.IsActive {
			variants = append(variants, toAdminSosmedBundleVariantResponseWithInactive(variant, includeInactive))
		}
	}
	return adminSosmedBundlePackageResponse{
		ID:            pkg.ID,
		Key:           pkg.Key,
		Title:         pkg.Title,
		Subtitle:      pkg.Subtitle,
		Description:   pkg.Description,
		Platform:      pkg.Platform,
		Badge:         pkg.Badge,
		IsHighlighted: pkg.IsHighlighted,
		IsActive:      pkg.IsActive,
		SortOrder:     pkg.SortOrder,
		Variants:      variants,
		CreatedAt:     pkg.CreatedAt,
		UpdatedAt:     pkg.UpdatedAt,
	}
}

func toAdminSosmedBundleVariantResponse(variant model.SosmedBundleVariant) adminSosmedBundleVariantResponse {
	return toAdminSosmedBundleVariantResponseWithInactive(variant, true)
}

func toAdminSosmedBundleVariantResponseWithInactive(variant model.SosmedBundleVariant, includeInactive bool) adminSosmedBundleVariantResponse {
	if !includeInactive {
		activeItems := make([]model.SosmedBundleItem, 0, len(variant.Items))
		for _, item := range variant.Items {
			if item.IsActive {
				activeItems = append(activeItems, item)
			}
		}
		variant.Items = activeItems
	}

	pricingByItemID := map[uuid.UUID]int64{}
	var subtotalPrice int64
	var calculatedDiscount int64
	var totalPrice int64
	var originalPrice int64

	pricingVariant := variant
	pricingVariant.Items = make([]model.SosmedBundleItem, 0, len(variant.Items))
	for _, item := range variant.Items {
		if item.IsActive {
			pricingVariant.Items = append(pricingVariant.Items, item)
		}
	}
	if pricing, err := service.CalculateSosmedBundlePricing(&pricingVariant); err == nil {
		subtotalPrice = pricing.SubtotalPrice
		calculatedDiscount = pricing.DiscountAmount
		totalPrice = pricing.TotalPrice
		originalPrice = pricing.TotalPrice
		if pricing.DiscountAmount > 0 {
			originalPrice = pricing.SubtotalPrice
		}
		for _, line := range pricing.Items {
			if parsed, err := uuid.Parse(line.BundleItemID); err == nil {
				pricingByItemID[parsed] = line.LinePrice
			}
		}
	}

	items := make([]adminSosmedBundleItemResponse, 0, len(variant.Items))
	for _, item := range variant.Items {
		itemResponse := toAdminSosmedBundleItemResponse(item)
		if linePrice, ok := pricingByItemID[item.ID]; ok {
			itemResponse.LinePrice = linePrice
		}
		items = append(items, itemResponse)
	}

	return adminSosmedBundleVariantResponse{
		ID:                       variant.ID,
		BundlePackageID:          variant.BundlePackageID,
		Key:                      variant.Key,
		Name:                     variant.Name,
		Description:              variant.Description,
		PriceMode:                variant.PriceMode,
		FixedPrice:               variant.FixedPrice,
		DiscountPercent:          variant.DiscountPercent,
		DiscountAmount:           variant.DiscountAmount,
		SubtotalPrice:            subtotalPrice,
		DiscountAmountCalculated: calculatedDiscount,
		TotalPrice:               totalPrice,
		OriginalPrice:            originalPrice,
		IsActive:                 variant.IsActive,
		SortOrder:                variant.SortOrder,
		Items:                    items,
		CreatedAt:                variant.CreatedAt,
		UpdatedAt:                variant.UpdatedAt,
	}
}

func toAdminSosmedBundleItemResponse(item model.SosmedBundleItem) adminSosmedBundleItemResponse {
	return adminSosmedBundleItemResponse{
		ID:              item.ID,
		BundleVariantID: item.BundleVariantID,
		SosmedServiceID: item.SosmedServiceID,
		ServiceCode:     item.Service.Code,
		ServiceTitle:    item.Service.Title,
		Label:           item.Label,
		QuantityUnits:   item.QuantityUnits,
		LinePrice:       calculateAdminSosmedBundleItemLinePrice(item),
		TargetStrategy:  item.TargetStrategy,
		IsActive:        item.IsActive,
		SortOrder:       item.SortOrder,
		ServiceIsActive: item.Service.IsActive,
		CreatedAt:       item.CreatedAt,
		UpdatedAt:       item.UpdatedAt,
	}
}

func calculateAdminSosmedBundleItemLinePrice(item model.SosmedBundleItem) int64 {
	if item.Service.CheckoutPrice <= 0 || item.QuantityUnits <= 0 {
		return 0
	}
	if item.QuantityUnits > math.MaxInt64/item.Service.CheckoutPrice {
		return 0
	}
	return (item.Service.CheckoutPrice*item.QuantityUnits + 999) / 1000
}

func (h *SosmedBundleAdminHandler) AdminList(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}

	includeInactive := false
	if raw := c.Query("include_inactive"); raw != "" {
		if parsed, err := strconv.ParseBool(raw); err == nil {
			includeInactive = parsed
		}
	}

	packages, err := h.svc.ListPackages(c.Request.Context(), includeInactive)
	if err != nil {
		response.InternalError(c)
		return
	}

	response.Success(c, "OK", toAdminSosmedBundlePackagesResponseWithInactive(packages, includeInactive))
}

func (h *SosmedBundleAdminHandler) AdminCreatePackage(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}

	var input service.CreateSosmedBundlePackageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	pkg, err := h.svc.CreatePackage(c.Request.Context(), input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Paket bundle sosmed berhasil dibuat", toAdminSosmedBundlePackageResponseWithInactive(*pkg, false))
}

func (h *SosmedBundleAdminHandler) AdminUpdatePackage(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}
	id, ok := parseAdminSosmedBundleUUIDParam(c, "id")
	if !ok {
		return
	}

	var input service.UpdateSosmedBundlePackageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	pkg, err := h.svc.UpdatePackage(c.Request.Context(), id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Paket bundle sosmed diperbarui", toAdminSosmedBundlePackageResponseWithInactive(*pkg, false))
}

func (h *SosmedBundleAdminHandler) AdminDeletePackage(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}
	id, ok := parseAdminSosmedBundleUUIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.svc.DeletePackage(c.Request.Context(), id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	pkg, err := h.svc.GetPackage(c.Request.Context(), id, true)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Paket bundle sosmed dinonaktifkan", toAdminSosmedBundlePackageResponseWithInactive(*pkg, true))
}

func (h *SosmedBundleAdminHandler) AdminCreateVariant(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}
	packageID, ok := parseAdminSosmedBundleUUIDParam(c, "id")
	if !ok {
		return
	}

	var input service.CreateSosmedBundleVariantInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	variant, err := h.svc.CreateVariant(c.Request.Context(), packageID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Variant bundle sosmed berhasil dibuat", toAdminSosmedBundleVariantResponseWithInactive(*variant, false))
}

func (h *SosmedBundleAdminHandler) AdminUpdateVariant(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}
	variantID, ok := parseAdminSosmedBundleUUIDParam(c, "variant_id")
	if !ok {
		return
	}

	var input service.UpdateSosmedBundleVariantInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	variant, err := h.svc.UpdateVariant(c.Request.Context(), variantID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Variant bundle sosmed diperbarui", toAdminSosmedBundleVariantResponseWithInactive(*variant, false))
}

func (h *SosmedBundleAdminHandler) AdminDeleteVariant(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}
	variantID, ok := parseAdminSosmedBundleUUIDParam(c, "variant_id")
	if !ok {
		return
	}

	if err := h.svc.DeleteVariant(c.Request.Context(), variantID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	variant, err := h.svc.GetVariant(c.Request.Context(), variantID, true)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Variant bundle sosmed dinonaktifkan", toAdminSosmedBundleVariantResponseWithInactive(*variant, true))
}

func (h *SosmedBundleAdminHandler) AdminCreateItem(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}
	variantID, ok := parseAdminSosmedBundleUUIDParam(c, "variant_id")
	if !ok {
		return
	}

	var input service.CreateSosmedBundleItemInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	item, err := h.svc.CreateItem(c.Request.Context(), variantID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Item bundle sosmed berhasil dibuat", toAdminSosmedBundleItemResponse(*item))
}

func (h *SosmedBundleAdminHandler) AdminUpdateItem(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}
	itemID, ok := parseAdminSosmedBundleUUIDParam(c, "item_id")
	if !ok {
		return
	}

	var input service.UpdateSosmedBundleItemInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	item, err := h.svc.UpdateItem(c.Request.Context(), itemID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Item bundle sosmed diperbarui", toAdminSosmedBundleItemResponse(*item))
}

func (h *SosmedBundleAdminHandler) AdminDeleteItem(c *gin.Context) {
	if !h.adminSosmedBundleServiceReady(c) {
		return
	}
	itemID, ok := parseAdminSosmedBundleUUIDParam(c, "item_id")
	if !ok {
		return
	}

	if err := h.svc.DeleteItem(c.Request.Context(), itemID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	item, err := h.svc.GetItem(c.Request.Context(), itemID, true)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Item bundle sosmed dinonaktifkan", toAdminSosmedBundleItemResponse(*item))
}

func (h *SosmedBundleAdminHandler) adminSosmedBundleServiceReady(c *gin.Context) bool {
	if h == nil || h.svc == nil {
		response.InternalError(c)
		return false
	}
	return true
}

func parseAdminSosmedBundleUUIDParam(c *gin.Context, paramName string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(paramName))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return uuid.Nil, false
	}
	return id, true
}
