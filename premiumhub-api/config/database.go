package config

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"premiumhub-api/internal/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg *Config) *gorm.DB {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Info)})
	if err != nil {
		log.Fatal("DB connect:", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.AuthSession{},
		&model.AccountType{},
		&model.ProductCategory{},
		&model.MaintenanceRule{},
		&model.UserSidebarMenuSetting{},
		&model.Product{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.ProductPrice{},
		&model.Stock{},
		&model.Order{},
		&model.Claim{},
		&model.Notification{},
		&model.WalletTopup{},
		&model.WalletLedger{},
		&model.FiveSimOrder{},
		&model.FiveSimOrderIdempotency{},
		&model.NokosLandingSummary{},
		&model.ConvertOrder{},
		&model.ConvertOrderEvent{},
		&model.ConvertProof{},
		&model.ConvertPricingRule{},
		&model.ConvertLimitRule{},
		&model.ConvertTrackingToken{},
	); err != nil {
		log.Fatal("DB migrate:", err)
	}

	if err := ensureDefaultAccountTypes(db); err != nil {
		log.Fatal("DB account type defaults:", err)
	}

	if err := ensureDefaultProductCategories(db); err != nil {
		log.Fatal("DB product category defaults:", err)
	}

	if err := ensureDefaultSosmedServices(db); err != nil {
		log.Fatal("DB sosmed service defaults:", err)
	}

	if err := ensureDefaultUserSidebarMenuSettings(db); err != nil {
		log.Fatal("DB user sidebar menu defaults:", err)
	}

	if err := applyPaymentSchemaCleanup(db); err != nil {
		log.Fatal("DB payment migration:", err)
	}

	log.Println("DB connected & migrated")
	return db
}

func ensureDefaultUserSidebarMenuSettings(db *gorm.DB) error {
	defaults := []model.UserSidebarMenuSetting{
		{Key: "convert_history", Label: "Riwayat Convert", Href: "/dashboard/convert/orders", SortOrder: 30, IsVisible: false, IsSystem: true},
		{Key: "active_accounts", Label: "Akun Aktif", Href: "/dashboard/akun-aktif", SortOrder: 60, IsVisible: false, IsSystem: true},
		{Key: "order_history", Label: "Riwayat Order", Href: "/dashboard/riwayat-order", SortOrder: 70, IsVisible: false, IsSystem: true},
		{Key: "warranty_claim", Label: "Klaim Garansi", Href: "/dashboard/klaim-garansi", SortOrder: 80, IsVisible: false, IsSystem: true},
	}

	for _, item := range defaults {
		var existing model.UserSidebarMenuSetting
		err := db.Where("key = ?", item.Key).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if createErr := db.Create(&item).Error; createErr != nil {
				return createErr
			}
			continue
		}
		if err != nil {
			return err
		}

		updates := map[string]interface{}{}
		if strings.TrimSpace(existing.Label) == "" || existing.Label != item.Label {
			updates["label"] = item.Label
		}
		if strings.TrimSpace(existing.Href) == "" || existing.Href != item.Href {
			updates["href"] = item.Href
		}
		if existing.SortOrder == 0 || existing.SortOrder != item.SortOrder {
			updates["sort_order"] = item.SortOrder
		}
		if !existing.IsSystem {
			updates["is_system"] = true
		}
		if len(updates) > 0 {
			if updateErr := db.Model(&existing).Updates(updates).Error; updateErr != nil {
				return updateErr
			}
		}
	}

	return nil
}

func ensureDefaultAccountTypes(db *gorm.DB) error {
	defaults := []model.AccountType{
		{
			Code:           "shared",
			Label:          "Shared · Akun Bersama",
			Description:    "Akun dipakai bersama beberapa user.",
			SortOrder:      10,
			BadgeBgColor:   "#ECFDF5",
			BadgeTextColor: "#047857",
			IsActive:       true,
			IsSystem:       true,
		},
		{
			Code:           "private",
			Label:          "Private · Akun Pribadi",
			Description:    "Akun dedicated untuk satu user.",
			SortOrder:      20,
			BadgeBgColor:   "#EFF6FF",
			BadgeTextColor: "#1D4ED8",
			IsActive:       true,
			IsSystem:       true,
		},
	}

	for _, item := range defaults {
		var existing model.AccountType
		err := db.Where("code = ?", item.Code).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if createErr := db.Create(&item).Error; createErr != nil {
				return createErr
			}
			continue
		}
		if err != nil {
			return err
		}

		updates := map[string]interface{}{}
		if strings.TrimSpace(existing.Label) == "" {
			updates["label"] = item.Label
		}
		if strings.TrimSpace(existing.Description) == "" {
			updates["description"] = item.Description
		}
		if existing.SortOrder == 0 {
			updates["sort_order"] = item.SortOrder
		}
		if strings.TrimSpace(existing.BadgeBgColor) == "" {
			updates["badge_bg_color"] = item.BadgeBgColor
		}
		if strings.TrimSpace(existing.BadgeTextColor) == "" {
			updates["badge_text_color"] = item.BadgeTextColor
		}
		if !existing.IsSystem {
			updates["is_system"] = true
		}

		if len(updates) > 0 {
			if updateErr := db.Model(&existing).Updates(updates).Error; updateErr != nil {
				return updateErr
			}
		}
	}

	return nil
}

func ensureDefaultProductCategories(db *gorm.DB) error {
	defaults := []model.ProductCategory{
		{Scope: model.ProductCategoryScopePremApps, Code: "streaming", Label: "Streaming", Description: "Kategori layanan streaming premium.", SortOrder: 10, IsActive: true},
		{Scope: model.ProductCategoryScopePremApps, Code: "music", Label: "Musik", Description: "Kategori layanan musik premium.", SortOrder: 20, IsActive: true},
		{Scope: model.ProductCategoryScopePremApps, Code: "gaming", Label: "Gaming", Description: "Kategori layanan gaming premium.", SortOrder: 30, IsActive: true},
		{Scope: model.ProductCategoryScopePremApps, Code: "design", Label: "Desain", Description: "Kategori tools desain dan kreatif.", SortOrder: 40, IsActive: true},
		{Scope: model.ProductCategoryScopePremApps, Code: "productivity", Label: "Produktivitas", Description: "Kategori tools produktivitas kerja.", SortOrder: 50, IsActive: true},
		{Scope: model.ProductCategoryScopeSosmed, Code: "followers", Label: "Followers", Description: "Paket pertumbuhan followers akun sosial media.", SortOrder: 10, IsActive: true},
		{Scope: model.ProductCategoryScopeSosmed, Code: "likes", Label: "Likes", Description: "Paket likes/favorite untuk social proof.", SortOrder: 20, IsActive: true},
		{Scope: model.ProductCategoryScopeSosmed, Code: "views", Label: "Views", Description: "Paket views/watchtime untuk konten video.", SortOrder: 30, IsActive: true},
		{Scope: model.ProductCategoryScopeSosmed, Code: "comments", Label: "Komentar", Description: "Paket komentar aktif untuk engagement.", SortOrder: 40, IsActive: true},
		{Scope: model.ProductCategoryScopeSosmed, Code: "shares", Label: "Share", Description: "Paket share dan save untuk distribusi konten.", SortOrder: 50, IsActive: true},
	}

	for _, item := range defaults {
		var existing model.ProductCategory
		err := db.Where("scope = ? AND code = ?", item.Scope, item.Code).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if createErr := db.Create(&item).Error; createErr != nil {
				return createErr
			}
			continue
		}
		if err != nil {
			return err
		}

		updates := map[string]interface{}{}
		if strings.TrimSpace(existing.Label) == "" {
			updates["label"] = item.Label
		}
		if strings.TrimSpace(existing.Description) == "" {
			updates["description"] = item.Description
		}
		if existing.SortOrder == 0 {
			updates["sort_order"] = item.SortOrder
		}
		if len(updates) > 0 {
			if updateErr := db.Model(&existing).Updates(updates).Error; updateErr != nil {
				return updateErr
			}
		}
	}

	return nil
}

func ensureDefaultSosmedServices(db *gorm.DB) error {
	var existingCount int64
	if err := db.Model(&model.SosmedService{}).Count(&existingCount).Error; err != nil {
		return err
	}
	// Seed default sosmed services only for a brand-new database.
	// Once operators manage the catalog manually, we should not recreate
	// deleted defaults on every restart/deploy.
	if existingCount > 0 {
		return nil
	}

	defaults := []model.SosmedService{
		{
			CategoryCode:  "followers",
			Code:          "ig-followers-id",
			Title:         "IG Followers Indonesia Aktif",
			Summary:       "Followers bertahap untuk ningkatin trust profile dan social proof akun bisnis.",
			PlatformLabel: "Instagram",
			BadgeText:     "Best Seller",
			Theme:         "blue",
			MinOrder:      "100",
			StartTime:     "5-15 menit",
			Refill:        "30 hari",
			ETA:           "2-12 jam",
			PriceStart:    "Rp 28.000",
			PricePer1K:    "≈ Rp 28 / 1K",
			CheckoutPrice: 28000,
			TrustBadges:   []string{"No Password", "Gradual Delivery", "Refill 30 Hari"},
			SortOrder:     10,
			IsActive:      true,
		},
		{
			CategoryCode:  "likes",
			Code:          "ig-likes-premium",
			Title:         "IG Likes Premium",
			Summary:       "Boost likes untuk naikin engagement rate dan bantu post kelihatan lebih kredibel.",
			PlatformLabel: "Instagram",
			BadgeText:     "Fast Start",
			Theme:         "pink",
			MinOrder:      "50",
			StartTime:     "Instan",
			Refill:        "Opsional",
			ETA:           "< 6 jam",
			PriceStart:    "Rp 16.000",
			PricePer1K:    "≈ Rp 16 / 1K",
			CheckoutPrice: 16000,
			TrustBadges:   []string{"No Password", "Real Interaction", "High Retention"},
			SortOrder:     20,
			IsActive:      true,
		},
		{
			CategoryCode:  "views",
			Code:          "tiktok-reels-views",
			Title:         "TikTok/Reels Views",
			Summary:       "Paket views untuk dorong momentum konten video baru atau campaign musiman.",
			PlatformLabel: "TikTok • Instagram Reels",
			BadgeText:     "Trending Boost",
			Theme:         "yellow",
			MinOrder:      "1.000",
			StartTime:     "10-30 menit",
			Refill:        "N/A",
			ETA:           "6-24 jam",
			PriceStart:    "Rp 22.000",
			PricePer1K:    "≈ Rp 22 / 1K",
			CheckoutPrice: 22000,
			TrustBadges:   []string{"No Password", "Stable Delivery", "Campaign Friendly"},
			SortOrder:     30,
			IsActive:      true,
		},
		{
			CategoryCode:  "comments",
			Code:          "komentar-aktif-id",
			Title:         "Komentar Aktif Indonesia",
			Summary:       "Komentar random/custom untuk ngasih sinyal diskusi aktif di post lu.",
			PlatformLabel: "Instagram • TikTok",
			BadgeText:     "Custom Text",
			Theme:         "purple",
			MinOrder:      "10",
			StartTime:     "30-90 menit",
			Refill:        "Opsional",
			ETA:           "6-24 jam",
			PriceStart:    "Rp 35.000",
			PricePer1K:    "≈ Rp 350 / 10",
			CheckoutPrice: 35000,
			TrustBadges:   []string{"No Password", "Natural Pattern", "Flexible Campaign"},
			SortOrder:     40,
			IsActive:      true,
		},
		{
			CategoryCode:  "shares",
			Code:          "share-save-booster",
			Title:         "Share & Save Booster",
			Summary:       "Tambahan sinyal distribusi biar algoritma baca konten lu punya potensi sebar tinggi.",
			PlatformLabel: "Instagram • TikTok",
			BadgeText:     "Discovery Push",
			Theme:         "mint",
			MinOrder:      "25",
			StartTime:     "15-45 menit",
			Refill:        "N/A",
			ETA:           "< 12 jam",
			PriceStart:    "Rp 19.000",
			PricePer1K:    "≈ Rp 19 / 1K",
			CheckoutPrice: 19000,
			TrustBadges:   []string{"No Password", "Gradual Delivery", "Algorithm Friendly"},
			SortOrder:     50,
			IsActive:      true,
		},
	}

	for _, item := range defaults {
		var existing model.SosmedService
		err := db.Where("code = ?", item.Code).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if createErr := db.Create(&item).Error; createErr != nil {
				return createErr
			}
			continue
		}
		if err != nil {
			return err
		}

		updates := map[string]interface{}{}
		if strings.TrimSpace(existing.Title) == "" {
			updates["title"] = item.Title
		}
		if strings.TrimSpace(existing.Summary) == "" {
			updates["summary"] = item.Summary
		}
		if strings.TrimSpace(existing.PlatformLabel) == "" {
			updates["platform_label"] = item.PlatformLabel
		}
		if strings.TrimSpace(existing.BadgeText) == "" {
			updates["badge_text"] = item.BadgeText
		}
		if strings.TrimSpace(existing.Theme) == "" {
			updates["theme"] = item.Theme
		}
		if strings.TrimSpace(existing.MinOrder) == "" {
			updates["min_order"] = item.MinOrder
		}
		if strings.TrimSpace(existing.StartTime) == "" {
			updates["start_time"] = item.StartTime
		}
		if strings.TrimSpace(existing.Refill) == "" {
			updates["refill"] = item.Refill
		}
		if strings.TrimSpace(existing.ETA) == "" {
			updates["eta"] = item.ETA
		}
		if strings.TrimSpace(existing.PriceStart) == "" {
			updates["price_start"] = item.PriceStart
		}
		if strings.TrimSpace(existing.PricePer1K) == "" {
			updates["price_per1_k"] = item.PricePer1K
		}
		if existing.CheckoutPrice <= 0 {
			updates["checkout_price"] = item.CheckoutPrice
		}
		if existing.SortOrder == 0 {
			updates["sort_order"] = item.SortOrder
		}
		if len(existing.TrustBadges) == 0 {
			updates["trust_badges"] = item.TrustBadges
		}
		if strings.TrimSpace(existing.CategoryCode) == "" {
			updates["category_code"] = item.CategoryCode
		}
		if len(updates) > 0 {
			if updateErr := db.Model(&existing).Updates(updates).Error; updateErr != nil {
				return updateErr
			}
		}
	}

	return nil
}
