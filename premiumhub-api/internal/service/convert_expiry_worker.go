package service

import (
	"context"
	"log"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/config"
)

func StartConvertExpiryWorker(cfg *config.Config, svc *ConvertService) {
	if cfg == nil || svc == nil {
		return
	}
	if !cfg.ConvertExpiryWorkerEnabled {
		log.Printf("[convert-expiry-worker] disabled")
		return
	}

	interval := parseConvertWorkerDuration(cfg.ConvertExpiryWorkerInterval, time.Minute)
	batchLimit := parseConvertWorkerPositiveInt(cfg.ConvertExpiryWorkerBatchLimit, 200)

	log.Printf("[convert-expiry-worker] started (interval=%s, batch=%d)", interval, batchLimit)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			res, err := svc.ExpirePendingOrders(ctx, batchLimit)
			cancel()
			if err != nil {
				log.Printf("[convert-expiry-worker] run failed: %v", err)
				continue
			}

			if res != nil && (res.Checked > 0 || res.Expired > 0) {
				log.Printf("[convert-expiry-worker] run done checked=%d expired=%d", res.Checked, res.Expired)
			}
		}
	}()
}

func parseConvertWorkerDuration(raw string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}

func parseConvertWorkerPositiveInt(raw string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
