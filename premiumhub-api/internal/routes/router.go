package routes

import (
	"strings"

	"premiumhub-api/config"
	"premiumhub-api/internal/handler"
	"premiumhub-api/internal/middleware"
	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Setup(db *gorm.DB, cfg *config.Config) *gin.Engine {
	r := gin.Default()
	r.Use(middleware.CORS(cfg.FrontendURL))

	// Repositories
	userRepo := repository.NewUserRepo(db)
	productRepo := repository.NewProductRepo(db)
	stockRepo := repository.NewStockRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	claimRepo := repository.NewClaimRepo(db)
	notifRepo := repository.NewNotificationRepo(db)
	walletRepo := repository.NewWalletRepo(db)
	fiveSimOrderRepo := repository.NewFiveSimOrderRepo(db)

	// Services
	authSvc := service.NewAuthService(userRepo, cfg)
	productSvc := service.NewProductService(productRepo, stockRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	orderSvc := service.NewOrderService(orderRepo, stockRepo, productRepo, notifRepo)
	stockSvc := service.NewStockService(stockRepo)
	claimSvc := service.NewClaimService(claimRepo, orderRepo, stockRepo, notifRepo)
	paymentSvc := service.NewPaymentService(orderRepo, orderSvc)
	walletSvc := service.NewWalletService(cfg, userRepo, walletRepo, notifRepo, nil)
	fiveSimSvc := service.NewFiveSimService(cfg, userRepo, fiveSimOrderRepo, walletRepo, nil)

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc, cfg)
	productHandler := handler.NewProductHandler(productSvc)
	orderHandler := handler.NewOrderHandler(orderSvc)
	paymentHandler := handler.NewPaymentHandler(paymentSvc)
	walletHandler := handler.NewWalletHandler(walletSvc)
	fiveSimHandler := handler.NewFiveSimHandler(fiveSimSvc)
	claimHandler := handler.NewClaimHandler(claimSvc)
	stockHandler := handler.NewStockHandler(stockSvc)
	adminHandler := handler.NewAdminHandler(orderRepo, claimRepo, userRepo, notifSvc)
	userHandler := handler.NewUserHandler(authSvc, notifSvc)

	api := r.Group("/api/v1")

	// Public routes
	auth := api.Group("/auth")
	auth.Use(middleware.NewAuthRateLimiter(cfg.AuthRateLimitMax, cfg.AuthRateLimitWindow))
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)
	auth.POST("/google", authHandler.GoogleLogin)
	auth.POST("/logout", authHandler.Logout)

	products := api.Group("/products")
	products.GET("", productHandler.List)
	products.GET("/:slug", productHandler.GetBySlug)
	products.GET("/:slug/prices", productHandler.GetPrices)

	api.POST("/payment/webhook", paymentHandler.Webhook)

	// Protected routes
	protected := api.Group("")
	protected.Use(middleware.Auth(cfg.JWTSecret))

	protected.GET("/me", authHandler.GetProfile)
	protected.PUT("/me", authHandler.UpdateProfile)
	protected.PUT("/me/password", authHandler.ChangePassword)
	protected.GET("/me/notifications", userHandler.GetNotifications)
	protected.PUT("/me/notifications/:id/read", userHandler.MarkNotificationRead)

	protected.POST("/orders", orderHandler.Create)
	protected.GET("/orders", orderHandler.List)
	protected.GET("/orders/:id", orderHandler.GetByID)
	protected.DELETE("/orders/:id", orderHandler.Cancel)

	protected.POST("/payment/create", paymentHandler.Create)
	protected.GET("/payment/status/:orderId", paymentHandler.GetStatus)
	if strings.ToLower(cfg.AppEnv) != "production" {
		protected.POST("/payment/simulate/:orderId", paymentHandler.SimulatePayment) // DEV only
	}

	protected.GET("/wallet/balance", walletHandler.Balance)
	protected.GET("/wallet/ledger", walletHandler.ListLedger)
	protected.POST("/wallet/topups", walletHandler.CreateTopup)
	protected.GET("/wallet/topups", walletHandler.ListTopups)
	protected.GET("/wallet/topups/:id", walletHandler.GetTopup)
	protected.POST("/wallet/topups/:id/check", walletHandler.CheckTopup)

	protected.GET("/5sim/catalog/countries", fiveSimHandler.GetCountries)
	protected.GET("/5sim/catalog/products", fiveSimHandler.GetProducts)
	protected.GET("/5sim/catalog/prices", fiveSimHandler.GetPrices)

	protected.GET("/5sim/orders", fiveSimHandler.ListOrders)
	protected.POST("/5sim/orders/activation", fiveSimHandler.BuyActivation)
	protected.POST("/5sim/orders/hosting", fiveSimHandler.BuyHosting)
	protected.POST("/5sim/orders/reuse", fiveSimHandler.ReuseNumber)
	protected.GET("/5sim/orders/:id", fiveSimHandler.CheckOrder)
	protected.POST("/5sim/orders/:id/finish", fiveSimHandler.FinishOrder)
	protected.POST("/5sim/orders/:id/cancel", fiveSimHandler.CancelOrder)
	protected.POST("/5sim/orders/:id/ban", fiveSimHandler.BanOrder)
	protected.GET("/5sim/orders/:id/sms-inbox", fiveSimHandler.GetSMSInbox)

	protected.POST("/claims", claimHandler.Create)
	protected.GET("/claims", claimHandler.List)
	protected.GET("/claims/:id", claimHandler.GetByID)

	// Admin routes
	admin := api.Group("/admin")
	admin.Use(middleware.Auth(cfg.JWTSecret), middleware.AdminOnly())

	admin.GET("/dashboard", adminHandler.Dashboard)
	admin.GET("/5sim/profile", fiveSimHandler.GetProviderProfile)
	admin.GET("/5sim/orders", fiveSimHandler.GetProviderOrderHistory)

	admin.GET("/products", productHandler.AdminList)
	admin.POST("/products", productHandler.Create)
	admin.PUT("/products/:id", productHandler.Update)
	admin.DELETE("/products/:id", productHandler.Delete)

	admin.GET("/stocks", stockHandler.List)
	admin.POST("/stocks", stockHandler.Create)
	admin.POST("/stocks/bulk", stockHandler.CreateBulk)
	admin.PUT("/stocks/:id", stockHandler.Update)
	admin.DELETE("/stocks/:id", stockHandler.Delete)

	admin.GET("/orders", orderHandler.AdminList)
	admin.PUT("/orders/:id/confirm", orderHandler.Confirm)
	admin.POST("/orders/:id/send", orderHandler.SendAccount)

	admin.GET("/claims", claimHandler.AdminList)
	admin.PUT("/claims/:id/approve", claimHandler.Approve)
	admin.PUT("/claims/:id/reject", claimHandler.Reject)

	admin.GET("/users", adminHandler.ListUsers)
	admin.PUT("/users/:id/block", adminHandler.BlockUser)
	admin.POST("/wallet/topups/:id/recheck", walletHandler.AdminRecheckTopup)
	admin.POST("/wallet/topups/reconcile", walletHandler.ReconcilePending)

	return r
}
