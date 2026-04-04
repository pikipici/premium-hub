package routes

import (
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

	// Services
	authSvc := service.NewAuthService(userRepo, cfg)
	productSvc := service.NewProductService(productRepo, stockRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	orderSvc := service.NewOrderService(orderRepo, stockRepo, productRepo, notifRepo)
	stockSvc := service.NewStockService(stockRepo)
	claimSvc := service.NewClaimService(claimRepo, orderRepo, stockRepo, notifRepo)
	paymentSvc := service.NewPaymentService(orderRepo, orderSvc)

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc)
	productHandler := handler.NewProductHandler(productSvc)
	orderHandler := handler.NewOrderHandler(orderSvc)
	paymentHandler := handler.NewPaymentHandler(paymentSvc)
	claimHandler := handler.NewClaimHandler(claimSvc)
	stockHandler := handler.NewStockHandler(stockSvc)
	adminHandler := handler.NewAdminHandler(orderRepo, claimRepo, userRepo, notifSvc)
	userHandler := handler.NewUserHandler(authSvc, notifSvc)

	api := r.Group("/api/v1")

	// Public routes
	auth := api.Group("/auth")
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)
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
	protected.POST("/payment/simulate/:orderId", paymentHandler.SimulatePayment) // DEV only

	protected.POST("/claims", claimHandler.Create)
	protected.GET("/claims", claimHandler.List)
	protected.GET("/claims/:id", claimHandler.GetByID)

	// Admin routes
	admin := api.Group("/admin")
	admin.Use(middleware.Auth(cfg.JWTSecret), middleware.AdminOnly())

	admin.GET("/dashboard", adminHandler.Dashboard)

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

	return r
}
