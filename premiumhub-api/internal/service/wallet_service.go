package service

import (
	"context"
	cryptoRand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WalletService struct {
	cfg        *config.Config
	userRepo   *repository.UserRepo
	walletRepo *repository.WalletRepo
	notifRepo  *repository.NotificationRepo
	neticon    NeticonClient
}

var walletRandReader io.Reader = cryptoRand.Reader

func NewWalletService(
	cfg *config.Config,
	userRepo *repository.UserRepo,
	walletRepo *repository.WalletRepo,
	notifRepo *repository.NotificationRepo,
	neticon NeticonClient,
) *WalletService {
	if neticon == nil {
		neticon = NewNeticonClient(cfg)
	}
	return &WalletService{
		cfg:        cfg,
		userRepo:   userRepo,
		walletRepo: walletRepo,
		notifRepo:  notifRepo,
		neticon:    neticon,
	}
}

type WalletBalanceResponse struct {
	Balance                     int64   `json:"balance"`
	FiveSimWalletMultiplier     float64 `json:"fivesim_wallet_price_multiplier"`
	FiveSimWalletMinDebitAmount int64   `json:"fivesim_wallet_min_debit"`
}

type CreateTopupInput struct {
	Amount         int64  `json:"amount" binding:"required"`
	IdempotencyKey string `json:"idempotency_key"`
}

type WalletTopupResponse struct {
	ID              string     `json:"id"`
	Provider        string     `json:"provider"`
	ProviderTrxID   string     `json:"provider_trx_id"`
	RequestedAmount int64      `json:"requested_amount"`
	UniqueCode      int        `json:"unique_code"`
	PayableAmount   int64      `json:"payable_amount"`
	Status          string     `json:"status"`
	ProviderStatus  string     `json:"provider_status"`
	IdempotencyKey  string     `json:"idempotency_key"`
	ExpiresAt       time.Time  `json:"expires_at"`
	IsOverdue       bool       `json:"is_overdue"`
	LastCheckedAt   *time.Time `json:"last_checked_at"`
	SettledAt       *time.Time `json:"settled_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type WalletTopupListResponse struct {
	Topups []WalletTopupResponse `json:"topups"`
	Total  int64                 `json:"total"`
}

type WalletLedgerResponse struct {
	ID            string    `json:"id"`
	Type          string    `json:"type"`
	Category      string    `json:"category"`
	Amount        int64     `json:"amount"`
	BalanceBefore int64     `json:"balance_before"`
	BalanceAfter  int64     `json:"balance_after"`
	Reference     string    `json:"reference"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"created_at"`
}

type WalletLedgerListResponse struct {
	Ledgers []WalletLedgerResponse `json:"ledgers"`
	Total   int64                  `json:"total"`
}

type WalletReconcileResult struct {
	Checked int      `json:"checked"`
	Settled int      `json:"settled"`
	Pending int      `json:"pending"`
	Failed  int      `json:"failed"`
	Expired int      `json:"expired"`
	Errors  []string `json:"errors,omitempty"`
}

func (s *WalletService) GetBalance(userID uuid.UUID) (*WalletBalanceResponse, error) {
	user, err := s.ensureActiveUser(userID)
	if err != nil {
		return nil, err
	}
	return &WalletBalanceResponse{
		Balance:                     user.WalletBalance,
		FiveSimWalletMultiplier:     s.fiveSimWalletMultiplier(),
		FiveSimWalletMinDebitAmount: s.fiveSimWalletMinDebit(),
	}, nil
}

func (s *WalletService) CreateTopup(ctx context.Context, userID uuid.UUID, input CreateTopupInput) (*WalletTopupResponse, error) {
	if _, err := s.ensureActiveUser(userID); err != nil {
		return nil, err
	}

	amount := input.Amount
	if amount < 1000 {
		return nil, errors.New("minimal topup Rp 1.000")
	}
	if amount > 1_000_000_000 {
		return nil, errors.New("nominal topup terlalu besar")
	}

	idempotencyKey := normalizeIdempotencyKey(input.IdempotencyKey)
	if idempotencyKey == "" {
		idempotencyKey = uuid.NewString()
	}

	if existing, err := s.walletRepo.FindTopupByIdempotencyKey(userID, idempotencyKey); err == nil {
		return toTopupResponse(existing), nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek idempotency")
	}

	uniqueCode, err := generateUniqueCode()
	if err != nil {
		return nil, errors.New("gagal membuat kode unik")
	}
	payableAmount := amount + int64(uniqueCode)
	expiresAt := time.Now().Add(s.topupExpiryDuration())

	rawReq, _ := json.Marshal(map[string]interface{}{
		"action":           "request_deposit",
		"requested_amount": amount,
		"unique_code":      uniqueCode,
		"payable_amount":   payableAmount,
	})

	netRes, netRaw, err := s.neticon.RequestDeposit(ctx, payableAmount)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat invoice topup: %w", err)
	}

	topup := &model.WalletTopup{
		ID:              uuid.New(),
		UserID:          userID,
		Provider:        "neticon",
		ProviderTrxID:   netRes.TrxID,
		IdempotencyKey:  idempotencyKey,
		RequestedAmount: amount,
		UniqueCode:      uniqueCode,
		PayableAmount:   netRes.Amount,
		Status:          "pending",
		ProviderStatus:  "pending",
		RawRequest:      string(rawReq),
		RawResponse:     string(netRaw),
		ExpiresAt:       expiresAt,
	}
	if err := s.walletRepo.CreateTopup(topup); err != nil {
		if existing, findErr := s.walletRepo.FindTopupByIdempotencyKey(userID, idempotencyKey); findErr == nil {
			return toTopupResponse(existing), nil
		}
		return nil, errors.New("gagal menyimpan topup")
	}

	return toTopupResponse(topup), nil
}

func (s *WalletService) GetTopupByID(userID, topupID uuid.UUID) (*WalletTopupResponse, error) {
	if _, err := s.ensureActiveUser(userID); err != nil {
		return nil, err
	}

	topup, err := s.walletRepo.FindTopupByIDAndUser(topupID, userID)
	if err != nil {
		return nil, errors.New("topup tidak ditemukan")
	}
	return toTopupResponse(topup), nil
}

func (s *WalletService) ListTopups(userID uuid.UUID, page, limit int) (*WalletTopupListResponse, error) {
	if _, err := s.ensureActiveUser(userID); err != nil {
		return nil, err
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	topups, total, err := s.walletRepo.ListTopupByUser(userID, page, limit)
	if err != nil {
		return nil, errors.New("gagal memuat daftar topup")
	}

	res := make([]WalletTopupResponse, 0, len(topups))
	for i := range topups {
		res = append(res, *toTopupResponse(&topups[i]))
	}

	return &WalletTopupListResponse{Topups: res, Total: total}, nil
}

func (s *WalletService) ListLedger(userID uuid.UUID, page, limit int) (*WalletLedgerListResponse, error) {
	if _, err := s.ensureActiveUser(userID); err != nil {
		return nil, err
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	rows, total, err := s.walletRepo.ListLedgerByUser(userID, page, limit)
	if err != nil {
		return nil, errors.New("gagal memuat riwayat wallet")
	}

	ledgers := make([]WalletLedgerResponse, 0, len(rows))
	for i := range rows {
		ledgers = append(ledgers, WalletLedgerResponse{
			ID:            rows[i].ID.String(),
			Type:          rows[i].Type,
			Category:      rows[i].Category,
			Amount:        rows[i].Amount,
			BalanceBefore: rows[i].BalanceBefore,
			BalanceAfter:  rows[i].BalanceAfter,
			Reference:     rows[i].Reference,
			Description:   rows[i].Description,
			CreatedAt:     rows[i].CreatedAt,
		})
	}

	return &WalletLedgerListResponse{Ledgers: ledgers, Total: total}, nil
}

func (s *WalletService) CheckTopupStatus(ctx context.Context, userID, topupID uuid.UUID) (*WalletTopupResponse, error) {
	if _, err := s.ensureActiveUser(userID); err != nil {
		return nil, err
	}

	topup, err := s.walletRepo.FindTopupByIDAndUser(topupID, userID)
	if err != nil {
		return nil, errors.New("topup tidak ditemukan")
	}

	if err := s.syncTopupStatus(ctx, topup); err != nil {
		return nil, err
	}

	updated, err := s.walletRepo.FindTopupByIDAndUser(topupID, userID)
	if err != nil {
		return nil, errors.New("gagal memuat status topup")
	}
	return toTopupResponse(updated), nil
}

func (s *WalletService) AdminRecheckTopup(ctx context.Context, topupID uuid.UUID) (*WalletTopupResponse, error) {
	topup, err := s.walletRepo.FindTopupByID(topupID)
	if err != nil {
		return nil, errors.New("topup tidak ditemukan")
	}

	if err := s.syncTopupStatus(ctx, topup); err != nil {
		return nil, err
	}

	updated, err := s.walletRepo.FindTopupByID(topupID)
	if err != nil {
		return nil, errors.New("gagal memuat topup")
	}
	return toTopupResponse(updated), nil
}

func (s *WalletService) ReconcilePending(ctx context.Context, limit int) (*WalletReconcileResult, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}

	topups, err := s.walletRepo.ListPendingTopups(limit)
	if err != nil {
		return nil, errors.New("gagal memuat pending topup")
	}

	result := &WalletReconcileResult{}
	for i := range topups {
		topup := topups[i]
		result.Checked++

		if err := s.syncTopupStatus(ctx, &topup); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", topup.ID.String(), err))
			continue
		}

		updated, err := s.walletRepo.FindTopupByID(topup.ID)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: gagal memuat status terbaru", topup.ID.String()))
			continue
		}

		switch updated.Status {
		case "success":
			result.Settled++
		case "failed":
			result.Failed++
		case "expired":
			result.Expired++
		default:
			result.Pending++
		}
	}

	if len(result.Errors) > 20 {
		result.Errors = result.Errors[:20]
	}

	return result, nil
}

func (s *WalletService) syncTopupStatus(ctx context.Context, topup *model.WalletTopup) error {
	if topup.Status == "success" || topup.Status == "failed" || topup.Status == "expired" {
		return nil
	}

	statusRes, raw, err := s.neticon.CheckStatus(ctx, topup.ProviderTrxID)
	if err != nil {
		return fmt.Errorf("gagal cek status topup: %w", err)
	}

	mapped := mapProviderStatus(statusRes.Status)
	switch mapped {
	case "success":
		return s.settleSuccess(topup.ID, statusRes.Status, raw)
	case "failed", "expired":
		return s.markFinalStatus(topup.ID, mapped, statusRes.Status, raw)
	default:
		return s.touchPending(topup.ID, statusRes.Status, raw)
	}
}

func (s *WalletService) settleSuccess(topupID uuid.UUID, providerStatus string, raw []byte) error {
	var userID uuid.UUID
	var creditedAmount int64

	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		topup, err := s.walletRepo.LockTopupByIDTx(tx, topupID)
		if err != nil {
			return errors.New("topup tidak ditemukan")
		}

		now := time.Now()
		topup.LastCheckedAt = &now
		topup.ProviderStatus = strings.ToLower(strings.TrimSpace(providerStatus))
		topup.RawResponse = string(raw)

		if topup.Status == "success" {
			if err := s.walletRepo.SaveTopupTx(tx, topup); err != nil {
				return errors.New("gagal update topup")
			}
			return nil
		}

		if topup.Status != "pending" {
			if err := s.walletRepo.SaveTopupTx(tx, topup); err != nil {
				return errors.New("gagal update topup")
			}
			return nil
		}

		reference := fmt.Sprintf("wallet_topup:%s", topup.ID.String())
		if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, reference); err == nil {
			topup.Status = "success"
			topup.SettledAt = &now
			return s.walletRepo.SaveTopupTx(tx, topup)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		user, err := s.walletRepo.LockUserByIDTx(tx, topup.UserID)
		if err != nil {
			return errors.New("user tidak ditemukan")
		}

		before := user.WalletBalance
		after := before + topup.PayableAmount
		user.WalletBalance = after
		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return errors.New("gagal update saldo wallet")
		}

		ledger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        user.ID,
			TopupID:       &topup.ID,
			Type:          "credit",
			Category:      "topup",
			Amount:        topup.PayableAmount,
			BalanceBefore: before,
			BalanceAfter:  after,
			Reference:     reference,
			Description:   fmt.Sprintf("Topup wallet via Neticon (%s)", topup.ProviderTrxID),
		}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger wallet")
		}

		topup.Status = "success"
		topup.SettledAt = &now
		if err := s.walletRepo.SaveTopupTx(tx, topup); err != nil {
			return errors.New("gagal finalize topup")
		}

		userID = user.ID
		creditedAmount = topup.PayableAmount
		return nil
	})
	if err != nil {
		return err
	}

	if userID != uuid.Nil && creditedAmount > 0 {
		_ = s.notifRepo.Create(&model.Notification{
			UserID:  userID,
			Title:   "Topup Berhasil",
			Message: fmt.Sprintf("Topup wallet kamu berhasil sebesar Rp %d.", creditedAmount),
			Type:    "wallet",
		})
	}

	return nil
}

func (s *WalletService) markFinalStatus(topupID uuid.UUID, status string, providerStatus string, raw []byte) error {
	if status != "failed" && status != "expired" {
		return errors.New("status final tidak valid")
	}

	return s.walletRepo.Transaction(func(tx *gorm.DB) error {
		topup, err := s.walletRepo.LockTopupByIDTx(tx, topupID)
		if err != nil {
			return errors.New("topup tidak ditemukan")
		}

		now := time.Now()
		topup.LastCheckedAt = &now
		topup.ProviderStatus = strings.ToLower(strings.TrimSpace(providerStatus))
		topup.RawResponse = string(raw)

		if topup.Status == "success" {
			return s.walletRepo.SaveTopupTx(tx, topup)
		}
		if topup.Status == "pending" {
			topup.Status = status
		}
		return s.walletRepo.SaveTopupTx(tx, topup)
	})
}

func (s *WalletService) touchPending(topupID uuid.UUID, providerStatus string, raw []byte) error {
	return s.walletRepo.Transaction(func(tx *gorm.DB) error {
		topup, err := s.walletRepo.LockTopupByIDTx(tx, topupID)
		if err != nil {
			return errors.New("topup tidak ditemukan")
		}

		now := time.Now()
		topup.LastCheckedAt = &now
		topup.ProviderStatus = strings.ToLower(strings.TrimSpace(providerStatus))
		topup.RawResponse = string(raw)
		return s.walletRepo.SaveTopupTx(tx, topup)
	})
}

func (s *WalletService) ensureActiveUser(userID uuid.UUID) (*model.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, errors.New("user tidak ditemukan")
	}
	if !user.IsActive {
		return nil, errors.New("akun diblokir")
	}
	return user, nil
}

func normalizeIdempotencyKey(key string) string {
	key = strings.TrimSpace(strings.ToLower(key))
	if key == "" {
		return ""
	}
	if len(key) > 80 {
		key = key[:80]
	}
	return key
}

func generateUniqueCode() (int, error) {
	var b [2]byte
	if _, err := io.ReadFull(walletRandReader, b[:]); err != nil {
		return 0, err
	}
	raw := int(b[0])<<8 | int(b[1])
	return 100 + (raw % 900), nil
}

func mapProviderStatus(status string) string {
	s := strings.ToLower(strings.TrimSpace(status))
	switch s {
	case "success", "settlement", "capture", "paid":
		return "success"
	case "deny", "cancel", "failed", "failure":
		return "failed"
	case "expire", "expired":
		return "expired"
	default:
		return "pending"
	}
}

func toTopupResponse(topup *model.WalletTopup) *WalletTopupResponse {
	now := time.Now()
	isOverdue := topup.Status == "pending" && now.After(topup.ExpiresAt)

	return &WalletTopupResponse{
		ID:              topup.ID.String(),
		Provider:        topup.Provider,
		ProviderTrxID:   topup.ProviderTrxID,
		RequestedAmount: topup.RequestedAmount,
		UniqueCode:      topup.UniqueCode,
		PayableAmount:   topup.PayableAmount,
		Status:          topup.Status,
		ProviderStatus:  topup.ProviderStatus,
		IdempotencyKey:  topup.IdempotencyKey,
		ExpiresAt:       topup.ExpiresAt,
		IsOverdue:       isOverdue,
		LastCheckedAt:   topup.LastCheckedAt,
		SettledAt:       topup.SettledAt,
		CreatedAt:       topup.CreatedAt,
		UpdatedAt:       topup.UpdatedAt,
	}
}

func (s *WalletService) fiveSimWalletMultiplier() float64 {
	if s.cfg == nil {
		return 1
	}

	raw := strings.TrimSpace(s.cfg.FiveSimWalletPriceMultiplier)
	if raw == "" {
		return 1
	}

	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || value <= 0 {
		return 1
	}

	return value
}

func (s *WalletService) fiveSimWalletMinDebit() int64 {
	if s.cfg == nil {
		return 1
	}

	raw := strings.TrimSpace(s.cfg.FiveSimWalletMinDebit)
	if raw == "" {
		return 1
	}

	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return 1
	}

	return value
}

func (s *WalletService) topupExpiryDuration() time.Duration {
	minutes, err := strconv.Atoi(s.cfg.WalletTopupExpiryMinutes)
	if err != nil || minutes <= 0 {
		minutes = 15
	}
	if minutes > 120 {
		minutes = 120
	}
	return time.Duration(minutes) * time.Minute
}
