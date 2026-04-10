package service

import (
	"context"
	"log"
	"time"

	"premiumhub-api/config"
)

func StartFiveSimReconcileWorker(cfg *config.Config, svc *FiveSimService) {
	if cfg == nil || svc == nil {
		return
	}
	if !cfg.FiveSimReconcileWorkerEnabled {
		log.Printf("[fivesim-reconcile-worker] disabled")
		return
	}

	interval := parseConvertWorkerDuration(cfg.FiveSimReconcileWorkerInterval, time.Minute)
	batchLimit := parseConvertWorkerPositiveInt(cfg.FiveSimReconcileWorkerBatchLimit, 200)
	minSyncAge := parseConvertWorkerDuration(cfg.FiveSimReconcileSyncMinAge, 45*time.Second)
	maxWaiting := parseConvertWorkerDuration(cfg.FiveSimOrderMaxWaitingDuration, 15*time.Minute)

	log.Printf("[fivesim-reconcile-worker] started (interval=%s, batch=%d, min_sync_age=%s, max_wait=%s)", interval, batchLimit, minSyncAge, maxWaiting)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			res, err := svc.ReconcileOpenOrders(ctx, FiveSimReconcileInput{
				Limit:      batchLimit,
				MinSyncAge: minSyncAge,
				MaxWaiting: maxWaiting,
			})
			cancel()
			if err != nil {
				log.Printf("[fivesim-reconcile-worker] run failed: %v", err)
				continue
			}
			if res == nil {
				continue
			}
			if res.Checked == 0 && res.Synced == 0 && res.AutoCanceled == 0 && res.SyntheticResolved == 0 && res.Refunded == 0 && res.Failed == 0 {
				continue
			}

			log.Printf(
				"[fivesim-reconcile-worker] run done checked=%d synced=%d auto_canceled=%d synthetic_resolved=%d refunded=%d failed=%d",
				res.Checked,
				res.Synced,
				res.AutoCanceled,
				res.SyntheticResolved,
				res.Refunded,
				res.Failed,
			)
		}
	}()
}
