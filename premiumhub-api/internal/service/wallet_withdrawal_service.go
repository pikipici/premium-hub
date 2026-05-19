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
	if count >= WithdrawalMaxRequestsPerDay {
		return nil, fmt.Errorf("limit harian tercapai (max %d permintaan/hari)", WithdrawalMaxRequestsPerDay)
	}
	if totalToday+input.Amount > WithdrawalMaxAmountPerDay {
		return nil, fmt.Errorf("total nominal harian tidak boleh melebihi Rp %s", formatRupiahPlain(WithdrawalMaxAmountPerDay))
	}

	withdrawal := &model.WalletWithdrawal{
		ID:                 uuid.New(),
		UserID:             userID,
		Amount:             input.Amount,
		Fee:                WithdrawalFlatFee,
		NetAmount:          input.Amount - WithdrawalFlatFee,
		Status:             model.WithdrawalStatusPending,
		DestinationType:    strings.ToLower(strings.TrimSpace(input.DestinationType)),
		DestinationCode:    strings.ToUpper(strings.TrimSpace(input.DestinationCode)),
		DestinationAccount: strings.TrimSpace(input.DestinationAccount),
		DestinationName:    strings.TrimSpace(input.DestinationName),
		PayoutRailKind:     PayoutRailKindManual,
	}

	autoApproved := input.Amount < WithdrawalAutoApproveThreshold

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

// Approve transitions pending → approved. No saldo movement here —
// the earn pocket was already debited at submit time.
func (s *WalletWithdrawalService) Approve(ctx context.Context, adminID, id uuid.UUID, note string) (*model.WalletWithdrawal, error) {
	return s.transitionFromPending(ctx, adminID, id,
		model.WithdrawalStatusApproved,
		strings.TrimSpace(note),
		"withdrawal_approved",
		"Withdraw Disetujui",
		func(amount int64) string {
			return fmt.Sprintf("Permintaan withdraw Rp %s disetujui dan akan segera diproses.", formatRupiahPlain(amount))
		},
	)
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
		w.AdminID = &adminID
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
		w.AdminID = &adminID
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
		w.AdminID = &adminID
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
	if input.Amount < WithdrawalMinAmount {
		return fmt.Errorf("minimal withdraw Rp %s", formatRupiahPlain(WithdrawalMinAmount))
	}
	if input.Amount > WithdrawalMaxAmount {
		return fmt.Errorf("maksimal withdraw Rp %s per permintaan", formatRupiahPlain(WithdrawalMaxAmount))
	}
	if input.Amount-WithdrawalFlatFee <= 0 {
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
		w.AdminID = &adminID
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
