package handler

import (
	"math"
	"strconv"

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

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 20 {
		limit = 20
	}

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
