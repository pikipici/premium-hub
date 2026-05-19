package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"premiumhub-api/internal/model"
)

// Wallet pocket transfer — Round 5 of WD plan.
//
// Hanya satu arah: pendapatan (earn) → utama (spend). Reverse direction
// (spend → earn) sengaja TIDAK pernah diekspos ke transport layer
// (gak ada handler, gak ada route) supaya gak bisa dipake user buat
// "naikin saldo pendapatan via topup", yg bakal ngebatalin disain
// dual-pocket. Kalau ke depan ada use case legit, harus dibalik via
// admin tooling — bukan endpoint user.

// TransferEarnToSpendInput payload service-level. Validation ringan
// di sini; handler tetep harus validate JSON shape.
type TransferEarnToSpendInput struct {
	Amount int64
}

// TransferEarnToSpendResult ringkasan hasil transfer untuk handler
// supaya FE bisa langsung refresh tampilan tanpa fetch ulang.
type TransferEarnToSpendResult struct {
	Amount             int64     `json:"amount"`
	BalanceSpend       int64     `json:"balance_spend"`
	BalanceEarn        int64     `json:"balance_earn"`
	LedgerReferenceOut string    `json:"ledger_reference_out"`
	LedgerReferenceIn  string    `json:"ledger_reference_in"`
	TransferID         uuid.UUID `json:"transfer_id"`
}

// Wallet transfer ledger categories. Pakai prefix transfer_* biar
// gampang difilter di reconciliation queries.
const (
	LedgerCategoryTransferOut = "transfer_out" // earn pocket debit
	LedgerCategoryTransferIn  = "transfer_in"  // spend pocket credit
)

// TransferEarnToSpend memindah dana dari Saldo Pendapatan (earn) ke
// Saldo Utama (spend) dalam satu transaction.
//
// Pre-conditions:
//   - amount > 0
//   - user.IsActive
//   - user.WalletBalanceEarn >= amount
//
// Side effects (atomic):
//   - earn pocket debit (User.WalletBalanceEarn -= amount)
//   - spend pocket credit (User.WalletBalance += amount)
//   - 2 ledger rows linked via transferID UUID — debit earn,
//     credit spend, both refer to the same transferID
func (s *WalletService) TransferEarnToSpend(ctx context.Context, userID uuid.UUID, input TransferEarnToSpendInput) (*TransferEarnToSpendResult, error) {
	if input.Amount <= 0 {
		return nil, errors.New("amount harus lebih dari 0")
	}

	transferID := uuid.New()
	refOut := fmt.Sprintf("transfer:%s:out", transferID.String())
	refIn := fmt.Sprintf("transfer:%s:in", transferID.String())

	var result *TransferEarnToSpendResult
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}

		// Lock user row buat re-check balance pas debit. LockUserByIDTx
		// pakai SELECT ... FOR UPDATE jadi ledger entries lain yg
		// touch user yg sama bakal nunggu sampe transaction ini commit.
		user, err := s.walletRepo.LockUserByIDTx(tx, userID)
		if err != nil {
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

		// --- Earn pocket debit ---
		earnBefore := user.WalletBalanceEarn
		earnAfter := earnBefore - input.Amount
		user.WalletBalanceEarn = earnAfter

		// --- Spend pocket credit ---
		spendBefore := user.WalletBalance
		spendAfter := spendBefore + input.Amount
		user.WalletBalance = spendAfter

		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return errors.New("gagal update saldo")
		}

		// Out leg — earn pocket debit.
		outLedger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "debit",
			Category:      LedgerCategoryTransferOut,
			Pocket:        model.WalletPocketEarn,
			Amount:        input.Amount,
			BalanceBefore: earnBefore,
			BalanceAfter:  earnAfter,
			Reference:     refOut,
			Description:   "Pindah ke Saldo Utama",
		}
		if err := s.walletRepo.CreateLedgerTx(tx, outLedger); err != nil {
			return errors.New("gagal menulis ledger transfer out")
		}

		// In leg — spend pocket credit.
		inLedger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "credit",
			Category:      LedgerCategoryTransferIn,
			Pocket:        model.WalletPocketSpend,
			Amount:        input.Amount,
			BalanceBefore: spendBefore,
			BalanceAfter:  spendAfter,
			Reference:     refIn,
			Description:   "Diterima dari Saldo Pendapatan",
		}
		if err := s.walletRepo.CreateLedgerTx(tx, inLedger); err != nil {
			return errors.New("gagal menulis ledger transfer in")
		}

		result = &TransferEarnToSpendResult{
			Amount:             input.Amount,
			BalanceSpend:       spendAfter,
			BalanceEarn:        earnAfter,
			LedgerReferenceOut: refOut,
			LedgerReferenceIn:  refIn,
			TransferID:         transferID,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
