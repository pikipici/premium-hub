package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var errFiveSimWalletInsufficient = errors.New("saldo wallet tidak cukup untuk beli nomor 5sim")

const (
	fiveSimStatusPending  = "PENDING"
	fiveSimStatusReceived = "RECEIVED"
	fiveSimStatusCanceled = "CANCELED"
	fiveSimStatusTimeout  = "TIMEOUT"
	fiveSimStatusFinished = "FINISHED"
	fiveSimStatusBanned   = "BANNED"

	fiveSimResolutionSourceProvider  = "provider"
	fiveSimResolutionSourceSynthetic = "synthetic"

	fiveSimSyncErrNone          = "NONE"
	fiveSimSyncErrOrderNotFound = "ORDER_NOT_FOUND"
	fiveSimSyncErrOrderExpired  = "ORDER_EXPIRED"
	fiveSimSyncErrAuth          = "AUTH"
	fiveSimSyncErrRateLimit     = "RATE_LIMIT"
	fiveSimSyncErrProvider      = "PROVIDER_ERROR"
	fiveSimSyncErrUnknown       = "UNKNOWN"

	fiveSimIdemStatusProcessing = "processing"
	fiveSimIdemStatusCompleted  = "completed"
	fiveSimIdemStatusFailed     = "failed"
	fiveSimIdemKeyMaxLen        = 80

	fiveSimAvailabilityAvailable  = "available"
	fiveSimAvailabilityOutOfStock = "out_of_stock"
	fiveSimAvailabilityUnknown    = "unknown"

	fiveSimAvailabilityReasonCountZero      = "count_zero"
	fiveSimAvailabilityReasonCountMissing   = "count_missing"
	fiveSimAvailabilityReasonRecentlyNoFree = "recent_no_free_phones"
)

const fiveSimOperatorNoStockCooldown = 90 * time.Second

var fiveSimOpenStatuses = map[string]struct{}{
	fiveSimStatusPending:  {},
	fiveSimStatusReceived: {},
}

var fiveSimRefundEligibleStatuses = map[string]struct{}{
	fiveSimStatusCanceled: {},
	fiveSimStatusTimeout:  {},
	fiveSimStatusBanned:   {},
}

type FiveSimService struct {
	cfg        *config.Config
	userRepo   *repository.UserRepo
	orderRepo  *repository.FiveSimOrderRepo
	walletRepo *repository.WalletRepo
	client     FiveSimClient

	operatorNoStockMu    sync.Mutex
	operatorNoStockUntil map[string]time.Time
}

type FiveSimBuyActivationInput struct {
	Country        string   `json:"country" binding:"required"`
	Operator       string   `json:"operator"`
	Product        string   `json:"product" binding:"required"`
	Forwarding     *bool    `json:"forwarding"`
	Number         string   `json:"number"`
	Reuse          bool     `json:"reuse"`
	Voice          bool     `json:"voice"`
	Ref            string   `json:"ref"`
	MaxPrice       *float64 `json:"max_price"`
	IdempotencyKey string   `json:"idempotency_key"`
}

type FiveSimBuyHostingInput struct {
	Country        string `json:"country" binding:"required"`
	Operator       string `json:"operator"`
	Product        string `json:"product" binding:"required"`
	IdempotencyKey string `json:"idempotency_key"`
}

type FiveSimReuseInput struct {
	Product        string `json:"product" binding:"required"`
	Number         string `json:"number" binding:"required"`
	IdempotencyKey string `json:"idempotency_key"`
}

type FiveSimProviderHistoryInput struct {
	Category string
	Limit    int
	Offset   int
	Order    string
	Reverse  bool
}

type FiveSimCatalogPriceRow struct {
	Operator           string `json:"operator"`
	WalletDebit        int64  `json:"wallet_debit"`
	NumberCount        *int64 `json:"number_count,omitempty"`
	BuyEnabled         bool   `json:"buy_enabled"`
	AvailabilityStatus string `json:"availability_status,omitempty"`
	AvailabilityReason string `json:"availability_reason,omitempty"`
}

type FiveSimCatalogPricesResponse struct {
	Country  string                   `json:"country"`
	Product  string                   `json:"product"`
	Currency string                   `json:"currency"`
	Prices   []FiveSimCatalogPriceRow `json:"prices"`
}

type FiveSimReconcileInput struct {
	Limit      int
	MinSyncAge time.Duration
	MaxWaiting time.Duration
}

type FiveSimReconcileResult struct {
	Checked           int `json:"checked"`
	Synced            int `json:"synced"`
	AutoCanceled      int `json:"auto_canceled"`
	SyntheticResolved int `json:"synthetic_resolved"`
	Refunded          int `json:"refunded"`
	Failed            int `json:"failed"`
}

type fiveSimSyncErrorInfo struct {
	Code          string
	Message       string
	Retryable     bool
	ResolveAsGone bool
}

func NewFiveSimService(
	cfg *config.Config,
	userRepo *repository.UserRepo,
	orderRepo *repository.FiveSimOrderRepo,
	walletRepo *repository.WalletRepo,
	client FiveSimClient,
) *FiveSimService {
	if client == nil {
		client = NewFiveSimClient(cfg)
	}
	return &FiveSimService{
		cfg:                  cfg,
		userRepo:             userRepo,
		orderRepo:            orderRepo,
		walletRepo:           walletRepo,
		client:               client,
		operatorNoStockUntil: map[string]time.Time{},
	}
}

func (s *FiveSimService) GetCatalogCountries(ctx context.Context, userID uuid.UUID) (map[string]any, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, err
	}
	res, err := s.client.GetCountries(ctx)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) GetCatalogProducts(ctx context.Context, userID uuid.UUID, country, operator string) (map[string]any, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, err
	}
	res, err := s.client.GetProducts(ctx, country, operator)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) GetCatalogPrices(ctx context.Context, userID uuid.UUID, country, product string) (*FiveSimCatalogPricesResponse, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, err
	}

	raw, err := s.client.GetPrices(ctx, country, product)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}

	response := &FiveSimCatalogPricesResponse{
		Country:  normalizeFiveSimCatalogKey(country, "any"),
		Product:  normalizeFiveSimCatalogKey(product, ""),
		Currency: "IDR",
		Prices:   s.sanitizeCatalogPrices(raw, country, product),
	}

	return response, nil
}

func (s *FiveSimService) BuyActivation(ctx context.Context, userID uuid.UUID, input FiveSimBuyActivationInput) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, nil, err
	}

	if strings.TrimSpace(input.Product) == "" {
		return nil, nil, errors.New("product wajib diisi")
	}
	if input.MaxPrice != nil && *input.MaxPrice <= 0 {
		return nil, nil, errors.New("max_price harus lebih dari 0")
	}

	if err := s.ensureActivationOperatorBuyable(ctx, input.Country, input.Product, input.Operator); err != nil {
		return nil, nil, err
	}

	requestHash := buildFiveSimBuyRequestHash(
		"activation",
		normalizeFiveSimCatalogKey(input.Country, "any"),
		normalizeFiveSimCatalogKey(input.Operator, "any"),
		normalizeFiveSimCatalogKey(input.Product, ""),
		normalizeFiveSimBoolPtr(input.Forwarding),
		strings.TrimSpace(input.Number),
		strconv.FormatBool(input.Reuse),
		strconv.FormatBool(input.Voice),
		strings.TrimSpace(input.Ref),
		normalizeFiveSimMaxPrice(input.MaxPrice),
	)

	return s.buyWithIdempotency(ctx, userID, "activation", input.IdempotencyKey, requestHash, func(runCtx context.Context) (*FiveSimOrderPayload, error) {
		providerOrder, err := s.client.BuyActivation(runCtx, input.Country, input.Operator, input.Product, FiveSimBuyActivationOptions{
			Forwarding: input.Forwarding,
			Number:     input.Number,
			Reuse:      input.Reuse,
			Voice:      input.Voice,
			Ref:        input.Ref,
			MaxPrice:   input.MaxPrice,
		})
		if err != nil {
			if isFiveSimNoFreePhonesError(err) {
				s.markOperatorNoStock(input.Country, input.Product, input.Operator)
			}
			return nil, err
		}
		return providerOrder, nil
	})
}

func (s *FiveSimService) BuyHosting(ctx context.Context, userID uuid.UUID, input FiveSimBuyHostingInput) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, nil, err
	}

	if strings.TrimSpace(input.Product) == "" {
		return nil, nil, errors.New("product wajib diisi")
	}

	requestHash := buildFiveSimBuyRequestHash(
		"hosting",
		normalizeFiveSimCatalogKey(input.Country, "any"),
		normalizeFiveSimCatalogKey(input.Operator, "any"),
		normalizeFiveSimCatalogKey(input.Product, ""),
	)

	return s.buyWithIdempotency(ctx, userID, "hosting", input.IdempotencyKey, requestHash, func(runCtx context.Context) (*FiveSimOrderPayload, error) {
		return s.client.BuyHosting(runCtx, input.Country, input.Operator, input.Product)
	})
}

func (s *FiveSimService) ReuseNumber(ctx context.Context, userID uuid.UUID, input FiveSimReuseInput) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, nil, err
	}

	if strings.TrimSpace(input.Product) == "" {
		return nil, nil, errors.New("product wajib diisi")
	}
	if strings.TrimSpace(input.Number) == "" {
		return nil, nil, errors.New("number wajib diisi")
	}

	requestHash := buildFiveSimBuyRequestHash(
		"reuse",
		normalizeFiveSimCatalogKey(input.Product, ""),
		strings.TrimSpace(input.Number),
	)

	return s.buyWithIdempotency(ctx, userID, "reuse", input.IdempotencyKey, requestHash, func(runCtx context.Context) (*FiveSimOrderPayload, error) {
		return s.client.ReuseNumber(runCtx, input.Product, input.Number)
	})
}

func (s *FiveSimService) ensureActivationOperatorBuyable(ctx context.Context, country, product, operator string) error {
	normalizedOperator := normalizeFiveSimCatalogKey(operator, "any")
	if normalizedOperator == "any" {
		return nil
	}

	if s.isOperatorTemporarilyBlocked(country, product, normalizedOperator) {
		return errors.New("stok nomor operator ini sedang habis, pilih operator lain")
	}

	rawPrices, err := s.client.GetPrices(ctx, country, product)
	if err != nil {
		return errors.New("gagal validasi stok operator, coba lagi sebentar")
	}

	eligibleRows := s.sanitizeCatalogPrices(rawPrices, country, product)
	for _, row := range eligibleRows {
		if strings.EqualFold(strings.TrimSpace(row.Operator), normalizedOperator) {
			return nil
		}
	}

	return errors.New("stok nomor operator ini sedang habis, pilih operator lain")
}

func buildFiveSimAvailabilityKey(country, product, operator string) string {
	normalizedOperator := normalizeFiveSimCatalogKey(operator, "any")
	if normalizedOperator == "" || normalizedOperator == "any" {
		return ""
	}
	return strings.Join([]string{
		normalizeFiveSimCatalogKey(country, "any"),
		normalizeFiveSimCatalogKey(product, ""),
		normalizedOperator,
	}, "|")
}

func (s *FiveSimService) markOperatorNoStock(country, product, operator string) {
	key := buildFiveSimAvailabilityKey(country, product, operator)
	if key == "" {
		return
	}

	s.operatorNoStockMu.Lock()
	defer s.operatorNoStockMu.Unlock()

	if s.operatorNoStockUntil == nil {
		s.operatorNoStockUntil = map[string]time.Time{}
	}
	s.operatorNoStockUntil[key] = time.Now().Add(fiveSimOperatorNoStockCooldown)
}

func (s *FiveSimService) isOperatorTemporarilyBlocked(country, product, operator string) bool {
	key := buildFiveSimAvailabilityKey(country, product, operator)
	if key == "" {
		return false
	}

	now := time.Now()
	s.operatorNoStockMu.Lock()
	defer s.operatorNoStockMu.Unlock()

	until, ok := s.operatorNoStockUntil[key]
	if !ok {
		return false
	}
	if now.After(until) {
		delete(s.operatorNoStockUntil, key)
		return false
	}
	return true
}

func isFiveSimNoFreePhonesError(err error) bool {
	if err == nil {
		return false
	}
	var apiErr *FiveSimAPIError
	if errors.As(err, &apiErr) {
		return strings.Contains(strings.ToLower(strings.TrimSpace(apiErr.Message)), "no free phones")
	}
	return strings.Contains(strings.ToLower(err.Error()), "no free phones")
}

func (s *FiveSimService) buyWithIdempotency(
	ctx context.Context,
	userID uuid.UUID,
	orderType string,
	rawIdempotencyKey string,
	requestHash string,
	providerFn func(runCtx context.Context) (*FiveSimOrderPayload, error),
) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	idempotencyKey, err := normalizeFiveSimIdempotencyKey(rawIdempotencyKey)
	if err != nil {
		return nil, nil, err
	}

	idemRow, replayOrder, replayProviderOrder, err := s.acquireBuyIdempotency(userID, orderType, idempotencyKey, requestHash)
	if err != nil {
		return nil, nil, err
	}
	if replayOrder != nil {
		return replayOrder, replayProviderOrder, nil
	}

	providerOrder, err := providerFn(ctx)
	if err != nil {
		normalizedErr := s.normalizeProviderErr(err)
		_ = s.markBuyIdempotencyFailed(idemRow, 0, normalizedErr.Error())
		return nil, nil, normalizedErr
	}

	localOrder, finalizeErr := s.finalizePurchasedOrder(ctx, userID, orderType, providerOrder)
	if finalizeErr != nil {
		providerOrderID := int64(0)
		if providerOrder != nil {
			providerOrderID = providerOrder.ID
		}
		_ = s.markBuyIdempotencyFailed(idemRow, providerOrderID, finalizeErr.Error())
		return nil, nil, finalizeErr
	}

	if err := s.markBuyIdempotencyCompleted(idemRow, localOrder.ProviderOrderID); err != nil {
		return nil, nil, errors.New("order 5sim berhasil dibuat, tapi pencatatan idempotency gagal, hubungi admin")
	}

	return localOrder, providerOrder, nil
}

func (s *FiveSimService) acquireBuyIdempotency(
	userID uuid.UUID,
	orderType string,
	idempotencyKey string,
	requestHash string,
) (*model.FiveSimOrderIdempotency, *model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if s.orderRepo == nil {
		return nil, nil, nil, errors.New("konfigurasi order 5sim belum siap")
	}
	if strings.TrimSpace(requestHash) == "" {
		return nil, nil, nil, errors.New("request hash 5sim tidak valid")
	}

	var (
		idemRow       *model.FiveSimOrderIdempotency
		replayOrder   *model.FiveSimOrder
		replayPayload *FiveSimOrderPayload
	)

	err := s.orderRepo.Transaction(func(tx *gorm.DB) error {
		existing, findErr := s.orderRepo.FindIdempotencyByKeyForUpdateTx(tx, userID, orderType, idempotencyKey)
		if findErr != nil {
			if !errors.Is(findErr, gorm.ErrRecordNotFound) {
				return errors.New("gagal cek idempotency order 5sim")
			}

			newRow := &model.FiveSimOrderIdempotency{
				UserID:          userID,
				OrderType:       orderType,
				IdempotencyKey:  idempotencyKey,
				RequestHash:     requestHash,
				Status:          fiveSimIdemStatusProcessing,
				ProviderOrderID: 0,
			}
			if createErr := s.orderRepo.CreateIdempotencyTx(tx, newRow); createErr != nil {
				return errors.New("gagal menyimpan idempotency order 5sim")
			}
			idemRow = newRow
			return nil
		}

		if strings.TrimSpace(existing.RequestHash) != strings.TrimSpace(requestHash) {
			return errors.New("idempotency_key sudah dipakai untuk request berbeda")
		}

		switch strings.ToLower(strings.TrimSpace(existing.Status)) {
		case fiveSimIdemStatusCompleted:
			if existing.ProviderOrderID <= 0 {
				return errors.New("idempotency order 5sim tidak konsisten, hubungi admin")
			}

			order, orderErr := s.orderRepo.FindByProviderOrderIDAndUser(existing.ProviderOrderID, userID)
			if orderErr != nil {
				if errors.Is(orderErr, gorm.ErrRecordNotFound) {
					return errors.New("order idempotency 5sim tidak ditemukan, hubungi admin")
				}
				return errors.New("gagal memuat order idempotency 5sim")
			}
			replayOrder = order
			replayPayload = buildFiveSimProviderPayloadFromLocalOrder(order)
			idemRow = existing
			return nil
		case fiveSimIdemStatusProcessing:
			return errors.New("request pembelian 5sim sedang diproses, coba lagi sebentar")
		case fiveSimIdemStatusFailed:
			existing.Status = fiveSimIdemStatusProcessing
			existing.ErrorMessage = ""
			existing.ProviderOrderID = 0
			if saveErr := s.orderRepo.SaveIdempotencyTx(tx, existing); saveErr != nil {
				return errors.New("gagal reset idempotency order 5sim")
			}
			idemRow = existing
			return nil
		default:
			return errors.New("status idempotency order 5sim tidak dikenal")
		}
	})
	if err != nil {
		return nil, nil, nil, err
	}

	return idemRow, replayOrder, replayPayload, nil
}

func (s *FiveSimService) markBuyIdempotencyCompleted(row *model.FiveSimOrderIdempotency, providerOrderID int64) error {
	if row == nil {
		return nil
	}
	row.Status = fiveSimIdemStatusCompleted
	row.ProviderOrderID = providerOrderID
	row.ErrorMessage = ""
	return s.orderRepo.SaveIdempotency(row)
}

func (s *FiveSimService) markBuyIdempotencyFailed(row *model.FiveSimOrderIdempotency, providerOrderID int64, reason string) error {
	if row == nil {
		return nil
	}
	row.Status = fiveSimIdemStatusFailed
	row.ProviderOrderID = providerOrderID
	row.ErrorMessage = truncateFiveSimErrorMessage(reason, 255)
	return s.orderRepo.SaveIdempotency(row)
}

func normalizeFiveSimIdempotencyKey(raw string) (string, error) {
	normalized := strings.TrimSpace(raw)
	if normalized == "" {
		return "", errors.New("idempotency_key wajib diisi")
	}
	if len(normalized) > fiveSimIdemKeyMaxLen {
		return "", fmt.Errorf("idempotency_key maksimal %d karakter", fiveSimIdemKeyMaxLen)
	}
	return normalized, nil
}

func buildFiveSimBuyRequestHash(parts ...string) string {
	normalizedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		normalizedParts = append(normalizedParts, strings.TrimSpace(part))
	}
	raw := strings.Join(normalizedParts, "|")
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func normalizeFiveSimBoolPtr(value *bool) string {
	if value == nil {
		return "null"
	}
	return strconv.FormatBool(*value)
}

func normalizeFiveSimMaxPrice(value *float64) string {
	if value == nil {
		return "null"
	}
	return strconv.FormatFloat(*value, 'f', 6, 64)
}

func buildFiveSimProviderPayloadFromLocalOrder(row *model.FiveSimOrder) *FiveSimOrderPayload {
	if row == nil {
		return nil
	}

	if trimmed := strings.TrimSpace(row.RawPayload); trimmed != "" {
		var payload FiveSimOrderPayload
		if err := json.Unmarshal([]byte(trimmed), &payload); err == nil {
			if payload.ID <= 0 {
				payload.ID = row.ProviderOrderID
			}
			if strings.TrimSpace(payload.Status) == "" {
				payload.Status = row.ProviderStatus
			}
			if strings.TrimSpace(payload.Country) == "" {
				payload.Country = row.Country
			}
			if strings.TrimSpace(payload.Operator) == "" {
				payload.Operator = row.Operator
			}
			if strings.TrimSpace(payload.Product) == "" {
				payload.Product = row.Product
			}
			if strings.TrimSpace(payload.Phone) == "" {
				payload.Phone = row.Phone
			}
			if payload.Price <= 0 {
				payload.Price = row.ProviderPrice
			}
			return &payload
		}
	}

	return &FiveSimOrderPayload{
		ID:       row.ProviderOrderID,
		Phone:    row.Phone,
		Operator: row.Operator,
		Product:  row.Product,
		Price:    row.ProviderPrice,
		Status:   row.ProviderStatus,
		Country:  row.Country,
	}
}

func truncateFiveSimErrorMessage(input string, maxLen int) string {
	trimmed := strings.TrimSpace(input)
	if maxLen <= 0 || len(trimmed) <= maxLen {
		return trimmed
	}
	return trimmed[:maxLen]
}

func (s *FiveSimService) finalizePurchasedOrder(ctx context.Context, userID uuid.UUID, orderType string, providerOrder *FiveSimOrderPayload) (*model.FiveSimOrder, error) {
	if providerOrder == nil || providerOrder.ID <= 0 {
		return nil, errors.New("response order 5sim tidak valid")
	}

	localOrder, err := s.upsertOwnedOrder(userID, orderType, providerOrder)
	if err != nil {
		if cancelErr := s.cancelProviderOrder(ctx, providerOrder.ID); cancelErr != nil {
			return nil, errors.New("gagal menyimpan order 5sim dan gagal rollback order provider, hubungi admin")
		}
		return nil, err
	}

	if _, err := s.debitWalletForOrder(userID, orderType, providerOrder); err != nil {
		if cancelErr := s.cancelProviderOrderAndSyncLocal(ctx, localOrder, providerOrder.ID); cancelErr != nil {
			return nil, fmt.Errorf("%s; order provider gagal dibatalkan otomatis, order diblokir sampai billing clear, hubungi admin", err.Error())
		}
		return nil, err
	}

	if _, err := s.settleWalletAfterSync(localOrder, providerOrder, "post-purchase-initial-sync"); err != nil {
		return nil, fmt.Errorf("order 5sim dibuat, tapi settlement wallet gagal: %w", err)
	}

	return localOrder, nil
}

func (s *FiveSimService) cancelProviderOrder(ctx context.Context, providerOrderID int64) error {
	if providerOrderID <= 0 {
		return errors.New("provider_order_id tidak valid")
	}
	_, err := s.client.CancelOrder(ctx, providerOrderID)
	if err != nil {
		return s.normalizeProviderErr(err)
	}
	return nil
}

func (s *FiveSimService) cancelProviderOrderAndSyncLocal(ctx context.Context, localOrder *model.FiveSimOrder, providerOrderID int64) error {
	if providerOrderID <= 0 {
		return errors.New("provider_order_id tidak valid")
	}

	providerOrder, err := s.client.CancelOrder(ctx, providerOrderID)
	if err != nil {
		if localOrder != nil {
			if latestOrder, checkErr := s.client.CheckOrder(ctx, providerOrderID); checkErr == nil {
				if applyErr := s.applySnapshot(localOrder, latestOrder, localOrder.OrderType, "check"); applyErr == nil {
					_ = s.orderRepo.Update(localOrder)
				}
			}
		}
		return s.normalizeProviderErr(err)
	}

	if localOrder != nil {
		if applyErr := s.applySnapshot(localOrder, providerOrder, localOrder.OrderType, "cancel"); applyErr != nil {
			return applyErr
		}
		if updateErr := s.orderRepo.Update(localOrder); updateErr != nil {
			return errors.New("order 5sim berhasil dibatalkan, tapi gagal simpan status lokal")
		}
	}

	return nil
}

func (s *FiveSimService) ensureOrderBilled(providerOrderID int64) error {
	if s.walletRepo == nil {
		return errors.New("konfigurasi wallet belum siap")
	}
	if providerOrderID <= 0 {
		return errors.New("provider_order_id tidak valid")
	}

	reference := fmt.Sprintf("fivesim_order:%d:charge", providerOrderID)
	if _, err := s.walletRepo.FindLedgerByReference(reference); err == nil {
		return nil
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		return errors.New("order belum berhasil didebit, silakan cancel order atau hubungi admin")
	} else {
		return errors.New("gagal validasi billing order 5sim")
	}
}

func (s *FiveSimService) debitWalletForOrder(userID uuid.UUID, orderType string, providerOrder *FiveSimOrderPayload) (int64, error) {
	if s.walletRepo == nil {
		return 0, errors.New("konfigurasi wallet belum siap")
	}
	if providerOrder == nil || providerOrder.ID <= 0 {
		return 0, errors.New("response order 5sim tidak valid")
	}

	chargeAmount, multiplier, err := s.calculateWalletDebit(providerOrder.Price)
	if err != nil {
		return 0, err
	}

	reference := fmt.Sprintf("fivesim_order:%d:charge", providerOrder.ID)
	description := fmt.Sprintf(
		"Pembelian 5sim %s (%s/%s/%s), provider_price=%.6f, multiplier=%.6f",
		orderType,
		providerOrder.Country,
		providerOrder.Operator,
		providerOrder.Product,
		providerOrder.Price,
		multiplier,
	)

	err = s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, reference); err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("gagal cek ledger wallet")
		}

		user, err := s.walletRepo.LockUserByIDTx(tx, userID)
		if err != nil {
			return errors.New("user tidak ditemukan")
		}
		if !user.IsActive {
			return errors.New("akun diblokir")
		}

		before := user.WalletBalance
		if before < chargeAmount {
			return errFiveSimWalletInsufficient
		}
		after := before - chargeAmount

		user.WalletBalance = after
		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return errors.New("gagal update saldo wallet")
		}

		ledger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "debit",
			Category:      "5sim_purchase",
			Amount:        chargeAmount,
			BalanceBefore: before,
			BalanceAfter:  after,
			Reference:     reference,
			Description:   description,
		}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger wallet")
		}

		return nil
	})
	if err != nil {
		if errors.Is(err, errFiveSimWalletInsufficient) {
			return chargeAmount, errFiveSimWalletInsufficient
		}
		return chargeAmount, err
	}

	return chargeAmount, nil
}

func (s *FiveSimService) calculateWalletDebit(providerPrice float64) (int64, float64, error) {
	if providerPrice <= 0 {
		return 0, 0, errors.New("harga provider 5sim tidak valid")
	}

	multiplier := 1.0
	if s.cfg != nil {
		if v := strings.TrimSpace(s.cfg.FiveSimWalletPriceMultiplier); v != "" {
			if parsed, err := strconv.ParseFloat(v, 64); err == nil && parsed > 0 {
				multiplier = parsed
			}
		}
	}

	minDebit := int64(1)
	if s.cfg != nil {
		if v := strings.TrimSpace(s.cfg.FiveSimWalletMinDebit); v != "" {
			if parsed, err := strconv.ParseInt(v, 10, 64); err == nil && parsed > 0 {
				minDebit = parsed
			}
		}
	}

	rawDebit := providerPrice * multiplier
	if math.IsNaN(rawDebit) || math.IsInf(rawDebit, 0) || rawDebit <= 0 {
		return 0, 0, errors.New("gagal hitung debit wallet 5sim")
	}

	amount := int64(math.Ceil(rawDebit))
	if amount < minDebit {
		amount = minDebit
	}
	if amount <= 0 {
		return 0, 0, errors.New("debit wallet 5sim tidak valid")
	}

	return amount, multiplier, nil
}

func normalizeFiveSimCatalogKey(value, fallback string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return fallback
	}
	return normalized
}

func asFiveSimMap(value any) (map[string]any, bool) {
	mapped, ok := value.(map[string]any)
	if !ok {
		return nil, false
	}
	return mapped, true
}

func parseFiveSimFloat(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) {
			return 0, false
		}
		return typed, true
	case float32:
		parsed := float64(typed)
		if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
			return 0, false
		}
		return parsed, true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case int16:
		return float64(typed), true
	case int8:
		return float64(typed), true
	case uint:
		return float64(typed), true
	case uint64:
		return float64(typed), true
	case uint32:
		return float64(typed), true
	case uint16:
		return float64(typed), true
	case uint8:
		return float64(typed), true
	case json.Number:
		if parsed, err := typed.Float64(); err == nil {
			if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
				return 0, false
			}
			return parsed, true
		}
	case string:
		raw := strings.TrimSpace(strings.ReplaceAll(typed, ",", "."))
		if raw == "" {
			return 0, false
		}
		if parsed, err := strconv.ParseFloat(raw, 64); err == nil {
			if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
				return 0, false
			}
			return parsed, true
		}
	}
	return 0, false
}

func parseFiveSimInt64(value any) (int64, bool) {
	switch typed := value.(type) {
	case int:
		return int64(typed), true
	case int64:
		return typed, true
	case int32:
		return int64(typed), true
	case int16:
		return int64(typed), true
	case int8:
		return int64(typed), true
	case uint:
		return int64(typed), true
	case uint64:
		if typed > math.MaxInt64 {
			return 0, false
		}
		return int64(typed), true
	case uint32:
		return int64(typed), true
	case uint16:
		return int64(typed), true
	case uint8:
		return int64(typed), true
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) {
			return 0, false
		}
		return int64(typed), true
	case json.Number:
		if parsed, err := typed.Int64(); err == nil {
			return parsed, true
		}
		if parsed, err := typed.Float64(); err == nil {
			if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
				return 0, false
			}
			return int64(parsed), true
		}
	case string:
		raw := strings.TrimSpace(typed)
		if raw == "" {
			return 0, false
		}
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil {
			return parsed, true
		}
		if parsed, err := strconv.ParseFloat(strings.ReplaceAll(raw, ",", "."), 64); err == nil {
			if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
				return 0, false
			}
			return int64(parsed), true
		}
	}
	return 0, false
}

func findFiveSimMapByKey(source map[string]any, key string) map[string]any {
	normalized := normalizeFiveSimCatalogKey(key, "")
	if normalized == "" {
		return nil
	}

	if value, ok := source[normalized]; ok {
		if mapped, ok := asFiveSimMap(value); ok {
			return mapped
		}
	}

	for rawKey, value := range source {
		if !strings.EqualFold(strings.TrimSpace(rawKey), normalized) {
			continue
		}
		if mapped, ok := asFiveSimMap(value); ok {
			return mapped
		}
	}

	return nil
}

func extractFiveSimProviderPrice(node any) (float64, bool) {
	if direct, ok := parseFiveSimFloat(node); ok {
		if direct > 0 {
			return direct, true
		}
	}

	rec, ok := asFiveSimMap(node)
	if !ok {
		return 0, false
	}

	for _, key := range []string{"cost", "price", "rate", "amount", "Cost", "Price"} {
		if parsed, ok := parseFiveSimFloat(rec[key]); ok {
			if parsed > 0 {
				return parsed, true
			}
		}
	}

	return 0, false
}

func (s *FiveSimService) extractCatalogPriceRow(operator string, node any) (*FiveSimCatalogPriceRow, bool) {
	cleanOperator := strings.TrimSpace(operator)
	if cleanOperator == "" {
		return nil, false
	}

	providerPrice, ok := extractFiveSimProviderPrice(node)
	if !ok {
		return nil, false
	}

	walletDebit, _, err := s.calculateWalletDebit(providerPrice)
	if err != nil || walletDebit <= 0 {
		return nil, false
	}

	row := &FiveSimCatalogPriceRow{
		Operator:           cleanOperator,
		WalletDebit:        walletDebit,
		BuyEnabled:         false,
		AvailabilityStatus: fiveSimAvailabilityUnknown,
		AvailabilityReason: fiveSimAvailabilityReasonCountMissing,
	}

	if rec, ok := asFiveSimMap(node); ok {
		if parsedCount, ok := parseFiveSimInt64(rec["count"]); ok && parsedCount >= 0 {
			count := parsedCount
			row.NumberCount = &count
			if count > 0 {
				row.BuyEnabled = true
				row.AvailabilityStatus = fiveSimAvailabilityAvailable
				row.AvailabilityReason = ""
			} else {
				row.BuyEnabled = false
				row.AvailabilityStatus = fiveSimAvailabilityOutOfStock
				row.AvailabilityReason = fiveSimAvailabilityReasonCountZero
			}
		}
	}

	return row, true
}

func (s *FiveSimService) collectCatalogPriceRows(source map[string]any) []FiveSimCatalogPriceRow {
	rowsByOperator := make(map[string]FiveSimCatalogPriceRow)

	upsert := func(row FiveSimCatalogPriceRow) {
		normalized := strings.ToLower(strings.TrimSpace(row.Operator))
		if normalized == "" {
			return
		}

		existing, exists := rowsByOperator[normalized]
		if !exists {
			rowsByOperator[normalized] = row
			return
		}

		if row.BuyEnabled != existing.BuyEnabled {
			if row.BuyEnabled {
				rowsByOperator[normalized] = row
			}
			return
		}

		if row.WalletDebit < existing.WalletDebit {
			rowsByOperator[normalized] = row
			return
		}

		if existing.NumberCount == nil && row.NumberCount != nil {
			existing.NumberCount = row.NumberCount
			rowsByOperator[normalized] = existing
		}
	}

	for key, value := range source {
		if row, ok := s.extractCatalogPriceRow(key, value); ok {
			upsert(*row)
			continue
		}

		nested, ok := asFiveSimMap(value)
		if !ok {
			continue
		}

		for nestedKey, nestedValue := range nested {
			if row, ok := s.extractCatalogPriceRow(nestedKey, nestedValue); ok {
				upsert(*row)
			}
		}
	}

	rows := make([]FiveSimCatalogPriceRow, 0, len(rowsByOperator))
	for _, row := range rowsByOperator {
		rows = append(rows, row)
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].WalletDebit == rows[j].WalletDebit {
			return rows[i].Operator < rows[j].Operator
		}
		return rows[i].WalletDebit < rows[j].WalletDebit
	})

	return rows
}

func (s *FiveSimService) applyCatalogAvailabilityGate(country, product string, rows []FiveSimCatalogPriceRow) []FiveSimCatalogPriceRow {
	if len(rows) == 0 {
		return rows
	}

	eligible := make([]FiveSimCatalogPriceRow, 0, len(rows))
	for _, row := range rows {
		if row.BuyEnabled && s.isOperatorTemporarilyBlocked(country, product, row.Operator) {
			row.BuyEnabled = false
			row.AvailabilityStatus = fiveSimAvailabilityOutOfStock
			row.AvailabilityReason = fiveSimAvailabilityReasonRecentlyNoFree
		}

		if row.BuyEnabled {
			eligible = append(eligible, row)
		}
	}

	return eligible
}

func (s *FiveSimService) sanitizeCatalogPrices(raw map[string]any, country, product string) []FiveSimCatalogPriceRow {
	if len(raw) == 0 {
		return []FiveSimCatalogPriceRow{}
	}

	candidates := make([]map[string]any, 0, 4)

	if countryNode := findFiveSimMapByKey(raw, country); countryNode != nil {
		if productNode := findFiveSimMapByKey(countryNode, product); productNode != nil {
			candidates = append(candidates, productNode)
		}
		candidates = append(candidates, countryNode)
	}

	if productNode := findFiveSimMapByKey(raw, product); productNode != nil {
		candidates = append(candidates, productNode)
	}

	candidates = append(candidates, raw)

	for _, candidate := range candidates {
		if candidate == nil {
			continue
		}
		rows := s.collectCatalogPriceRows(candidate)
		rows = s.applyCatalogAvailabilityGate(country, product, rows)
		if len(rows) > 0 {
			return rows
		}
	}

	return []FiveSimCatalogPriceRow{}
}

func (s *FiveSimService) CheckOrder(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	return s.runOrderAction(ctx, userID, providerOrderID, "check", s.client.CheckOrder)
}

func (s *FiveSimService) FinishOrder(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	return s.runOrderAction(ctx, userID, providerOrderID, "finish", s.client.FinishOrder)
}

func (s *FiveSimService) CancelOrder(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	return s.runOrderAction(ctx, userID, providerOrderID, "cancel", s.client.CancelOrder)
}

func (s *FiveSimService) BanOrder(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	return s.runOrderAction(ctx, userID, providerOrderID, "ban", s.client.BanOrder)
}

func (s *FiveSimService) GetSMSInbox(ctx context.Context, userID uuid.UUID, providerOrderID int64) (map[string]any, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, err
	}

	localOrder, err := s.orderRepo.FindByProviderOrderIDAndUser(providerOrderID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order 5sim tidak ditemukan")
		}
		return nil, errors.New("gagal memuat order 5sim")
	}

	if err := s.ensureOrderBilled(localOrder.ProviderOrderID); err != nil {
		return nil, err
	}

	inbox, err := s.client.GetSMSInbox(ctx, providerOrderID)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}

	now := time.Now()
	localOrder.LastSyncedAt = &now
	_ = s.orderRepo.Update(localOrder)

	return inbox, nil
}

func (s *FiveSimService) ListLocalOrders(userID uuid.UUID, page, limit int) ([]model.FiveSimOrder, int64, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, 0, err
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

	rows, total, err := s.orderRepo.ListByUser(userID, page, limit)
	if err != nil {
		return nil, 0, errors.New("gagal memuat daftar order 5sim")
	}
	return rows, total, nil
}

func (s *FiveSimService) ReconcileOpenOrders(ctx context.Context, input FiveSimReconcileInput) (*FiveSimReconcileResult, error) {
	if input.Limit <= 0 {
		input.Limit = 200
	}
	if input.Limit > 1000 {
		input.Limit = 1000
	}
	if input.MinSyncAge <= 0 {
		input.MinSyncAge = 45 * time.Second
	}
	if input.MaxWaiting <= 0 {
		input.MaxWaiting = 15 * time.Minute
	}

	notFoundThreshold := s.parseResolveNotFoundThreshold(3)
	notFoundMinAge := s.parseResolveNotFoundMinAge(3 * time.Minute)

	syncedBefore := time.Now().Add(-input.MinSyncAge)
	rows, err := s.orderRepo.ListOpenForReconcile([]string{fiveSimStatusPending, fiveSimStatusReceived}, syncedBefore, input.Limit)
	if err != nil {
		return nil, errors.New("gagal memuat antrian order 5sim")
	}

	result := &FiveSimReconcileResult{}
	for i := range rows {
		if err := ctx.Err(); err != nil {
			break
		}

		row := &rows[i]
		result.Checked++

		providerOrder, err := s.client.CheckOrder(ctx, row.ProviderOrderID)
		if err != nil {
			errInfo := classifyFiveSimSyncError(err)
			s.markSyncFailed(row, errInfo, input.MinSyncAge)

			if s.shouldResolveSyntheticOnMissingProviderOrder(row, errInfo, notFoundThreshold, notFoundMinAge) {
				s.resolveSyntheticTerminal(row, errInfo)
				if updateErr := s.orderRepo.Update(row); updateErr != nil {
					result.Failed++
					continue
				}
				result.Synced++
				result.SyntheticResolved++

				refunded, settleErr := s.settleWalletAfterSync(row, nil, "auto-reconcile-missing-order")
				if settleErr != nil {
					result.Failed++
					continue
				}
				if refunded {
					result.Refunded++
				}
				continue
			}

			if updateErr := s.orderRepo.Update(row); updateErr != nil {
				result.Failed++
				continue
			}
			result.Failed++
			continue
		}

		if err := s.applySnapshot(row, providerOrder, row.OrderType, "worker-check"); err != nil {
			result.Failed++
			continue
		}

		if s.shouldAutoCancelByWaitingWindow(row, providerOrder, input.MaxWaiting) {
			cancelledOrder, cancelErr := s.client.CancelOrder(ctx, row.ProviderOrderID)
			if cancelErr == nil {
				providerOrder = cancelledOrder
				result.AutoCanceled++
				if err := s.applySnapshot(row, providerOrder, row.OrderType, "worker-cancel"); err != nil {
					result.Failed++
					continue
				}
			} else if latest, checkErr := s.client.CheckOrder(ctx, row.ProviderOrderID); checkErr == nil {
				providerOrder = latest
				if err := s.applySnapshot(row, providerOrder, row.OrderType, "worker-check-after-cancel"); err != nil {
					result.Failed++
					continue
				}
			} else {
				errInfo := classifyFiveSimSyncError(cancelErr)
				s.markSyncFailed(row, errInfo, input.MinSyncAge)
			}
		}

		if err := s.orderRepo.Update(row); err != nil {
			result.Failed++
			continue
		}
		result.Synced++

		refunded, settleErr := s.settleWalletAfterSync(row, providerOrder, "auto-reconcile")
		if settleErr != nil {
			result.Failed++
			continue
		}
		if refunded {
			result.Refunded++
		}
	}

	return result, nil
}

func (s *FiveSimService) GetProviderProfile(ctx context.Context) (map[string]any, error) {
	res, err := s.client.GetProfile(ctx)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) GetProviderOrderHistory(ctx context.Context, input FiveSimProviderHistoryInput) (map[string]any, error) {
	if input.Limit <= 0 {
		input.Limit = 20
	}
	if input.Limit > 100 {
		input.Limit = 100
	}
	if input.Offset < 0 {
		input.Offset = 0
	}
	if strings.TrimSpace(input.Order) == "" {
		input.Order = "id"
	}
	if strings.TrimSpace(input.Category) == "" {
		input.Category = "activation"
	}

	res, err := s.client.GetProviderOrderHistory(ctx, input.Category, input.Limit, input.Offset, input.Order, input.Reverse)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) runOrderAction(
	ctx context.Context,
	userID uuid.UUID,
	providerOrderID int64,
	action string,
	providerFn func(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error),
) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, nil, err
	}
	if providerOrderID <= 0 {
		return nil, nil, errors.New("provider_order_id tidak valid")
	}

	localOrder, err := s.orderRepo.FindByProviderOrderIDAndUser(providerOrderID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("order 5sim tidak ditemukan")
		}
		return nil, nil, errors.New("gagal memuat order 5sim")
	}

	if action != "cancel" {
		if err := s.ensureOrderBilled(localOrder.ProviderOrderID); err != nil {
			return nil, nil, err
		}
	}

	providerOrder, err := providerFn(ctx, providerOrderID)
	if err != nil {
		if action == "check" {
			errInfo := classifyFiveSimSyncError(err)
			s.markSyncFailed(localOrder, errInfo, 30*time.Second)
			if s.shouldResolveSyntheticOnMissingProviderOrder(localOrder, errInfo, s.parseResolveNotFoundThreshold(3), s.parseResolveNotFoundMinAge(3*time.Minute)) {
				s.resolveSyntheticTerminal(localOrder, errInfo)
				if updateErr := s.orderRepo.Update(localOrder); updateErr == nil {
					if _, settleErr := s.settleWalletAfterSync(localOrder, nil, "manual-check-missing-order"); settleErr == nil {
						return localOrder, nil, nil
					}
				}
			} else {
				_ = s.orderRepo.Update(localOrder)
			}
		}
		return nil, nil, s.normalizeProviderErr(err)
	}

	if err := s.applySnapshot(localOrder, providerOrder, "", action); err != nil {
		return nil, nil, err
	}
	if err := s.orderRepo.Update(localOrder); err != nil {
		return nil, nil, errors.New("gagal update order 5sim")
	}

	if _, err := s.settleWalletAfterSync(localOrder, providerOrder, "manual-"+action); err != nil {
		return nil, nil, fmt.Errorf("status order 5sim berhasil diupdate, tapi settlement wallet gagal: %w", err)
	}

	return localOrder, providerOrder, nil
}

func (s *FiveSimService) upsertOwnedOrder(userID uuid.UUID, orderType string, providerOrder *FiveSimOrderPayload) (*model.FiveSimOrder, error) {
	if providerOrder == nil || providerOrder.ID <= 0 {
		return nil, errors.New("response order 5sim tidak valid")
	}

	row, err := s.orderRepo.FindByProviderOrderID(providerOrder.ID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("gagal memuat order 5sim")
		}
		row = &model.FiveSimOrder{
			UserID:          userID,
			ProviderOrderID: providerOrder.ID,
			OrderType:       orderType,
		}
		if err := s.applySnapshot(row, providerOrder, orderType, "create"); err != nil {
			return nil, err
		}
		if err := s.orderRepo.Create(row); err != nil {
			return nil, errors.New("gagal menyimpan order 5sim")
		}
		return row, nil
	}

	if row.UserID != userID {
		return nil, errors.New("order 5sim milik user lain")
	}
	if err := s.applySnapshot(row, providerOrder, orderType, "sync"); err != nil {
		return nil, err
	}
	if err := s.orderRepo.Update(row); err != nil {
		return nil, errors.New("gagal update order 5sim")
	}
	return row, nil
}

func (s *FiveSimService) applySnapshot(row *model.FiveSimOrder, providerOrder *FiveSimOrderPayload, fallbackType, _ string) error {
	if row == nil || providerOrder == nil {
		return errors.New("snapshot order tidak valid")
	}

	if row.ProviderOrderID == 0 {
		row.ProviderOrderID = providerOrder.ID
	}
	if row.OrderType == "" {
		row.OrderType = strings.TrimSpace(fallbackType)
	}
	if row.OrderType == "" {
		row.OrderType = "activation"
	}

	if v := strings.TrimSpace(providerOrder.Phone); v != "" {
		row.Phone = v
	}
	if v := strings.TrimSpace(providerOrder.Country); v != "" {
		row.Country = v
	}
	if v := strings.TrimSpace(providerOrder.Operator); v != "" {
		row.Operator = v
	}
	if v := strings.TrimSpace(providerOrder.Product); v != "" {
		row.Product = v
	}
	if providerOrder.Price > 0 {
		row.ProviderPrice = providerOrder.Price
	}

	status := normalizeFiveSimOrderStatus(providerOrder.Status)
	if status != "" {
		row.ProviderStatus = status
	}

	raw, err := json.Marshal(providerOrder)
	if err != nil {
		return errors.New("gagal serialisasi snapshot order")
	}
	row.RawPayload = string(raw)
	now := time.Now()
	row.LastSyncedAt = &now
	row.NextSyncAt = nil
	row.SyncFailCount = 0
	row.LastSyncErrorCode = ""
	row.LastSyncErrorMsg = ""

	if isFiveSimOpenStatus(status) {
		row.ResolvedAt = nil
		row.ResolutionSource = ""
		row.ResolutionReason = ""
	} else {
		row.ResolvedAt = &now
		row.ResolutionSource = fiveSimResolutionSourceProvider
		row.ResolutionReason = fmt.Sprintf("provider_%s", strings.ToLower(status))
	}

	return nil
}

func (s *FiveSimService) parseResolveNotFoundThreshold(fallback int) int {
	if fallback <= 0 {
		fallback = 3
	}
	if s == nil || s.cfg == nil {
		return fallback
	}
	raw := strings.TrimSpace(s.cfg.FiveSimResolveNotFoundThreshold)
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return fallback
	}
	if n > 100 {
		return 100
	}
	return n
}

func (s *FiveSimService) parseResolveNotFoundMinAge(fallback time.Duration) time.Duration {
	if fallback <= 0 {
		fallback = 3 * time.Minute
	}
	if s == nil || s.cfg == nil {
		return fallback
	}
	raw := strings.TrimSpace(s.cfg.FiveSimResolveNotFoundMinAge)
	if raw == "" {
		return fallback
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}

func classifyFiveSimSyncError(err error) fiveSimSyncErrorInfo {
	info := fiveSimSyncErrorInfo{
		Code:      fiveSimSyncErrUnknown,
		Message:   normalizeFiveSimSyncMessage("request 5sim gagal"),
		Retryable: true,
	}
	if err == nil {
		info.Code = fiveSimSyncErrNone
		info.Message = ""
		info.Retryable = false
		return info
	}

	var apiErr *FiveSimAPIError
	if errors.As(err, &apiErr) {
		msg := normalizeFiveSimSyncMessage(apiErr.Message)
		if msg == "" {
			msg = normalizeFiveSimSyncMessage(err.Error())
		}
		info.Message = msg
		info.Retryable = apiErr.Retryable

		lowerMsg := strings.ToLower(msg)
		switch {
		case apiErr.StatusCode == http.StatusUnauthorized || apiErr.StatusCode == http.StatusForbidden:
			info.Code = fiveSimSyncErrAuth
			info.Retryable = false
		case apiErr.StatusCode == http.StatusTooManyRequests:
			info.Code = fiveSimSyncErrRateLimit
			info.Retryable = true
		case apiErr.StatusCode == http.StatusNotFound || strings.Contains(lowerMsg, "order not found"):
			info.Code = fiveSimSyncErrOrderNotFound
			info.ResolveAsGone = true
			info.Retryable = false
		case apiErr.StatusCode == http.StatusBadRequest && strings.Contains(lowerMsg, "order expired"):
			info.Code = fiveSimSyncErrOrderExpired
			info.ResolveAsGone = true
			info.Retryable = false
		case apiErr.StatusCode >= 500:
			info.Code = fiveSimSyncErrProvider
			info.Retryable = true
		default:
			info.Code = fiveSimSyncErrUnknown
		}
		return info
	}

	msg := normalizeFiveSimSyncMessage(err.Error())
	if msg != "" {
		info.Message = msg
	}
	if strings.Contains(strings.ToLower(info.Message), "order not found") {
		info.Code = fiveSimSyncErrOrderNotFound
		info.ResolveAsGone = true
		info.Retryable = false
	}
	return info
}

func normalizeFiveSimSyncMessage(raw string) string {
	msg := strings.TrimSpace(raw)
	if msg == "" {
		return ""
	}
	if len(msg) > 255 {
		msg = msg[:255]
	}
	return msg
}

func (s *FiveSimService) markSyncFailed(row *model.FiveSimOrder, info fiveSimSyncErrorInfo, minSyncAge time.Duration) {
	if row == nil {
		return
	}
	now := time.Now()
	row.SyncFailCount = row.SyncFailCount + 1
	row.LastSyncErrorCode = strings.TrimSpace(info.Code)
	row.LastSyncErrorMsg = normalizeFiveSimSyncMessage(info.Message)
	row.LastSyncedAt = &now
	row.NextSyncAt = nil

	nextDelay := nextFiveSimSyncDelay(row.SyncFailCount, minSyncAge, info)
	if nextDelay > 0 {
		nextAt := now.Add(nextDelay)
		row.NextSyncAt = &nextAt
	}
}

func nextFiveSimSyncDelay(failCount int, minSyncAge time.Duration, info fiveSimSyncErrorInfo) time.Duration {
	base := minSyncAge
	if base <= 0 {
		base = 45 * time.Second
	}

	switch info.Code {
	case fiveSimSyncErrAuth:
		return maxFiveSimDuration(base, 10*time.Minute)
	case fiveSimSyncErrOrderNotFound, fiveSimSyncErrOrderExpired:
		return maxFiveSimDuration(base, 1*time.Minute)
	case fiveSimSyncErrRateLimit:
		return maxFiveSimDuration(base, 90*time.Second)
	}

	switch {
	case failCount >= 10:
		return maxFiveSimDuration(base, 15*time.Minute)
	case failCount >= 6:
		return maxFiveSimDuration(base, 5*time.Minute)
	case failCount >= 3:
		return maxFiveSimDuration(base, 90*time.Second)
	default:
		return base
	}
}

func maxFiveSimDuration(a, b time.Duration) time.Duration {
	if a >= b {
		return a
	}
	return b
}

func (s *FiveSimService) shouldResolveSyntheticOnMissingProviderOrder(row *model.FiveSimOrder, info fiveSimSyncErrorInfo, threshold int, minAge time.Duration) bool {
	if row == nil || !info.ResolveAsGone {
		return false
	}
	if !isFiveSimOpenStatus(row.ProviderStatus) {
		return false
	}
	if threshold <= 0 {
		threshold = 3
	}
	if minAge <= 0 {
		minAge = 3 * time.Minute
	}
	if row.SyncFailCount < threshold {
		return false
	}
	return time.Since(row.CreatedAt) >= minAge
}

func (s *FiveSimService) resolveSyntheticTerminal(row *model.FiveSimOrder, info fiveSimSyncErrorInfo) {
	if row == nil {
		return
	}

	now := time.Now()
	targetStatus := fiveSimStatusTimeout
	reason := "provider_missing_order"
	if info.Code == fiveSimSyncErrOrderExpired {
		reason = "provider_order_expired"
	}
	if s.orderHasAnySMS(row, nil) {
		targetStatus = fiveSimStatusFinished
		reason = reason + "_with_sms"
	}

	row.ProviderStatus = targetStatus
	row.ResolutionSource = fiveSimResolutionSourceSynthetic
	row.ResolutionReason = reason
	row.ResolvedAt = &now
	row.LastSyncedAt = &now
	row.NextSyncAt = nil
	row.LastSyncErrorCode = strings.TrimSpace(info.Code)
	row.LastSyncErrorMsg = normalizeFiveSimSyncMessage(info.Message)
	row.SyncFailCount = 0
}

func (s *FiveSimService) shouldAutoCancelByWaitingWindow(row *model.FiveSimOrder, providerOrder *FiveSimOrderPayload, maxWaiting time.Duration) bool {
	if row == nil {
		return false
	}
	if maxWaiting <= 0 {
		maxWaiting = 15 * time.Minute
	}

	status := normalizeFiveSimOrderStatus(row.ProviderStatus)
	if providerOrder != nil {
		if providerStatus := normalizeFiveSimOrderStatus(providerOrder.Status); providerStatus != "" {
			status = providerStatus
		}
	}
	if !isFiveSimOpenStatus(status) {
		return false
	}
	if s.orderHasAnySMS(row, providerOrder) {
		return false
	}

	return time.Since(row.CreatedAt) >= maxWaiting
}

func (s *FiveSimService) settleWalletAfterSync(row *model.FiveSimOrder, providerOrder *FiveSimOrderPayload, reason string) (bool, error) {
	if row == nil {
		return false, nil
	}

	status := normalizeFiveSimOrderStatus(row.ProviderStatus)
	if providerOrder != nil {
		if providerStatus := normalizeFiveSimOrderStatus(providerOrder.Status); providerStatus != "" {
			status = providerStatus
		}
	}
	if !isFiveSimRefundEligibleStatus(status) {
		return false, nil
	}
	if s.orderHasAnySMS(row, providerOrder) {
		return false, nil
	}

	return s.refundWalletForOrder(row, status, reason)
}

func (s *FiveSimService) refundWalletForOrder(row *model.FiveSimOrder, status, reason string) (bool, error) {
	if row == nil || row.ProviderOrderID <= 0 {
		return false, nil
	}
	if s.walletRepo == nil {
		return false, errors.New("konfigurasi wallet belum siap")
	}

	chargeRef := fmt.Sprintf("fivesim_order:%d:charge", row.ProviderOrderID)
	refundRef := fmt.Sprintf("fivesim_order:%d:refund", row.ProviderOrderID)

	description := fmt.Sprintf(
		"Refund otomatis 5sim provider_order_id=%d status=%s reason=%s",
		row.ProviderOrderID,
		normalizeFiveSimOrderStatus(status),
		strings.TrimSpace(reason),
	)

	refunded := false
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, refundRef); err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("gagal cek ledger refund 5sim")
		}

		chargeLedger, err := s.walletRepo.FindLedgerByReferenceTx(tx, chargeRef)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return errors.New("gagal cek ledger charge 5sim")
		}

		amount := chargeLedger.Amount
		if amount <= 0 {
			return errors.New("nominal refund 5sim tidak valid")
		}

		user, err := s.walletRepo.LockUserByIDTx(tx, row.UserID)
		if err != nil {
			return errors.New("user tidak ditemukan")
		}

		before := user.WalletBalance
		after := before + amount
		user.WalletBalance = after
		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return errors.New("gagal update saldo wallet untuk refund 5sim")
		}

		ledger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "credit",
			Category:      "5sim_refund",
			Amount:        amount,
			BalanceBefore: before,
			BalanceAfter:  after,
			Reference:     refundRef,
			Description:   description,
		}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger refund 5sim")
		}

		refunded = true
		return nil
	})
	if err != nil {
		return false, err
	}

	return refunded, nil
}

func (s *FiveSimService) orderHasAnySMS(row *model.FiveSimOrder, providerOrder *FiveSimOrderPayload) bool {
	if providerOrder != nil && hasFiveSimSMS(providerOrder.SMS) {
		return true
	}
	if row == nil {
		return false
	}
	return rawFiveSimPayloadHasSMS(row.RawPayload)
}

func (s *FiveSimService) touchOrderSyncedAt(row *model.FiveSimOrder) {
	if row == nil {
		return
	}
	now := time.Now()
	row.LastSyncedAt = &now
	_ = s.orderRepo.Update(row)
}

func normalizeFiveSimOrderStatus(status string) string {
	return strings.ToUpper(strings.TrimSpace(status))
}

func isFiveSimOpenStatus(status string) bool {
	_, ok := fiveSimOpenStatuses[normalizeFiveSimOrderStatus(status)]
	return ok
}

func isFiveSimRefundEligibleStatus(status string) bool {
	_, ok := fiveSimRefundEligibleStatuses[normalizeFiveSimOrderStatus(status)]
	return ok
}

func hasFiveSimSMS(smsList []FiveSimSMS) bool {
	if len(smsList) == 0 {
		return false
	}
	for _, sms := range smsList {
		if strings.TrimSpace(sms.Code) != "" {
			return true
		}
		if strings.TrimSpace(sms.Text) != "" {
			return true
		}
		if strings.TrimSpace(sms.Sender) != "" {
			return true
		}
	}
	return false
}

func rawFiveSimPayloadHasSMS(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return false
	}

	var payload FiveSimOrderPayload
	if err := json.Unmarshal([]byte(trimmed), &payload); err == nil {
		return hasFiveSimSMS(payload.SMS)
	}

	var generic map[string]any
	if err := json.Unmarshal([]byte(trimmed), &generic); err != nil {
		return false
	}
	rawSMS, ok := generic["sms"]
	if !ok {
		return false
	}
	items, ok := rawSMS.([]any)
	if !ok {
		return false
	}
	return len(items) > 0
}

func (s *FiveSimService) ensureUserActive(userID uuid.UUID) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("user tidak ditemukan")
	}
	if !user.IsActive {
		return errors.New("akun diblokir")
	}
	return nil
}

func (s *FiveSimService) normalizeProviderErr(err error) error {
	if err == nil {
		return nil
	}

	var apiErr *FiveSimAPIError
	if errors.As(err, &apiErr) {
		msg := strings.TrimSpace(apiErr.Message)
		if msg == "" {
			msg = "request ke 5sim gagal"
		}

		if isFiveSimNoFreePhonesError(apiErr) {
			return errors.New("stok nomor operator ini sedang habis, pilih operator lain")
		}

		lowerMsg := strings.ToLower(msg)
		switch {
		case strings.Contains(lowerMsg, "order has sms"):
			return errors.New("order sudah menerima SMS. Gunakan finish untuk menyelesaikan order")
		case strings.Contains(lowerMsg, "order expired"):
			return errors.New("order sudah kedaluwarsa")
		case strings.Contains(lowerMsg, "hosting order"):
			return errors.New("aksi ini hanya berlaku untuk order activation")
		case strings.Contains(lowerMsg, "order not found"):
			return errors.New("order 5sim tidak ditemukan")
		}

		switch apiErr.StatusCode {
		case 401, 403:
			return errors.New("autentikasi 5sim gagal, cek API key")
		case 404:
			return errors.New("resource 5sim tidak ditemukan")
		case 429:
			return errors.New("limit request 5sim tercapai, coba lagi sebentar")
		case 503:
			return errors.New("5sim sedang sibuk/offline, coba lagi")
		default:
			if apiErr.StatusCode >= 500 {
				return errors.New("5sim sedang bermasalah, coba lagi")
			}
			if strings.EqualFold(msg, "server offline") {
				return errors.New("server 5sim offline, coba lagi")
			}
			return errors.New(msg)
		}
	}

	return fmt.Errorf("request 5sim gagal: %w", err)
}
