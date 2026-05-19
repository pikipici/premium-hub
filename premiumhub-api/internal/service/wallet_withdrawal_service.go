package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Locked-in spec from .kiro/steering/wallet-withdraw-system.md.
// Tweaking these defaults? Update the steering doc + skill reference too.
const (
	// Per-request bounds (gross amount, before fee deduction).
	WithdrawalMinAmount int64 = 50_000
	WithdrawalMaxAmount int64 = 500_000

	// Flat fee deducted from user's gross — they receive `amount - fee`.
	WithdrawalFlatFee int64 = 2_500

	// Daily caps per user (Asia/Jakarta start-of-day).
	WithdrawalMaxRequestsPerDay int64 = 5
	WithdrawalMaxAmountPerDay   int64 = 2_500_000

	// Auto-approve threshold — requests strictly below this are
	// approved without admin review. Requests at or above the
	// threshold land in pending and wait for admin.
	WithdrawalAutoApproveThreshold int64 = 100_000

	// PayoutRailKindManual = no rail wired up yet, admin transfers via
	// internet banking and clicks "mark paid" by hand. Other kinds
	// (duitku/xendit/etc) ship in Round 4.
	PayoutRailKindManual = "manual"
)

// CreateWithdrawalInput is the user-supplied payload for POST
// /api/v1/wallet/withdrawals. Validation lives in the service.
type CreateWithdrawalInput struct {
	Amount             int64  `json:"amount" binding:"required"`
	DestinationType    string `json:"destination_type" binding:"required"`
	DestinationCode    string `json:"destination_code" binding:"required"`
	DestinationAccount string `json:"destination_account" binding:"required"`
	DestinationName    string `json:"destination_name" binding:"required"`
}

// WalletWithdrawalService orchestrates withdrawal request lifecycle —
// validation, balance lock against earn pocket, status transitions,
// notifications, and (in Round 4) PayoutRail dispatch.
type WalletWithdrawalService struct {
	cfg        *config.Config
	repo       *repository.WalletWithdrawalRepo
	walletRepo *repository.WalletRepo
	notifRepo  *repository.NotificationRepo
	payoutRail PayoutRail
}

func NewWalletWithdrawalService(
	cfg *config.Config,
	repo *repository.WalletWithdrawalRepo,
	walletRepo *repository.WalletRepo,
	notifRepo *repository.NotificationRepo,
) *WalletWithdrawalService {
	return &WalletWithdrawalService{
		cfg:        cfg,
		repo:       repo,
		walletRepo: walletRepo,
		notifRepo:  notifRepo,
	}
}

// SetPayoutRail injects the active payout rail. Optional — service
// works without one (Approve falls back to "manual" semantics: stay
// in approved without dispatching anywhere). Wired in router.go after
// service construction so the rail can also be hot-swapped in tests.
func (s *WalletWithdrawalService) SetPayoutRail(rail PayoutRail) *WalletWithdrawalService {
	s.payoutRail = rail
	return s
}

// minAmount returns the configured minimum gross withdrawal amount,
// falling back to the legacy constant if config is unset (zero).
// Same fallback semantics for the other policy getters below.
func (s *WalletWithdrawalService) minAmount() int64 {
	if s.cfg != nil && s.cfg.WithdrawalMin > 0 {
		return s.cfg.WithdrawalMin
	}
	return WithdrawalMinAmount
}

func (s *WalletWithdrawalService) maxAmount() int64 {
	if s.cfg != nil && s.cfg.WithdrawalMax > 0 {
		return s.cfg.WithdrawalMax
	}
	return WithdrawalMaxAmount
}

func (s *WalletWithdrawalService) flatFee() int64 {
	if s.cfg != nil && s.cfg.WithdrawalFee > 0 {
		return s.cfg.WithdrawalFee
	}
	return WithdrawalFlatFee
}

func (s *WalletWithdrawalService) maxRequestsPerDay() int64 {
	if s.cfg != nil && s.cfg.WithdrawalDailyMaxRequests > 0 {
		return int64(s.cfg.WithdrawalDailyMaxRequests)
	}
	return WithdrawalMaxRequestsPerDay
}

func (s *WalletWithdrawalService) maxAmountPerDay() int64 {
	if s.cfg != nil && s.cfg.WithdrawalDailyMaxTotal > 0 {
		return s.cfg.WithdrawalDailyMaxTotal
	}
	return WithdrawalMaxAmountPerDay
}

func (s *WalletWithdrawalService) autoApproveThreshold() int64 {
	if s.cfg != nil && s.cfg.WithdrawalAutoApproveThreshold > 0 {
		return s.cfg.WithdrawalAutoApproveThreshold
	}
	return WithdrawalAutoApproveThreshold
}

// PolicySnapshot returns the currently-active policy values. Used by
// the destinations/policy endpoint so client-side caps always match
// server enforcement (admin-tunable per env).
type WithdrawalPolicy struct {
	MinAmount            int64 `json:"min_amount"`
	MaxAmount            int64 `json:"max_amount"`
	FlatFee              int64 `json:"flat_fee"`
	MaxRequestsPerDay    int   `json:"max_requests_per_day"`
	MaxAmountPerDay      int64 `json:"max_amount_per_day"`
	AutoApproveThreshold int64 `json:"auto_approve_threshold"`
}

func (s *WalletWithdrawalService) Policy() WithdrawalPolicy {
	return WithdrawalPolicy{
		MinAmount:            s.minAmount(),
		MaxAmount:            s.maxAmount(),
		FlatFee:              s.flatFee(),
		MaxRequestsPerDay:    int(s.maxRequestsPerDay()),
		MaxAmountPerDay:      s.maxAmountPerDay(),
		AutoApproveThreshold: s.autoApproveThreshold(),
	}
}

// jakartaStartOfDay returns 00:00:00 Asia/Jakarta of `now`. Falls back
// to UTC if the tz database isn't available (shouldn't happen on Linux,
// but cheap insurance).
func jakartaStartOfDay(now time.Time) time.Time {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.UTC
	}
	t := now.In(loc)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
}

// CreateRequest is the user-side entry point. Validates, locks the
// earn pocket, debits via withdrawal_hold ledger entry, persists the
// row, and either auto-approves (<100k) or leaves it pending.
//
// Returns ErrWithdrawalValidation-style messages in Bahasa for the
// handler to surface as 400.
func (s *WalletWithdrawalService) CreateRequest(ctx context.Context, userID uuid.UUID, input CreateWithdrawalInput) (*model.WalletWithdrawal, error) {
	if err := s.validateInput(input); err != nil {
		return nil, err
	}

	now := time.Now()
	dayStart := jakartaStartOfDay(now)

	// Daily-limit pre-check (cheap, runs outside tx).
	count, totalToday, err := s.repo.CountTodayByUser(userID, dayStart)
	if err != nil {
		return nil, errors.New("gagal cek limit harian withdraw")
	}
	if count >= s.maxRequestsPerDay() {
		return nil, fmt.Errorf("limit harian tercapai (max %d permintaan/hari)", s.maxRequestsPerDay())
	}
	if totalToday+input.Amount > s.maxAmountPerDay() {
		return nil, fmt.Errorf("total nominal harian tidak boleh melebihi Rp %s", formatRupiahPlain(s.maxAmountPerDay()))
	}

	withdrawal := &model.WalletWithdrawal{
		ID:                 uuid.New(),
		UserID:             userID,
		Amount:             input.Amount,
		Fee:                s.flatFee(),
		NetAmount:          input.Amount - s.flatFee(),
		Status:             model.WithdrawalStatusPending,
		DestinationType:    strings.ToLower(strings.TrimSpace(input.DestinationType)),
		DestinationCode:    strings.ToUpper(strings.TrimSpace(input.DestinationCode)),
		DestinationAccount: strings.TrimSpace(input.DestinationAccount),
		DestinationName:    strings.TrimSpace(input.DestinationName),
		PayoutRailKind:     PayoutRailKindManual,
	}

	autoApproved := input.Amount < s.autoApproveThreshold()

	err = s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}

		// Lock user row, re-check earn balance, debit.
		user := &model.User{}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(user, "id = ?", userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("user tidak ditemukan")
			}
			return errors.New("gagal memuat user")
		}
		if !user.IsActive {
			return errors.New("akun diblokir")
		}
		if user.WalletBalanceEarn < input.Amount {
			return errors.New("saldo pendapatan tidak cukup")
		}

		balanceBefore := user.WalletBalanceEarn
		balanceAfter := balanceBefore - input.Amount
		user.WalletBalanceEarn = balanceAfter
		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return errors.New("gagal update saldo pendapatan")
		}

		// Hold ledger entry — earn pocket debit.
		holdRef := fmt.Sprintf("withdrawal:%s:hold", withdrawal.ID.String())
		holdLedger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "debit",
			Category:      model.LedgerCategoryWithdrawalHold,
			Pocket:        model.WalletPocketEarn,
			Amount:        input.Amount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  balanceAfter,
			Reference:     holdRef,
			Description: fmt.Sprintf("Permintaan WD %s — hold saldo pendapatan",
				shortWalletLedgerRef(withdrawal.ID.String())),
		}
		if err := s.walletRepo.CreateLedgerTx(tx, holdLedger); err != nil {
			return errors.New("gagal menulis ledger hold")
		}
		withdrawal.LedgerHoldID = &holdLedger.ID

		// Auto-approve <100k path.
		if autoApproved {
			withdrawal.Status = model.WithdrawalStatusApproved
			withdrawal.AutoApproved = true
			now := time.Now()
			withdrawal.ApprovedAt = &now
		}

		if err := s.repo.CreateTx(tx, withdrawal); err != nil {
			return errors.New("gagal menyimpan permintaan withdraw")
		}

		// Notif: submitted (always) + approved (if auto).
		if err := s.writeNotifTx(tx, user.ID, "withdrawal_submitted",
			"Permintaan Withdraw Diterima",
			fmt.Sprintf("Permintaan withdraw Rp %s sudah masuk antrian. Kami akan kabari saat statusnya berubah.",
				formatRupiahPlain(withdrawal.Amount)),
			withdrawal.ID,
		); err != nil {
			return err
		}
		if autoApproved {
			if err := s.writeNotifTx(tx, user.ID, "withdrawal_approved",
				"Withdraw Disetujui Otomatis",
				fmt.Sprintf("Withdraw Rp %s otomatis disetujui dan akan segera diproses.",
					formatRupiahPlain(withdrawal.Amount)),
				withdrawal.ID,
			); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Auto-approve path needs to dispatch to rail too — without
	// this, auto-approved withdrawals get stuck in "approved"
	// forever. Best-effort: rail failure leaves it in approved and
	// admin can retry.
	if autoApproved && s.payoutRail != nil {
		// adminID for auto-approve = uuid.Nil sentinel (no admin
		// row). Downstream state setters guard against this so
		// AdminID stays NULL on auto-approved entries — naive
		// audit joins on admin_id won't dredge up user IDs.
		dispatched, _ := s.dispatchToRail(ctx, uuid.Nil, withdrawal)
		if dispatched != nil {
			return dispatched, nil
		}
	}
	return withdrawal, nil
}

// Cancel is user-initiated. Only valid while status=pending. Refunds
// the earn pocket and writes a withdrawal_refund ledger row.
func (s *WalletWithdrawalService) Cancel(ctx context.Context, userID, id uuid.UUID) (*model.WalletWithdrawal, error) {
	var result *model.WalletWithdrawal
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
		w, err := s.repo.LockByIDTx(tx, id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("permintaan withdraw tidak ditemukan")
			}
			return errors.New("gagal memuat withdraw")
		}
		if w.UserID != userID {
			return errors.New("akses ditolak")
		}
		if w.Status != model.WithdrawalStatusPending {
			return errors.New("withdraw tidak bisa dibatalkan pada status saat ini")
		}

		if err := s.refundEarnTx(tx, w, "Pembatalan oleh pengguna"); err != nil {
			return err
		}
		now := time.Now()
		w.Status = model.WithdrawalStatusCancelled
		w.CancelledAt = &now
		if err := s.repo.SaveTx(tx, w); err != nil {
			return errors.New("gagal update withdraw")
		}
		if err := s.writeNotifTx(tx, w.UserID, "withdrawal_cancelled",
			"Withdraw Dibatalkan",
			fmt.Sprintf("Permintaan withdraw Rp %s sudah dibatalkan. Saldo pendapatan dikembalikan.",
				formatRupiahPlain(w.Amount)),
			w.ID,
		); err != nil {
			return err
		}
		result = w
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// ListMine returns the user's own withdrawal history (newest first).
func (s *WalletWithdrawalService) ListMine(userID uuid.UUID, page, limit int) ([]model.WalletWithdrawal, int64, error) {
	return s.repo.ListByUser(userID, page, limit)
}

// GetMine fetches a single withdrawal scoped to the user.
func (s *WalletWithdrawalService) GetMine(userID, id uuid.UUID) (*model.WalletWithdrawal, error) {
	w, err := s.repo.GetByIDForUser(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("permintaan withdraw tidak ditemukan")
		}
		return nil, errors.New("gagal memuat withdraw")
	}
	return w, nil
}

// ----- Admin actions -----

// ListAdmin returns the admin queue, optionally filtered by status / user.
func (s *WalletWithdrawalService) ListAdmin(filters repository.AdminListFilters, page, limit int) ([]model.WalletWithdrawal, int64, error) {
	return s.repo.ListAdmin(filters, page, limit)
}

// GetAdmin fetches a single withdrawal regardless of user — for admin UI.
func (s *WalletWithdrawalService) GetAdmin(id uuid.UUID) (*model.WalletWithdrawal, error) {
	w, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("permintaan withdraw tidak ditemukan")
		}
		return nil, errors.New("gagal memuat withdraw")
	}
	return w, nil
}

// Approve transitions pending → approved, then dispatches the payout
// to the active rail. Rail outcome maps to terminal/intermediate
// withdrawal status:
//
//	pending → withdrawal flips to processing (manual rail; admin
//	          eventually marks paid by hand. async API rails reach
//	          paid/failed via reconcile worker.)
//	success → withdrawal flips to paid (sync API rails)
//	failed  → withdrawal flips to failed and earn pocket is refunded
//	          (rail rejected the payload outright)
//
// No saldo movement on the approve→processing path — the earn pocket
// was already debited at submit time. The refund only happens on
// rail-failure.
func (s *WalletWithdrawalService) Approve(ctx context.Context, adminID, id uuid.UUID, note string) (*model.WalletWithdrawal, error) {
	w, err := s.transitionFromPending(ctx, adminID, id,
		model.WithdrawalStatusApproved,
		strings.TrimSpace(note),
		"withdrawal_approved",
		"Withdraw Disetujui",
		func(amount int64) string {
			return fmt.Sprintf("Permintaan withdraw Rp %s disetujui dan akan segera diproses.", formatRupiahPlain(amount))
		},
	)
	if err != nil {
		return nil, err
	}

	// No rail wired up = legacy manual semantics, leave it in approved.
	// Admin will move it forward via MarkProcessing/MarkPaid manually.
	if s.payoutRail == nil {
		return w, nil
	}
	return s.dispatchToRail(ctx, adminID, w)
}

// dispatchToRail submits the (already-approved) withdrawal to the
// payout rail and applies the resulting state transition. Idempotent
// per call: if rail blows up we leave the withdrawal in approved so
// the admin can retry (status flip only happens after rail returns).
func (s *WalletWithdrawalService) dispatchToRail(ctx context.Context, adminID uuid.UUID, w *model.WalletWithdrawal) (*model.WalletWithdrawal, error) {
	if s.payoutRail == nil {
		return w, nil
	}
	req := PayoutRequest{
		WithdrawalID:       w.ID,
		Amount:             w.NetAmount,
		DestinationType:    w.DestinationType,
		DestinationCode:    w.DestinationCode,
		DestinationAccount: w.DestinationAccount,
		DestinationName:    w.DestinationName,
	}
	res, err := s.payoutRail.Submit(ctx, req)
	if err != nil {
		// Rail hard-failed (network, panic, panic-recover). Leave
		// withdrawal in approved so admin sees the issue and can
		// retry. Don't refund — the request is still "live".
		return w, nil
	}
	railKind := string(s.payoutRail.Kind())

	switch res.Status {
	case PayoutStatusSuccess:
		// Sync API rail completed payout immediately. Skip the
		// processing-then-paid two-step and go straight to paid.
		paid, mErr := s.MarkPaid(ctx, adminID, w.ID, railKind, res.RailRef)
		if mErr != nil {
			return w, nil
		}
		return paid, nil

	case PayoutStatusFailed:
		// Rail rejected payload (validation error, dest unreachable).
		// Refund the earn pocket and notify user.
		reason := strings.TrimSpace(res.Error)
		if reason == "" {
			reason = "rail menolak permintaan payout"
		}
		failed, mErr := s.MarkFailed(ctx, adminID, w.ID, reason)
		if mErr != nil {
			return w, nil
		}
		return failed, nil

	default:
		// Pending — most common path. For manual rails this is
		// permanent until admin clicks mark-paid. For async API
		// rails the reconcile worker (future) flips it later.
		processed, mErr := s.MarkProcessingWithRail(ctx, adminID, w.ID, railKind, res.RailRef)
		if mErr != nil {
			return w, nil
		}
		return processed, nil
	}
}

// Reject transitions pending → rejected. Refunds earn pocket. Note is
// required so the user knows why.
func (s *WalletWithdrawalService) Reject(ctx context.Context, adminID, id uuid.UUID, note string) (*model.WalletWithdrawal, error) {
	note = strings.TrimSpace(note)
	if note == "" {
		return nil, errors.New("alasan penolakan wajib diisi")
	}
	var result *model.WalletWithdrawal
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
		w, err := s.repo.LockByIDTx(tx, id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("permintaan withdraw tidak ditemukan")
			}
			return errors.New("gagal memuat withdraw")
		}
		if w.Status != model.WithdrawalStatusPending {
			return errors.New("withdraw tidak bisa ditolak pada status saat ini")
		}

		if err := s.refundEarnTx(tx, w, fmt.Sprintf("Ditolak admin: %s", note)); err != nil {
			return err
		}
		now := time.Now()
		w.Status = model.WithdrawalStatusRejected
		w.RejectedAt = &now
		if adminID != uuid.Nil {
			w.AdminID = &adminID
		}
		w.AdminNote = note
		if err := s.repo.SaveTx(tx, w); err != nil {
			return errors.New("gagal update withdraw")
		}
		if err := s.writeNotifTx(tx, w.UserID, "withdrawal_rejected",
			"Withdraw Ditolak",
			fmt.Sprintf("Permintaan withdraw Rp %s ditolak. Alasan: %s. Saldo pendapatan dikembalikan.",
				formatRupiahPlain(w.Amount), note),
			w.ID,
		); err != nil {
			return err
		}
		result = w
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// MarkProcessing transitions approved → processing.
func (s *WalletWithdrawalService) MarkProcessing(ctx context.Context, adminID, id uuid.UUID) (*model.WalletWithdrawal, error) {
	return s.adminTransition(ctx, adminID, id,
		[]string{model.WithdrawalStatusApproved},
		model.WithdrawalStatusProcessing,
		"",
		"withdrawal_processing",
		"Withdraw Sedang Diproses",
		func(amount int64) string {
			return fmt.Sprintf("Withdraw Rp %s sedang diproses ke rekening tujuan.", formatRupiahPlain(amount))
		},
	)
}

// MarkProcessingWithRail is the rail-aware variant called by
// dispatchToRail after Approve. Same state transition as
// MarkProcessing but additionally stamps PayoutRailKind / RailRef on
// the row so admins can see which rail is handling it (especially
// useful when running multiple rails in parallel later).
func (s *WalletWithdrawalService) MarkProcessingWithRail(ctx context.Context, adminID, id uuid.UUID, railKind, railRef string) (*model.WalletWithdrawal, error) {
	railKind = strings.TrimSpace(railKind)
	if railKind == "" {
		railKind = PayoutRailKindManual
	}
	var result *model.WalletWithdrawal
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
		w, err := s.repo.LockByIDTx(tx, id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("permintaan withdraw tidak ditemukan")
			}
			return errors.New("gagal memuat withdraw")
		}
		if w.Status != model.WithdrawalStatusApproved {
			return errors.New("withdraw belum bisa diproses (bukan status approved)")
		}

		now := time.Now()
		w.Status = model.WithdrawalStatusProcessing
		if adminID != uuid.Nil {
			w.AdminID = &adminID
		}
		w.PayoutRailKind = railKind
		if strings.TrimSpace(railRef) != "" {
			w.PayoutRailRef = strings.TrimSpace(railRef)
		}
		_ = now
		if err := s.repo.SaveTx(tx, w); err != nil {
			return errors.New("gagal update withdraw")
		}

		_ = s.writeNotifTx(tx, w.UserID, "withdrawal_processing", "Withdraw Sedang Diproses",
			fmt.Sprintf("Withdraw Rp %s sedang diproses ke rekening tujuan.", formatRupiahPlain(w.Amount)),
			w.ID)
		result = w
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// MarkPaid transitions processing → paid. Writes a withdrawal_final
// ledger entry (amount=0, audit-only) for trace continuity.
// payoutRailRef is optional — admin can leave it blank if they
// transferred manually.
func (s *WalletWithdrawalService) MarkPaid(ctx context.Context, adminID, id uuid.UUID, payoutRailKind, payoutRailRef string) (*model.WalletWithdrawal, error) {
	payoutRailKind = strings.TrimSpace(payoutRailKind)
	if payoutRailKind == "" {
		payoutRailKind = PayoutRailKindManual
	}

	var result *model.WalletWithdrawal
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
		w, err := s.repo.LockByIDTx(tx, id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("permintaan withdraw tidak ditemukan")
			}
			return errors.New("gagal memuat withdraw")
		}
		if w.Status != model.WithdrawalStatusProcessing && w.Status != model.WithdrawalStatusApproved {
			return errors.New("withdraw belum siap di-mark paid")
		}

		// Audit ledger row — saldo unchanged, just for trace.
		user := &model.User{}
		if err := tx.Where("id = ?", w.UserID).First(user).Error; err != nil {
			return errors.New("gagal memuat user")
		}
		finalRef := fmt.Sprintf("withdrawal:%s:final", w.ID.String())
		finalLedger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        w.UserID,
			Type:          "debit",
			Category:      model.LedgerCategoryWithdrawalFinal,
			Pocket:        model.WalletPocketEarn,
			Amount:        0,
			BalanceBefore: user.WalletBalanceEarn,
			BalanceAfter:  user.WalletBalanceEarn,
			Reference:     finalRef,
			Description: fmt.Sprintf("WD %s — final paid (rail=%s ref=%s)",
				shortWalletLedgerRef(w.ID.String()), payoutRailKind, payoutRailRef),
		}
		if err := s.walletRepo.CreateLedgerTx(tx, finalLedger); err != nil {
			return errors.New("gagal menulis ledger final")
		}
		w.LedgerFinalID = &finalLedger.ID
		now := time.Now()
		w.Status = model.WithdrawalStatusPaid
		w.PaidAt = &now
		if adminID != uuid.Nil {
			w.AdminID = &adminID
		}
		w.PayoutRailKind = payoutRailKind
		w.PayoutRailRef = strings.TrimSpace(payoutRailRef)
		if err := s.repo.SaveTx(tx, w); err != nil {
			return errors.New("gagal update withdraw")
		}
		if err := s.writeNotifTx(tx, w.UserID, "withdrawal_paid",
			"Withdraw Berhasil",
			fmt.Sprintf("Withdraw Rp %s berhasil cair ke rekening tujuan. Terima kasih.",
				formatRupiahPlain(w.Amount)),
			w.ID,
		); err != nil {
			return err
		}
		result = w
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// MarkFailed transitions processing → failed. Refunds earn pocket
// because the payout never landed. Reason is required.
func (s *WalletWithdrawalService) MarkFailed(ctx context.Context, adminID, id uuid.UUID, reason string) (*model.WalletWithdrawal, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("alasan kegagalan wajib diisi")
	}
	var result *model.WalletWithdrawal
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
		w, err := s.repo.LockByIDTx(tx, id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("permintaan withdraw tidak ditemukan")
			}
			return errors.New("gagal memuat withdraw")
		}
		if w.Status != model.WithdrawalStatusProcessing && w.Status != model.WithdrawalStatusApproved {
			return errors.New("withdraw tidak bisa di-mark failed pada status saat ini")
		}

		if err := s.refundEarnTx(tx, w, fmt.Sprintf("Gagal payout: %s", reason)); err != nil {
			return err
		}
		w.Status = model.WithdrawalStatusFailed
		if adminID != uuid.Nil {
			w.AdminID = &adminID
		}
		w.FailureReason = reason
		// Re-using PaidAt pointer as null, leaves it nil.
		if err := s.repo.SaveTx(tx, w); err != nil {
			return errors.New("gagal update withdraw")
		}
		if err := s.writeNotifTx(tx, w.UserID, "withdrawal_failed",
			"Withdraw Gagal",
			fmt.Sprintf("Withdraw Rp %s gagal diproses. Alasan: %s. Saldo pendapatan dikembalikan.",
				formatRupiahPlain(w.Amount), reason),
			w.ID,
		); err != nil {
			return err
		}
		result = w
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// ----- internals -----

func (s *WalletWithdrawalService) validateInput(input CreateWithdrawalInput) error {
	if input.Amount < s.minAmount() {
		return fmt.Errorf("minimal withdraw Rp %s", formatRupiahPlain(s.minAmount()))
	}
	if input.Amount > s.maxAmount() {
		return fmt.Errorf("maksimal withdraw Rp %s per permintaan", formatRupiahPlain(s.maxAmount()))
	}
	if input.Amount-s.flatFee() <= 0 {
		return errors.New("nominal terlalu kecil setelah dipotong biaya")
	}
	destType := strings.ToLower(strings.TrimSpace(input.DestinationType))
	destCode := strings.ToUpper(strings.TrimSpace(input.DestinationCode))
	if destType != model.WithdrawalDestBank && destType != model.WithdrawalDestEwallet {
		return errors.New("tipe tujuan tidak valid")
	}
	if !model.IsKnownWithdrawalDestination(destType, destCode) {
		return errors.New("tujuan transfer tidak dikenal")
	}
	if l := len(strings.TrimSpace(input.DestinationAccount)); l < 4 || l > 64 {
		return errors.New("nomor rekening tujuan tidak valid")
	}
	if l := len(strings.TrimSpace(input.DestinationName)); l < 2 || l > 128 {
		return errors.New("nama pemilik rekening tidak valid")
	}
	return nil
}

// refundEarnTx writes the withdrawal_refund ledger row + credits
// User.WalletBalanceEarn back. Caller already locked the withdrawal
// row; this also locks the user row.
func (s *WalletWithdrawalService) refundEarnTx(tx *gorm.DB, w *model.WalletWithdrawal, reason string) error {
	if w.LedgerRefundID != nil {
		return errors.New("withdraw sudah pernah di-refund")
	}
	user, err := s.walletRepo.LockUserByIDTx(tx, w.UserID)
	if err != nil {
		return errors.New("gagal memuat user")
	}
	balanceBefore := user.WalletBalanceEarn
	balanceAfter := balanceBefore + w.Amount
	user.WalletBalanceEarn = balanceAfter
	if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
		return errors.New("gagal update saldo pendapatan")
	}

	refundRef := fmt.Sprintf("withdrawal:%s:refund", w.ID.String())
	refundLedger := &model.WalletLedger{
		ID:            uuid.New(),
		UserID:        user.ID,
		Type:          "credit",
		Category:      model.LedgerCategoryWithdrawalRefund,
		Pocket:        model.WalletPocketEarn,
		Amount:        w.Amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  balanceAfter,
		Reference:     refundRef,
		Description: fmt.Sprintf("Refund WD %s — %s",
			shortWalletLedgerRef(w.ID.String()), reason),
	}
	if err := s.walletRepo.CreateLedgerTx(tx, refundLedger); err != nil {
		return errors.New("gagal menulis ledger refund")
	}
	w.LedgerRefundID = &refundLedger.ID
	return nil
}

// transitionFromPending handles the simple pending → X transitions
// that don't move money (Approve). Reject has refund logic so it has
// its own dedicated method.
func (s *WalletWithdrawalService) transitionFromPending(
	ctx context.Context,
	adminID, id uuid.UUID,
	target string,
	note string,
	notifType string,
	notifTitle string,
	notifBody func(amount int64) string,
) (*model.WalletWithdrawal, error) {
	return s.adminTransition(ctx, adminID, id,
		[]string{model.WithdrawalStatusPending},
		target, note, notifType, notifTitle, notifBody)
}

// adminTransition is the generic state-machine helper for non-money
// transitions (approve, mark-processing). Reject/MarkFailed have their
// own bespoke handlers because they touch ledger.
func (s *WalletWithdrawalService) adminTransition(
	ctx context.Context,
	adminID, id uuid.UUID,
	allowedFrom []string,
	target string,
	note string,
	notifType string,
	notifTitle string,
	notifBody func(amount int64) string,
) (*model.WalletWithdrawal, error) {
	var result *model.WalletWithdrawal
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
		w, err := s.repo.LockByIDTx(tx, id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("permintaan withdraw tidak ditemukan")
			}
			return errors.New("gagal memuat withdraw")
		}
		ok := false
		for _, allowed := range allowedFrom {
			if w.Status == allowed {
				ok = true
				break
			}
		}
		if !ok {
			return fmt.Errorf("transisi ke %s tidak diizinkan dari status %s", target, w.Status)
		}

		now := time.Now()
		w.Status = target
		if adminID != uuid.Nil {
			w.AdminID = &adminID
		}
		switch target {
		case model.WithdrawalStatusApproved:
			w.ApprovedAt = &now
			if note != "" {
				w.AdminNote = note
			}
		}
		_ = now
		if err := s.repo.SaveTx(tx, w); err != nil {
			return errors.New("gagal update withdraw")
		}
		if notifType != "" {
			if err := s.writeNotifTx(tx, w.UserID, notifType, notifTitle, notifBody(w.Amount), w.ID); err != nil {
				return err
			}
		}
		result = w
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// writeNotifTx inserts a notification row inside the same tx as the
// state mutation. Type prefixed with "withdrawal_" so dashboard can
// filter / icon them appropriately.
func (s *WalletWithdrawalService) writeNotifTx(
	tx *gorm.DB,
	userID uuid.UUID,
	notifType, title, message string,
	withdrawalID uuid.UUID,
) error {
	notif := &model.Notification{
		UserID:  userID,
		Title:   title,
		Message: message,
		Type:    notifType,
	}
	if err := tx.Create(notif).Error; err != nil {
		return errors.New("gagal membuat notifikasi")
	}
	_ = withdrawalID // reserved for future structured payload
	return nil
}

// formatRupiahPlain renders 2_500_000 as "2.500.000" — Indonesian
// thousands separator. Used in user-facing copy. Prefer this over
// strconv.FormatInt for any string the user reads.
func formatRupiahPlain(n int64) string {
	if n < 0 {
		return "-" + formatRupiahPlain(-n)
	}
	in := fmt.Sprintf("%d", n)
	out := strings.Builder{}
	pre := len(in) % 3
	if pre > 0 {
		out.WriteString(in[:pre])
	}
	for i := pre; i < len(in); i += 3 {
		if out.Len() > 0 {
			out.WriteByte('.')
		}
		out.WriteString(in[i : i+3])
	}
	return out.String()
}
