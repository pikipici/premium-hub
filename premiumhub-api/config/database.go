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
		&model.AccountType{},
		&model.MaintenanceRule{},
		&model.Product{},
		&model.ProductPrice{},
		&model.Stock{},
		&model.Order{},
		&model.Claim{},
		&model.Notification{},
		&model.WalletTopup{},
		&model.WalletLedger{},
		&model.FiveSimOrder{},
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

	if err := applyPaymentSchemaCleanup(db); err != nil {
		log.Fatal("DB payment migration:", err)
	}

	log.Println("DB connected & migrated")
	return db
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
