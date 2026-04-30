package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	sosmedOrderStatusPendingPayment = "pending_payment"
	sosmedOrderStatusProcessing     = "processing"
	sosmedOrderStatusSuccess        = "success"
	sosmedOrderStatusFailed         = "failed"
	sosmedOrderStatusCanceled       = "canceled"
	sosmedOrderStatusExpired        = "expired"

	sosmedRefillStatusNone       = "none"
	sosmedRefillStatusRequested  = "requested"
	sosmedRefillStatusProcessing = "processing"
	sosmedRefillStatusCompleted  = "completed"
	sosmedRefillStatusFailed     = "failed"
	sosmedRefillStatusRejected   = "rejected"

	defaultSosmedOpsStaleSyncMinutes = 30
	maxSosmedOpsStaleSyncMinutes     = 1440
)

var sosmedAdminTransitionMatrix = map[string]map[string]bool{
	sosmedOrderStatusPendingPayment: {
		sosmedOrderStatusProcessing: true,
		sosmedOrderStatusFailed:     true,
		sosmedOrderStatusCanceled:   true,
		sosmedOrderStatusExpired:    true,
	},
	sosmedOrderStatusProcessing: {
		sosmedOrderStatusSuccess:  true,
		sosmedOrderStatusFailed:   true,
		sosmedOrderStatusCanceled: true,
	},
}

type SosmedOrderService struct {
	repo             *repository.SosmedOrderRepo
	serviceRepo      *repository.SosmedServiceRepo
	notifRepo        *repository.NotificationRepo
	walletRepo       *repository.WalletRepo
	japOrderProvider SosmedJAPOrderProvider
}

type SosmedJAPOrderProvider interface {
	AddOrder(ctx context.Context, input JAPAddOrderInput) (*JAPAddOrderResponse, error)
	GetOrderStatus(ctx context.Context, orderID string) (*JAPOrderStatusResponse, error)
	RequestRefill(ctx context.Context, orderID string) (*JAPRefillResponse, error)
	GetRefillStatus(ctx context.Context, refillID string) (*JAPRefillStatusResponse, error)
}

func NewSosmedOrderService(
	repo *repository.SosmedOrderRepo,
	serviceRepo *repository.SosmedServiceRepo,
	notifRepo *repository.NotificationRepo,
) *SosmedOrderService {
	return &SosmedOrderService{repo: repo, serviceRepo: serviceRepo, notifRepo: notifRepo}
}

func (s *SosmedOrderService) SetWalletRepo(walletRepo *repository.WalletRepo) *SosmedOrderService {
	s.walletRepo = walletRepo
	return s
}

func (s *SosmedOrderService) SetJAPOrderProvider(provider SosmedJAPOrderProvider) *SosmedOrderService {
	s.japOrderProvider = provider
	return s
}

type CreateSosmedOrderInput struct {
	ServiceID             string `json:"service_id" binding:"required"`
	TargetLink            string `json:"target_link"`
	Quantity              int64  `json:"quantity"`
	Notes                 string `json:"notes"`
	TargetPublicConfirmed bool   `json:"target_public_confirmed"`
}

type AdminUpdateSosmedOrderStatusInput struct {
	ToStatus     string `json:"to_status" binding:"required"`
	Reason       string `json:"reason"`
	InternalNote string `json:"internal_note"`
}

type AdminSyncSosmedProviderResult struct {
	Requested int                                 `json:"requested"`
	Synced    int                                 `json:"synced"`
	Updated   int                                 `json:"updated"`
	Failed    int                                 `json:"failed"`
	Skipped   int                                 `json:"skipped"`
	Items     []AdminSyncSosmedProviderResultItem `json:"items,omitempty"`
}

type AdminSyncSosmedProviderResultItem struct {
	OrderID         uuid.UUID `json:"order_id"`
	ServiceCode     string    `json:"service_code"`
	ProviderCode    string    `json:"provider_code"`
	ProviderOrderID string    `json:"provider_order_id"`
	ProviderStatus  string    `json:"provider_status"`
	OrderStatus     string    `json:"order_status"`
	Result          string    `json:"result"`
	Message         string    `json:"message,omitempty"`
}

type SosmedOrderDetail struct {
	Order  *model.SosmedOrder       `json:"order"`
	Events []model.SosmedOrderEvent `json:"events"`
}

func normalizeSosmedOrderStatus(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeSosmedRefillStatus(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return sosmedRefillStatusNone
	}
	return normalized
}

func isActiveSosmedRefillStatus(value string) bool {
	switch normalizeSosmedRefillStatus(value) {
	case sosmedRefillStatusRequested, sosmedRefillStatusProcessing:
		return true
	default:
		return false
	}
}

func isTerminalSosmedRefillStatus(value string) bool {
	switch normalizeSosmedRefillStatus(value) {
	case sosmedRefillStatusCompleted, sosmedRefillStatusFailed, sosmedRefillStatusRejected:
		return true
	default:
		return false
	}
}

func isSosmedJAPRefillCooldownError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	if message == "" {
		return false
	}
	cooldownSignals := []string{
		"cooldown",
		"cool down",
		"please wait",
		"try again",
		"request again",
		"before requesting refill again",
		"refill again",
		"already requested",
		"already in progress",
		"refill already",
		"refill is already",
		"refill not available yet",
		"not available yet",
		"too soon",
		"after 24",
		"after 12",
		"after 6",
		"after 1 day",
		"24 hours",
		"24 hour",
		"12 hours",
		"6 hours",
	}
	for _, signal := range cooldownSignals {
		if strings.Contains(message, signal) {
			return true
		}
	}
	return false
}

func mapSosmedJAPRefillStatus(value string) string {
	switch normalizeSosmedProviderStatus(value) {
	case "completed", "complete", "success", "delivered", "done":
		return sosmedRefillStatusCompleted
	case "rejected", "reject":
		return sosmedRefillStatusRejected
	case "failed", "fail", "canceled", "cancelled", "error":
		return sosmedRefillStatusFailed
	case "pending", "processing", "in progress", "inprogress", "queued", "queue", "active", "refilling":
		return sosmedRefillStatusProcessing
	default:
		return sosmedRefillStatusProcessing
	}
}

func isValidSosmedOrderStatus(value string) bool {
	switch normalizeSosmedOrderStatus(value) {
	case sosmedOrderStatusPendingPayment,
		sosmedOrderStatusProcessing,
		sosmedOrderStatusSuccess,
		sosmedOrderStatusFailed,
		sosmedOrderStatusCanceled,
		sosmedOrderStatusExpired:
		return true
	default:
		return false
	}
}

func normalizeSosmedOrderTargetLink(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) > 255 {
		return strings.TrimSpace(trimmed[:255])
	}
	return trimmed
}

func shortSosmedWalletRef(raw string) string {
	ref := strings.ReplaceAll(strings.TrimSpace(raw), "-", "")
	if ref == "" {
		return "-"
	}
	if len(ref) > 8 {
		ref = ref[:8]
	}
	return strings.ToUpper(ref)
}

func sosmedOrderWalletChargeRef(orderID uuid.UUID) string {
	return fmt.Sprintf("sosmed_order:%s:charge", orderID.String())
}

func sosmedOrderWalletRefundRef(orderID uuid.UUID) string {
	return fmt.Sprintf("sosmed_order:%s:refund", orderID.String())
}

func sosmedOrderWalletRetryChargeRef(orderID uuid.UUID, attempt int64) string {
	return fmt.Sprintf("sosmed_order:%s:retry:%d:charge", orderID.String(), attempt)
}

func sosmedOrderWalletRetryRefundRef(orderID uuid.UUID, attempt int64) string {
	return fmt.Sprintf("sosmed_order:%s:retry:%d:refund", orderID.String(), attempt)
}

func (s *SosmedOrderService) buildDetail(order *model.SosmedOrder) (*SosmedOrderDetail, error) {
	if order != nil {
		if created := s.ensureLegacySosmedRefillHistory(order); created {
			if fresh, err := s.repo.FindByID(order.ID); err == nil {
				order = fresh
			}
		}
	}
	events, err := s.repo.ListEventsByOrder(order.ID)
	if err != nil {
		return nil, errors.New("gagal memuat event order sosmed")
	}

	return &SosmedOrderDetail{Order: order, Events: events}, nil
}

func (s *SosmedOrderService) ensureLegacySosmedRefillHistory(order *model.SosmedOrder) bool {
	if s == nil || s.repo == nil || order == nil {
		return false
	}
	if len(order.RefillHistory) > 0 || order.RefillRequestedAt == nil {
		return false
	}
	status := normalizeSosmedRefillStatus(order.RefillStatus)
	if status == sosmedRefillStatusNone {
		return false
	}
	completedAt := order.RefillCompletedAt
	attempt := &model.SosmedOrderRefillAttempt{
		OrderID:          order.ID,
		AttemptNumber:    1,
		Status:           status,
		ProviderRefillID: strings.TrimSpace(order.RefillProviderOrderID),
		ProviderStatus:   strings.TrimSpace(order.RefillProviderStatus),
		ProviderError:    truncateSosmedProviderText(order.RefillProviderError, 2000),
		Reason:           "riwayat refill lama dari data order",
		ActorType:        "system",
		RequestedAt:      *order.RefillRequestedAt,
		CompletedAt:      completedAt,
	}
	return s.repo.DB().Create(attempt).Error == nil
}

func (s *SosmedOrderService) Create(ctx context.Context, userID uuid.UUID, input CreateSosmedOrderInput) (*SosmedOrderDetail, error) {
	serviceID, err := uuid.Parse(strings.TrimSpace(input.ServiceID))
	if err != nil {
		return nil, errors.New("service_id tidak valid")
	}

	sosmedService, err := s.serviceRepo.FindByID(serviceID)
	if err != nil {
		return nil, errors.New("layanan sosmed tidak ditemukan")
	}
	if !sosmedService.IsActive {
		return nil, errors.New("layanan sosmed sedang nonaktif")
	}
	if sosmedService.CheckoutPrice <= 0 {
		return nil, errors.New("harga checkout layanan belum dikonfigurasi")
	}

	quantity := input.Quantity
	if quantity <= 0 {
		quantity = 1
	}
	if quantity > 1000 {
		return nil, errors.New("quantity terlalu besar")
	}

	targetLink := normalizeSosmedOrderTargetLink(input.TargetLink)
	if targetLink == "" {
		return nil, errors.New("target link/username wajib diisi")
	}
	if !input.TargetPublicConfirmed {
		return nil, errors.New("konfirmasi dulu kalau akun/link target sudah public, aktif, dan tidak akan diubah sampai order selesai")
	}

	totalPriceFloat := float64(sosmedService.CheckoutPrice) * float64(quantity)
	if totalPriceFloat > math.MaxInt64 {
		return nil, errors.New("harga order melebihi batas sistem")
	}
	totalPrice := int64(totalPriceFloat)

	if s.walletRepo != nil {
		return s.createWalletPaidOrder(ctx, userID, sosmedService, targetLink, quantity, totalPrice, input)
	}

	return s.createPendingPaymentOrder(userID, sosmedService, targetLink, quantity, totalPrice, input)
}

func (s *SosmedOrderService) createPendingPaymentOrder(
	userID uuid.UUID,
	sosmedService *model.SosmedService,
	targetLink string,
	quantity int64,
	totalPrice int64,
	input CreateSosmedOrderInput,
) (*SosmedOrderDetail, error) {
	now := time.Now()
	expiresAt := now.Add(60 * time.Minute)
	order := &model.SosmedOrder{
		ID:            uuid.New(),
		UserID:        userID,
		ServiceID:     sosmedService.ID,
		ServiceCode:   strings.TrimSpace(sosmedService.Code),
		ServiceTitle:  strings.TrimSpace(sosmedService.Title),
		TargetLink:    targetLink,
		Quantity:      quantity,
		UnitPrice:     sosmedService.CheckoutPrice,
		TotalPrice:    totalPrice,
		PaymentStatus: "pending",
		OrderStatus:   sosmedOrderStatusPendingPayment,
		Notes:         strings.TrimSpace(input.Notes),
		ExpiresAt:     &expiresAt,
	}

	populateSosmedOrderRefill(order, sosmedService)

	if err := s.repo.Create(order); err != nil {
		return nil, errors.New("gagal membuat order sosmed")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: "",
		ToStatus:   sosmedOrderStatusPendingPayment,
		Reason:     "order dibuat",
		ActorType:  "user",
		ActorID:    &userID,
		CreatedAt:  now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return nil, errors.New("gagal mencatat event order sosmed")
	}

	stored, err := s.repo.FindByID(order.ID)
	if err != nil {
		return nil, errors.New("gagal memuat order sosmed")
	}
	return s.buildDetail(stored)
}

func (s *SosmedOrderService) createWalletPaidOrder(
	ctx context.Context,
	userID uuid.UUID,
	sosmedService *model.SosmedService,
	targetLink string,
	quantity int64,
	totalPrice int64,
	input CreateSosmedOrderInput,
) (*SosmedOrderDetail, error) {
	orderID := uuid.New()
	chargeRef := sosmedOrderWalletChargeRef(orderID)
	now := time.Now()

	order := &model.SosmedOrder{
		ID:                orderID,
		UserID:            userID,
		ServiceID:         sosmedService.ID,
		ServiceCode:       strings.TrimSpace(sosmedService.Code),
		ServiceTitle:      strings.TrimSpace(sosmedService.Title),
		TargetLink:        targetLink,
		Quantity:          quantity,
		UnitPrice:         sosmedService.CheckoutPrice,
		TotalPrice:        totalPrice,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusProcessing,
		ProviderCode:      strings.TrimSpace(sosmedService.ProviderCode),
		ProviderServiceID: strings.TrimSpace(sosmedService.ProviderServiceID),
		ProviderStatus:    "queued",
		Notes:             strings.TrimSpace(input.Notes),
		PaidAt:            &now,
	}

	populateSosmedOrderRefill(order, sosmedService)

	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}

		user, err := s.walletRepo.LockUserByIDTx(tx, userID)
		if err != nil {
			return errors.New("user tidak ditemukan")
		}
		if !user.IsActive {
			return errors.New("akun diblokir")
		}

		if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, chargeRef); err == nil {
			return errors.New("transaksi wallet sosmed sudah diproses")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("gagal cek ledger wallet")
		}

		if user.WalletBalance < totalPrice {
			return errors.New("saldo wallet tidak cukup")
		}

		before := user.WalletBalance
		after := before - totalPrice
		user.WalletBalance = after
		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return errors.New("gagal update saldo wallet")
		}

		if err := tx.Create(order).Error; err != nil {
			return errors.New("gagal membuat order sosmed")
		}

		ledger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "debit",
			Category:      "sosmed_purchase",
			Amount:        totalPrice,
			BalanceBefore: before,
			BalanceAfter:  after,
			Reference:     chargeRef,
			Description:   fmt.Sprintf("Pembelian layanan sosmed order %s via wallet", shortSosmedWalletRef(orderID.String())),
		}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger wallet")
		}

		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: "",
			ToStatus:   sosmedOrderStatusProcessing,
			Reason:     "order dibuat dan dibayar via wallet",
			ActorType:  "user",
			ActorID:    &userID,
			CreatedAt:  now,
		}
		if err := tx.Create(event).Error; err != nil {
			return errors.New("gagal mencatat event order sosmed")
		}

		if s.notifRepo != nil {
			notif := &model.Notification{
				UserID:  user.ID,
				Title:   "Pembayaran Sosmed Berhasil",
				Message: fmt.Sprintf("Saldo wallet untuk order sosmed %s berhasil dipotong. Order masuk antrean proses.", shortSosmedWalletRef(orderID.String())),
				Type:    "order",
			}
			if err := tx.Create(notif).Error; err != nil {
				return errors.New("gagal membuat notifikasi")
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	if isJAPSosmedOrder(order) {
		if err := s.fulfillJAPOrder(ctx, order.ID); err != nil {
			return nil, err
		}
	}

	stored, err := s.repo.FindByID(order.ID)
	if err != nil {
		return nil, errors.New("gagal memuat order sosmed")
	}
	return s.buildDetail(stored)
}

func isJAPSosmedOrder(order *model.SosmedOrder) bool {
	if order == nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(order.ProviderCode), "jap") && strings.TrimSpace(order.ProviderServiceID) != ""
}

// populateSosmedOrderRefill sets refill tracking fields on a new order
// based on the associated service metadata. Call this right after building
// the order struct in both the wallet-paid and pending-payment checkout paths.
func populateSosmedOrderRefill(order *model.SosmedOrder, svc *model.SosmedService) {
	if order == nil || svc == nil {
		return
	}

	// Determine eligibility: the service must flag provider_refill_supported=true
	// OR have a parseable refill period string (e.g. "30 Hari").
	periodDays := parseSosmedRefillPeriodDays(svc.Refill)
	eligible := svc.ProviderRefillSupported || periodDays > 0

	order.RefillEligible = eligible
	order.RefillStatus = sosmedRefillStatusNone

	if eligible && periodDays > 0 {
		order.RefillPeriodDays = periodDays
		deadline := time.Now().Add(time.Duration(periodDays) * 24 * time.Hour)
		order.RefillDeadline = &deadline
	}
}

func (s *SosmedOrderService) fulfillJAPOrder(ctx context.Context, orderID uuid.UUID) error {
	if s.japOrderProvider == nil {
		return s.failAndRefundWalletOrder(orderID, "failed", "konfigurasi JAP order provider belum siap", "")
	}

	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return errors.New("order sosmed tidak ditemukan")
	}
	if !isJAPSosmedOrder(order) {
		return nil
	}
	if strings.TrimSpace(order.ProviderOrderID) != "" {
		return nil
	}
	if order.PaymentStatus != "paid" {
		return errors.New("order sosmed belum dibayar")
	}
	if order.TargetLink == "" {
		return s.failAndRefundWalletOrder(orderID, "failed", "target link/username kosong", "")
	}

	providerQuantity := order.Quantity * 1000
	requestPayload := map[string]any{
		"provider":     "jap",
		"action":       "add",
		"service":      order.ProviderServiceID,
		"link":         order.TargetLink,
		"quantity":     providerQuantity,
		"local_order":  order.ID.String(),
		"service_code": order.ServiceCode,
	}
	rawRequest, _ := json.Marshal(requestPayload)

	res, err := s.japOrderProvider.AddOrder(ctx, JAPAddOrderInput{
		ServiceID: order.ProviderServiceID,
		Link:      order.TargetLink,
		Quantity:  providerQuantity,
	})
	if err != nil {
		return s.failAndRefundWalletOrder(orderID, "failed", fmt.Sprintf("gagal kirim order ke JAP: %v", err), string(rawRequest))
	}

	providerOrderID := strings.TrimSpace(string(res.Order))
	if providerOrderID == "" {
		return s.failAndRefundWalletOrder(orderID, "failed", "response JAP tidak berisi provider order id", string(rawRequest))
	}

	responsePayload := map[string]any{
		"request":           requestPayload,
		"provider_order_id": providerOrderID,
	}
	rawPayload, _ := json.Marshal(responsePayload)

	now := time.Now()
	previousStatus := order.OrderStatus
	order.ProviderOrderID = providerOrderID
	order.ProviderStatus = "submitted"
	order.ProviderPayload = string(rawPayload)
	order.ProviderError = ""
	order.OrderStatus = sosmedOrderStatusProcessing
	if err := s.repo.Update(order); err != nil {
		return errors.New("gagal menyimpan provider order JAP")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: previousStatus,
		ToStatus:   sosmedOrderStatusProcessing,
		Reason:     fmt.Sprintf("order dikirim ke JAP #%s", providerOrderID),
		ActorType:  "system",
		CreatedAt:  now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return errors.New("gagal mencatat event provider JAP")
	}

	return nil
}

func (s *SosmedOrderService) failAndRefundWalletOrder(orderID uuid.UUID, providerStatus, providerError, providerPayload string) error {
	if s.walletRepo == nil {
		return errors.New(providerError)
	}

	refunded := false
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		var order model.SosmedOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&order, "id = ?", orderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("order sosmed tidak ditemukan")
			}
			return errors.New("gagal memuat order sosmed")
		}

		previousStatus := order.OrderStatus
		order.ProviderStatus = strings.TrimSpace(providerStatus)
		order.ProviderError = truncateSosmedProviderText(providerError, 2000)
		order.ProviderPayload = truncateSosmedProviderText(providerPayload, 4000)
		order.OrderStatus = sosmedOrderStatusFailed

		if strings.EqualFold(strings.TrimSpace(order.PaymentMethod), "wallet") && order.PaymentStatus == "paid" {
			refundRef := sosmedOrderWalletRefundRef(order.ID)
			if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, refundRef); err == nil {
				order.PaymentStatus = "failed"
				if err := tx.Save(&order).Error; err != nil {
					return errors.New("gagal update order sosmed")
				}
				return nil
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("gagal cek ledger refund wallet")
			}

			chargeLedger, err := s.walletRepo.FindLedgerByReferenceTx(tx, sosmedOrderWalletChargeRef(order.ID))
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.New("ledger debit wallet sosmed tidak ditemukan")
				}
				return errors.New("gagal cek ledger debit wallet")
			}
			if chargeLedger.Amount <= 0 {
				return errors.New("nominal refund sosmed tidak valid")
			}

			user, err := s.walletRepo.LockUserByIDTx(tx, order.UserID)
			if err != nil {
				return errors.New("user tidak ditemukan")
			}

			before := user.WalletBalance
			after := before + chargeLedger.Amount
			user.WalletBalance = after
			if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
				return errors.New("gagal refund saldo wallet")
			}

			ledger := &model.WalletLedger{
				ID:            uuid.New(),
				UserID:        user.ID,
				Type:          "credit",
				Category:      "sosmed_refund",
				Amount:        chargeLedger.Amount,
				BalanceBefore: before,
				BalanceAfter:  after,
				Reference:     refundRef,
				Description:   fmt.Sprintf("Refund otomatis order sosmed %s karena gagal dikirim ke supplier", shortSosmedWalletRef(order.ID.String())),
			}
			if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
				return errors.New("gagal menulis ledger refund wallet")
			}

			order.PaymentStatus = "failed"
			refunded = true
		}

		if err := tx.Save(&order).Error; err != nil {
			return errors.New("gagal update order sosmed")
		}

		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: previousStatus,
			ToStatus:   sosmedOrderStatusFailed,
			Reason:     truncateSosmedProviderText(providerError, 1000),
			ActorType:  "system",
			CreatedAt:  time.Now(),
		}
		if err := tx.Create(event).Error; err != nil {
			return errors.New("gagal mencatat event gagal sosmed")
		}

		return nil
	})
	if err != nil {
		return err
	}

	if refunded {
		return errors.New("order gagal dikirim ke supplier, saldo wallet sudah direfund")
	}
	return errors.New(providerError)
}

func truncateSosmedProviderText(value string, max int) string {
	trimmed := strings.TrimSpace(value)
	if max <= 0 || len(trimmed) <= max {
		return trimmed
	}
	return strings.TrimSpace(trimmed[:max])
}

func normalizeSosmedProviderStatus(value string) string {
	fields := strings.Fields(strings.ToLower(strings.TrimSpace(value)))
	return strings.Join(fields, " ")
}

func humanizeSosmedProviderStatus(value string) string {
	normalized := normalizeSosmedProviderStatus(value)
	if normalized == "" {
		return "status provider kosong"
	}
	return normalized
}

func mapSosmedProviderOrderStatus(currentOrderStatus, providerStatus string) string {
	if normalizeSosmedOrderStatus(currentOrderStatus) != sosmedOrderStatusProcessing {
		return normalizeSosmedOrderStatus(currentOrderStatus)
	}

	switch normalizeSosmedProviderStatus(providerStatus) {
	case "completed", "complete", "success", "delivered":
		return sosmedOrderStatusSuccess
	case "partial", "partially completed", "partial completed", "failed", "fail", "canceled", "cancelled", "error":
		return sosmedOrderStatusFailed
	case "pending", "processing", "in progress", "inprogress", "queued", "queue", "active", "refilling":
		return sosmedOrderStatusProcessing
	default:
		return sosmedOrderStatusProcessing
	}
}

func buildSosmedProviderSyncPayload(order *model.SosmedOrder, response *JAPOrderStatusResponse) string {
	payload := map[string]any{
		"provider":          "jap",
		"action":            "status",
		"local_order_id":    "",
		"provider_order_id": "",
		"response":          response,
	}
	if order != nil {
		payload["local_order_id"] = order.ID.String()
		payload["provider_order_id"] = order.ProviderOrderID
		payload["service_code"] = order.ServiceCode
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}

func (s *SosmedOrderService) syncJAPProviderOrder(ctx context.Context, order *model.SosmedOrder, actorType string, actorID *uuid.UUID) (*model.SosmedOrder, bool, error) {
	if s.japOrderProvider == nil {
		return nil, false, errors.New("konfigurasi JAP order provider belum siap")
	}
	if order == nil {
		return nil, false, errors.New("order sosmed tidak ditemukan")
	}
	if !isJAPSosmedOrder(order) {
		return nil, false, errors.New("order ini bukan order supplier JAP")
	}
	if strings.TrimSpace(order.ProviderOrderID) == "" {
		return nil, false, errors.New("provider order id belum tersedia")
	}

	syncedAt := time.Now()
	providerRes, err := s.japOrderProvider.GetOrderStatus(ctx, order.ProviderOrderID)
	if err != nil {
		order.ProviderError = truncateSosmedProviderText(err.Error(), 2000)
		order.ProviderSyncedAt = &syncedAt
		if saveErr := s.repo.Update(order); saveErr != nil {
			return nil, false, errors.New("gagal menyimpan error sync provider")
		}
		return nil, false, err
	}

	providerStatus := strings.TrimSpace(providerRes.Status)
	previousOrderStatus := normalizeSosmedOrderStatus(order.OrderStatus)
	previousProviderStatus := strings.TrimSpace(order.ProviderStatus)
	previousRefillStatus := normalizeSosmedRefillStatus(order.RefillStatus)
	previousRefillProviderStatus := strings.TrimSpace(order.RefillProviderStatus)
	nextOrderStatus := mapSosmedProviderOrderStatus(previousOrderStatus, providerStatus)

	order.ProviderStatus = providerStatus
	order.ProviderPayload = truncateSosmedProviderText(buildSosmedProviderSyncPayload(order, providerRes), 4000)
	order.ProviderError = ""
	order.ProviderSyncedAt = &syncedAt
	order.OrderStatus = nextOrderStatus

	refillChanged := false
	refillSyncErrText := ""
	if isActiveSosmedRefillStatus(order.RefillStatus) && strings.TrimSpace(order.RefillProviderOrderID) != "" {
		refillRes, refillErr := s.japOrderProvider.GetRefillStatus(ctx, order.RefillProviderOrderID)
		if refillErr != nil {
			refillSyncErrText = truncateSosmedProviderText(refillErr.Error(), 1000)
			order.RefillProviderError = truncateSosmedProviderText(refillErr.Error(), 2000)
		} else {
			nextRefillProviderStatus := strings.TrimSpace(refillRes.Status)
			nextRefillStatus := mapSosmedJAPRefillStatus(nextRefillProviderStatus)

			order.RefillProviderStatus = nextRefillProviderStatus
			order.RefillProviderError = ""
			order.RefillStatus = nextRefillStatus
			if nextRefillStatus == sosmedRefillStatusCompleted && order.RefillCompletedAt == nil {
				order.RefillCompletedAt = &syncedAt
			}

			refillChanged = previousRefillStatus != nextRefillStatus || previousRefillProviderStatus != nextRefillProviderStatus
		}
	}

	if err := s.repo.Update(order); err != nil {
		return nil, false, errors.New("gagal menyimpan sync status provider")
	}

	statusChanged := previousOrderStatus != nextOrderStatus
	providerChanged := previousProviderStatus != providerStatus
	if statusChanged || providerChanged {
		reason := fmt.Sprintf("sync JAP: provider status %s", humanizeSosmedProviderStatus(providerStatus))
		if statusChanged {
			reason = fmt.Sprintf("%s, order jadi %s", reason, nextOrderStatus)
		}

		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: previousOrderStatus,
			ToStatus:   nextOrderStatus,
			Reason:     reason,
			ActorType:  strings.TrimSpace(actorType),
			ActorID:    actorID,
			CreatedAt:  syncedAt,
		}
		if err := s.repo.CreateEvent(event); err != nil {
			return nil, false, errors.New("gagal mencatat event sync provider")
		}
	}

	if refillChanged || refillSyncErrText != "" {
		reason := "sync refill JAP"
		if refillSyncErrText != "" {
			reason = fmt.Sprintf("%s gagal: %s", reason, refillSyncErrText)
		} else {
			reason = fmt.Sprintf("%s: provider status %s, refill jadi %s", reason, humanizeSosmedProviderStatus(order.RefillProviderStatus), order.RefillStatus)
		}
		if err := s.updateLatestSosmedRefillHistory(order, syncedAt, reason); err != nil {
			return nil, false, errors.New("gagal memperbarui riwayat refill")
		}

		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: previousRefillStatus,
			ToStatus:   order.RefillStatus,
			Reason:     reason,
			ActorType:  strings.TrimSpace(actorType),
			ActorID:    actorID,
			CreatedAt:  syncedAt,
		}
		if err := s.repo.CreateEvent(event); err != nil {
			return nil, false, errors.New("gagal mencatat event sync refill")
		}
	}

	stored, err := s.repo.FindByID(order.ID)
	if err != nil {
		return nil, false, errors.New("gagal memuat order sosmed hasil sync")
	}

	return stored, statusChanged || providerChanged || refillChanged, nil
}

func (s *SosmedOrderService) GetByID(id, userID uuid.UUID) (*SosmedOrderDetail, error) {
	order, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("order sosmed tidak ditemukan")
	}
	if order.UserID != userID {
		return nil, errors.New("akses ditolak")
	}
	return s.buildDetail(order)
}

func (s *SosmedOrderService) ListByUser(userID uuid.UUID, page, limit int) ([]model.SosmedOrder, int64, error) {
	orders, total, err := s.repo.FindByUserID(userID, page, limit)
	if err != nil {
		return orders, total, err
	}

	for idx := range orders {
		if synced := s.syncActiveJAPRefillStatusForUserList(&orders[idx]); synced != nil {
			orders[idx] = *synced
		}
		if created := s.ensureLegacySosmedRefillHistory(&orders[idx]); created {
			if fresh, err := s.repo.FindByID(orders[idx].ID); err == nil {
				orders[idx] = *fresh
			}
		}
	}

	return orders, total, nil
}

func (s *SosmedOrderService) syncActiveJAPRefillStatusForUserList(order *model.SosmedOrder) *model.SosmedOrder {
	if s == nil || s.japOrderProvider == nil || order == nil {
		return nil
	}
	if !isJAPSosmedOrder(order) || !isActiveSosmedRefillStatus(order.RefillStatus) {
		return nil
	}
	if strings.TrimSpace(order.RefillProviderOrderID) == "" {
		return nil
	}

	previousRefillStatus := normalizeSosmedRefillStatus(order.RefillStatus)
	previousRefillProviderStatus := strings.TrimSpace(order.RefillProviderStatus)
	now := time.Now()
	refillRes, err := s.japOrderProvider.GetRefillStatus(context.Background(), order.RefillProviderOrderID)
	if err != nil {
		order.RefillProviderError = truncateSosmedProviderText(err.Error(), 2000)
		if saveErr := s.repo.Update(order); saveErr != nil {
			return nil
		}
		stored, loadErr := s.repo.FindByID(order.ID)
		if loadErr != nil {
			return order
		}
		return stored
	}

	nextRefillProviderStatus := strings.TrimSpace(refillRes.Status)
	if nextRefillProviderStatus == "" {
		return nil
	}
	nextRefillStatus := mapSosmedJAPRefillStatus(nextRefillProviderStatus)
	order.RefillProviderStatus = nextRefillProviderStatus
	order.RefillProviderError = ""
	order.RefillStatus = nextRefillStatus
	if nextRefillStatus == sosmedRefillStatusCompleted && order.RefillCompletedAt == nil {
		order.RefillCompletedAt = &now
	}

	refillChanged := previousRefillStatus != nextRefillStatus || previousRefillProviderStatus != nextRefillProviderStatus
	if err := s.repo.Update(order); err != nil {
		return nil
	}
	if refillChanged {
		reason := fmt.Sprintf("sync refill JAP saat user buka order: provider status %s, refill jadi %s", humanizeSosmedProviderStatus(order.RefillProviderStatus), order.RefillStatus)
		_ = s.updateLatestSosmedRefillHistory(order, now, reason)
		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: previousRefillStatus,
			ToStatus:   order.RefillStatus,
			Reason:     reason,
			ActorType:  "system",
			CreatedAt:  now,
		}
		_ = s.repo.CreateEvent(event)
	}

	stored, loadErr := s.repo.FindByID(order.ID)
	if loadErr != nil {
		return order
	}
	return stored
}

func (s *SosmedOrderService) Cancel(id, userID uuid.UUID) error {
	order, err := s.repo.FindByID(id)
	if err != nil {
		return errors.New("order sosmed tidak ditemukan")
	}
	if order.UserID != userID {
		return errors.New("akses ditolak")
	}
	if order.PaymentStatus != "pending" || order.OrderStatus != sosmedOrderStatusPendingPayment {
		return errors.New("order tidak bisa dibatalkan")
	}

	previousStatus := order.OrderStatus
	now := time.Now()
	order.PaymentStatus = "failed"
	order.OrderStatus = sosmedOrderStatusCanceled
	if err := s.repo.Update(order); err != nil {
		return errors.New("gagal membatalkan order sosmed")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: previousStatus,
		ToStatus:   sosmedOrderStatusCanceled,
		Reason:     "dibatalkan user",
		ActorType:  "user",
		ActorID:    &userID,
		CreatedAt:  now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return errors.New("gagal mencatat event cancel")
	}

	return nil
}

func isSosmedSupplierRejectedRefillUnavailable(order *model.SosmedOrder) bool {
	if order == nil {
		return false
	}
	return isJAPSosmedOrder(order) &&
		normalizeSosmedRefillStatus(order.RefillStatus) == sosmedRefillStatusRejected &&
		strings.EqualFold(strings.TrimSpace(order.RefillProviderStatus), "rejected") &&
		strings.TrimSpace(order.RefillProviderOrderID) != ""
}

func canUserRequestSosmedRefill(order *model.SosmedOrder, now time.Time) error {
	if order == nil {
		return errors.New("order sosmed tidak ditemukan")
	}
	if !order.RefillEligible {
		return errors.New("order ini tidak memiliki garansi refill")
	}
	if order.OrderStatus != sosmedOrderStatusSuccess {
		return errors.New("refill hanya bisa diklaim untuk order yang sudah sukses")
	}
	if order.RefillDeadline == nil || order.RefillPeriodDays <= 0 {
		return errors.New("periode garansi refill belum dikonfigurasi, hubungi admin")
	}
	if now.After(*order.RefillDeadline) {
		return errors.New("periode garansi refill sudah habis")
	}
	if isSosmedSupplierRejectedRefillUnavailable(order) {
		return errors.New("refill dari supplier belum tersedia, tunggu update sistem atau hubungi admin")
	}
	if isActiveSosmedRefillStatus(order.RefillStatus) {
		return errors.New("refill sedang diproses, tunggu sampai selesai")
	}
	if strings.TrimSpace(order.ProviderOrderID) == "" {
		return errors.New("order belum memiliki provider order ID untuk refill")
	}
	if !isJAPSosmedOrder(order) {
		return errors.New("refill hanya tersedia untuk order supplier JAP")
	}
	return nil
}

type sosmedRefillRequestOptions struct {
	orderID         uuid.UUID
	actorID         uuid.UUID
	actorType       string
	ownerID         *uuid.UUID
	enforceDeadline bool
}

func (s *SosmedOrderService) reserveSosmedRefillRequest(ctx context.Context, opts sosmedRefillRequestOptions) (*model.SosmedOrder, error) {
	if s.repo == nil {
		return nil, errors.New("repo order sosmed belum siap")
	}

	now := time.Now()
	var order model.SosmedOrder
	db := s.repo.DB()
	if ctx != nil {
		db = db.WithContext(ctx)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("User").
			Preload("Service").
			First(&order, "id = ?", opts.orderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("order sosmed tidak ditemukan")
			}
			return errors.New("gagal memuat order sosmed")
		}

		if opts.ownerID != nil && order.UserID != *opts.ownerID {
			return errors.New("akses ditolak")
		}
		if opts.actorType == "user" {
			if err := canUserRequestSosmedRefill(&order, now); err != nil {
				return err
			}
		}
		if !order.RefillEligible {
			return errors.New("order ini tidak memiliki garansi refill")
		}
		if order.OrderStatus != sosmedOrderStatusSuccess {
			return errors.New("refill hanya bisa diklaim untuk order yang sudah sukses")
		}
		if opts.enforceDeadline {
			if order.RefillDeadline == nil || order.RefillPeriodDays <= 0 {
				return errors.New("periode garansi refill belum dikonfigurasi, hubungi admin")
			}
			if now.After(*order.RefillDeadline) {
				return errors.New("periode garansi refill sudah habis")
			}
		}
		if isActiveSosmedRefillStatus(order.RefillStatus) {
			isAdminCooldownRetry := opts.actorType == "admin" &&
				strings.EqualFold(strings.TrimSpace(order.RefillProviderStatus), "cooldown") &&
				strings.TrimSpace(order.RefillProviderOrderID) == ""
			if !isAdminCooldownRetry {
				return errors.New("refill sedang diproses, tunggu sampai selesai")
			}
		}

		providerOrderID := strings.TrimSpace(order.ProviderOrderID)
		if providerOrderID == "" {
			return errors.New("order belum memiliki provider order ID untuk refill")
		}
		if !isJAPSosmedOrder(&order) {
			return errors.New("refill hanya tersedia untuk order supplier JAP")
		}

		previousRefillStatus := normalizeSosmedRefillStatus(order.RefillStatus)
		order.RefillStatus = sosmedRefillStatusProcessing
		order.RefillProviderOrderID = ""
		order.RefillProviderStatus = "queued"
		order.RefillProviderError = ""
		order.RefillRequestedAt = &now
		if err := tx.Save(&order).Error; err != nil {
			return errors.New("gagal mengunci status refill")
		}

		attemptNumber, err := s.repo.NextRefillAttemptNumberTx(tx, order.ID)
		if err != nil {
			return errors.New("gagal menyiapkan riwayat refill")
		}
		attempt := &model.SosmedOrderRefillAttempt{
			OrderID:        order.ID,
			AttemptNumber:  attemptNumber,
			Status:         sosmedRefillStatusProcessing,
			ProviderStatus: "queued",
			Reason:         fmt.Sprintf("refill diklaim untuk dikirim ke JAP #%s", providerOrderID),
			ActorType:      strings.TrimSpace(opts.actorType),
			ActorID:        &opts.actorID,
			RequestedAt:    now,
		}
		if err := tx.Create(attempt).Error; err != nil {
			return errors.New("gagal mencatat riwayat refill")
		}

		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: previousRefillStatus,
			ToStatus:   sosmedRefillStatusProcessing,
			Reason:     fmt.Sprintf("refill dikunci untuk dikirim ke JAP #%s", providerOrderID),
			ActorType:  strings.TrimSpace(opts.actorType),
			ActorID:    &opts.actorID,
			CreatedAt:  now,
		}
		if err := tx.Create(event).Error; err != nil {
			return errors.New("gagal mencatat event kunci refill")
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return &order, nil
}

func (s *SosmedOrderService) updateLatestSosmedRefillHistory(order *model.SosmedOrder, when time.Time, reason string) error {
	if s == nil || s.repo == nil || order == nil {
		return nil
	}
	db := s.repo.DB()
	return db.Transaction(func(tx *gorm.DB) error {
		attempt, err := s.repo.FindLatestRefillAttemptTx(tx, order.ID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				attemptNumber, nextErr := s.repo.NextRefillAttemptNumberTx(tx, order.ID)
				if nextErr != nil {
					return nextErr
				}
				requestedAt := when
				if order.RefillRequestedAt != nil {
					requestedAt = *order.RefillRequestedAt
				}
				attempt = &model.SosmedOrderRefillAttempt{
					OrderID:       order.ID,
					AttemptNumber: attemptNumber,
					ActorType:     "system",
					RequestedAt:   requestedAt,
				}
			} else {
				return err
			}
		}

		attempt.Status = normalizeSosmedRefillStatus(order.RefillStatus)
		attempt.ProviderRefillID = strings.TrimSpace(order.RefillProviderOrderID)
		attempt.ProviderStatus = strings.TrimSpace(order.RefillProviderStatus)
		attempt.ProviderError = truncateSosmedProviderText(order.RefillProviderError, 2000)
		attempt.Reason = strings.TrimSpace(reason)
		if attempt.RequestedAt.IsZero() {
			attempt.RequestedAt = when
		}
		if isTerminalSosmedRefillStatus(attempt.Status) && attempt.CompletedAt == nil {
			attempt.CompletedAt = &when
		}
		if attempt.ID == uuid.Nil {
			return tx.Create(attempt).Error
		}
		return tx.Save(attempt).Error
	})
}

func (s *SosmedOrderService) finalizeSosmedRefillRequest(
	ctx context.Context,
	orderID uuid.UUID,
	actorID uuid.UUID,
	actorType string,
	nextStatus string,
	refillID string,
	providerStatus string,
	providerError string,
	reason string,
) (*model.SosmedOrder, error) {
	now := time.Now()
	var order model.SosmedOrder
	db := s.repo.DB()
	if ctx != nil {
		db = db.WithContext(ctx)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("User").
			Preload("Service").
			First(&order, "id = ?", orderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("order sosmed tidak ditemukan")
			}
			return errors.New("gagal memuat order sosmed")
		}

		previousRefillStatus := normalizeSosmedRefillStatus(order.RefillStatus)
		order.RefillStatus = normalizeSosmedRefillStatus(nextStatus)
		order.RefillProviderOrderID = strings.TrimSpace(refillID)
		order.RefillProviderStatus = strings.TrimSpace(providerStatus)
		order.RefillProviderError = truncateSosmedProviderText(providerError, 2000)
		if order.RefillRequestedAt == nil {
			order.RefillRequestedAt = &now
		}
		if order.RefillStatus == sosmedRefillStatusCompleted && order.RefillCompletedAt == nil {
			order.RefillCompletedAt = &now
		}

		if err := tx.Save(&order).Error; err != nil {
			return errors.New("gagal menyimpan status refill")
		}

		attempt, attemptErr := s.repo.FindLatestRefillAttemptTx(tx, order.ID)
		if attemptErr != nil {
			if errors.Is(attemptErr, gorm.ErrRecordNotFound) {
				attemptNumber, nextErr := s.repo.NextRefillAttemptNumberTx(tx, order.ID)
				if nextErr != nil {
					return errors.New("gagal menyiapkan riwayat refill")
				}
				attempt = &model.SosmedOrderRefillAttempt{
					OrderID:       order.ID,
					AttemptNumber: attemptNumber,
					ActorType:     strings.TrimSpace(actorType),
					ActorID:       &actorID,
					RequestedAt:   now,
				}
			} else {
				return errors.New("gagal memuat riwayat refill")
			}
		}
		attempt.Status = order.RefillStatus
		attempt.ProviderRefillID = strings.TrimSpace(refillID)
		attempt.ProviderStatus = strings.TrimSpace(providerStatus)
		attempt.ProviderError = truncateSosmedProviderText(providerError, 2000)
		attempt.Reason = strings.TrimSpace(reason)
		if attempt.RequestedAt.IsZero() {
			attempt.RequestedAt = now
		}
		if isTerminalSosmedRefillStatus(order.RefillStatus) && attempt.CompletedAt == nil {
			attempt.CompletedAt = &now
		}
		if attempt.ID == uuid.Nil {
			if err := tx.Create(attempt).Error; err != nil {
				return errors.New("gagal mencatat riwayat refill")
			}
		} else if err := tx.Save(attempt).Error; err != nil {
			return errors.New("gagal menyimpan riwayat refill")
		}

		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: previousRefillStatus,
			ToStatus:   order.RefillStatus,
			Reason:     strings.TrimSpace(reason),
			ActorType:  strings.TrimSpace(actorType),
			ActorID:    &actorID,
			CreatedAt:  now,
		}
		if event.Reason == "" {
			event.Reason = fmt.Sprintf("status refill berubah ke %s", order.RefillStatus)
		}
		if err := tx.Create(event).Error; err != nil {
			return errors.New("gagal mencatat event refill")
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return &order, nil
}

func (s *SosmedOrderService) requestSosmedRefill(ctx context.Context, opts sosmedRefillRequestOptions) (*SosmedOrderDetail, error) {
	if s.japOrderProvider == nil {
		return nil, errors.New("konfigurasi JAP provider belum siap")
	}

	order, err := s.reserveSosmedRefillRequest(ctx, opts)
	if err != nil {
		return nil, err
	}

	providerOrderID := strings.TrimSpace(order.ProviderOrderID)
	refillRes, err := s.japOrderProvider.RequestRefill(ctx, providerOrderID)
	if err != nil {
		if isSosmedJAPRefillCooldownError(err) {
			reason := fmt.Sprintf("refill menunggu cooldown JAP: %v", err)
			if opts.actorType == "admin" {
				reason = fmt.Sprintf("admin refill menunggu cooldown JAP: %v", err)
			}
			stored, finalizeErr := s.finalizeSosmedRefillRequest(ctx, order.ID, opts.actorID, opts.actorType, sosmedRefillStatusProcessing, "", "cooldown", err.Error(), reason)
			if finalizeErr != nil {
				return nil, finalizeErr
			}
			fresh, findErr := s.repo.FindByID(stored.ID)
			if findErr != nil {
				return nil, errors.New("gagal memuat order sosmed")
			}
			return s.buildDetail(fresh)
		}

		reason := fmt.Sprintf("refill gagal dikirim ke JAP: %v", err)
		if opts.actorType == "admin" {
			reason = fmt.Sprintf("admin refill gagal dikirim ke JAP: %v", err)
		}
		_, _ = s.finalizeSosmedRefillRequest(ctx, order.ID, opts.actorID, opts.actorType, sosmedRefillStatusFailed, "", "failed", err.Error(), reason)
		if opts.actorType == "user" {
			return nil, errors.New("gagal mengirim refill ke supplier, coba lagi nanti atau hubungi admin")
		}
		return nil, fmt.Errorf("gagal mengirim refill ke supplier: %v", err)
	}

	refillID := ""
	if refillRes != nil {
		refillID = strings.TrimSpace(string(refillRes.Refill))
	}
	if refillID == "" {
		err := errors.New("response refill JAP tidak berisi refill id")
		_, _ = s.finalizeSosmedRefillRequest(ctx, order.ID, opts.actorID, opts.actorType, sosmedRefillStatusFailed, "", "failed", err.Error(), err.Error())
		if opts.actorType == "user" {
			return nil, errors.New("gagal mengirim refill ke supplier, coba lagi nanti atau hubungi admin")
		}
		return nil, err
	}

	reason := fmt.Sprintf("refill diklaim oleh user ke JAP #%s, refill #%s", providerOrderID, refillID)
	if opts.actorType == "admin" {
		reason = fmt.Sprintf("refill di-trigger admin ke JAP #%s, refill #%s", providerOrderID, refillID)
	}
	stored, err := s.finalizeSosmedRefillRequest(ctx, order.ID, opts.actorID, opts.actorType, sosmedRefillStatusRequested, refillID, "submitted", "", reason)
	if err != nil {
		return nil, err
	}

	if s.notifRepo != nil {
		title := "Klaim Refill Dikirim"
		message := fmt.Sprintf("Permintaan refill untuk order %s sudah dikirim ke supplier. Proses refill sedang berjalan.", shortSosmedWalletRef(order.ID.String()))
		if opts.actorType == "admin" {
			title = "Refill Dikirim oleh Admin"
			message = fmt.Sprintf("Permintaan refill untuk order %s sudah dikirim oleh admin ke supplier.", shortSosmedWalletRef(order.ID.String()))
		}
		_ = s.notifRepo.Create(&model.Notification{
			UserID:  stored.UserID,
			Title:   title,
			Message: message,
			Type:    "order",
		})
	}

	fresh, err := s.repo.FindByID(stored.ID)
	if err != nil {
		return nil, errors.New("gagal memuat order sosmed")
	}
	return s.buildDetail(fresh)
}

func (s *SosmedOrderService) UserRequestRefill(ctx context.Context, orderID, userID uuid.UUID) (*SosmedOrderDetail, error) {
	ownerID := userID
	return s.requestSosmedRefill(ctx, sosmedRefillRequestOptions{
		orderID:         orderID,
		actorID:         userID,
		actorType:       "user",
		ownerID:         &ownerID,
		enforceDeadline: true,
	})
}

func (s *SosmedOrderService) AdminTriggerRefill(ctx context.Context, orderID, adminID uuid.UUID) (*SosmedOrderDetail, error) {
	return s.requestSosmedRefill(ctx, sosmedRefillRequestOptions{
		orderID:         orderID,
		actorID:         adminID,
		actorType:       "admin",
		enforceDeadline: false,
	})
}

// AdminBackfillRefill re-populates refill metadata for an existing order from
// its associated SosmedService. Useful for orders created before the refill
// system was deployed.
func (s *SosmedOrderService) AdminBackfillRefill(orderID, adminID uuid.UUID) (*SosmedOrderDetail, error) {
	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return nil, errors.New("order sosmed tidak ditemukan")
	}

	if s.serviceRepo == nil {
		return nil, errors.New("service repo belum dikonfigurasi")
	}

	svc, err := s.serviceRepo.FindByID(order.ServiceID)
	if err != nil {
		return nil, errors.New("layanan sosmed tidak ditemukan, tidak bisa backfill refill")
	}

	populateSosmedOrderRefill(order, svc)

	if err := s.repo.Update(order); err != nil {
		return nil, errors.New("gagal menyimpan backfill refill")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: order.OrderStatus,
		ToStatus:   order.OrderStatus,
		Reason:     fmt.Sprintf("admin backfill refill: eligible=%v, period=%d hari", order.RefillEligible, order.RefillPeriodDays),
		ActorType:  "admin",
		ActorID:    &adminID,
		CreatedAt:  time.Now(),
	}
	_ = s.repo.CreateEvent(event)

	stored, err := s.repo.FindByID(order.ID)
	if err != nil {
		return nil, errors.New("gagal memuat order sosmed")
	}
	return s.buildDetail(stored)
}

// AdminBackfillRefillResult holds counters for a bulk backfill operation.
type AdminBackfillRefillResult struct {
	Scanned int `json:"scanned"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
	Errors  int `json:"errors"`
}

// AdminBackfillAllRefill scans success JAP orders that currently have
// refill_eligible=false and re-populates their refill fields from the catalog.
func (s *SosmedOrderService) AdminBackfillAllRefill(adminID uuid.UUID) (*AdminBackfillRefillResult, error) {
	if s.serviceRepo == nil {
		return nil, errors.New("service repo belum dikonfigurasi")
	}

	var orders []model.SosmedOrder
	if err := s.repo.DB().
		Where("order_status = ? AND refill_eligible = ? AND provider_code = ?", sosmedOrderStatusSuccess, false, "jap").
		Find(&orders).Error; err != nil {
		return nil, errors.New("gagal memuat order untuk backfill")
	}

	result := &AdminBackfillRefillResult{Scanned: len(orders)}

	for i := range orders {
		order := &orders[i]

		svc, err := s.serviceRepo.FindByID(order.ServiceID)
		if err != nil {
			result.Errors++
			continue
		}

		populateSosmedOrderRefill(order, svc)

		if !order.RefillEligible {
			result.Skipped++
			continue
		}

		if err := s.repo.Update(order); err != nil {
			result.Errors++
			continue
		}

		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: order.OrderStatus,
			ToStatus:   order.OrderStatus,
			Reason:     fmt.Sprintf("bulk backfill refill: eligible=%v, period=%d hari", order.RefillEligible, order.RefillPeriodDays),
			ActorType:  "admin",
			ActorID:    &adminID,
			CreatedAt:  time.Now(),
		}
		_ = s.repo.CreateEvent(event)

		result.Updated++
	}

	return result, nil
}

func (s *SosmedOrderService) ConfirmPayment(orderID uuid.UUID) error {
	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return errors.New("order sosmed tidak ditemukan")
	}

	if order.PaymentStatus == "paid" && (order.OrderStatus == sosmedOrderStatusProcessing || order.OrderStatus == sosmedOrderStatusSuccess) {
		return nil
	}

	previousStatus := order.OrderStatus
	now := time.Now()
	order.PaymentStatus = "paid"
	order.OrderStatus = sosmedOrderStatusProcessing
	order.PaidAt = &now
	if err := s.repo.Update(order); err != nil {
		return errors.New("gagal mengonfirmasi pembayaran sosmed")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: previousStatus,
		ToStatus:   sosmedOrderStatusProcessing,
		Reason:     "pembayaran terverifikasi",
		ActorType:  "system",
		CreatedAt:  now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return errors.New("gagal mencatat event pembayaran")
	}

	if s.notifRepo != nil {
		_ = s.notifRepo.Create(&model.Notification{
			UserID:  order.UserID,
			Title:   "Pembayaran Sosmed Berhasil",
			Message: "Order sosmed lu sudah masuk antrian proses.",
			Type:    "order",
		})
	}

	return nil
}

func (s *SosmedOrderService) AdminList(status string, page, limit int) ([]model.SosmedOrder, int64, error) {
	return s.repo.AdminList(normalizeSosmedOrderStatus(status), page, limit)
}

func (s *SosmedOrderService) AdminOpsSummary(staleMinutes int) (*repository.SosmedOrderOpsSummary, error) {
	if staleMinutes <= 0 {
		staleMinutes = defaultSosmedOpsStaleSyncMinutes
	}
	if staleMinutes > maxSosmedOpsStaleSyncMinutes {
		staleMinutes = maxSosmedOpsStaleSyncMinutes
	}

	staleBefore := time.Now().Add(-time.Duration(staleMinutes) * time.Minute)
	summary, err := s.repo.AdminOpsSummary(staleBefore)
	if err != nil {
		return nil, errors.New("gagal memuat ringkasan operasional order sosmed")
	}
	summary.StaleSyncMinutes = staleMinutes
	return summary, nil
}

func (s *SosmedOrderService) AdminGetByID(orderID uuid.UUID) (*SosmedOrderDetail, error) {
	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return nil, errors.New("order sosmed tidak ditemukan")
	}
	return s.buildDetail(order)
}

func (s *SosmedOrderService) AdminUpdateStatus(orderID uuid.UUID, actorID uuid.UUID, input AdminUpdateSosmedOrderStatusInput) (*SosmedOrderDetail, error) {
	toStatus := normalizeSosmedOrderStatus(input.ToStatus)
	if !isValidSosmedOrderStatus(toStatus) {
		return nil, errors.New("status order sosmed tidak valid")
	}

	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return nil, errors.New("order sosmed tidak ditemukan")
	}

	fromStatus := normalizeSosmedOrderStatus(order.OrderStatus)
	if fromStatus == toStatus {
		return s.buildDetail(order)
	}

	allowedTargets := sosmedAdminTransitionMatrix[fromStatus]
	if len(allowedTargets) == 0 || !allowedTargets[toStatus] {
		return nil, errors.New("transisi status tidak diizinkan")
	}

	order.OrderStatus = toStatus
	if toStatus == sosmedOrderStatusFailed || toStatus == sosmedOrderStatusCanceled || toStatus == sosmedOrderStatusExpired {
		if order.PaymentStatus == "pending" {
			order.PaymentStatus = "failed"
		}
	}
	if toStatus == sosmedOrderStatusSuccess && order.PaymentStatus == "pending" {
		order.PaymentStatus = "paid"
		now := time.Now()
		order.PaidAt = &now
	}

	if err := s.repo.Update(order); err != nil {
		return nil, errors.New("gagal update status order sosmed")
	}

	now := time.Now()
	event := &model.SosmedOrderEvent{
		OrderID:      order.ID,
		FromStatus:   fromStatus,
		ToStatus:     toStatus,
		Reason:       strings.TrimSpace(input.Reason),
		InternalNote: strings.TrimSpace(input.InternalNote),
		ActorType:    "admin",
		ActorID:      &actorID,
		CreatedAt:    now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return nil, errors.New("gagal mencatat event status order")
	}

	stored, err := s.repo.FindByID(order.ID)
	if err != nil {
		return nil, errors.New("gagal memuat order sosmed")
	}
	return s.buildDetail(stored)
}

func (s *SosmedOrderService) AdminSyncProviderStatus(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID) (*SosmedOrderDetail, error) {
	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return nil, errors.New("order sosmed tidak ditemukan")
	}

	stored, _, err := s.syncJAPProviderOrder(ctx, order, "admin", &actorID)
	if err != nil {
		return nil, err
	}

	return s.buildDetail(stored)
}

func (s *SosmedOrderService) AdminSyncProcessingProviderOrders(ctx context.Context, actorID uuid.UUID, limit int) (*AdminSyncSosmedProviderResult, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	orders, err := s.repo.FindSyncableProviderOrders("jap", limit)
	if err != nil {
		return nil, errors.New("gagal memuat order sync provider")
	}

	result := &AdminSyncSosmedProviderResult{
		Requested: len(orders),
		Items:     make([]AdminSyncSosmedProviderResultItem, 0, len(orders)),
	}

	for _, item := range orders {
		order := item
		row := AdminSyncSosmedProviderResultItem{
			OrderID:         order.ID,
			ServiceCode:     order.ServiceCode,
			ProviderCode:    order.ProviderCode,
			ProviderOrderID: order.ProviderOrderID,
			ProviderStatus:  order.ProviderStatus,
			OrderStatus:     order.OrderStatus,
		}

		stored, changed, syncErr := s.syncJAPProviderOrder(ctx, &order, "admin", &actorID)
		if syncErr != nil {
			row.Result = "failed"
			row.Message = syncErr.Error()
			result.Failed++
			result.Items = append(result.Items, row)
			continue
		}

		row.ProviderStatus = stored.ProviderStatus
		row.OrderStatus = stored.OrderStatus
		if changed {
			row.Result = "updated"
			result.Updated++
		} else {
			row.Result = "synced"
			result.Skipped++
		}
		result.Synced++
		result.Items = append(result.Items, row)
	}

	return result, nil
}

type AdminRetrySosmedProviderInput struct {
	Reason string `json:"reason"`
}

func (s *SosmedOrderService) AdminRetryProviderOrder(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID, input AdminRetrySosmedProviderInput) (*SosmedOrderDetail, error) {
	if s.walletRepo == nil {
		return nil, errors.New("wallet repo belum siap")
	}
	if s.japOrderProvider == nil {
		return nil, errors.New("konfigurasi JAP order provider belum siap")
	}

	var chargeRef string
	var retryAttempt int64
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		var order model.SosmedOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&order, "id = ?", orderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("order sosmed tidak ditemukan")
			}
			return errors.New("gagal memuat order sosmed")
		}

		if !isJAPSosmedOrder(&order) {
			return errors.New("order ini bukan order supplier JAP")
		}
		if strings.TrimSpace(order.ProviderOrderID) != "" {
			return errors.New("order sudah punya provider order id, gunakan sync provider")
		}
		if normalizeSosmedOrderStatus(order.OrderStatus) != sosmedOrderStatusFailed {
			return errors.New("hanya order gagal yang bisa diretry")
		}
		if !strings.EqualFold(strings.TrimSpace(order.PaymentMethod), "wallet") {
			return errors.New("retry provider saat ini hanya mendukung pembayaran wallet")
		}
		if strings.TrimSpace(order.TargetLink) == "" {
			return errors.New("target link/username kosong")
		}
		if order.TotalPrice <= 0 {
			return errors.New("nominal retry tidak valid")
		}

		previousStatus := order.OrderStatus
		shouldCharge := order.PaymentStatus != "paid"
		if shouldCharge {
			var retryCount int64
			pattern := fmt.Sprintf("sosmed_order:%s:retry:%%:charge", order.ID.String())
			if err := tx.Model(&model.WalletLedger{}).
				Where("reference LIKE ?", pattern).
				Count(&retryCount).Error; err != nil {
				return errors.New("gagal cek attempt retry wallet")
			}

			retryAttempt = retryCount + 1
			chargeRef = sosmedOrderWalletRetryChargeRef(order.ID, retryAttempt)
			if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, chargeRef); err == nil {
				return errors.New("ledger retry wallet sudah ada")
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("gagal cek ledger retry wallet")
			}

			user, err := s.walletRepo.LockUserByIDTx(tx, order.UserID)
			if err != nil {
				return errors.New("user tidak ditemukan")
			}
			if !user.IsActive {
				return errors.New("akun user diblokir")
			}
			if user.WalletBalance < order.TotalPrice {
				return errors.New("saldo wallet user tidak cukup untuk retry")
			}

			before := user.WalletBalance
			after := before - order.TotalPrice
			user.WalletBalance = after
			if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
				return errors.New("gagal update saldo wallet retry")
			}

			ledger := &model.WalletLedger{
				ID:            uuid.New(),
				UserID:        user.ID,
				Type:          "debit",
				Category:      "sosmed_purchase",
				Amount:        order.TotalPrice,
				BalanceBefore: before,
				BalanceAfter:  after,
				Reference:     chargeRef,
				Description:   fmt.Sprintf("Retry admin layanan sosmed order %s via wallet", shortSosmedWalletRef(order.ID.String())),
			}
			if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
				return errors.New("gagal menulis ledger retry wallet")
			}
		}

		order.PaymentStatus = "paid"
		order.OrderStatus = sosmedOrderStatusProcessing
		order.ProviderStatus = "retrying"
		order.ProviderError = ""
		if err := tx.Save(&order).Error; err != nil {
			return errors.New("gagal update order retry")
		}

		reason := "retry kirim order ke JAP oleh admin"
		if trimmed := strings.TrimSpace(input.Reason); trimmed != "" {
			reason = fmt.Sprintf("%s: %s", reason, trimmed)
		}
		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: previousStatus,
			ToStatus:   sosmedOrderStatusProcessing,
			Reason:     reason,
			ActorType:  "admin",
			ActorID:    &actorID,
			CreatedAt:  time.Now(),
		}
		if err := tx.Create(event).Error; err != nil {
			return errors.New("gagal mencatat event retry")
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	if err := s.submitRetryJAPOrder(ctx, orderID, actorID, chargeRef, retryAttempt); err != nil {
		return nil, err
	}

	stored, err := s.repo.FindByID(orderID)
	if err != nil {
		return nil, errors.New("gagal memuat order sosmed")
	}
	return s.buildDetail(stored)
}

func (s *SosmedOrderService) submitRetryJAPOrder(ctx context.Context, orderID uuid.UUID, actorID uuid.UUID, chargeRef string, retryAttempt int64) error {
	order, err := s.repo.FindByID(orderID)
	if err != nil {
		return errors.New("order sosmed tidak ditemukan")
	}
	if !isJAPSosmedOrder(order) {
		return nil
	}
	if strings.TrimSpace(order.ProviderOrderID) != "" {
		return errors.New("retry dibatalkan: order sudah punya provider order id, gunakan sync provider")
	}
	if normalizeSosmedOrderStatus(order.OrderStatus) != sosmedOrderStatusProcessing {
		return errors.New("retry dibatalkan: order tidak lagi dalam status processing")
	}
	if order.PaymentStatus != "paid" {
		return errors.New("retry dibatalkan: pembayaran order belum paid")
	}
	if strings.TrimSpace(order.TargetLink) == "" {
		return s.failAndRefundWalletRetryOrder(orderID, chargeRef, retryAttempt, "retry dibatalkan: target link/username kosong", "", actorID)
	}
	if order.Quantity <= 0 {
		return s.failAndRefundWalletRetryOrder(orderID, chargeRef, retryAttempt, "retry dibatalkan: quantity order tidak valid", "", actorID)
	}

	providerQuantity := order.Quantity * 1000
	requestPayload := map[string]any{
		"provider":      "jap",
		"action":        "add",
		"service":       order.ProviderServiceID,
		"link":          order.TargetLink,
		"quantity":      providerQuantity,
		"local_order":   order.ID.String(),
		"service_code":  order.ServiceCode,
		"retry_attempt": retryAttempt,
		"admin_retry":   true,
	}
	rawRequest, _ := json.Marshal(requestPayload)

	res, err := s.japOrderProvider.AddOrder(ctx, JAPAddOrderInput{
		ServiceID: order.ProviderServiceID,
		Link:      order.TargetLink,
		Quantity:  providerQuantity,
	})
	if err != nil {
		return s.failAndRefundWalletRetryOrder(orderID, chargeRef, retryAttempt, fmt.Sprintf("retry gagal kirim order ke JAP: %v", err), string(rawRequest), actorID)
	}

	providerOrderID := strings.TrimSpace(string(res.Order))
	if providerOrderID == "" {
		return s.failAndRefundWalletRetryOrder(orderID, chargeRef, retryAttempt, "retry response JAP tidak berisi provider order id", string(rawRequest), actorID)
	}

	responsePayload := map[string]any{
		"request":           requestPayload,
		"provider_order_id": providerOrderID,
	}
	rawPayload, _ := json.Marshal(responsePayload)

	now := time.Now()
	previousStatus := order.OrderStatus
	order.ProviderOrderID = providerOrderID
	order.ProviderStatus = "submitted"
	order.ProviderPayload = truncateSosmedProviderText(string(rawPayload), 4000)
	order.ProviderError = ""
	order.OrderStatus = sosmedOrderStatusProcessing
	order.PaymentStatus = "paid"
	if err := s.repo.Update(order); err != nil {
		return errors.New("gagal menyimpan retry provider order JAP")
	}

	event := &model.SosmedOrderEvent{
		OrderID:    order.ID,
		FromStatus: previousStatus,
		ToStatus:   sosmedOrderStatusProcessing,
		Reason:     fmt.Sprintf("retry order dikirim ke JAP #%s", providerOrderID),
		ActorType:  "admin",
		ActorID:    &actorID,
		CreatedAt:  now,
	}
	if err := s.repo.CreateEvent(event); err != nil {
		return errors.New("gagal mencatat event retry provider")
	}

	return nil
}

func (s *SosmedOrderService) failAndRefundWalletRetryOrder(orderID uuid.UUID, chargeRef string, retryAttempt int64, providerError, providerPayload string, actorID uuid.UUID) error {
	refunded := false
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		var order model.SosmedOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&order, "id = ?", orderID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("order sosmed tidak ditemukan")
			}
			return errors.New("gagal memuat order sosmed")
		}

		previousStatus := order.OrderStatus
		order.ProviderStatus = "failed"
		order.ProviderError = truncateSosmedProviderText(providerError, 2000)
		order.ProviderPayload = truncateSosmedProviderText(providerPayload, 4000)
		order.OrderStatus = sosmedOrderStatusFailed

		if strings.TrimSpace(chargeRef) != "" {
			refundRef := sosmedOrderWalletRetryRefundRef(order.ID, retryAttempt)
			if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, refundRef); err == nil {
				order.PaymentStatus = "failed"
				if err := tx.Save(&order).Error; err != nil {
					return errors.New("gagal update order retry")
				}
				return nil
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("gagal cek ledger refund retry")
			}

			chargeLedger, err := s.walletRepo.FindLedgerByReferenceTx(tx, chargeRef)
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.New("ledger debit retry wallet tidak ditemukan")
				}
				return errors.New("gagal cek ledger debit retry wallet")
			}

			user, err := s.walletRepo.LockUserByIDTx(tx, order.UserID)
			if err != nil {
				return errors.New("user tidak ditemukan")
			}

			before := user.WalletBalance
			after := before + chargeLedger.Amount
			user.WalletBalance = after
			if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
				return errors.New("gagal refund saldo retry")
			}

			ledger := &model.WalletLedger{
				ID:            uuid.New(),
				UserID:        user.ID,
				Type:          "credit",
				Category:      "sosmed_refund",
				Amount:        chargeLedger.Amount,
				BalanceBefore: before,
				BalanceAfter:  after,
				Reference:     refundRef,
				Description:   fmt.Sprintf("Refund otomatis retry order sosmed %s karena gagal dikirim ke supplier", shortSosmedWalletRef(order.ID.String())),
			}
			if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
				return errors.New("gagal menulis ledger refund retry")
			}

			order.PaymentStatus = "failed"
			refunded = true
		}

		if err := tx.Save(&order).Error; err != nil {
			return errors.New("gagal update order retry gagal")
		}

		event := &model.SosmedOrderEvent{
			OrderID:    order.ID,
			FromStatus: previousStatus,
			ToStatus:   sosmedOrderStatusFailed,
			Reason:     truncateSosmedProviderText(providerError, 1000),
			ActorType:  "admin",
			ActorID:    &actorID,
			CreatedAt:  time.Now(),
		}
		if err := tx.Create(event).Error; err != nil {
			return errors.New("gagal mencatat event retry gagal")
		}

		return nil
	})
	if err != nil {
		return err
	}

	if refunded {
		return errors.New("retry gagal dikirim ke supplier, saldo wallet sudah direfund")
	}
	return errors.New(providerError)
}
