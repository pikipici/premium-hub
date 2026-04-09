package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	hashpkg "premiumhub-api/pkg/hash"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	convertAssetPulsa  = "pulsa"
	convertAssetPaypal = "paypal"
	convertAssetCrypto = "crypto"
)

const (
	convertStatusPendingTransfer = "pending_transfer"
	convertStatusWaitingReview   = "waiting_review"
	convertStatusApproved        = "approved"
	convertStatusProcessing      = "processing"
	convertStatusSuccess         = "success"
	convertStatusFailed          = "failed"
	convertStatusExpired         = "expired"
	convertStatusCanceled        = "canceled"
)

const (
	defaultConvertPPNRate = 0.11
	defaultConvertExpiry  = 60 * time.Minute
)

const (
	convertGuestBridgeEmail = "guest-convert@system.local"
	convertGuestBridgeName  = "Guest Convert"
)

var supportedConvertAssets = map[string]struct{}{
	convertAssetPulsa:  {},
	convertAssetPaypal: {},
	convertAssetCrypto: {},
}

var convertTransitionMatrix = map[string]map[string]bool{
	convertStatusPendingTransfer: {
		convertStatusWaitingReview: true,
		convertStatusExpired:       true,
		convertStatusCanceled:      true,
	},
	convertStatusWaitingReview: {
		convertStatusApproved: true,
		convertStatusFailed:   true,
		convertStatusCanceled: true,
	},
	convertStatusApproved: {
		convertStatusProcessing: true,
		convertStatusFailed:     true,
	},
	convertStatusProcessing: {
		convertStatusSuccess: true,
		convertStatusFailed:  true,
	},
}

var convertDailyLimitStatuses = []string{
	convertStatusPendingTransfer,
	convertStatusWaitingReview,
	convertStatusApproved,
	convertStatusProcessing,
	convertStatusSuccess,
}

type ConvertService struct {
	userRepo    *repository.UserRepo
	convertRepo *repository.ConvertRepo
}

func NewConvertService(userRepo *repository.UserRepo, convertRepo *repository.ConvertRepo) *ConvertService {
	return &ConvertService{
		userRepo:    userRepo,
		convertRepo: convertRepo,
	}
}

type CreateConvertOrderInput struct {
	AssetType                string `json:"asset_type" binding:"required"`
	SourceAmount             int64  `json:"source_amount" binding:"required"`
	SourceChannel            string `json:"source_channel" binding:"required"`
	SourceAccount            string `json:"source_account" binding:"required"`
	DestinationBank          string `json:"destination_bank" binding:"required"`
	DestinationAccountNumber string `json:"destination_account_number" binding:"required"`
	DestinationAccountName   string `json:"destination_account_name" binding:"required"`
	IsGuest                  bool   `json:"is_guest"`
	Notes                    string `json:"notes"`
	IdempotencyKey           string `json:"idempotency_key"`
}

type ConvertListFilterInput struct {
	AssetType string
	Status    string
	Query     string
}

type UploadConvertProofInput struct {
	FileURL  string `json:"file_url"`
	FileName string `json:"file_name"`
	MimeType string `json:"mime_type"`
	FileSize int64  `json:"file_size"`
	Note     string `json:"note"`
}

type AdminUpdateConvertStatusInput struct {
	ToStatus     string `json:"to_status" binding:"required"`
	Reason       string `json:"reason"`
	InternalNote string `json:"internal_note"`
}

type ConvertPricingRuleInput struct {
	AssetType      string  `json:"asset_type"`
	Enabled        bool    `json:"enabled"`
	Rate           float64 `json:"rate"`
	AdminFee       int64   `json:"admin_fee"`
	RiskFee        int64   `json:"risk_fee"`
	TransferFee    int64   `json:"transfer_fee"`
	GuestSurcharge int64   `json:"guest_surcharge"`
	PPNRate        float64 `json:"ppn_rate"`
}

type UpdateConvertPricingInput struct {
	Rules []ConvertPricingRuleInput `json:"rules" binding:"required,min=1"`
}

type ConvertLimitRuleInput struct {
	AssetType             string `json:"asset_type"`
	Enabled               bool   `json:"enabled"`
	AllowGuest            bool   `json:"allow_guest"`
	RequireLogin          bool   `json:"require_login"`
	MinAmount             int64  `json:"min_amount"`
	MaxAmount             int64  `json:"max_amount"`
	DailyLimit            int64  `json:"daily_limit"`
	ManualReviewThreshold int64  `json:"manual_review_threshold"`
}

type UpdateConvertLimitsInput struct {
	Rules []ConvertLimitRuleInput `json:"rules" binding:"required,min=1"`
}

type ConvertPricingSnapshotResponse struct {
	Rate           float64 `json:"rate"`
	AdminFee       int64   `json:"admin_fee"`
	RiskFee        int64   `json:"risk_fee"`
	TransferFee    int64   `json:"transfer_fee"`
	GuestSurcharge int64   `json:"guest_surcharge"`
	PPNRate        float64 `json:"ppn_rate"`
	PPNAmount      int64   `json:"ppn_amount"`
}

type ConvertOrderSummaryResponse struct {
	ID                       string                         `json:"id"`
	UserID                   string                         `json:"user_id"`
	UserName                 string                         `json:"user_name,omitempty"`
	UserEmail                string                         `json:"user_email,omitempty"`
	AssetType                string                         `json:"asset_type"`
	Status                   string                         `json:"status"`
	IsGuest                  bool                           `json:"is_guest"`
	SourceAmount             int64                          `json:"source_amount"`
	SourceChannel            string                         `json:"source_channel"`
	SourceAccount            string                         `json:"source_account"`
	DestinationBank          string                         `json:"destination_bank"`
	DestinationAccountNumber string                         `json:"destination_account_number"`
	DestinationAccountName   string                         `json:"destination_account_name"`
	ConvertedAmount          int64                          `json:"converted_amount"`
	TotalFee                 int64                          `json:"total_fee"`
	ReceiveAmount            int64                          `json:"receive_amount"`
	PricingSnapshot          ConvertPricingSnapshotResponse `json:"pricing_snapshot"`
	TrackingToken            string                         `json:"tracking_token,omitempty"`
	IdempotencyKey           string                         `json:"idempotency_key,omitempty"`
	Notes                    string                         `json:"notes,omitempty"`
	ExpiresAt                *time.Time                     `json:"expires_at,omitempty"`
	CreatedAt                time.Time                      `json:"created_at"`
	UpdatedAt                time.Time                      `json:"updated_at"`
}

type ConvertOrderEventResponse struct {
	ID           string    `json:"id"`
	OrderID      string    `json:"order_id"`
	FromStatus   string    `json:"from_status"`
	ToStatus     string    `json:"to_status"`
	Reason       string    `json:"reason,omitempty"`
	InternalNote string    `json:"internal_note,omitempty"`
	ActorType    string    `json:"actor_type"`
	ActorID      string    `json:"actor_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type ConvertProofResponse struct {
	ID             string    `json:"id"`
	OrderID        string    `json:"order_id"`
	FileURL        string    `json:"file_url"`
	FileName       string    `json:"file_name,omitempty"`
	MimeType       string    `json:"mime_type,omitempty"`
	FileSize       int64     `json:"file_size"`
	Note           string    `json:"note,omitempty"`
	UploadedByType string    `json:"uploaded_by_type"`
	UploadedByID   string    `json:"uploaded_by_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type ConvertOrderDetailResponse struct {
	Order  ConvertOrderSummaryResponse `json:"order"`
	Events []ConvertOrderEventResponse `json:"events"`
	Proofs []ConvertProofResponse      `json:"proofs"`
}

type ConvertOrderListResponse struct {
	Orders []ConvertOrderSummaryResponse `json:"orders"`
	Total  int64                         `json:"total"`
}

type ConvertExpireResult struct {
	Checked int `json:"checked"`
	Expired int `json:"expired"`
}

func (s *ConvertService) CreateOrder(ctx context.Context, userID uuid.UUID, input CreateConvertOrderInput) (*ConvertOrderDetailResponse, error) {
	if err := s.ensureDefaultRules(); err != nil {
		return nil, errors.New("gagal menyiapkan rule convert")
	}

	if _, err := s.ensureActiveUser(userID); err != nil {
		return nil, err
	}

	actorID := userID
	return s.createOrderWithOwner(ctx, userID, input, "user", &actorID, true)
}

func (s *ConvertService) CreateGuestOrder(ctx context.Context, input CreateConvertOrderInput) (*ConvertOrderDetailResponse, error) {
	if err := s.ensureDefaultRules(); err != nil {
		return nil, errors.New("gagal menyiapkan rule convert")
	}

	guestUser, err := s.ensureGuestBridgeUser()
	if err != nil {
		return nil, err
	}

	input.IsGuest = true
	return s.createOrderWithOwner(ctx, guestUser.ID, input, "guest", nil, false)
}

func (s *ConvertService) createOrderWithOwner(ctx context.Context, ownerUserID uuid.UUID, input CreateConvertOrderInput, actorType string, actorID *uuid.UUID, includeUser bool) (*ConvertOrderDetailResponse, error) {
	_ = ctx

	assetType := normalizeConvertAsset(input.AssetType)
	if !isSupportedConvertAsset(assetType) {
		return nil, errors.New("asset convert tidak tersedia")
	}

	if strings.TrimSpace(input.SourceChannel) == "" || strings.TrimSpace(input.SourceAccount) == "" {
		return nil, errors.New("sumber transaksi wajib diisi")
	}
	if strings.TrimSpace(input.DestinationBank) == "" || strings.TrimSpace(input.DestinationAccountNumber) == "" || strings.TrimSpace(input.DestinationAccountName) == "" {
		return nil, errors.New("tujuan transfer wajib diisi")
	}

	idempotencyKey := normalizeConvertIdempotencyKey(input.IdempotencyKey)
	if input.IsGuest {
		idempotencyKey = buildGuestIdempotencyKey(idempotencyKey, input)
	}
	if idempotencyKey != "" {
		existing, err := s.convertRepo.FindOrderByIdempotencyKey(ownerUserID, idempotencyKey)
		if err == nil {
			if includeUser {
				return s.GetOrderByUser(ownerUserID, existing.ID)
			}
			return s.getOrderByPublic(existing.ID)
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("gagal cek idempotency order convert")
		}
	}

	limitRule, err := s.convertRepo.FindLimitRuleByAsset(assetType)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("limit convert belum dikonfigurasi")
		}
		return nil, errors.New("gagal membaca limit convert")
	}
	if !limitRule.Enabled {
		return nil, errors.New("asset convert tidak tersedia")
	}

	if input.SourceAmount < limitRule.MinAmount {
		return nil, errors.New("nominal convert di bawah minimum")
	}
	if input.SourceAmount > limitRule.MaxAmount {
		return nil, errors.New("nominal convert melebihi batas maksimum")
	}
	if input.IsGuest && !limitRule.AllowGuest {
		return nil, errors.New("asset convert ini tidak mengizinkan guest")
	}

	now := time.Now()
	if !input.IsGuest {
		startDay, endDay := convertDayRange(now, "Asia/Jakarta")
		todayUsedAmount, err := s.convertRepo.SumUserDailySourceAmount(ownerUserID, assetType, startDay, endDay, convertDailyLimitStatuses)
		if err != nil {
			return nil, errors.New("gagal menghitung limit harian convert")
		}
		if limitRule.DailyLimit > 0 && todayUsedAmount+input.SourceAmount > limitRule.DailyLimit {
			return nil, errors.New("nominal convert melebihi limit harian")
		}
	}

	pricingRule, err := s.convertRepo.FindPricingRuleByAsset(assetType)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("pricing convert belum dikonfigurasi")
		}
		return nil, errors.New("gagal membaca pricing convert")
	}
	if !pricingRule.Enabled {
		return nil, errors.New("asset convert tidak tersedia")
	}

	calc, err := calculateConvertAmounts(input.SourceAmount, pricingRule, input.IsGuest)
	if err != nil {
		return nil, err
	}

	expiresAt := now.Add(defaultConvertExpiry)
	order := &model.ConvertOrder{
		UserID:                   ownerUserID,
		AssetType:                assetType,
		Status:                   convertStatusPendingTransfer,
		IsGuest:                  input.IsGuest,
		SourceAmount:             input.SourceAmount,
		SourceChannel:            strings.TrimSpace(input.SourceChannel),
		SourceAccount:            strings.TrimSpace(input.SourceAccount),
		DestinationBank:          strings.TrimSpace(input.DestinationBank),
		DestinationAccountNumber: strings.TrimSpace(input.DestinationAccountNumber),
		DestinationAccountName:   strings.TrimSpace(input.DestinationAccountName),
		Rate:                     pricingRule.Rate,
		AdminFee:                 pricingRule.AdminFee,
		RiskFee:                  pricingRule.RiskFee,
		TransferFee:              pricingRule.TransferFee,
		GuestSurcharge:           calc.GuestSurcharge,
		PPNRate:                  pricingRule.PPNRate,
		PPNAmount:                calc.PPNAmount,
		ConvertedAmount:          calc.ConvertedAmount,
		TotalFee:                 calc.TotalFee,
		ReceiveAmount:            calc.ReceiveAmount,
		IdempotencyKey:           idempotencyKey,
		Notes:                    strings.TrimSpace(input.Notes),
		ExpiresAt:                &expiresAt,
	}

	trackingToken := ""
	err = s.convertRepo.Transaction(func(tx *gorm.DB) error {
		if err := s.convertRepo.CreateOrderTx(tx, order); err != nil {
			return err
		}

		token, err := s.generateTrackingTokenTx(tx, order.ID, order.ExpiresAt)
		if err != nil {
			return err
		}
		trackingToken = token

		event := &model.ConvertOrderEvent{
			OrderID:    order.ID,
			FromStatus: "",
			ToStatus:   convertStatusPendingTransfer,
			Reason:     "order dibuat",
			ActorType:  actorType,
			ActorID:    actorID,
			CreatedAt:  now,
		}
		if err := s.convertRepo.CreateEventTx(tx, event); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, errors.New("gagal membuat order convert")
	}

	var res *ConvertOrderDetailResponse
	if includeUser {
		res, err = s.GetOrderByUser(ownerUserID, order.ID)
	} else {
		res, err = s.getOrderByPublic(order.ID)
	}
	if err != nil {
		return nil, err
	}
	if res != nil {
		res.Order.TrackingToken = trackingToken
	}
	return res, nil
}

func (s *ConvertService) ListOrdersByUser(userID uuid.UUID, page, limit int, filter ConvertListFilterInput) (*ConvertOrderListResponse, error) {
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

	rows, total, err := s.convertRepo.ListOrdersByUser(userID, page, limit, repository.ConvertOrderFilter{
		AssetType: normalizeConvertAsset(filter.AssetType),
		Status:    normalizeConvertStatus(filter.Status),
		Query:     strings.TrimSpace(filter.Query),
	})
	if err != nil {
		return nil, errors.New("gagal memuat order convert")
	}

	items := make([]ConvertOrderSummaryResponse, 0, len(rows))
	for _, row := range rows {
		trackingToken := s.resolveTrackingToken(row.ID)
		items = append(items, mapConvertOrderSummary(row, trackingToken, true))
	}

	return &ConvertOrderListResponse{Orders: items, Total: total}, nil
}

func (s *ConvertService) GetOrderByUser(userID, orderID uuid.UUID) (*ConvertOrderDetailResponse, error) {
	if _, err := s.ensureActiveUser(userID); err != nil {
		return nil, err
	}

	row, err := s.convertRepo.FindOrderByIDAndUser(orderID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order convert tidak ditemukan")
		}
		return nil, errors.New("gagal memuat order convert")
	}

	return s.buildConvertOrderDetail(row, true)
}

func (s *ConvertService) getOrderByPublic(orderID uuid.UUID) (*ConvertOrderDetailResponse, error) {
	row, err := s.convertRepo.FindOrderByID(orderID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order convert tidak ditemukan")
		}
		return nil, errors.New("gagal memuat order convert")
	}

	return s.buildConvertOrderDetail(row, false)
}

func (s *ConvertService) TrackOrderByToken(token string) (*ConvertOrderDetailResponse, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, errors.New("token tracking tidak valid")
	}

	track, err := s.convertRepo.FindTrackingToken(token)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order convert tidak ditemukan")
		}
		return nil, errors.New("gagal melacak order convert")
	}
	if track.ExpiresAt != nil && track.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("token tracking sudah kedaluwarsa")
	}

	row, err := s.convertRepo.FindOrderByID(track.OrderID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order convert tidak ditemukan")
		}
		return nil, errors.New("gagal memuat order convert")
	}

	res, err := s.buildConvertOrderDetail(row, false)
	if err != nil {
		return nil, err
	}
	if res != nil {
		res.Order.TrackingToken = token
	}
	return res, nil
}

func (s *ConvertService) UploadProof(ctx context.Context, userID, orderID uuid.UUID, input UploadConvertProofInput) (*ConvertOrderDetailResponse, error) {
	_ = ctx

	if _, err := s.ensureActiveUser(userID); err != nil {
		return nil, err
	}

	fileURL := strings.TrimSpace(input.FileURL)
	if fileURL == "" {
		return nil, errors.New("bukti transaksi tidak valid")
	}

	note := strings.TrimSpace(input.Note)
	if len(note) > 500 {
		return nil, errors.New("catatan bukti terlalu panjang")
	}

	now := time.Now()
	err := s.convertRepo.Transaction(func(tx *gorm.DB) error {
		row, err := s.convertRepo.LockOrderByIDTx(tx, orderID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("order convert tidak ditemukan")
			}
			return err
		}
		if row.UserID != userID {
			return errors.New("order convert bukan milik user")
		}
		if isFinalConvertStatus(row.Status) {
			return errors.New("order convert sudah final")
		}

		proof := &model.ConvertProof{
			OrderID:        row.ID,
			FileURL:        fileURL,
			FileName:       strings.TrimSpace(input.FileName),
			MimeType:       strings.TrimSpace(input.MimeType),
			FileSize:       input.FileSize,
			Note:           note,
			UploadedByType: "user",
			UploadedByID:   &userID,
			CreatedAt:      now,
		}
		if err := s.convertRepo.CreateProofTx(tx, proof); err != nil {
			return err
		}

		fromStatus := normalizeConvertStatus(row.Status)
		toStatus := fromStatus
		reason := "bukti transaksi diunggah"

		if row.Status == convertStatusPendingTransfer {
			toStatus = convertStatusWaitingReview
			row.Status = toStatus
			if err := s.convertRepo.SaveOrderTx(tx, row); err != nil {
				return err
			}
		} else {
			reason = "bukti tambahan diunggah"
		}

		event := &model.ConvertOrderEvent{
			OrderID:    row.ID,
			FromStatus: fromStatus,
			ToStatus:   toStatus,
			Reason:     reason,
			ActorType:  "user",
			ActorID:    &userID,
			CreatedAt:  now,
		}
		if err := s.convertRepo.CreateEventTx(tx, event); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		if err.Error() == "order convert tidak ditemukan" || err.Error() == "order convert bukan milik user" || err.Error() == "order convert sudah final" || err.Error() == "catatan bukti terlalu panjang" {
			return nil, err
		}
		return nil, errors.New("gagal mengunggah bukti convert")
	}

	return s.GetOrderByUser(userID, orderID)
}

func (s *ConvertService) UploadProofByTrackingToken(ctx context.Context, token string, input UploadConvertProofInput) (*ConvertOrderDetailResponse, error) {
	_ = ctx

	token = strings.TrimSpace(token)
	if token == "" {
		return nil, errors.New("token tracking tidak valid")
	}

	track, err := s.convertRepo.FindTrackingToken(token)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order convert tidak ditemukan")
		}
		return nil, errors.New("gagal melacak order convert")
	}
	if track.ExpiresAt != nil && track.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("token tracking sudah kedaluwarsa")
	}

	fileURL := strings.TrimSpace(input.FileURL)
	if fileURL == "" {
		return nil, errors.New("bukti transaksi tidak valid")
	}

	note := strings.TrimSpace(input.Note)
	if len(note) > 500 {
		return nil, errors.New("catatan bukti terlalu panjang")
	}

	now := time.Now()
	err = s.convertRepo.Transaction(func(tx *gorm.DB) error {
		row, err := s.convertRepo.LockOrderByIDTx(tx, track.OrderID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("order convert tidak ditemukan")
			}
			return err
		}
		if isFinalConvertStatus(row.Status) {
			return errors.New("order convert sudah final")
		}

		proof := &model.ConvertProof{
			OrderID:        row.ID,
			FileURL:        fileURL,
			FileName:       strings.TrimSpace(input.FileName),
			MimeType:       strings.TrimSpace(input.MimeType),
			FileSize:       input.FileSize,
			Note:           note,
			UploadedByType: "guest",
			UploadedByID:   nil,
			CreatedAt:      now,
		}
		if err := s.convertRepo.CreateProofTx(tx, proof); err != nil {
			return err
		}

		fromStatus := normalizeConvertStatus(row.Status)
		toStatus := fromStatus
		reason := "bukti transaksi diunggah via tracking"

		if row.Status == convertStatusPendingTransfer {
			toStatus = convertStatusWaitingReview
			row.Status = toStatus
			if err := s.convertRepo.SaveOrderTx(tx, row); err != nil {
				return err
			}
		} else {
			reason = "bukti tambahan diunggah via tracking"
		}

		event := &model.ConvertOrderEvent{
			OrderID:    row.ID,
			FromStatus: fromStatus,
			ToStatus:   toStatus,
			Reason:     reason,
			ActorType:  "guest",
			CreatedAt:  now,
		}
		if err := s.convertRepo.CreateEventTx(tx, event); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		if err.Error() == "order convert tidak ditemukan" || err.Error() == "order convert sudah final" || err.Error() == "catatan bukti terlalu panjang" || err.Error() == "token tracking sudah kedaluwarsa" {
			return nil, err
		}
		return nil, errors.New("gagal mengunggah bukti convert")
	}

	return s.TrackOrderByToken(token)
}

func (s *ConvertService) AdminListOrders(page, limit int, filter ConvertListFilterInput) (*ConvertOrderListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	rows, total, err := s.convertRepo.ListOrdersAdmin(page, limit, repository.ConvertOrderFilter{
		AssetType: normalizeConvertAsset(filter.AssetType),
		Status:    normalizeConvertStatus(filter.Status),
		Query:     strings.TrimSpace(filter.Query),
	})
	if err != nil {
		return nil, errors.New("gagal memuat queue convert")
	}

	items := make([]ConvertOrderSummaryResponse, 0, len(rows))
	for _, row := range rows {
		trackingToken := s.resolveTrackingToken(row.ID)
		items = append(items, mapConvertOrderSummary(row, trackingToken, true))
	}

	return &ConvertOrderListResponse{Orders: items, Total: total}, nil
}

func (s *ConvertService) AdminGetOrderByID(orderID uuid.UUID) (*ConvertOrderDetailResponse, error) {
	row, err := s.convertRepo.FindOrderByID(orderID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order convert tidak ditemukan")
		}
		return nil, errors.New("gagal memuat detail order convert")
	}

	return s.buildConvertOrderDetail(row, true)
}

func (s *ConvertService) AdminUpdateOrderStatus(ctx context.Context, adminID, orderID uuid.UUID, input AdminUpdateConvertStatusInput) (*ConvertOrderDetailResponse, error) {
	_ = ctx

	toStatus := normalizeConvertStatus(input.ToStatus)
	if !isKnownConvertStatus(toStatus) {
		return nil, errors.New("transisi status tidak valid")
	}

	now := time.Now()
	err := s.convertRepo.Transaction(func(tx *gorm.DB) error {
		row, err := s.convertRepo.LockOrderByIDTx(tx, orderID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("order convert tidak ditemukan")
			}
			return err
		}

		fromStatus := normalizeConvertStatus(row.Status)
		if fromStatus == toStatus {
			return errors.New("transisi status tidak valid")
		}
		if !isValidConvertTransition(fromStatus, toStatus) {
			return errors.New("transisi status tidak valid")
		}

		row.Status = toStatus
		if err := s.convertRepo.SaveOrderTx(tx, row); err != nil {
			return err
		}

		event := &model.ConvertOrderEvent{
			OrderID:      row.ID,
			FromStatus:   fromStatus,
			ToStatus:     toStatus,
			Reason:       strings.TrimSpace(input.Reason),
			InternalNote: strings.TrimSpace(input.InternalNote),
			ActorType:    "admin",
			ActorID:      &adminID,
			CreatedAt:    now,
		}
		if err := s.convertRepo.CreateEventTx(tx, event); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		if err.Error() == "order convert tidak ditemukan" || err.Error() == "transisi status tidak valid" {
			return nil, err
		}
		return nil, errors.New("gagal update status order convert")
	}

	row, err := s.convertRepo.FindOrderByID(orderID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order convert tidak ditemukan")
		}
		return nil, errors.New("gagal memuat order convert")
	}

	return s.buildConvertOrderDetail(row, true)
}

func (s *ConvertService) ExpirePendingOrders(ctx context.Context, limit int) (*ConvertExpireResult, error) {
	_ = ctx

	if limit <= 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}

	now := time.Now()
	rows, err := s.convertRepo.ListExpiredOrders([]string{convertStatusPendingTransfer, convertStatusWaitingReview}, now, limit)
	if err != nil {
		return nil, errors.New("gagal memuat kandidat expire convert")
	}

	result := &ConvertExpireResult{Checked: len(rows), Expired: 0}
	for _, candidate := range rows {
		didExpire := false
		err := s.convertRepo.Transaction(func(tx *gorm.DB) error {
			row, err := s.convertRepo.LockOrderByIDTx(tx, candidate.ID)
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return nil
				}
				return err
			}

			fromStatus := normalizeConvertStatus(row.Status)
			if fromStatus != convertStatusPendingTransfer && fromStatus != convertStatusWaitingReview {
				return nil
			}
			if row.ExpiresAt == nil || row.ExpiresAt.After(now) {
				return nil
			}

			row.Status = convertStatusExpired
			if err := s.convertRepo.SaveOrderTx(tx, row); err != nil {
				return err
			}

			if err := s.convertRepo.DeactivateTrackingTokenByOrderIDTx(tx, row.ID); err != nil {
				return err
			}

			event := &model.ConvertOrderEvent{
				OrderID:    row.ID,
				FromStatus: fromStatus,
				ToStatus:   convertStatusExpired,
				Reason:     "expired otomatis oleh scheduler",
				ActorType:  "system",
				CreatedAt:  now,
			}
			if err := s.convertRepo.CreateEventTx(tx, event); err != nil {
				return err
			}

			didExpire = true
			return nil
		})
		if err != nil {
			return nil, errors.New("gagal mengeksekusi expire pending convert")
		}
		if didExpire {
			result.Expired++
		}
	}

	return result, nil
}

func (s *ConvertService) GetPricingRules() ([]ConvertPricingRuleInput, error) {
	if err := s.ensureDefaultRules(); err != nil {
		return nil, errors.New("gagal menyiapkan rule convert")
	}

	rows, err := s.convertRepo.ListPricingRules()
	if err != nil {
		return nil, errors.New("gagal memuat pricing convert")
	}

	res := make([]ConvertPricingRuleInput, 0, len(rows))
	for _, row := range rows {
		res = append(res, ConvertPricingRuleInput{
			AssetType:      row.AssetType,
			Enabled:        row.Enabled,
			Rate:           row.Rate,
			AdminFee:       row.AdminFee,
			RiskFee:        row.RiskFee,
			TransferFee:    row.TransferFee,
			GuestSurcharge: row.GuestSurcharge,
			PPNRate:        row.PPNRate,
		})
	}

	return res, nil
}

func (s *ConvertService) UpdatePricingRules(input UpdateConvertPricingInput) ([]ConvertPricingRuleInput, error) {
	if len(input.Rules) == 0 {
		return nil, errors.New("rules pricing convert wajib diisi")
	}

	for _, rule := range input.Rules {
		assetType := normalizeConvertAsset(rule.AssetType)
		if !isSupportedConvertAsset(assetType) {
			return nil, fmt.Errorf("asset convert tidak valid: %s", rule.AssetType)
		}
		if rule.Rate <= 0 || rule.Rate > 10 {
			return nil, fmt.Errorf("rate convert tidak valid untuk %s", assetType)
		}
		if rule.AdminFee < 0 || rule.RiskFee < 0 || rule.TransferFee < 0 || rule.GuestSurcharge < 0 {
			return nil, fmt.Errorf("biaya convert tidak valid untuk %s", assetType)
		}
		if rule.PPNRate < 0 || rule.PPNRate > 1 {
			return nil, fmt.Errorf("ppn_rate tidak valid untuk %s", assetType)
		}
	}

	for _, rule := range input.Rules {
		assetType := normalizeConvertAsset(rule.AssetType)

		row, err := s.convertRepo.FindPricingRuleByAsset(assetType)
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("gagal update pricing convert")
			}

			create := &model.ConvertPricingRule{
				AssetType:      assetType,
				Enabled:        rule.Enabled,
				Rate:           rule.Rate,
				AdminFee:       rule.AdminFee,
				RiskFee:        rule.RiskFee,
				TransferFee:    rule.TransferFee,
				GuestSurcharge: rule.GuestSurcharge,
				PPNRate:        normalizePPNRate(rule.PPNRate),
			}
			if err := s.convertRepo.CreatePricingRule(create); err != nil {
				return nil, errors.New("gagal update pricing convert")
			}
			continue
		}

		row.Enabled = rule.Enabled
		row.Rate = rule.Rate
		row.AdminFee = rule.AdminFee
		row.RiskFee = rule.RiskFee
		row.TransferFee = rule.TransferFee
		row.GuestSurcharge = rule.GuestSurcharge
		row.PPNRate = normalizePPNRate(rule.PPNRate)
		if err := s.convertRepo.SavePricingRule(row); err != nil {
			return nil, errors.New("gagal update pricing convert")
		}
	}

	return s.GetPricingRules()
}

func (s *ConvertService) GetLimitRules() ([]ConvertLimitRuleInput, error) {
	if err := s.ensureDefaultRules(); err != nil {
		return nil, errors.New("gagal menyiapkan rule convert")
	}

	rows, err := s.convertRepo.ListLimitRules()
	if err != nil {
		return nil, errors.New("gagal memuat limit convert")
	}

	res := make([]ConvertLimitRuleInput, 0, len(rows))
	for _, row := range rows {
		res = append(res, ConvertLimitRuleInput{
			AssetType:             row.AssetType,
			Enabled:               row.Enabled,
			AllowGuest:            row.AllowGuest,
			RequireLogin:          row.RequireLogin,
			MinAmount:             row.MinAmount,
			MaxAmount:             row.MaxAmount,
			DailyLimit:            row.DailyLimit,
			ManualReviewThreshold: row.ManualReviewThreshold,
		})
	}

	return res, nil
}

func (s *ConvertService) UpdateLimitRules(input UpdateConvertLimitsInput) ([]ConvertLimitRuleInput, error) {
	if len(input.Rules) == 0 {
		return nil, errors.New("rules limit convert wajib diisi")
	}

	for _, rule := range input.Rules {
		assetType := normalizeConvertAsset(rule.AssetType)
		if !isSupportedConvertAsset(assetType) {
			return nil, fmt.Errorf("asset convert tidak valid: %s", rule.AssetType)
		}
		if rule.MinAmount <= 0 {
			return nil, fmt.Errorf("min_amount tidak valid untuk %s", assetType)
		}
		if rule.MaxAmount < rule.MinAmount {
			return nil, fmt.Errorf("max_amount tidak valid untuk %s", assetType)
		}
		if rule.DailyLimit < rule.MaxAmount {
			return nil, fmt.Errorf("daily_limit tidak valid untuk %s", assetType)
		}
		if rule.ManualReviewThreshold < rule.MinAmount {
			return nil, fmt.Errorf("manual_review_threshold tidak valid untuk %s", assetType)
		}
	}

	for _, rule := range input.Rules {
		assetType := normalizeConvertAsset(rule.AssetType)

		row, err := s.convertRepo.FindLimitRuleByAsset(assetType)
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("gagal update limit convert")
			}

			create := &model.ConvertLimitRule{
				AssetType:             assetType,
				Enabled:               rule.Enabled,
				AllowGuest:            rule.AllowGuest,
				RequireLogin:          rule.RequireLogin,
				MinAmount:             rule.MinAmount,
				MaxAmount:             rule.MaxAmount,
				DailyLimit:            rule.DailyLimit,
				ManualReviewThreshold: rule.ManualReviewThreshold,
			}
			if err := s.convertRepo.CreateLimitRule(create); err != nil {
				return nil, errors.New("gagal update limit convert")
			}
			continue
		}

		row.Enabled = rule.Enabled
		row.AllowGuest = rule.AllowGuest
		row.RequireLogin = rule.RequireLogin
		row.MinAmount = rule.MinAmount
		row.MaxAmount = rule.MaxAmount
		row.DailyLimit = rule.DailyLimit
		row.ManualReviewThreshold = rule.ManualReviewThreshold
		if err := s.convertRepo.SaveLimitRule(row); err != nil {
			return nil, errors.New("gagal update limit convert")
		}
	}

	return s.GetLimitRules()
}

func (s *ConvertService) ensureActiveUser(userID uuid.UUID) (*model.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, errors.New("user tidak ditemukan")
	}
	if !user.IsActive {
		return nil, errors.New("akun diblokir")
	}
	return user, nil
}

func (s *ConvertService) ensureGuestBridgeUser() (*model.User, error) {
	user, err := s.userRepo.FindByEmail(convertGuestBridgeEmail)
	if err == nil {
		if !user.IsActive {
			user.IsActive = true
			if saveErr := s.userRepo.Update(user); saveErr != nil {
				return nil, errors.New("gagal update user guest convert")
			}
		}
		return user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek user guest convert")
	}

	password, hashErr := hashpkg.Password(uuid.NewString())
	if hashErr != nil {
		return nil, errors.New("gagal menyiapkan user guest convert")
	}

	create := &model.User{
		Name:     convertGuestBridgeName,
		Email:    convertGuestBridgeEmail,
		Password: password,
		Role:     "user",
		IsActive: true,
	}
	if createErr := s.userRepo.Create(create); createErr != nil {
		if !isUniqueConstraintError(createErr) {
			return nil, errors.New("gagal membuat user guest convert")
		}

		reload, reloadErr := s.userRepo.FindByEmail(convertGuestBridgeEmail)
		if reloadErr != nil {
			return nil, errors.New("gagal memuat user guest convert")
		}
		return reload, nil
	}

	return create, nil
}

func (s *ConvertService) ensureDefaultRules() error {
	pricingDefaults := defaultConvertPricingRules()
	for _, base := range pricingDefaults {
		_, err := s.convertRepo.FindPricingRuleByAsset(base.AssetType)
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := s.convertRepo.CreatePricingRule(base); err != nil && !isUniqueConstraintError(err) {
			return err
		}
	}

	limitDefaults := defaultConvertLimitRules()
	for _, base := range limitDefaults {
		_, err := s.convertRepo.FindLimitRuleByAsset(base.AssetType)
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := s.convertRepo.CreateLimitRule(base); err != nil && !isUniqueConstraintError(err) {
			return err
		}
	}

	return nil
}

func defaultConvertPricingRules() []*model.ConvertPricingRule {
	return []*model.ConvertPricingRule{
		{
			AssetType:      convertAssetPulsa,
			Enabled:        true,
			Rate:           0.85,
			AdminFee:       2500,
			RiskFee:        0,
			TransferFee:    6500,
			GuestSurcharge: 3000,
			PPNRate:        defaultConvertPPNRate,
		},
		{
			AssetType:      convertAssetPaypal,
			Enabled:        true,
			Rate:           0.90,
			AdminFee:       5000,
			RiskFee:        3000,
			TransferFee:    6500,
			GuestSurcharge: 0,
			PPNRate:        defaultConvertPPNRate,
		},
		{
			AssetType:      convertAssetCrypto,
			Enabled:        true,
			Rate:           0.92,
			AdminFee:       6000,
			RiskFee:        5000,
			TransferFee:    6500,
			GuestSurcharge: 0,
			PPNRate:        defaultConvertPPNRate,
		},
	}
}

func defaultConvertLimitRules() []*model.ConvertLimitRule {
	return []*model.ConvertLimitRule{
		{
			AssetType:             convertAssetPulsa,
			Enabled:               true,
			AllowGuest:            true,
			RequireLogin:          false,
			MinAmount:             10000,
			MaxAmount:             1000000,
			DailyLimit:            5000000,
			ManualReviewThreshold: 1000000,
		},
		{
			AssetType:             convertAssetPaypal,
			Enabled:               true,
			AllowGuest:            false,
			RequireLogin:          true,
			MinAmount:             50000,
			MaxAmount:             50000000,
			DailyLimit:            100000000,
			ManualReviewThreshold: 10000000,
		},
		{
			AssetType:             convertAssetCrypto,
			Enabled:               true,
			AllowGuest:            false,
			RequireLogin:          true,
			MinAmount:             100000,
			MaxAmount:             100000000,
			DailyLimit:            300000000,
			ManualReviewThreshold: 15000000,
		},
	}
}

func (s *ConvertService) buildConvertOrderDetail(row *model.ConvertOrder, includeUser bool) (*ConvertOrderDetailResponse, error) {
	if row == nil {
		return nil, errors.New("order convert tidak ditemukan")
	}

	if includeUser && row.User.ID == uuid.Nil {
		if user, err := s.userRepo.FindByID(row.UserID); err == nil {
			row.User = *user
		}
	}

	events, err := s.convertRepo.ListEventsByOrder(row.ID, 200)
	if err != nil {
		return nil, errors.New("gagal memuat event order convert")
	}
	proofs, err := s.convertRepo.ListProofsByOrder(row.ID)
	if err != nil {
		return nil, errors.New("gagal memuat bukti order convert")
	}

	trackingToken := s.resolveTrackingToken(row.ID)

	resp := &ConvertOrderDetailResponse{
		Order:  mapConvertOrderSummary(*row, trackingToken, includeUser),
		Events: mapConvertOrderEvents(events),
		Proofs: mapConvertProofs(proofs),
	}
	return resp, nil
}

func (s *ConvertService) resolveTrackingToken(orderID uuid.UUID) string {
	track, err := s.convertRepo.FindTrackingTokenByOrderID(orderID)
	if err != nil {
		return ""
	}
	if track.ExpiresAt != nil && track.ExpiresAt.Before(time.Now()) {
		return ""
	}
	return track.Token
}

func (s *ConvertService) generateTrackingTokenTx(tx *gorm.DB, orderID uuid.UUID, expiresAt *time.Time) (string, error) {
	for i := 0; i < 8; i++ {
		token, err := generateConvertToken(18)
		if err != nil {
			return "", err
		}

		row := &model.ConvertTrackingToken{
			OrderID:   orderID,
			Token:     "cvt_" + token,
			IsActive:  true,
			ExpiresAt: expiresAt,
		}
		if err := s.convertRepo.CreateTrackingTokenTx(tx, row); err != nil {
			if isUniqueConstraintError(err) {
				continue
			}
			return "", err
		}
		return row.Token, nil
	}

	return "", errors.New("gagal membuat tracking token")
}

type convertAmountResult struct {
	ConvertedAmount int64
	PPNAmount       int64
	TotalFee        int64
	ReceiveAmount   int64
	GuestSurcharge  int64
}

func calculateConvertAmounts(sourceAmount int64, rule *model.ConvertPricingRule, isGuest bool) (*convertAmountResult, error) {
	if sourceAmount <= 0 {
		return nil, errors.New("nominal convert tidak valid")
	}
	if rule == nil {
		return nil, errors.New("rule convert tidak ditemukan")
	}
	if rule.Rate <= 0 {
		return nil, errors.New("rate convert tidak valid")
	}

	convertedAmount := roundPositive(float64(sourceAmount) * rule.Rate)
	ppnAmount := roundPositive(float64(rule.AdminFee) * normalizePPNRate(rule.PPNRate))
	guestSurcharge := int64(0)
	if isGuest {
		guestSurcharge = rule.GuestSurcharge
	}

	totalFee := rule.AdminFee + rule.RiskFee + rule.TransferFee + guestSurcharge + ppnAmount
	receiveAmount := convertedAmount - totalFee
	if receiveAmount < 0 {
		receiveAmount = 0
	}

	return &convertAmountResult{
		ConvertedAmount: convertedAmount,
		PPNAmount:       ppnAmount,
		TotalFee:        totalFee,
		ReceiveAmount:   receiveAmount,
		GuestSurcharge:  guestSurcharge,
	}, nil
}

func roundPositive(v float64) int64 {
	if math.IsNaN(v) || math.IsInf(v, 0) || v <= 0 {
		return 0
	}
	return int64(math.Round(v))
}

func normalizeConvertAsset(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

func normalizeConvertStatus(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

func normalizeConvertIdempotencyKey(v string) string {
	key := strings.TrimSpace(v)
	if len(key) > 80 {
		key = key[:80]
	}
	return key
}

func buildGuestIdempotencyKey(base string, input CreateConvertOrderInput) string {
	base = normalizeConvertIdempotencyKey(base)
	if base == "" {
		return ""
	}

	srcTail := tailAlnum(input.SourceAccount, 4)
	dstTail := tailAlnum(input.DestinationAccountNumber, 4)
	asset := normalizeConvertAsset(input.AssetType)
	composed := fmt.Sprintf("g:%s:%s:%s:%s", asset, base, srcTail, dstTail)
	return normalizeConvertIdempotencyKey(composed)
}

func tailAlnum(v string, n int) string {
	if n <= 0 {
		return ""
	}
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return "none"
	}

	filtered := make([]rune, 0, len(trimmed))
	for _, ch := range trimmed {
		if (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') {
			filtered = append(filtered, ch)
		}
	}
	if len(filtered) == 0 {
		return "none"
	}
	if len(filtered) <= n {
		return strings.ToLower(string(filtered))
	}
	return strings.ToLower(string(filtered[len(filtered)-n:]))
}

func normalizePPNRate(v float64) float64 {
	if v <= 0 {
		return defaultConvertPPNRate
	}
	if v > 1 {
		return 1
	}
	return v
}

func isSupportedConvertAsset(asset string) bool {
	_, ok := supportedConvertAssets[asset]
	return ok
}

func isKnownConvertStatus(status string) bool {
	if status == "" {
		return false
	}
	if status == convertStatusPendingTransfer ||
		status == convertStatusWaitingReview ||
		status == convertStatusApproved ||
		status == convertStatusProcessing ||
		status == convertStatusSuccess ||
		status == convertStatusFailed ||
		status == convertStatusExpired ||
		status == convertStatusCanceled {
		return true
	}
	return false
}

func isFinalConvertStatus(status string) bool {
	normalized := normalizeConvertStatus(status)
	return normalized == convertStatusSuccess ||
		normalized == convertStatusFailed ||
		normalized == convertStatusExpired ||
		normalized == convertStatusCanceled
}

func isValidConvertTransition(fromStatus, toStatus string) bool {
	next, ok := convertTransitionMatrix[fromStatus]
	if !ok {
		return false
	}
	return next[toStatus]
}

func convertDayRange(now time.Time, tz string) (time.Time, time.Time) {
	loc := time.UTC
	if tz != "" {
		if loaded, err := time.LoadLocation(tz); err == nil {
			loc = loaded
		}
	}

	inLoc := now.In(loc)
	start := time.Date(inLoc.Year(), inLoc.Month(), inLoc.Day(), 0, 0, 0, 0, loc)
	end := start.Add(24 * time.Hour)
	return start, end
}

func mapConvertOrderSummary(row model.ConvertOrder, trackingToken string, includeUser bool) ConvertOrderSummaryResponse {
	res := ConvertOrderSummaryResponse{
		ID:                       row.ID.String(),
		UserID:                   row.UserID.String(),
		AssetType:                row.AssetType,
		Status:                   row.Status,
		IsGuest:                  row.IsGuest,
		SourceAmount:             row.SourceAmount,
		SourceChannel:            row.SourceChannel,
		SourceAccount:            row.SourceAccount,
		DestinationBank:          row.DestinationBank,
		DestinationAccountNumber: row.DestinationAccountNumber,
		DestinationAccountName:   row.DestinationAccountName,
		ConvertedAmount:          row.ConvertedAmount,
		TotalFee:                 row.TotalFee,
		ReceiveAmount:            row.ReceiveAmount,
		PricingSnapshot: ConvertPricingSnapshotResponse{
			Rate:           row.Rate,
			AdminFee:       row.AdminFee,
			RiskFee:        row.RiskFee,
			TransferFee:    row.TransferFee,
			GuestSurcharge: row.GuestSurcharge,
			PPNRate:        row.PPNRate,
			PPNAmount:      row.PPNAmount,
		},
		TrackingToken:  trackingToken,
		IdempotencyKey: row.IdempotencyKey,
		Notes:          row.Notes,
		ExpiresAt:      row.ExpiresAt,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}

	if includeUser && row.User.ID != uuid.Nil {
		res.UserName = row.User.Name
		res.UserEmail = row.User.Email
	}

	return res
}

func mapConvertOrderEvents(rows []model.ConvertOrderEvent) []ConvertOrderEventResponse {
	items := make([]ConvertOrderEventResponse, 0, len(rows))
	for _, row := range rows {
		item := ConvertOrderEventResponse{
			ID:           row.ID.String(),
			OrderID:      row.OrderID.String(),
			FromStatus:   row.FromStatus,
			ToStatus:     row.ToStatus,
			Reason:       row.Reason,
			InternalNote: row.InternalNote,
			ActorType:    row.ActorType,
			CreatedAt:    row.CreatedAt,
		}
		if row.ActorID != nil && *row.ActorID != uuid.Nil {
			item.ActorID = row.ActorID.String()
		}
		items = append(items, item)
	}
	return items
}

func mapConvertProofs(rows []model.ConvertProof) []ConvertProofResponse {
	items := make([]ConvertProofResponse, 0, len(rows))
	for _, row := range rows {
		item := ConvertProofResponse{
			ID:             row.ID.String(),
			OrderID:        row.OrderID.String(),
			FileURL:        row.FileURL,
			FileName:       row.FileName,
			MimeType:       row.MimeType,
			FileSize:       row.FileSize,
			Note:           row.Note,
			UploadedByType: row.UploadedByType,
			CreatedAt:      row.CreatedAt,
		}
		if row.UploadedByID != nil && *row.UploadedByID != uuid.Nil {
			item.UploadedByID = row.UploadedByID.String()
		}
		items = append(items, item)
	}
	return items
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "unique constraint") || strings.Contains(msg, "unique violation")
}

func generateConvertToken(size int) (string, error) {
	if size <= 0 {
		size = 16
	}
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
