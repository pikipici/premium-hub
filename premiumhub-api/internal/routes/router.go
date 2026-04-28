package routes

import (
	"fmt"
	"net/http"
	"strings"

	"premiumhub-api/config"
	"premiumhub-api/internal/handler"
	"premiumhub-api/internal/middleware"
	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/service"
	"premiumhub-api/internal/storage"
	"premiumhub-api/pkg/credential"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Setup(db *gorm.DB, cfg *config.Config) *gin.Engine {
	r := gin.New()
	if cfg == nil || !strings.EqualFold(strings.TrimSpace(cfg.AppEnv), "production") {
		r.Use(gin.Logger())
	}
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.FrontendURL))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"ok":      true,
			"service": "premiumhub-api",
		})
	})

	// Repositories
	userRepo := repository.NewUserRepo(db)
	authSessionRepo := repository.NewAuthSessionRepo(db)
	accountTypeRepo := repository.NewAccountTypeRepo(db)
	productRepo := repository.NewProductRepo(db)
	productCategoryRepo := repository.NewProductCategoryRepo(db)
	sosmedServiceRepo := repository.NewSosmedServiceRepo(db)
	sosmedOrderRepo := repository.NewSosmedOrderRepo(db)
	stockRepo := repository.NewStockRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	claimRepo := repository.NewClaimRepo(db)
	notifRepo := repository.NewNotificationRepo(db)
	walletRepo := repository.NewWalletRepo(db)
	fiveSimOrderRepo := repository.NewFiveSimOrderRepo(db)
	nokosLandingRepo := repository.NewNokosLandingSummaryRepo(db)
	convertRepo := repository.NewConvertRepo(db)
	maintenanceRuleRepo := repository.NewMaintenanceRuleRepo(db)
	userSidebarMenuSettingRepo := repository.NewUserSidebarMenuSettingRepo(db)
	navbarMenuSettingRepo := repository.NewNavbarMenuSettingRepo(db)
	activityRepo := repository.NewActivityRepo(db)

	stockCredentialKey := strings.TrimSpace(cfg.StockCredentialKey)
	if stockCredentialKey == "" {
		stockCredentialKey = strings.TrimSpace(cfg.JWTSecret)
	}

	stockCredentialCipher, err := credential.NewStockCipher(stockCredentialKey)
	if err != nil {
		panic(fmt.Errorf("gagal inisialisasi stock credential cipher: %w", err))
	}

	// Services
	authSvc := service.NewAuthService(userRepo, cfg).SetSessionRepo(authSessionRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	accountTypeSvc := service.NewAccountTypeService(accountTypeRepo)
	productCategorySvc := service.NewProductCategoryService(productCategoryRepo)
	sosmedServiceSvc := service.NewSosmedServiceService(sosmedServiceRepo, productCategoryRepo).
		SetResellerFXConfig(service.NewSosmedResellerFXConfig(
			cfg.SosmedResellerFXMode,
			cfg.SosmedResellerFXFixedRate,
			cfg.SosmedResellerFXLiveURL,
			cfg.SosmedResellerFXLiveTimeout,
		))
	japSvc := service.NewJAPService(cfg, nil)
	sosmedServiceSvc.SetJAPCatalogProvider(japSvc)
	sosmedOrderSvc := service.NewSosmedOrderService(sosmedOrderRepo, sosmedServiceRepo, notifRepo).
		SetWalletRepo(walletRepo).
		SetJAPOrderProvider(japSvc)
	sosmedPaymentSvc := service.NewSosmedPaymentServiceWithGateway(cfg, sosmedOrderRepo, sosmedOrderSvc, nil)
	orderSvc := service.NewOrderService(orderRepo, stockRepo, productRepo, notifRepo).
		SetStockCredentialCipher(stockCredentialCipher)
	stockSvc := service.NewStockService(stockRepo, productRepo).
		SetAccountTypeRepo(accountTypeRepo).
		SetStockCredentialCipher(stockCredentialCipher)
	claimSvc := service.NewClaimService(claimRepo, orderRepo, stockRepo, notifRepo)
	paymentSvc := service.NewPaymentServiceWithGateway(cfg, orderRepo, orderSvc, nil)
	walletSvc := service.NewWalletService(cfg, userRepo, walletRepo, notifRepo, nil)
	paymentSvc.SetWalletService(walletSvc)
	paymentWebhookSvc := service.NewPaymentWebhookService(orderRepo, sosmedOrderRepo, walletRepo, paymentSvc, sosmedPaymentSvc, walletSvc)
	fiveSimSvc := service.NewFiveSimService(cfg, userRepo, fiveSimOrderRepo, walletRepo, nil)
	nokosLandingSvc := service.NewNokosLandingSummaryService(cfg, nokosLandingRepo, nil, nil)
	convertSvc := service.NewConvertService(userRepo, convertRepo)
	maintenanceSvc := service.NewMaintenanceService(maintenanceRuleRepo)
	userSidebarMenuSettingSvc := service.NewUserSidebarMenuSettingService(userSidebarMenuSettingRepo)
	navbarMenuSettingSvc := service.NewNavbarMenuSettingService(navbarMenuSettingRepo)
	activitySvc := service.NewActivityService(activityRepo)
	service.StartConvertExpiryWorker(cfg, convertSvc)
	service.StartFiveSimReconcileWorker(cfg, fiveSimSvc)
	service.StartWalletTopupReconcileWorker(cfg, walletSvc)
	service.StartNokosLandingSummaryWorker(cfg, nokosLandingSvc)

	convertProofStorage, err := storage.NewConvertProofStorage(cfg)
	if err != nil {
		panic(fmt.Errorf("gagal inisialisasi convert proof storage: %w", err))
	}

	productAssetStorage, err := storage.NewProductAssetStorage(cfg)
	if err != nil {
		panic(fmt.Errorf("gagal inisialisasi product asset storage: %w", err))
	}
	productSvc := service.NewProductService(productRepo, stockRepo, productAssetStorage).
		SetAccountTypeRepo(accountTypeRepo).
		SetProductCategoryRepo(productCategoryRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(authSvc, cfg)
	productHandler := handler.NewProductHandler(productSvc)
	orderHandler := handler.NewOrderHandler(orderSvc)
	paymentHandler := handler.NewPaymentHandler(paymentSvc, paymentWebhookSvc)
	walletHandler := handler.NewWalletHandler(walletSvc)
	fiveSimHandler := handler.NewFiveSimHandler(fiveSimSvc)
	nokosPublicHandler := handler.NewNokosPublicHandler(nokosLandingSvc)
	convertHandler := handler.NewConvertHandler(convertSvc, convertProofStorage, cfg)
	claimHandler := handler.NewClaimHandler(claimSvc)
	stockHandler := handler.NewStockHandler(stockSvc)
	accountTypeHandler := handler.NewAccountTypeHandler(accountTypeSvc)
	productCategoryHandler := handler.NewProductCategoryHandler(productCategorySvc)
	sosmedServiceHandler := handler.NewSosmedServiceHandler(sosmedServiceSvc)
	japHandler := handler.NewJAPHandler(japSvc)
	sosmedOrderHandler := handler.NewSosmedOrderHandler(sosmedOrderSvc)
	sosmedPaymentHandler := handler.NewSosmedPaymentHandler(sosmedPaymentSvc)
	maintenanceHandler := handler.NewMaintenanceHandler(maintenanceSvc)
	userSidebarMenuSettingHandler := handler.NewUserSidebarMenuSettingHandler(userSidebarMenuSettingSvc)
	navbarMenuSettingHandler := handler.NewNavbarMenuSettingHandler(navbarMenuSettingSvc)
	activityHandler := handler.NewActivityHandler(activitySvc)
	adminHandler := handler.NewAdminHandler(orderRepo, claimRepo, userRepo, notifSvc)
	userHandler := handler.NewUserHandler(authSvc, notifSvc)

	api := r.Group("/api/v1")
	api.Use(
		middleware.MaxRequestBodyBytes(cfg.MaxRequestBodyBytes),
		middleware.NewIPRateLimiter(cfg.GlobalRateLimitMax, cfg.GlobalRateLimitWindow, "Terlalu banyak request API. Coba lagi sebentar."),
	)

	// Public routes
	auth := api.Group("/auth")
	auth.Use(middleware.NewAuthRateLimiter(cfg.AuthRateLimitMax, cfg.AuthRateLimitWindow))
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)
	auth.POST("/google", authHandler.GoogleLogin)
	auth.POST("/logout", authHandler.Logout)
	auth.GET("/session", authHandler.Session)

	products := api.Group("/products")
	products.GET("", productHandler.List)
	products.GET("/:slug", productHandler.GetBySlug)
	products.GET("/:slug/prices", productHandler.GetPrices)

	api.GET("/account-types", accountTypeHandler.List)
	api.GET("/product-categories", productCategoryHandler.List)
	api.GET("/maintenance/evaluate", maintenanceHandler.Evaluate)

	api.POST(
		"/payment/webhook",
		middleware.NewIPRateLimiter(cfg.WebhookRateLimitMax, cfg.WebhookRateLimitWindow, "Terlalu banyak request webhook. Coba lagi sebentar."),
		paymentHandler.Webhook,
	)
	api.GET("/public/nokos/landing-summary", nokosPublicHandler.GetLandingSummary)
	api.GET("/public/nokos/countries", nokosPublicHandler.GetCountries)
	api.GET("/public/navbar-menu", navbarMenuSettingHandler.PublicList)
	api.GET("/public/sosmed/services", sosmedServiceHandler.PublicList)
	api.GET(
		"/convert/track/:token",
		middleware.NewIPRateLimiter(cfg.ConvertTrackRateLimitMax, cfg.ConvertTrackRateLimitWindow, "Terlalu banyak request tracking convert. Coba lagi sebentar."),
		convertHandler.TrackOrder,
	)
	api.GET(
		"/convert/proofs/:proofId/view",
		middleware.NewIPRateLimiter(cfg.ConvertTrackRateLimitMax, cfg.ConvertTrackRateLimitWindow, "Terlalu banyak request bukti convert. Coba lagi sebentar."),
		convertHandler.ViewProof,
	)
	api.POST(
		"/convert/guest/orders",
		middleware.NewIPRateLimiter(cfg.ConvertCreateRateLimitMax, cfg.ConvertCreateRateLimitWindow, "Terlalu banyak request buat order convert guest. Coba lagi sebentar."),
		convertHandler.CreateGuestOrder,
	)
	api.POST(
		"/convert/track/:token/proofs",
		middleware.NewIPRateLimiter(cfg.ConvertProofRateLimitMax, cfg.ConvertProofRateLimitWindow, "Terlalu banyak upload bukti convert. Coba lagi sebentar."),
		convertHandler.UploadProofByToken,
	)

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

	protected.POST("/sosmed/orders", sosmedOrderHandler.Create)
	protected.GET("/sosmed/orders", sosmedOrderHandler.List)
	protected.GET("/sosmed/orders/:id", sosmedOrderHandler.GetByID)
	protected.DELETE("/sosmed/orders/:id", sosmedOrderHandler.Cancel)
	protected.POST("/sosmed/orders/:id/refill", sosmedOrderHandler.RequestRefill)

	protected.GET("/activities/history", activityHandler.List)
	protected.GET("/me/sidebar-menu", userSidebarMenuSettingHandler.List)

	protected.GET(
		"/payment/methods",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak request metode pembayaran. Coba lagi sebentar."),
		paymentHandler.ListMethods,
	)
	protected.POST(
		"/payment/create",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak request pembayaran. Coba lagi sebentar."),
		paymentHandler.Create,
	)
	protected.GET(
		"/payment/status/:orderId",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak cek status pembayaran. Coba lagi sebentar."),
		paymentHandler.GetStatus,
	)
	protected.POST(
		"/sosmed/payments",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak request pembayaran. Coba lagi sebentar."),
		sosmedPaymentHandler.Create,
	)
	protected.GET(
		"/sosmed/payments/status/:orderId",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak cek status pembayaran. Coba lagi sebentar."),
		sosmedPaymentHandler.GetStatus,
	)

	protected.GET("/wallet/balance", walletHandler.Balance)
	protected.GET("/wallet/ledger", walletHandler.ListLedger)
	protected.POST(
		"/wallet/topups",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak request topup. Coba lagi sebentar."),
		walletHandler.CreateTopup,
	)
	protected.GET("/wallet/topups", walletHandler.ListTopups)
	protected.GET("/wallet/topups/:id", walletHandler.GetTopup)
	protected.POST(
		"/wallet/topups/:id/check",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak cek topup. Coba lagi sebentar."),
		walletHandler.CheckTopup,
	)

	protected.POST(
		"/convert/orders",
		middleware.NewUserRateLimiter(cfg.ConvertCreateRateLimitMax, cfg.ConvertCreateRateLimitWindow, "Terlalu banyak request buat order convert. Coba lagi sebentar."),
		convertHandler.CreateOrder,
	)
	protected.GET("/convert/orders", convertHandler.ListOrders)
	protected.GET("/convert/orders/:id", convertHandler.GetOrder)
	protected.POST(
		"/convert/orders/:id/proofs",
		middleware.NewUserRateLimiter(cfg.ConvertProofRateLimitMax, cfg.ConvertProofRateLimitWindow, "Terlalu banyak upload bukti convert. Coba lagi sebentar."),
		convertHandler.UploadProof,
	)

	protected.GET(
		"/5sim/catalog/countries",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak request katalog provider. Coba lagi sebentar."),
		fiveSimHandler.GetCountries,
	)
	protected.GET(
		"/5sim/catalog/products",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak request katalog provider. Coba lagi sebentar."),
		fiveSimHandler.GetProducts,
	)
	protected.GET(
		"/5sim/catalog/prices",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak request katalog provider. Coba lagi sebentar."),
		fiveSimHandler.GetPrices,
	)

	protected.GET("/5sim/orders", fiveSimHandler.ListOrders)
	protected.POST(
		"/5sim/orders/activation",
		middleware.NewUserRateLimiter(cfg.FiveSimBuyRateLimitMax, cfg.FiveSimBuyRateLimitWindow, "Terlalu banyak request pembelian 5sim. Coba lagi sebentar."),
		fiveSimHandler.BuyActivation,
	)
	protected.POST(
		"/5sim/orders/hosting",
		middleware.NewUserRateLimiter(cfg.FiveSimBuyRateLimitMax, cfg.FiveSimBuyRateLimitWindow, "Terlalu banyak request pembelian 5sim. Coba lagi sebentar."),
		fiveSimHandler.BuyHosting,
	)
	protected.POST(
		"/5sim/orders/reuse",
		middleware.NewUserRateLimiter(cfg.FiveSimBuyRateLimitMax, cfg.FiveSimBuyRateLimitWindow, "Terlalu banyak request pembelian 5sim. Coba lagi sebentar."),
		fiveSimHandler.ReuseNumber,
	)
	protected.GET(
		"/5sim/orders/:id",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak sinkron order provider. Coba lagi sebentar."),
		fiveSimHandler.CheckOrder,
	)
	protected.POST(
		"/5sim/orders/:id/finish",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak aksi order provider. Coba lagi sebentar."),
		fiveSimHandler.FinishOrder,
	)
	protected.POST(
		"/5sim/orders/:id/cancel",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak aksi order provider. Coba lagi sebentar."),
		fiveSimHandler.CancelOrder,
	)
	protected.POST(
		"/5sim/orders/:id/ban",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak aksi order provider. Coba lagi sebentar."),
		fiveSimHandler.BanOrder,
	)
	protected.GET(
		"/5sim/orders/:id/sms-inbox",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak cek inbox provider. Coba lagi sebentar."),
		fiveSimHandler.GetSMSInbox,
	)

	protected.POST("/claims", claimHandler.Create)
	protected.GET("/claims", claimHandler.List)
	protected.GET("/claims/:id", claimHandler.GetByID)

	// Admin routes
	admin := api.Group("/admin")
	admin.Use(middleware.Auth(cfg.JWTSecret), middleware.AdminOnly())

	admin.GET("/dashboard", adminHandler.Dashboard)
	admin.GET(
		"/5sim/profile",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak request provider. Coba lagi sebentar."),
		fiveSimHandler.GetProviderProfile,
	)
	admin.GET(
		"/5sim/orders",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak request provider. Coba lagi sebentar."),
		fiveSimHandler.GetProviderOrderHistory,
	)

	admin.GET("/products", productHandler.AdminList)
	admin.POST("/products", productHandler.Create)
	admin.PUT("/products/:id", productHandler.Update)
	admin.POST("/products/:id/assets", productHandler.UploadAsset)
	admin.DELETE("/products/:id", productHandler.Delete)
	admin.DELETE("/products/:id/permanent", productHandler.DeletePermanent)
	admin.POST("/products/:id/prices", productHandler.CreatePrice)
	admin.PUT("/products/:id/prices/:priceId", productHandler.UpdatePrice)
	admin.DELETE("/products/:id/prices/:priceId", productHandler.DeletePrice)

	admin.GET("/account-types", accountTypeHandler.List)
	admin.POST("/account-types", accountTypeHandler.Create)
	admin.PUT("/account-types/:id", accountTypeHandler.Update)
	admin.DELETE("/account-types/:id", accountTypeHandler.Delete)

	admin.GET("/product-categories", productCategoryHandler.List)
	admin.POST("/product-categories", productCategoryHandler.Create)
	admin.PUT("/product-categories/:id", productCategoryHandler.Update)
	admin.DELETE("/product-categories/:id", productCategoryHandler.Delete)

	admin.GET("/sosmed/services", sosmedServiceHandler.AdminList)
	admin.GET(
		"/sosmed/provider/jap/balance",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak request provider. Coba lagi sebentar."),
		japHandler.GetBalance,
	)
	admin.GET(
		"/sosmed/provider/jap/services",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak request provider. Coba lagi sebentar."),
		japHandler.GetServices,
	)
	admin.POST("/sosmed/services", sosmedServiceHandler.Create)
	admin.POST("/sosmed/services/preview-jap-selected", sosmedServiceHandler.PreviewSelectedFromJAP)
	admin.POST("/sosmed/services/import-jap-selected", sosmedServiceHandler.ImportSelectedFromJAP)
	admin.POST("/sosmed/services/reprice-reseller", sosmedServiceHandler.RepriceReseller)
	admin.PUT("/sosmed/services/:id", sosmedServiceHandler.Update)
	admin.DELETE("/sosmed/services/:id", sosmedServiceHandler.Delete)

	admin.GET("/maintenance/rules", maintenanceHandler.AdminList)
	admin.POST("/maintenance/rules", maintenanceHandler.AdminCreate)
	admin.PUT("/maintenance/rules/:id", maintenanceHandler.AdminUpdate)
	admin.DELETE("/maintenance/rules/:id", maintenanceHandler.AdminDelete)
	admin.GET("/settings/user-sidebar-menu", userSidebarMenuSettingHandler.List)
	admin.PUT("/settings/user-sidebar-menu", userSidebarMenuSettingHandler.AdminUpdate)
	admin.GET("/settings/navbar-menu", navbarMenuSettingHandler.AdminList)
	admin.PUT("/settings/navbar-menu", navbarMenuSettingHandler.AdminUpdate)

	admin.GET("/stocks", stockHandler.List)
	admin.POST("/stocks", stockHandler.Create)
	admin.POST("/stocks/bulk", stockHandler.CreateBulk)
	admin.PUT("/stocks/:id", stockHandler.Update)
	admin.DELETE("/stocks/:id", stockHandler.Delete)

	admin.GET("/orders", orderHandler.AdminList)
	admin.PUT("/orders/:id/confirm", orderHandler.Confirm)
	admin.POST("/orders/:id/send", orderHandler.SendAccount)

	admin.GET("/sosmed/orders", sosmedOrderHandler.AdminList)
	admin.GET("/sosmed/orders/ops-summary", sosmedOrderHandler.AdminOpsSummary)
	admin.POST(
		"/sosmed/orders/sync-provider",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak sinkron provider. Coba lagi sebentar."),
		sosmedOrderHandler.AdminSyncProcessingProviders,
	)
	admin.GET("/sosmed/orders/:id", sosmedOrderHandler.AdminGetByID)
	admin.PATCH("/sosmed/orders/:id/status", sosmedOrderHandler.AdminUpdateStatus)
	admin.POST(
		"/sosmed/orders/:id/sync-provider",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak sinkron provider. Coba lagi sebentar."),
		sosmedOrderHandler.AdminSyncProvider,
	)
	admin.POST(
		"/sosmed/orders/:id/retry-provider",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak retry provider. Coba lagi sebentar."),
		sosmedOrderHandler.AdminRetryProvider,
	)
	admin.POST(
		"/sosmed/orders/:id/refill",
		middleware.NewUserRateLimiter(cfg.ProviderRateLimitMax, cfg.ProviderRateLimitWindow, "Terlalu banyak refill provider. Coba lagi sebentar."),
		sosmedOrderHandler.AdminTriggerRefill,
	)
	admin.POST("/sosmed/orders/:id/backfill-refill", sosmedOrderHandler.AdminBackfillRefill)
	admin.POST("/sosmed/orders/backfill-refill", sosmedOrderHandler.AdminBackfillAllRefill)

	admin.GET("/claims", claimHandler.AdminList)
	admin.PUT("/claims/:id/approve", claimHandler.Approve)
	admin.PUT("/claims/:id/reject", claimHandler.Reject)

	admin.GET("/users", adminHandler.ListUsers)
	admin.PUT("/users/:id/block", adminHandler.BlockUser)
	admin.POST(
		"/wallet/topups/:id/recheck",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak recheck topup. Coba lagi sebentar."),
		walletHandler.AdminRecheckTopup,
	)
	admin.POST(
		"/wallet/topups/reconcile",
		middleware.NewUserRateLimiter(cfg.PaymentRateLimitMax, cfg.PaymentRateLimitWindow, "Terlalu banyak reconcile topup. Coba lagi sebentar."),
		walletHandler.ReconcilePending,
	)

	admin.GET("/convert/orders", convertHandler.AdminListOrders)
	admin.GET("/convert/orders/:id", convertHandler.AdminGetOrder)
	admin.PATCH(
		"/convert/orders/:id/status",
		middleware.NewUserRateLimiter(cfg.ConvertAdminStatusRateLimitMax, cfg.ConvertAdminStatusRateLimitWindow, "Terlalu banyak update status convert. Coba lagi sebentar."),
		convertHandler.AdminUpdateOrderStatus,
	)
	admin.POST(
		"/convert/orders/:id/settlement-proofs",
		middleware.NewUserRateLimiter(cfg.ConvertProofRateLimitMax, cfg.ConvertProofRateLimitWindow, "Terlalu banyak upload bukti settlement convert. Coba lagi sebentar."),
		convertHandler.AdminUploadSettlementProof,
	)
	admin.POST("/convert/orders/expire-pending", convertHandler.AdminExpirePending)
	admin.GET("/convert/pricing", convertHandler.AdminGetPricingRules)
	admin.PUT("/convert/pricing", convertHandler.AdminUpdatePricingRules)
	admin.GET("/convert/limits", convertHandler.AdminGetLimitRules)
	admin.PUT("/convert/limits", convertHandler.AdminUpdateLimitRules)

	return r
}
