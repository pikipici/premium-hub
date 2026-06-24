package handler

import (
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SosmedPromotionAdminHandler struct {
	svc *service.SosmedPromotionService
}

type sosmedPromotionStatusInput struct {
	IsActive bool `json:"is_active"`
}

type adminSosmedPromotionResponse struct {
	ID              uuid.UUID  `json:"id"`
	Name            string     `json:"name"`
	TargetType      string     `json:"target_type"`
	ServiceID       *uuid.UUID `json:"service_id,omitempty"`
	ServiceTitle    string     `json:"service_title,omitempty"`
	BundleVariantID *uuid.UUID `json:"bundle_variant_id,omitempty"`
	BundleTitle     string     `json:"bundle_title,omitempty"`
	VariantName     string     `json:"variant_name,omitempty"`
	DiscountType    string     `json:"discount_type"`
	DiscountValue   int64      `json:"discount_value"`
	StartsAt        time.Time  `json:"starts_at"`
	EndsAt          time.Time  `json:"ends_at"`
	IsActive        bool       `json:"is_active"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func NewSosmedPromotionAdminHandler(svc *service.SosmedPromotionService) *SosmedPromotionAdminHandler {
	return &SosmedPromotionAdminHandler{svc: svc}
}

func (h *SosmedPromotionAdminHandler) List(c *gin.Context) {
	items, err := h.svc.List(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	out := make([]adminSosmedPromotionResponse, 0, len(items))
	for _, item := range items {
		out = append(out, toAdminSosmedPromotionResponse(item))
	}
	response.Success(c, "OK", out)
}

func (h *SosmedPromotionAdminHandler) Create(c *gin.Context) {
	var input service.SosmedPromotionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "payload promo tidak valid")
		return
	}
	item, err := h.svc.Create(c.Request.Context(), input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Promo sosmed dibuat", toAdminSosmedPromotionResponse(*item))
}

func (h *SosmedPromotionAdminHandler) Update(c *gin.Context) {
	id, ok := parsePromotionID(c)
	if !ok {
		return
	}
	var input service.SosmedPromotionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "payload promo tidak valid")
		return
	}
	item, err := h.svc.Update(c.Request.Context(), id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Promo sosmed diupdate", toAdminSosmedPromotionResponse(*item))
}

func (h *SosmedPromotionAdminHandler) SetStatus(c *gin.Context) {
	id, ok := parsePromotionID(c)
	if !ok {
		return
	}
	var input sosmedPromotionStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "payload status promo tidak valid")
		return
	}
	item, err := h.svc.SetActive(c.Request.Context(), id, input.IsActive)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Status promo sosmed diupdate", toAdminSosmedPromotionResponse(*item))
}

func (h *SosmedPromotionAdminHandler) Delete(c *gin.Context) {
	id, ok := parsePromotionID(c)
	if !ok {
		return
	}
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Promo sosmed dihapus", nil)
}

func parsePromotionID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "id promo tidak valid")
		return uuid.Nil, false
	}
	return id, true
}

func toAdminSosmedPromotionResponse(item model.SosmedPromotion) adminSosmedPromotionResponse {
	out := adminSosmedPromotionResponse{
		ID:              item.ID,
		Name:            item.Name,
		TargetType:      item.TargetType,
		ServiceID:       item.ServiceID,
		BundleVariantID: item.BundleVariantID,
		DiscountType:    item.DiscountType,
		DiscountValue:   item.DiscountValue,
		StartsAt:        item.StartsAt,
		EndsAt:          item.EndsAt,
		IsActive:        item.IsActive,
		CreatedAt:       item.CreatedAt,
		UpdatedAt:       item.UpdatedAt,
	}
	if item.Service != nil {
		out.ServiceTitle = item.Service.Title
	}
	if item.BundleVariant != nil {
		out.VariantName = item.BundleVariant.Name
		out.BundleTitle = item.BundleVariant.Package.Title
	}
	return out
}
