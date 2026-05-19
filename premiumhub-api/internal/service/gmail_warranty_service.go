package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailWarrantyService handles 1×24h warranty claims on sold gmail
// accounts.
//
// MVP: auto-resolve immediately — no admin queue. Buyer files claim,
// service either replaces from inventory (if stock) or refunds to
// spend pocket. Original gmail row is always disposed (banned-after-
// sale assumed; admin can audit).
//
// Atomicity: full flow inside walletRepo.Transaction. Lock buyer +
// original gmail + (if replacing) replacement gmail. Refund path
// also locks user (FOR UPDATE) before crediting balance.
type GmailWarrantyService struct {
	cfg        *config.Config
	gmailRepo  *repository.GmailAccountRepo
	orderRepo  *repository.GmailOrderRepo
	claimRepo  *repository.GmailClaimRepo
	walletRepo *repository.WalletRepo
}

func NewGmailWarrantyService(
	cfg *config.Config,
	gmailRepo *repository.GmailAccountRepo,
	orderRepo *repository.GmailOrderRepo,
	claimRepo *repository.GmailClaimRepo,
	walletRepo *repository.WalletRepo,
) *GmailWarrantyService {
	return &GmailWarrantyService{
		cfg:        cfg,
		gmailRepo:  gmailRepo,
		orderRepo:  orderRepo,
		claimRepo:  claimRepo,
		walletRepo: walletRepo,
	}
}

func (s *GmailWarrantyService) warrantyHours() int {
	if s.cfg != nil && s.cfg.GmailWarrantyHours > 0 {
		return s.cfg.GmailWarrantyHours
	}
	return 24
}

// ClaimResult is what handler returns after auto-resolve.
type ClaimResult struct {
	Claim          *model.GmailClaim   `json:"claim"`
	Replacement    *model.GmailAccount `json:"replacement,omitempty"`
	RefundAmount   int64               `json:"refund_amount,omitempty"`
	RefundedToWalletBalance bool       `json:"refunded_to_wallet_balance,omitempty"`
}

// CreateClaim files + auto-resolves a warranty claim.
//
// Steps (in tx):
//   1. Lock original gmail row (FOR UPDATE)
//   2. Verify ownership: SoldToUserID == buyerID && Status == sold
//   3. Verify within warranty window (now - SoldAt <= warrantyHours)
//   4. Verify not double-claimed (claimRepo.ExistsForGmailTx)
//   5. Try claim 1 row from verified inventory (LockOldestVerifiedForOrderTx)
//   6a. Have replacement → mark original disposed, mark replacement
//       sold (chain to original.SoldOrderID), create claim row with
//       resolution=replaced
//   6b. No replacement → lock buyer user, refund SoldPrice to spend
//       pocket, write debit-side ledger row referencing original gmail
//       (note: this is a credit to buyer; we use type=credit), mark
//       original disposed, create claim row resolution=refunded
//   7. Notify buyer (atomic in tx via writeNotifTx)
func (s *GmailWarrantyService) CreateClaim(buyerID, orderID, gmailAccountID uuid.UUID, reason string) (*ClaimResult, error) {
	if reason = strings.TrimSpace(reason); reason == "" {
		return nil, errors.New("alasan klaim wajib diisi")
	}
	if len(reason) > 255 {
		reason = reason[:255]
	}

	var result *ClaimResult

	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		// 1. Lock original gmail row.
		original, err := s.gmailRepo.LockByIDTx(tx, gmailAccountID)
		if err != nil {
			return errors.New("gmail account tidak ditemukan")
		}

		// 2. Auth + ownership.
		if original.SoldToUserID == nil || *original.SoldToUserID != buyerID {
			return errors.New("gmail ini bukan milik lu")
		}
		if original.SoldOrderID == nil || *original.SoldOrderID != orderID {
			return errors.New("gmail ini bukan dari order ini")
		}
		if original.Status != model.GmailStatusSold {
			// Already disposed via prior claim → return existing record
			// (idempotent on UI retry).
			return errors.New("gmail udah pernah di-claim atau gak bisa di-claim")
		}

		// 3. Warranty window.
		if original.SoldAt == nil {
			return errors.New("data sold_at hilang, hubungi admin")
		}
		warrantyDeadline := original.SoldAt.Add(time.Duration(s.warrantyHours()) * time.Hour)
		if time.Now().After(warrantyDeadline) {
			return fmt.Errorf("garansi sudah expired (lebih dari %d jam sejak pembelian)", s.warrantyHours())
		}

		// 4. Double-claim guard.
		exists, err := s.claimRepo.ExistsForGmailTx(tx, gmailAccountID)
		if err != nil {
			return errors.New("gagal cek riwayat klaim")
		}
		if exists {
			return errors.New("gmail ini udah pernah di-klaim")
		}

		// 5. Try claim replacement from inventory.
		replacements, err := s.gmailRepo.LockOldestVerifiedForOrderTx(tx, 1)
		if err != nil {
			return errors.New("gagal akses inventory")
		}

		now := time.Now()

		// 6. Common: dispose original.
		original.Status = model.GmailStatusDisposed
		original.DisposedAt = &now
		original.DisposedReason = model.GmailDisposedReasonBannedAfterSale
		if err := s.gmailRepo.SaveTx(tx, original); err != nil {
			return errors.New("gagal dispose gmail original")
		}

		claim := &model.GmailClaim{
			ID:             uuid.New(),
			BuyerID:        buyerID,
			GmailOrderID:   orderID,
			GmailAccountID: gmailAccountID,
			Reason:         reason,
			ResolvedAt:     now,
		}

		// 6a. Replacement available → swap.
		if len(replacements) > 0 {
			rep := &replacements[0]
			rep.Status = model.GmailStatusSold
			rep.SoldToUserID = &buyerID
			rep.SoldOrderID = &orderID
			rep.SoldPrice = original.SoldPrice
			rep.SoldAt = &now
			if err := s.gmailRepo.SaveTx(tx, rep); err != nil {
				return errors.New("gagal mark replacement sold")
			}

			claim.Status = model.GmailClaimStatusReplaced
			claim.ResolutionType = model.GmailClaimResolutionReplaced
			claim.ReplacementGmailAccountID = &rep.ID
			if err := s.claimRepo.CreateTx(tx, claim); err != nil {
				return errors.New("gagal create claim record")
			}

			_ = s.writeNotifTx(tx, buyerID, "gmail_warranty_replaced",
				"Garansi: Akun Diganti",
				fmt.Sprintf("Gmail %s diganti dengan %s. Lihat detail di order.",
					original.Email, rep.Email))

			result = &ClaimResult{
				Claim:       claim,
				Replacement: rep,
			}
			return nil
		}

		// 6b. Inventory empty → refund to spend pocket.
		buyer, err := s.walletRepo.LockUserByIDTx(tx, buyerID)
		if err != nil {
			return errors.New("gagal lock buyer untuk refund")
		}
		refundAmt := original.SoldPrice
		balanceBefore := buyer.WalletBalance
		balanceAfter := balanceBefore + refundAmt
		buyer.WalletBalance = balanceAfter
		if err := s.walletRepo.SaveUserTx(tx, buyer); err != nil {
			return errors.New("gagal kredit refund saldo utama")
		}

		ledger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        buyerID,
			Type:          "credit",
			Category:      model.LedgerCategoryGmailWarrantyRefund,
			Pocket:        model.WalletPocketSpend,
			Amount:        refundAmt,
			BalanceBefore: balanceBefore,
			BalanceAfter:  balanceAfter,
			Reference:     fmt.Sprintf("gmail-warranty:%s", gmailAccountID.String()),
			Description:   fmt.Sprintf("Refund garansi gmail %s", original.Email),
		}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger refund")
		}

		claim.Status = model.GmailClaimStatusRefunded
		claim.ResolutionType = model.GmailClaimResolutionRefunded
		claim.RefundAmount = refundAmt
		claim.RefundLedgerID = &ledger.ID
		if err := s.claimRepo.CreateTx(tx, claim); err != nil {
			return errors.New("gagal create claim record (refund)")
		}

		_ = s.writeNotifTx(tx, buyerID, "gmail_warranty_refunded",
			"Garansi: Refund",
			fmt.Sprintf("Stok gmail kosong. Rp %d direfund ke Saldo Utama lu.", refundAmt))

		result = &ClaimResult{
			Claim:                   claim,
			RefundAmount:            refundAmt,
			RefundedToWalletBalance: true,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// ListByOrder returns all claims for buyer's order. Auth-scoped.
func (s *GmailWarrantyService) ListByOrder(buyerID, orderID uuid.UUID) ([]model.GmailClaim, error) {
	// Verify order ownership before listing — keep auth boundary tight.
	if _, err := s.orderRepo.GetByIDForUser(orderID, buyerID); err != nil {
		return nil, err
	}
	return s.claimRepo.ListByOrder(buyerID, orderID)
}

// writeNotifTx — same pattern as gmail_service / gmail_order_service.
func (s *GmailWarrantyService) writeNotifTx(tx *gorm.DB, userID uuid.UUID, typ, title, msg string) error {
	notif := &model.Notification{
		UserID:  userID,
		Title:   title,
		Message: msg,
		Type:    typ,
	}
	if err := tx.Create(notif).Error; err != nil {
		return errors.New("gagal membuat notifikasi")
	}
	return nil
}
