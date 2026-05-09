package handler

import (
	"math"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ActivityHandler struct {
	activitySvc *service.ActivityService
}

func NewActivityHandler(activitySvc *service.ActivityService) *ActivityHandler {
	return &ActivityHandler{activitySvc: activitySvc}
}

func (h *ActivityHandler) List(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)

	items, total, err := h.activitySvc.ListByUser(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	response.SuccessWithMeta(c, "OK", items, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}
