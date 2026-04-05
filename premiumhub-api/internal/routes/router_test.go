package routes

import (
	"testing"

	"premiumhub-api/config"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func openTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	return db
}

func hasRoute(routes []gin.RouteInfo, method, path string) bool {
	for _, r := range routes {
		if r.Method == method && r.Path == path {
			return true
		}
	}
	return false
}

func TestSetupProductionDisablesSimulateRoute(t *testing.T) {
	db := openTestDB(t)
	cfg := &config.Config{
		AppEnv:      "production",
		FrontendURL: "http://localhost:3000",
		JWTSecret:   "test-secret",
	}

	r := Setup(db, cfg)
	routes := r.Routes()

	if hasRoute(routes, "POST", "/api/v1/payment/simulate/:orderId") {
		t.Fatalf("simulate route should be disabled in production")
	}

	if !hasRoute(routes, "POST", "/api/v1/admin/wallet/topups/:id/recheck") {
		t.Fatalf("admin recheck route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/wallet/topups/reconcile") {
		t.Fatalf("admin reconcile route should exist")
	}
}

func TestSetupNonProductionEnablesSimulateRoute(t *testing.T) {
	db := openTestDB(t)
	cfg := &config.Config{
		AppEnv:      "development",
		FrontendURL: "http://localhost:3000",
		JWTSecret:   "test-secret",
	}

	r := Setup(db, cfg)
	routes := r.Routes()

	if !hasRoute(routes, "POST", "/api/v1/payment/simulate/:orderId") {
		t.Fatalf("simulate route should exist in non-production")
	}
}
