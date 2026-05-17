package service

import (
	"context"
	"log"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
)

// StartDigiConnectReconcileWorker periodically scans `pending_verification`
// DigiConnect requests and finalizes them. Strategy:
//   - rows older than `MinAge` (default 2m) AND younger than `MaxAge` (default 30m)
//     are flipped to `failed` with billing decision `rejected` so the user can
//     retry. Wallet is never debited for these rows because the original code
//     path never reached `chargeWalletAndFinalize`.
//   - rows older than `MaxAge` (default 30m) are also marked failed. They are
//     considered abandoned and will not be retried automatically.
//
// The worker is opt-in via `DIGICONNECT_RECONCILE_WORKER_ENABLED=true`.
func StartDigiConnectReconcileWorker(cfg *config.Config, svc *DigiConnectService) {
	if cfg == nil || svc == nil {
		return
	}
	if !cfg.DigiConnectReconcileWorkerEnabled {
		log.Printf("[digiconnect-reconcile-worker] disabled")
		return
	}
	interval := parseConvertWorkerDuration(cfg.DigiConnectReconcileWorkerInterval, 60*time.Second)
	minAge := parseConvertWorkerDuration(cfg.DigiConnectReconcileMinAge, 2*time.Minute)
	maxAge := parseConvertWorkerDuration(cfg.DigiConnectReconcileMaxAge, 30*time.Minute)
	batchLimit := parseConvertWorkerPositiveInt(cfg.DigiConnectReconcileBatchLimit, 50)

	log.Printf("[digiconnect-reconcile-worker] started (interval=%s, min_age=%s, max_age=%s, batch=%d)", interval, minAge, maxAge, batchLimit)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			finalized, err := svc.ReconcilePendingVerification(ctx, minAge, maxAge, batchLimit)
			cancel()
			if err != nil {
				log.Printf("[digiconnect-reconcile-worker] run failed: %v", err)
				continue
			}
			if finalized > 0 {
				log.Printf("[digiconnect-reconcile-worker] finalized %d row(s)", finalized)
			}
		}
	}()
}

// ReconcilePendingVerification scans pending_verification rows and flips them
// to a terminal `failed` state. Returns count of rows finalized.
func (s *DigiConnectService) ReconcilePendingVerification(ctx context.Context, minAge, maxAge time.Duration, batchLimit int) (int, error) {
	if s == nil || s.repo == nil {
		return 0, nil
	}
	now := time.Now()
	olderThan := now.Add(-minAge)
	maxBoundary := now.Add(-maxAge)
	rows, err := s.repo.ListPendingVerificationRequests(olderThan, maxBoundary, batchLimit)
	if err != nil {
		return 0, err
	}
	finalized := 0
	for i := range rows {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return finalized, ctx.Err()
			default:
			}
		}
		if s.finalizeStalePendingVerification(&rows[i], now, "PENDING_VERIFICATION_RETRY_EXPIRED", "Request belum dapat diverifikasi setelah retry. Silakan coba lagi.") {
			finalized++
		}
	}
	stale, err := s.repo.ListStalePendingVerificationRequests(maxBoundary, batchLimit)
	if err != nil {
		return finalized, err
	}
	for i := range stale {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return finalized, ctx.Err()
			default:
			}
		}
		if s.finalizeStalePendingVerification(&stale[i], now, "PENDING_VERIFICATION_ABANDONED", "Request kadaluarsa tanpa hasil verifikasi.") {
			finalized++
		}
	}
	return finalized, nil
}

func (s *DigiConnectService) finalizeStalePendingVerification(request *model.DigiConnectRequest, now time.Time, internalCode, publicMessage string) bool {
	if request == nil || request.Status != "pending_verification" {
		return false
	}
	completedAt := now
	request.Status = "failed"
	request.BillingDecision = "rejected"
	request.BillingStatus = "failed"
	request.PublicErrorCode = "REQUEST_VERIFICATION_FAILED"
	request.PublicErrorMessage = publicMessage
	if request.InternalErrorCode == "" {
		request.InternalErrorCode = internalCode
	}
	if request.CompletedAt == nil {
		request.CompletedAt = &completedAt
	}
	if err := s.repo.SaveRequest(request); err != nil {
		log.Printf("[digiconnect-reconcile-worker] save failed for request %s: %v", request.RequestID, err)
		return false
	}
	return true
}
