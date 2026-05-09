package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

const (
	DefaultCustomerPageLimit = 10
	DefaultAdminPageLimit    = 20
	DefaultPublicPageLimit   = 12
	MaxPageLimit             = 100
	DefaultAuditReportLimit  = 200
	MaxAuditReportLimit      = 500
	DefaultBatchActionLimit  = 20
	MaxBatchActionLimit      = 1000
)

func parsePageLimit(c *gin.Context, defaultLimit, maxLimit int) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit := parseLimit(c, defaultLimit, maxLimit)
	if page < 1 {
		page = 1
	}
	return page, limit
}

func parseLimit(c *gin.Context, defaultLimit, maxLimit int) int {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(defaultLimit)))
	if limit < 1 {
		limit = defaultLimit
	}
	if maxLimit > 0 && limit > maxLimit {
		limit = maxLimit
	}
	return limit
}
