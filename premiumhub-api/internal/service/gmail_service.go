package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/credential"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailService handles the sell-side gmail marketplace lifecycle:
// slot generation -> user creates -> user submits -> admin verify or
// reject. Buy-side is handled separately in Round 2.
//
// All state transitions that touch money (admin verify -> earn-pocket
// credit) run inside one walletRepo.Transaction so the wallet ledger
// row commits atomically with the gmail status update.
type GmailService struct {
	cfg            *config.Config
	repo           *repository.GmailAccountRepo
	pricingRepo    *repository.GmailPricingRepo
	strikeRepo     *repository.GmailStrikeRepo
	walletRepo     *repository.WalletRepo
	userRepo       *repository.UserRepo
	notifRepo      *repository.NotificationRepo
	cipher         *credential.StockCipher
	credsGenerator *GmailCredsGenerator
}

func NewGmailService(
	cfg *config.Config,
	repo *repository.GmailAccountRepo,
	pricingRepo *repository.GmailPricingRepo,
	strikeRepo *repository.GmailStrikeRepo,
	walletRepo *repository.WalletRepo,
	userRepo *repository.UserRepo,
	notifRepo *repository.NotificationRepo,
	cipher *credential.StockCipher,
) *GmailService {
	prefix := cfg.GmailGeneratedEmailPrefix
	if strings.TrimSpace(prefix) == "" {
		prefix = "premium"
	}
	return &GmailService{
		cfg:            cfg,
		repo:           repo,
		pricingRepo:    pricingRepo,
		strikeRepo:     strikeRepo,
		walletRepo:     walletRepo,
		userRepo:       userRepo,
		notifRepo:      notifRepo,
		cipher:         cipher,
		credsGenerator: NewGmailCredsGenerator(prefix),
	}
}

// ----- tunable getters (cfg-with-default fallback) -----

func (s *GmailService) maxPendingPerUser() int {
	if s.cfg != nil && s.cfg.GmailMaxPendingPerUser > 0 {
		return s.cfg.GmailMaxPendingPerUser
	}
	return 3
}

func (s *GmailService) slotExpiryDuration() time.Duration {
	hours := 6
	if s.cfg != nil && s.cfg.GmailSlotExpiryHours > 0 {
		hours = s.cfg.GmailSlotExpiryHours
	}
	return time.Duration(hours) * time.Hour
}

func (s *GmailService) strikeWindow() time.Duration {
	days := 30
	if s.cfg != nil && s.cfg.GmailStrikeWindowDays > 0 {
		days = s.cfg.GmailStrikeWindowDays
	}
	return time.Duration(days) * 24 * time.Hour
}

func (s *GmailService) banDuration() time.Duration {
	days := 30
	if s.cfg != nil && s.cfg.GmailStrikeBanDays > 0 {
		days = s.cfg.GmailStrikeBanDays
	}
	return time.Duration(days) * 24 * time.Hour
}

func (s *GmailService) strikeThreshold() int {
	if s.cfg != nil && s.cfg.GmailStrikeThreshold > 0 {
		return s.cfg.GmailStrikeThreshold
	}
	return 3
}

// SlotResponse is what RequestSlot returns to the user — the plain
// password is shown ONCE and never persisted unencrypted.
type SlotResponse struct {
	GmailAccount *model.GmailAccount `json:"gmail_account"`
	PlainPassword string             `json:"plain_password"`
}

// ----- user-side methods -----

// RequestSlot generates a fresh email + password and reserves a slot
// for the user. Returns ONE-TIME plaintext password the user must use
// when creating the gmail account at Google.
//
// Pre-conditions:
//   - User not banned (GmailSellBannedUntil < now)
//   - User has < maxPendingPerUser active slots (pending_create or pending_verify)
//
// Side effects: creates GmailAccount row with status=pending_create,
// slot_expires_at = now + 6h.
func (s *GmailService) RequestSlot(userID uuid.UUID) (*SlotResponse, error) {
	// Generate creds OUTSIDE transaction (cheap, but no DB I/O needed
	// to be locked). Uniqueness check is also outside since collision
	// is astronomically unlikely with 32-char random suffix and the
	// uniqueIndex on email column will reject any real collision when
	// the row is inserted inside the tx.
	const maxAttempts = 10
	var email, plainPassword string
	for i := 0; i < maxAttempts; i++ {
		e, p, gerr := s.credsGenerator.Generate()
		if gerr != nil {
			return nil, errors.New("gagal generate kredensial")
		}
		if _, lookupErr := s.repo.GetByEmail(e); lookupErr != nil {
			// Not found = email available — use it.
			email = e
			plainPassword = p
			break
		}
		// Collision, retry.
	}
	if email == "" {
		return nil, errors.New("gagal generate email unik, coba lagi")
	}

	encPassword, err := s.cipher.Encrypt(plainPassword)
	if err != nil {
		return nil, errors.New("gagal enkripsi password")
	}

	// Atomicity: ban check + pending count + slot insert all happen
	// inside one tx with the user row FOR UPDATE locked. This kills
	// the TOCTOU race where a user could double-submit and bypass
	// max-pending or the freshly-applied ban.
	var result *SlotResponse
	err = s.walletRepo.Transaction(func(tx *gorm.DB) error {
		user, err := s.walletRepo.LockUserByIDTx(tx, userID)
		if err != nil {
			return errors.New("user tidak ditemukan")
		}
		now := time.Now()
		if user.GmailSellBannedUntil != nil && now.Before(*user.GmailSellBannedUntil) {
			remaining := time.Until(*user.GmailSellBannedUntil)
			days := int(remaining.Hours()/24) + 1
			return fmt.Errorf("akun lu lagi di-ban dari setor gmail. Tunggu %d hari lagi", days)
		}

		pending, err := s.repo.CountPendingByUserTx(tx, userID)
		if err != nil {
			return errors.New("gagal cek slot pending")
		}
		if int(pending) >= s.maxPendingPerUser() {
			return fmt.Errorf("selesaikan dulu slot pending lu (max %d simultan)", s.maxPendingPerUser())
		}

		expiresAt := now.Add(s.slotExpiryDuration())
		g := &model.GmailAccount{
			CreatedByUserID: userID,
			Status:          model.GmailStatusPendingCreate,
			Email:           email,
			PasswordEnc:     encPassword,
			PasswordVersion: model.GmailPasswordVersionInitial,
			SlotExpiresAt:   &expiresAt,
		}
		if err := s.repo.CreateTx(tx, g); err != nil {
			return errors.New("gagal membuat slot gmail")
		}
		result = &SlotResponse{
			GmailAccount:  g,
			PlainPassword: plainPassword,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// SubmitSlot moves a slot from pending_create -> pending_verify after
// the user has manually created the gmail account at Google.
func (s *GmailService) SubmitSlot(userID, slotID uuid.UUID) (*model.GmailAccount, error) {
	var result *model.GmailAccount
	err := s.repo.Transaction(func(tx *gorm.DB) error {
		g, err := s.repo.LockByIDTx(tx, slotID)
		if err != nil {
			return errors.New("slot tidak ditemukan")
		}
		if g.CreatedByUserID != userID {
			return errors.New("slot bukan milik lu")
		}
		if g.Status != model.GmailStatusPendingCreate {
			return fmt.Errorf("slot tidak bisa di-submit (status %s)", g.Status)
		}
		// Anti-late: kalo slot udah expired (worker belum jalan), tolak.
		if g.SlotExpiresAt != nil && time.Now().After(*g.SlotExpiresAt) {
			return errors.New("slot sudah expired (>6 jam)")
		}
		now := time.Now()
		g.Status = model.GmailStatusPendingVerify
		g.SubmittedAt = &now
		g.SlotExpiresAt = nil // no longer relevant
		if err := s.repo.SaveTx(tx, g); err != nil {
			return errors.New("gagal update slot")
		}
		_ = s.writeNotifTx(tx, g.CreatedByUserID, "gmail_submitted",
			"Setoran Gmail Diterima",
			"Submission lu masuk antrian verifikasi admin. Tunggu max 1×24 jam.",
			g.ID)
		result = g
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// ListMySlots returns the user's sell-side history with optional
// status filter.
func (s *GmailService) ListMySlots(userID uuid.UUID, status string, page, limit int) ([]model.GmailAccount, int64, error) {
	return s.repo.ListMyContributions(userID, strings.TrimSpace(status), page, limit)
}

// GetMine fetches one gmail row scoped to the calling user.
func (s *GmailService) GetMine(userID, slotID uuid.UUID) (*model.GmailAccount, error) {
	return s.repo.GetByIDForUser(slotID, userID)
}

// ----- admin-side methods -----

// AdminListPendingVerify returns the verification queue.
func (s *GmailService) AdminListPendingVerify(page, limit int) ([]model.GmailAccount, int64, error) {
	return s.repo.ListPendingVerify(page, limit)
}

// AdminGetByID returns any gmail row regardless of owner.
func (s *GmailService) AdminGetByID(id uuid.UUID) (*model.GmailAccount, error) {
	return s.repo.GetByID(id)
}

// AdminGetCredentials returns the decrypted plaintext password for
// admin verification login. Reserved for admin verify queue UI.
func (s *GmailService) AdminGetCredentials(id uuid.UUID) (string, string, error) {
	g, err := s.repo.GetByID(id)
	if err != nil {
		return "", "", err
	}
	pw, err := s.cipher.Decrypt(g.PasswordEnc)
	if err != nil {
		return "", "", errors.New("gagal dekripsi password")
	}
	return g.Email, pw, nil
}

// AdminVerify marks a pending_verify slot as verified, rotates the
// password (anti-hackback), and credits the seller's earn pocket.
//
// Atomicity: gmail row save + earn pocket credit + ledger row are all
// in one transaction.
func (s *GmailService) AdminVerify(adminID, gmailID uuid.UUID, newPlainPassword string) (*model.GmailAccount, error) {
	if strings.TrimSpace(newPlainPassword) == "" {
		return nil, errors.New("password baru wajib diisi")
	}
	if len(newPlainPassword) < 10 {
		return nil, errors.New("password baru minimal 10 karakter")
	}

	pricing, err := s.pricingRepo.Get()
	if err != nil {
		return nil, errors.New("config harga gmail belum diset")
	}
	payoutAmount := pricing.BuyPrice
	if payoutAmount <= 0 {
		return nil, errors.New("harga beli gmail tidak valid")
	}

	newEnc, err := s.cipher.Encrypt(newPlainPassword)
	if err != nil {
		return nil, errors.New("gagal enkripsi password baru")
	}

	var result *model.GmailAccount
	err = s.walletRepo.Transaction(func(tx *gorm.DB) error {
		g, err := s.repo.LockByIDTx(tx, gmailID)
		if err != nil {
			return errors.New("gmail tidak ditemukan")
		}
		if g.Status != model.GmailStatusPendingVerify {
			return fmt.Errorf("gmail tidak bisa di-verify (status %s)", g.Status)
		}
		seller, err := s.walletRepo.LockUserEarnByIDTx(tx, g.CreatedByUserID)
		if err != nil {
			return errors.New("gagal lock seller")
		}
		balanceBefore := seller.WalletBalanceEarn
		balanceAfter := balanceBefore + payoutAmount
		seller.WalletBalanceEarn = balanceAfter
		if err := s.walletRepo.SaveUserTx(tx, seller); err != nil {
			return errors.New("gagal update saldo pendapatan")
		}
		ref := fmt.Sprintf("gmail:%s:sell", g.ID.String())
		ledger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        seller.ID,
			Type:          "credit",
			Category:      model.LedgerCategoryGmailSellPayout,
			Pocket:        model.WalletPocketEarn,
			Amount:        payoutAmount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  balanceAfter,
			Reference:     ref,
			Description:   fmt.Sprintf("Payout setor gmail %s", g.Email),
		}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger payout")
		}

		now := time.Now()
		g.PasswordEnc = newEnc
		g.PasswordVersion = model.GmailPasswordVersionPostVerify
		g.VerifiedAt = &now
		g.VerifiedByAdminID = &adminID
		g.SellerPayoutAmount = payoutAmount
		g.SellerPayoutLedgerID = &ledger.ID
		g.Status = model.GmailStatusVerified
		if err := s.repo.SaveTx(tx, g); err != nil {
			return errors.New("gagal update gmail")
		}

		_ = s.writeNotifTx(tx, g.CreatedByUserID, "gmail_verified",
			"Setoran Diverifikasi",
			fmt.Sprintf("Setoran %s diverifikasi. +Rp %d masuk Saldo Pendapatan.", g.Email, payoutAmount),
			g.ID)
		result = g
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// AdminReject moves pending_verify -> rejected, creates a strike, and
// auto-bans the user if their rolling 30-day strike count crosses the
// threshold.
func (s *GmailService) AdminReject(adminID, gmailID uuid.UUID, reason, note string) (*model.GmailAccount, error) {
	reason = strings.TrimSpace(reason)
	switch reason {
	case model.GmailStrikeReasonRecoverySet,
		model.GmailStrikeReasonLoginFailed,
		model.GmailStrikeReasonFreshnessFailed,
		model.GmailStrikeReasonOther:
		// ok
	default:
		return nil, errors.New("reject reason tidak valid")
	}

	var result *model.GmailAccount
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		g, err := s.repo.LockByIDTx(tx, gmailID)
		if err != nil {
			return errors.New("gmail tidak ditemukan")
		}
		if g.Status != model.GmailStatusPendingVerify {
			return fmt.Errorf("gmail tidak bisa di-reject (status %s)", g.Status)
		}
		now := time.Now()
		g.Status = model.GmailStatusRejected
		g.RejectedAt = &now
		g.RejectedByAdminID = &adminID
		g.RejectReason = reason
		g.RejectNote = strings.TrimSpace(note)
		if err := s.repo.SaveTx(tx, g); err != nil {
			return errors.New("gagal update gmail")
		}

		strike := &model.GmailStrike{
			UserID:         g.CreatedByUserID,
			GmailAccountID: g.ID,
			Reason:         reason,
			Note:           strings.TrimSpace(note),
			AdminID:        adminID,
		}
		if err := s.strikeRepo.CreateTx(tx, strike); err != nil {
			return errors.New("gagal mencatat strike")
		}

		// Count strikes including the one just inserted.
		windowStart := now.Add(-s.strikeWindow())
		strikeCount, err := s.strikeRepo.CountActiveByUserTx(tx, g.CreatedByUserID, windowStart)
		if err != nil {
			return errors.New("gagal hitung strike")
		}

		threshold := int64(s.strikeThreshold())
		if strikeCount >= threshold {
			user, err := s.userRepo.FindByID(g.CreatedByUserID)
			if err != nil {
				return errors.New("gagal load user untuk ban")
			}
			banUntil := now.Add(s.banDuration())
			user.GmailSellBannedUntil = &banUntil
			if err := tx.Save(user).Error; err != nil {
				return errors.New("gagal apply ban")
			}
			_ = s.writeNotifTx(tx, g.CreatedByUserID, "gmail_banned",
				"Akses Setor Gmail Dibekukan",
				fmt.Sprintf("Lu kena %d strike dalam %d hari. Akses setor gmail di-ban sampe %s.",
					strikeCount, s.cfg.GmailStrikeWindowDays, banUntil.Format("2 Jan 2006")),
				g.ID)
		} else {
			reasonHuman := gmailRejectReasonHuman(reason)
			if reason == model.GmailStrikeReasonOther && strings.TrimSpace(note) != "" {
				reasonHuman = strings.TrimSpace(note)
			}
			_ = s.writeNotifTx(tx, g.CreatedByUserID, "gmail_rejected",
				"Setoran Ditolak",
				fmt.Sprintf("Setoran %s ditolak: %s. Strike %d/%d.",
					g.Email, reasonHuman, strikeCount, threshold),
				g.ID)
		}
		result = g
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// MarkExpired is called by the slot expiry worker to flip
// pending_create slots that hit the 6h deadline without a submit.
// Notifies the user that their slot was cleared.
func (s *GmailService) MarkExpired(slotID uuid.UUID) error {
	return s.repo.Transaction(func(tx *gorm.DB) error {
		g, err := s.repo.LockByIDTx(tx, slotID)
		if err != nil {
			return err
		}
		if g.Status != model.GmailStatusPendingCreate {
			return nil // already moved to another state, skip
		}
		g.Status = model.GmailStatusExpired
		if err := s.repo.SaveTx(tx, g); err != nil {
			return err
		}
		_ = s.writeNotifTx(tx, g.CreatedByUserID, "gmail_slot_expired",
			"Slot Setor Expired",
			"Slot setor gmail lu expired (>6 jam tanpa submit). Kuota pending kebuka kembali.",
			g.ID)
		return nil
	})
}

// CountVerifiedInventory exposes the verified count for low-inventory
// alerting and buy-side stock check (used in Round 2).
func (s *GmailService) CountVerifiedInventory() (int64, error) {
	return s.repo.CountVerified()
}

// ----- internals -----

// writeNotifTx mirrors the WD pattern — insert a notification inline
// with the state change. Type prefixed with "gmail_" so dashboard can
// filter and icon them.
func (s *GmailService) writeNotifTx(
	tx *gorm.DB,
	userID uuid.UUID,
	notifType, title, message string,
	gmailID uuid.UUID,
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
	_ = gmailID // reserved for future structured payload
	return nil
}

func gmailRejectReasonHuman(reason string) string {
	switch reason {
	case model.GmailStrikeReasonRecoverySet:
		return "akun ada recovery (dilarang)"
	case model.GmailStrikeReasonLoginFailed:
		return "credentials gak match"
	case model.GmailStrikeReasonFreshnessFailed:
		return "akun bukan baru / ada history"
	default:
		return "alasan lain"
	}
}
