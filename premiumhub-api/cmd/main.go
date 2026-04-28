package main

import (
	"log"
	"net/http"
	"premiumhub-api/config"
	"premiumhub-api/internal/routes"
	"strconv"
	"strings"
	"time"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	db := config.InitDB(cfg)
	r := routes.Setup(db, cfg)
	log.Printf("Server running on :%s", cfg.AppPort)
	srv := &http.Server{
		Addr:              ":" + cfg.AppPort,
		Handler:           r,
		ReadHeaderTimeout: parseServerDuration(cfg.HTTPReadHeaderTimeout, 5*time.Second),
		ReadTimeout:       parseServerDuration(cfg.HTTPReadTimeout, 15*time.Second),
		WriteTimeout:      parseServerDuration(cfg.HTTPWriteTimeout, 30*time.Second),
		IdleTimeout:       parseServerDuration(cfg.HTTPIdleTimeout, 60*time.Second),
		MaxHeaderBytes:    parseServerInt(cfg.HTTPMaxHeaderBytes, 1<<20),
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func parseServerDuration(raw string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}

func parseServerInt(raw string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
