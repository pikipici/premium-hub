package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestParsePageLimitClampsPageAndLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("GET", "/?page=0&limit=999", nil)

	page, limit := parsePageLimit(ctx, DefaultAdminPageLimit, MaxPageLimit)
	if page != 1 {
		t.Fatalf("expected page clamp to 1, got %d", page)
	}
	if limit != MaxPageLimit {
		t.Fatalf("expected limit clamp to %d, got %d", MaxPageLimit, limit)
	}
}

func TestParseLimitDefaultsInvalidValue(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("GET", "/?limit=-5", nil)

	limit := parseLimit(ctx, DefaultAuditReportLimit, MaxAuditReportLimit)
	if limit != DefaultAuditReportLimit {
		t.Fatalf("expected default audit limit %d, got %d", DefaultAuditReportLimit, limit)
	}
}
