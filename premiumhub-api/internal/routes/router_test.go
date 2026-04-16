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

func TestSetupProductionRoutes(t *testing.T) {
	db := openTestDB(t)
	cfg := &config.Config{
		AppEnv:      "production",
		FrontendURL: "http://localhost:3000",
		JWTSecret:   "test-secret",
	}

	r := Setup(db, cfg)
	routes := r.Routes()

	if !hasRoute(routes, "GET", "/healthz") {
		t.Fatalf("health route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/auth/google") {
		t.Fatalf("google auth route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/products/:id/prices") {
		t.Fatalf("admin product create price route should exist")
	}
	if !hasRoute(routes, "PUT", "/api/v1/admin/products/:id/prices/:priceId") {
		t.Fatalf("admin product update price route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/products/:id/assets") {
		t.Fatalf("admin product asset upload route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/account-types") {
		t.Fatalf("account type public list route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/product-categories") {
		t.Fatalf("product category public list route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/maintenance/evaluate") {
		t.Fatalf("maintenance evaluate route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/admin/account-types") {
		t.Fatalf("admin account type list route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/account-types") {
		t.Fatalf("admin account type create route should exist")
	}
	if !hasRoute(routes, "PUT", "/api/v1/admin/account-types/:id") {
		t.Fatalf("admin account type update route should exist")
	}
	if !hasRoute(routes, "DELETE", "/api/v1/admin/account-types/:id") {
		t.Fatalf("admin account type delete route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/admin/product-categories") {
		t.Fatalf("admin product category list route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/product-categories") {
		t.Fatalf("admin product category create route should exist")
	}
	if !hasRoute(routes, "PUT", "/api/v1/admin/product-categories/:id") {
		t.Fatalf("admin product category update route should exist")
	}
	if !hasRoute(routes, "DELETE", "/api/v1/admin/product-categories/:id") {
		t.Fatalf("admin product category delete route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/admin/sosmed/services") {
		t.Fatalf("admin sosmed service list route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/sosmed/services") {
		t.Fatalf("admin sosmed service create route should exist")
	}
	if !hasRoute(routes, "PUT", "/api/v1/admin/sosmed/services/:id") {
		t.Fatalf("admin sosmed service update route should exist")
	}
	if !hasRoute(routes, "DELETE", "/api/v1/admin/sosmed/services/:id") {
		t.Fatalf("admin sosmed service delete route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/admin/maintenance/rules") {
		t.Fatalf("admin maintenance list route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/maintenance/rules") {
		t.Fatalf("admin maintenance create route should exist")
	}
	if !hasRoute(routes, "PUT", "/api/v1/admin/maintenance/rules/:id") {
		t.Fatalf("admin maintenance update route should exist")
	}
	if !hasRoute(routes, "DELETE", "/api/v1/admin/maintenance/rules/:id") {
		t.Fatalf("admin maintenance delete route should exist")
	}
	if !hasRoute(routes, "DELETE", "/api/v1/admin/products/:id/permanent") {
		t.Fatalf("admin product permanent delete route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/payment/webhook") {
		t.Fatalf("payment webhook route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/public/nokos/landing-summary") {
		t.Fatalf("public nokos landing summary route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/public/nokos/countries") {
		t.Fatalf("public nokos countries route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/public/sosmed/services") {
		t.Fatalf("public sosmed services route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/wallet/topups/:id/recheck") {
		t.Fatalf("admin recheck route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/wallet/topups/reconcile") {
		t.Fatalf("admin reconcile route should exist")
	}
	if hasRoute(routes, "POST", "/api/v1/wallet/topups/webhook/pakasir") {
		t.Fatalf("dedicated wallet webhook route should not exist (use /payment/webhook)")
	}
	if !hasRoute(routes, "GET", "/api/v1/5sim/catalog/countries") {
		t.Fatalf("5sim countries route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/5sim/orders/activation") {
		t.Fatalf("5sim activation buy route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/admin/5sim/profile") {
		t.Fatalf("admin 5sim profile route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/convert/orders/expire-pending") {
		t.Fatalf("admin convert expire pending route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/admin/convert/orders/:id") {
		t.Fatalf("admin convert detail route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/admin/convert/orders/:id/settlement-proofs") {
		t.Fatalf("admin convert settlement proof upload route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/convert/guest/orders") {
		t.Fatalf("guest convert create route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/convert/track/:token/proofs") {
		t.Fatalf("guest convert upload proof by token route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/convert/proofs/:proofId/view") {
		t.Fatalf("convert proof proxy route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/activities/history") {
		t.Fatalf("activity history route should exist")
	}
}

func TestSetupDevelopmentPaymentRoutes(t *testing.T) {
	db := openTestDB(t)
	cfg := &config.Config{
		AppEnv:      "development",
		FrontendURL: "http://localhost:3000",
		JWTSecret:   "test-secret",
	}

	r := Setup(db, cfg)
	routes := r.Routes()

	if !hasRoute(routes, "POST", "/api/v1/payment/create") {
		t.Fatalf("payment create route should exist")
	}
	if !hasRoute(routes, "POST", "/api/v1/payment/webhook") {
		t.Fatalf("payment webhook route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/public/nokos/landing-summary") {
		t.Fatalf("public nokos landing summary route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/public/nokos/countries") {
		t.Fatalf("public nokos countries route should exist")
	}
	if !hasRoute(routes, "GET", "/api/v1/public/sosmed/services") {
		t.Fatalf("public sosmed services route should exist")
	}
}
