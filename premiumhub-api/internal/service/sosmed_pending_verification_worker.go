package service

import (
	"context"
	"log"
	"time"

	"premiumhub-api/config"
)

const (
	sosmedPendingVerificationWorkerMinInterval       = 30 * time.Second
	sosmedPendingVerificationWorkerMaxInterval       = 5 * time.Minute
	sosmedPendingVerificationWorkerMinBatchLimit     = 1
	sosmedPendingVerificationWorkerMaxBatchLimit     = 100
	sosmedPendingVerificationWorkerMinTimeout        = 5 * time.Second
	sosmedPendingVerificationWorkerMaxTimeout        = 5 * time.Minute
	sosmedPendingVerificationExpiryWorkerMinInterval = 1 * time.Minute
	sosmedPendingVerificationExpiryWorkerMaxInterval = 30 * time.Minute
	sosmedPendingVerificationExpiryWorkerMinBatch    = 1
	sosmedPendingVerificationExpiryWorkerMaxBatch    = 100
)

type sosmedPendingVerificationWorkerCfg struct {
	enabled    bool
	interval   time.Duration
	batchLimit int
	timeout    time.Duration
}

func readSosmedPendingVerificationWorkerCfg(cfg *config.Config) sosmedPendingVerificationWorkerCfg {
	if cfg == nil {
		return sosmedPendingVerificationWorkerCfg{}
	}
	return sosmedPendingVerificationWorkerCfg{
		enabled:    cfg.SosmedPendingVerificationWorkerEnabled,
		interval:   clampDuration(parseConvertWorkerDuration(cfg.SosmedPendingVerificationWorkerInterval, 60*time.Second), sosmedPendingVerificationWorkerMinInterval, sosmedPendingVerificationWorkerMaxInterval),
		batchLimit: clampInt(parseConvertWorkerPositiveInt(cfg.SosmedPendingVerificationWorkerBatchLimit, 20), sosmedPendingVerificationWorkerMinBatchLimit, sosmedPendingVerificationWorkerMaxBatchLimit),
		timeout:    clampDuration(parseConvertWorkerDuration(cfg.SosmedPendingVerificationWorkerTimeout, 45*time.Second), sosmedPendingVerificationWorkerMinTimeout, sosmedPendingVerificationWorkerMaxTimeout),
	}
}

type sosmedPendingVerificationExpiryCfg struct {
	enabled    bool
	interval   time.Duration
	batchLimit int
	timeout    time.Duration
}

func readSosmedPendingVerificationExpiryCfg(cfg *config.Config) sosmedPendingVerificationExpiryCfg {
	if cfg == nil {
		return sosmedPendingVerificationExpiryCfg{}
	}
	return sosmedPendingVerificationExpiryCfg{
		enabled:    cfg.SosmedPendingVerificationWorkerEnabled,
		interval:   clampDuration(parseConvertWorkerDuration(cfg.SosmedPendingVerificationExpiryInterval, 5*time.Minute), sosmedPendingVerificationExpiryWorkerMinInterval, sosmedPendingVerificationExpiryWorkerMaxInterval),
		batchLimit: clampInt(parseConvertWorkerPositiveInt(cfg.SosmedPendingVerificationExpiryBatchLimit, 20), sosmedPendingVerificationExpiryWorkerMinBatch, sosmedPendingVerificationExpiryWorkerMaxBatch),
		timeout:    clampDuration(parseConvertWorkerDuration(cfg.SosmedPendingVerificationExpiryTimeout, 30*time.Second), sosmedPendingVerificationWorkerMinTimeout, sosmedPendingVerificationWorkerMaxTimeout),
	}
}

func clampDuration(value, minValue, maxValue time.Duration) time.Duration {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

// StartSosmedPendingVerificationWorker starts a background worker that periodically
// processes pending verification orders — checks JAP balance, deducts wallet,
// and submits orders to JAP when balance is sufficient.
func StartSosmedPendingVerificationWorker(cfg *config.Config, svc *SosmedOrderService) {
	if cfg == nil || svc == nil {
		return
	}
	settings := readSosmedPendingVerificationWorkerCfg(cfg)
	if !settings.enabled {
		log.Printf("[sosmed-pending-verification-worker] disabled")
		return
	}

	log.Printf(
		"[sosmed-pending-verification-worker] started (interval=%s, batch=%d, timeout=%s)",
		settings.interval,
		settings.batchLimit,
		settings.timeout,
	)

	go func() {
		ticker := time.NewTicker(settings.interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), settings.timeout)
			res, err := svc.ProcessPendingVerificationOrders(ctx, settings.batchLimit)
			cancel()
			if err != nil {
				log.Printf("[sosmed-pending-verification-worker] run failed: %v", err)
				continue
			}
			if res == nil || (res.Processed == 0 && res.Skipped == 0 && res.Failed == 0) {
				continue
			}
			log.Printf(
				"[sosmed-pending-verification-worker] run done processed=%d skipped=%d failed=%d",
				res.Processed,
				res.Skipped,
				res.Failed,
			)
		}
	}()
}

// StartSosmedPendingVerificationExpiryWorker starts a background worker that
// expires pending verification orders that have exceeded the timeout window.
func StartSosmedPendingVerificationExpiryWorker(cfg *config.Config, svc *SosmedOrderService) {
	if cfg == nil || svc == nil {
		return
	}
	settings := readSosmedPendingVerificationExpiryCfg(cfg)
	if !settings.enabled {
		log.Printf("[sosmed-pending-verification-expiry-worker] disabled")
		return
	}

	log.Printf(
		"[sosmed-pending-verification-expiry-worker] started (interval=%s, batch=%d, timeout=%s)",
		settings.interval,
		settings.batchLimit,
		settings.timeout,
	)

	go func() {
		ticker := time.NewTicker(settings.interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), settings.timeout)
			res, err := svc.ExpireStalePendingVerificationOrders(ctx, settings.batchLimit)
			cancel()
			if err != nil {
				log.Printf("[sosmed-pending-verification-expiry-worker] run failed: %v", err)
				continue
			}
			if res == nil || res.Expired == 0 {
				continue
			}
			log.Printf(
				"[sosmed-pending-verification-expiry-worker] run done expired=%d",
				res.Expired,
			)
		}
	}()
}
