package handler

import (
	"math"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SosmedBundleOrderHandler struct {
	svc *service.SosmedBundleOrderService
}

type userSosmedBundleOrderResponse struct {
	ID                 string                              `json:"id"`
	OrderNumber        string                              `json:"order_number"`
	PackageKeySnapshot string                              `json:"package_key_snapshot"`
	VariantKeySnapshot string                              `json:"variant_key_snapshot"`
	TitleSnapshot      string                              `json:"title_snapshot"`
	TargetLink         string                              `json:"target_link"`
	TargetUsername     string                              `json:"target_username,omitempty"`
	Notes              string                              `json:"notes,omitempty"`
	SubtotalPrice      int64                               `json:"subtotal_price"`
	DiscountAmount     int64                               `json:"discount_amount"`
	TotalPrice         int64                               `json:"total_price"`
	Status             string                              `json:"status"`
	PaymentMethod      string                              `json:"payment_method"`
	Items              []userSosmedBundleOrderItemResponse `json:"items"`
	PaidAt             *time.Time                          `json:"paid_at,omitempty"`
	CompletedAt        *time.Time                          `json:"completed_at,omitempty"`
	CreatedAt          time.Time                           `json:"created_at"`
	UpdatedAt          time.Time                           `json:"updated_at"`
}

type userSosmedBundleOrderItemResponse struct {
	ID                     string     `json:"id"`
	ServiceCodeSnapshot    string     `json:"service_code_snapshot"`
	ServiceTitleSnapshot   string     `json:"service_title_snapshot"`
	QuantityUnits          int64      `json:"quantity_units"`
	UnitPricePer1KSnapshot int64      `json:"unit_price_per_1k_snapshot"`
	LinePrice              int64      `json:"line_price"`
	TargetLinkSnapshot     string     `json:"target_link_snapshot"`
	Status                 string     `json:"status"`
	SubmittedAt            *time.Time `json:"submitted_at,omitempty"`
	CompletedAt            *time.Time `json:"completed_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

func toUserSosmedBundleOrderResponse(order *model.SosmedBundleOrder) userSosmedBundleOrderResponse {
	if order == nil {
		return userSosmedBundleOrderResponse{}
	}
	items := make([]userSosmedBundleOrderItemResponse, 0, len(order.Items))
	for _, item := range order.Items {
		items = append(items, userSosmedBundleOrderItemResponse{
			ID:                     item.ID.String(),
			ServiceCodeSnapshot:    item.ServiceCodeSnapshot,
			ServiceTitleSnapshot:   item.ServiceTitleSnapshot,
			QuantityUnits:          item.QuantityUnits,
			UnitPricePer1KSnapshot: item.UnitPricePer1KSnapshot,
			LinePrice:              item.LinePrice,
			TargetLinkSnapshot:     item.TargetLinkSnapshot,
			Status:                 item.Status,
			SubmittedAt:            item.SubmittedAt,
			CompletedAt:            item.CompletedAt,
			CreatedAt:              item.CreatedAt,
			UpdatedAt:              item.UpdatedAt,
		})
	}
	return userSosmedBundleOrderResponse{
		ID:                 order.ID.String(),
		OrderNumber:        order.OrderNumber,
		PackageKeySnapshot: order.PackageKeySnapshot,
		VariantKeySnapshot: order.VariantKeySnapshot,
		TitleSnapshot:      order.TitleSnapshot,
		TargetLink:         order.TargetLink,
		TargetUsername:     order.TargetUsername,
		Notes:              order.Notes,
		SubtotalPrice:      order.SubtotalPrice,
		DiscountAmount:     order.DiscountAmount,
		TotalPrice:         order.TotalPrice,
		Status:             order.Status,
		PaymentMethod:      order.PaymentMethod,
		Items:              items,
		PaidAt:             order.PaidAt,
		CompletedAt:        order.CompletedAt,
		CreatedAt:          order.CreatedAt,
		UpdatedAt:          order.UpdatedAt,
	}
}

func toUserSosmedBundleOrderResponses(orders []model.SosmedBundleOrder) []userSosmedBundleOrderResponse {
	out := make([]userSosmedBundleOrderResponse, 0, len(orders))
	for i := range orders {
		out = append(out, toUserSosmedBundleOrderResponse(&orders[i]))
	}
	return out
}

func NewSosmedBundleOrderHandler(svc *service.SosmedBundleOrderService) *SosmedBundleOrderHandler {
	return &SosmedBundleOrderHandler{svc: svc}
}

func (h *SosmedBundleOrderHandler) Create(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateSosmedBundleOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	order, err := h.svc.Create(c.Request.Context(), userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Order bundle sosmed berhasil dibuat", toUserSosmedBundleOrderResponse(order))
}

func (h *SosmedBundleOrderHandler) List(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, 10, 100)

	orders, total, err := h.svc.ListByUser(c.Request.Context(), userID, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", toUserSosmedBundleOrderResponses(orders), response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *SosmedBundleOrderHandler) GetByOrderNumber(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderNumber := strings.TrimSpace(c.Param("order_number"))
	if orderNumber == "" {
		response.BadRequest(c, "Nomor order tidak valid")
		return
	}

	order, err := h.svc.GetByOrderNumberForUser(c.Request.Context(), userID, orderNumber)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", toUserSosmedBundleOrderResponse(order))
}

func (h *SosmedBundleOrderHandler) AdminList(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	page, limit := parsePageLimit(c, 20, 100)

	orders, total, err := h.svc.AdminList(c.Request.Context(), status, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.SuccessWithMeta(c, "OK", orders, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

func (h *SosmedBundleOrderHandler) AdminGetByOrderNumber(c *gin.Context) {
	orderNumber := strings.TrimSpace(c.Param("order_number"))
	if orderNumber == "" {
		response.BadRequest(c, "Nomor order tidak valid")
		return
	}

	order, err := h.svc.AdminGetByOrderNumber(c.Request.Context(), orderNumber)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", order)
}
