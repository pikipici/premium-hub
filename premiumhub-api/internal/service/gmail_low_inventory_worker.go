package service

import (
	"log"
	"sync"
	"time"

	"premiumhub-api/config"
)

// GmailLowInventoryWorker periodically checks verified inventory count
// against the threshold from GmailPricing. Logs alert when below
// threshold (max once per cooldown to avoid spam). Future: send notif
// to all admin users.
//
// Cooldown defaults to 6 hours — same value used in plan Round 5.
type GmailLowInventoryWorker struct {
	cfg         *config.Config
	gmailSvc    *GmailService
	pricingSvc  *GmailPricingService
	tickEvery   time.Duration
	cooldown    time.Duration
	lastAlertAt time.Time
	mu          sync.Mutex
}

func NewGmailLowInventoryWorker(
	cfg *config.Config,
	gmailSvc *GmailService,
	pricingSvc *GmailPricingService,
) *GmailLowInventoryWorker {
	tick := 30 * time.Minute
	if cfg != nil && cfg.GmailLowInvCheckMinutes > 0 {
		tick = time.Duration(cfg.GmailLowInvCheckMinutes) * time.Minute
	}
	cooldown := 6 * time.Hour
	if cfg != nil && cfg.GmailLowInvCooldownHours > 0 {
		cooldown = time.Duration(cfg.GmailLowInvCooldownHours) * time.Hour
	}
	return &GmailLowInventoryWorker{
		cfg:        cfg,
		gmailSvc:   gmailSvc,
		pricingSvc: pricingSvc,
		tickEvery:  tick,
		cooldown:   cooldown,
	}
}

// StartGmailLowInventoryWorker launches a background goroutine. Returns
// immediately; goroutine runs forever.
func StartGmailLowInventoryWorker(
	cfg *config.Config,
	gmailSvc *GmailService,
	pricingSvc *GmailPricingService,
) {
	w := NewGmailLowInventoryWorker(cfg, gmailSvc, pricingSvc)
	go w.run()
}

func (w *GmailLowInventoryWorker) run() {
	ticker := time.NewTicker(w.tickEvery)
	defer ticker.Stop()

	// First check on boot, then every tick.
	w.tick()
	for range ticker.C {
		w.tick()
	}
}

func (w *GmailLowInventoryWorker) tick() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[gmail-low-inv] panic: %v", r)
		}
	}()

	count, err := w.gmailSvc.CountVerifiedInventory()
	if err != nil {
		log.Printf("[gmail-low-inv] count failed: %v", err)
		return
	}

	pricing, err := w.pricingSvc.GetActive()
	if err != nil || pricing == nil {
		log.Printf("[gmail-low-inv] pricing fetch failed: %v", err)
		return
	}

	if count >= int64(pricing.LowInventoryThreshold) {
		return // healthy
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	if time.Since(w.lastAlertAt) < w.cooldown {
		return // suppress, still in cooldown
	}
	w.lastAlertAt = time.Now()
	log.Printf(
		"[gmail-low-inv] ALERT verified=%d threshold=%d — inventory low, restock soon",
		count, pricing.LowInventoryThreshold,
	)
	// Future: send notif/email to admin users. For now log-only matches
	// MVP scope (admin checks logs / monitoring).
}
