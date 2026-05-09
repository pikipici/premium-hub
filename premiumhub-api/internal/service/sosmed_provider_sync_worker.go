package service

import (
	"context"
	"log"
	"time"

	"premiumhub-api/config"
)

const (
	sosmedProviderSyncWorkerMinInterval   = 30 * time.Second
	sosmedProviderSyncWorkerMaxInterval   = 30 * time.Minute
	sosmedProviderSyncWorkerMinBatchLimit = 1
	sosmedProviderSyncWorkerMaxBatchLimit = 100
	sosmedProviderSyncWorkerMinStaleAfter = 5 * time.Minute
	sosmedProviderSyncWorkerMaxStaleAfter = 24 * time.Hour
	sosmedProviderSyncWorkerMinTimeout    = 5 * time.Second
	sosmedProviderSyncWorkerMaxTimeout    = 5 * time.Minute
)

type sosmedProviderSyncWorkerRuntimeSettings struct {
	enabled    bool
	interval   time.Duration
	batchLimit int
	staleAfter time.Duration
	timeout    time.Duration
}

func sosmedProviderSyncWorkerSettings(cfg *config.Config) sosmedProviderSyncWorkerRuntimeSettings {
	if cfg == nil {
		return sosmedProviderSyncWorkerRuntimeSettings{}
	}
	return sosmedProviderSyncWorkerRuntimeSettings{
		enabled:    cfg.SosmedProviderSyncWorkerEnabled,
		interval:   clampSosmedProviderSyncWorkerDuration(parseConvertWorkerDuration(cfg.SosmedProviderSyncWorkerInterval, time.Minute), sosmedProviderSyncWorkerMinInterval, sosmedProviderSyncWorkerMaxInterval),
		batchLimit: clampSosmedProviderSyncWorkerInt(parseConvertWorkerPositiveInt(cfg.SosmedProviderSyncWorkerBatchLimit, 20), sosmedProviderSyncWorkerMinBatchLimit, sosmedProviderSyncWorkerMaxBatchLimit),
		staleAfter: clampSosmedProviderSyncWorkerDuration(parseConvertWorkerDuration(cfg.SosmedProviderSyncWorkerStaleAfter, 30*time.Minute), sosmedProviderSyncWorkerMinStaleAfter, sosmedProviderSyncWorkerMaxStaleAfter),
		timeout:    clampSosmedProviderSyncWorkerDuration(parseConvertWorkerDuration(cfg.SosmedProviderSyncWorkerTimeout, 45*time.Second), sosmedProviderSyncWorkerMinTimeout, sosmedProviderSyncWorkerMaxTimeout),
	}
}

func clampSosmedProviderSyncWorkerDuration(value, minValue, maxValue time.Duration) time.Duration {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func clampSosmedProviderSyncWorkerInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func StartSosmedProviderSyncWorker(cfg *config.Config, svc *SosmedOrderService) {
	if cfg == nil || svc == nil {
		return
	}
	settings := sosmedProviderSyncWorkerSettings(cfg)
	if !settings.enabled {
		log.Printf("[sosmed-provider-sync-worker] disabled")
		return
	}

	log.Printf(
		"[sosmed-provider-sync-worker] started (interval=%s, batch=%d, stale_after=%s, timeout=%s)",
		settings.interval,
		settings.batchLimit,
		settings.staleAfter,
		settings.timeout,
	)

	go func() {
		ticker := time.NewTicker(settings.interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), settings.timeout)
			res, err := svc.AutoSyncStaleProviderOrders(ctx, AutoSyncSosmedProviderInput{
				ProviderCode: "jap",
				StaleAfter:   settings.staleAfter,
				Limit:        settings.batchLimit,
			})
			cancel()
			if err != nil {
				log.Printf("[sosmed-provider-sync-worker] run failed: %v", err)
				continue
			}
			if res == nil || (res.Requested == 0 && res.Synced == 0 && res.Updated == 0 && res.Failed == 0 && res.Skipped == 0) {
				continue
			}
			log.Printf(
				"[sosmed-provider-sync-worker] run done requested=%d synced=%d updated=%d failed=%d skipped=%d",
				res.Requested,
				res.Synced,
				res.Updated,
				res.Failed,
				res.Skipped,
			)
		}
	}()
}
