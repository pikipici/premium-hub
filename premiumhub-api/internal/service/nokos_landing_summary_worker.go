package service

import (
	"context"
	"log"
	"time"

	"premiumhub-api/config"
)

func StartNokosLandingSummaryWorker(cfg *config.Config, svc *NokosLandingSummaryService) {
	if cfg == nil || svc == nil {
		return
	}
	if !cfg.NokosLandingWorkerEnabled {
		log.Printf("[nokos-landing-worker] disabled")
		return
	}

	interval := parseConvertWorkerDuration(cfg.NokosLandingWorkerInterval, 10*time.Minute)
	timeout := parseConvertWorkerDuration(cfg.NokosLandingSyncTimeout, 25*time.Second)

	log.Printf("[nokos-landing-worker] started (interval=%s timeout=%s)", interval, timeout)

	run := func() {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		if err := svc.Sync(ctx); err != nil {
			log.Printf("[nokos-landing-worker] run failed: %v", err)
		}
	}

	run()

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			run()
		}
	}()
}
