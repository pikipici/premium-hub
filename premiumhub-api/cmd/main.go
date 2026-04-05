package main

import (
	"log"
	"premiumhub-api/config"
	"premiumhub-api/internal/routes"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	db := config.InitDB(cfg)
	r := routes.Setup(db, cfg)
	log.Printf("Server running on :%s", cfg.AppPort)
	if err := r.Run(":" + cfg.AppPort); err != nil {
		log.Fatal(err)
	}
}
