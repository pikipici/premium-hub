package config

import (
	"fmt"
	"log"

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
		&model.Product{},
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

	if err := applyPaymentSchemaCleanup(db); err != nil {
		log.Fatal("DB payment migration:", err)
	}

	log.Println("DB connected & migrated")
	return db
}
