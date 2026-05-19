package service

import (
	"log"
	"strings"
	"time"

	"premiumhub-api/config"
)

// StartGmailSlotExpiryWorker runs a background loop that flips
// pending_create slots past their 6h deadline to status=expired.
//
// Cadence configurable via cfg.GmailSlotExpiryWorkerInterval (default
// 5m). Batch size capped via cfg.GmailSlotExpiryWorkerBatchLimit
// (default 100) so a backlog doesn't block the DB for long.
func StartGmailSlotExpiryWorker(cfg *config.Config, svc *GmailService) {
	if cfg == nil || svc == nil {
		return
	}
	if !cfg.GmailSlotExpiryWorkerEnabled {
		log.Printf("[gmail-slot-expiry-worker] disabled")
		return
	}

	interval := parseGmailWorkerDuration(cfg.GmailSlotExpiryWorkerInterval, 5*time.Minute)
	batchLimit := cfg.GmailSlotExpiryWorkerBatchLimit
	if batchLimit <= 0 {
		batchLimit = 100
	}

	log.Printf("[gmail-slot-expiry-worker] started (interval=%s, batch=%d)", interval, batchLimit)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			runGmailSlotExpiryOnce(svc, batchLimit)
		}
	}()
}

func runGmailSlotExpiryOnce(svc *GmailService, batchLimit int) {
	rows, err := svc.repo.ListSlotsExpiring(time.Now(), batchLimit)
	if err != nil {
		log.Printf("[gmail-slot-expiry-worker] list failed: %v", err)
		return
	}
	if len(rows) == 0 {
		return
	}
	expired := 0
	for _, g := range rows {
		if err := svc.MarkExpired(g.ID); err != nil {
			log.Printf("[gmail-slot-expiry-worker] mark %s failed: %v", g.ID, err)
			continue
		}
		expired++
	}
	if expired > 0 {
		log.Printf("[gmail-slot-expiry-worker] run done checked=%d expired=%d", len(rows), expired)
	}
}

func parseGmailWorkerDuration(raw string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}
