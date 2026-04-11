package service

import (
	"context"
	"log"
	"time"

	"premiumhub-api/config"
)

func StartWalletTopupReconcileWorker(cfg *config.Config, svc *WalletService) {
	if cfg == nil || svc == nil {
		return
	}
	if !cfg.WalletTopupReconcileWorkerEnabled {
		log.Printf("[wallet-topup-reconcile-worker] disabled")
		return
	}

	interval := parseConvertWorkerDuration(cfg.WalletTopupReconcileWorkerInterval, time.Minute)
	batchLimit := parseConvertWorkerPositiveInt(cfg.WalletTopupReconcileWorkerBatchLimit, 200)

	log.Printf("[wallet-topup-reconcile-worker] started (interval=%s, batch=%d)", interval, batchLimit)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			res, err := svc.ReconcilePending(ctx, batchLimit)
			cancel()
			if err != nil {
				log.Printf("[wallet-topup-reconcile-worker] run failed: %v", err)
				continue
			}
			if res == nil {
				continue
			}
			if res.Checked == 0 && res.Settled == 0 && res.Pending == 0 && res.Failed == 0 && res.Expired == 0 && len(res.Errors) == 0 {
				continue
			}

			log.Printf(
				"[wallet-topup-reconcile-worker] run done checked=%d settled=%d pending=%d failed=%d expired=%d errors=%d",
				res.Checked,
				res.Settled,
				res.Pending,
				res.Failed,
				res.Expired,
				len(res.Errors),
			)
		}
	}()
}
