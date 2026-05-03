package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	SosmedBundleOrderStatusProcessing    = "processing"
	SosmedBundleOrderStatusPartial       = "partial"
	SosmedBundleOrderStatusFailed        = "failed"
	SosmedBundleOrderItemStatusQueued    = "queued"
	SosmedBundleOrderItemStatusSubmitted = "submitted"
	SosmedBundleOrderItemStatusFailed    = "failed"
)

type SosmedBundleOrderService struct {
	bundleRepo       *repository.SosmedBundleRepo
	orderRepo        *repository.SosmedBundleOrderRepo
	walletRepo       *repository.WalletRepo
	japOrderProvider SosmedJAPOrderProvider
}

type CreateSosmedBundleOrderInput struct {
	BundleKey             string `json:"bundle_key" binding:"required"`
	VariantKey            string `json:"variant_key" binding:"required"`
	TargetLink            string `json:"target_link"`
	TargetUsername        string `json:"target_username"`
	Notes                 string `json:"notes"`
	PaymentMethod         string `json:"payment_method"`
	IdempotencyKey        string `json:"idempotency_key"`
	TargetPublicConfirmed bool   `json:"target_public_confirmed"`
}

func NewSosmedBundleOrderService(
	bundleRepo *repository.SosmedBundleRepo,
	orderRepo *repository.SosmedBundleOrderRepo,
	walletRepo *repository.WalletRepo,
) *SosmedBundleOrderService {
	return &SosmedBundleOrderService{bundleRepo: bundleRepo, orderRepo: orderRepo, walletRepo: walletRepo}
}

func (s *SosmedBundleOrderService) SetJAPOrderProvider(provider SosmedJAPOrderProvider) *SosmedBundleOrderService {
	s.japOrderProvider = provider
	return s
}

func (s *SosmedBundleOrderService) Create(ctx context.Context, userID uuid.UUID, input CreateSosmedBundleOrderInput) (*model.SosmedBundleOrder, error) {
	if s == nil || s.bundleRepo == nil || s.orderRepo == nil || s.walletRepo == nil {
		return nil, errors.New("layanan bundle sosmed belum siap")
	}
	if userID == uuid.Nil {
		return nil, errors.New("user tidak valid")
	}

	bundleKey := strings.TrimSpace(input.BundleKey)
	variantKey := strings.TrimSpace(input.VariantKey)
	if bundleKey == "" || variantKey == "" {
		return nil, errors.New("bundle dan variant wajib diisi")
	}

	targetLink := normalizeSosmedOrderTargetLink(input.TargetLink)
	if targetLink == "" {
		return nil, errors.New("target link/username wajib diisi")
	}
	if !input.TargetPublicConfirmed {
		return nil, errors.New("konfirmasi dulu kalau akun/link target sudah public, aktif, dan tidak akan diubah sampai order selesai")
	}
	paymentMethod := strings.ToLower(strings.TrimSpace(input.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "wallet"
	}
	if paymentMethod != "wallet" {
		return nil, errors.New("checkout bundle saat ini hanya mendukung wallet")
	}
	idempotencyKey := normalizeSosmedBundleIdempotencyKey(input.IdempotencyKey)
	if idempotencyKey == "" {
		return nil, errors.New("idempotency key wajib diisi")
	}
	if existing, err := s.orderRepo.GetBundleOrderByIdempotencyKeyForUser(ctx, userID, idempotencyKey); err == nil {
		return existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek order bundle sosmed")
	}

	variant, err := s.bundleRepo.GetVariantForCheckout(ctx, bundleKey, variantKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("paket bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat paket bundle sosmed")
	}
	pricing, err := CalculateSosmedBundlePricing(variant)
	if err != nil {
		return nil, err
	}
	if pricing.TotalPrice <= 0 {
		return nil, errors.New("total harga bundle tidak valid")
	}

	now := time.Now()
	orderID := uuid.New()
	order := &model.SosmedBundleOrder{
		ID:                 orderID,
		OrderNumber:        generateSosmedBundleOrderNumber(now, orderID),
		UserID:             userID,
		BundlePackageID:    variant.Package.ID,
		BundleVariantID:    variant.ID,
		PackageKeySnapshot: strings.TrimSpace(variant.Package.Key),
		VariantKeySnapshot: strings.TrimSpace(variant.Key),
		TitleSnapshot:      buildSosmedBundleOrderTitleSnapshot(variant),
		TargetLink:         targetLink,
		TargetUsername:     strings.TrimSpace(input.TargetUsername),
		Notes:              strings.TrimSpace(input.Notes),
		SubtotalPrice:      pricing.SubtotalPrice,
		DiscountAmount:     pricing.DiscountAmount,
		TotalPrice:         pricing.TotalPrice,
		CostPriceSnapshot:  pricing.CostPriceSnapshot,
		MarginSnapshot:     pricing.MarginSnapshot,
		Status:             SosmedBundleOrderStatusProcessing,
		PaymentMethod:      paymentMethod,
		IdempotencyKey:     idempotencyKey,
		PaidAt:             &now,
	}
	items := buildSosmedBundleOrderItems(variant, pricing, targetLink)
	chargeRef := sosmedBundleOrderWalletChargeRef(orderID)

	err = s.walletRepo.Transaction(func(tx *gorm.DB) error {
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
			return errors.New("transaksi wallet bundle sosmed sudah diproses")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("gagal cek ledger wallet")
		}
		if user.WalletBalance < pricing.TotalPrice {
			return errors.New("saldo wallet tidak cukup")
		}

		before := user.WalletBalance
		after := before - pricing.TotalPrice
		user.WalletBalance = after
		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return errors.New("gagal update saldo wallet")
		}

		ledger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "debit",
			Category:      "sosmed_bundle_purchase",
			Amount:        pricing.TotalPrice,
			BalanceBefore: before,
			BalanceAfter:  after,
			Reference:     chargeRef,
			Description:   fmt.Sprintf("Pembelian paket sosmed %s via wallet", shortSosmedWalletRef(orderID.String())),
		}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger wallet")
		}
		order.WalletTransactionID = &ledger.ID

		if err := tx.Create(order).Error; err != nil {
			return errors.New("gagal membuat order bundle sosmed")
		}
		for i := range items {
			items[i].BundleOrderID = order.ID
		}
		if err := tx.Create(&items).Error; err != nil {
			return errors.New("gagal membuat item order bundle sosmed")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	stored, err := s.orderRepo.GetBundleOrderByNumberForUser(ctx, userID, order.OrderNumber)
	if err != nil {
		return nil, errors.New("gagal memuat order bundle sosmed")
	}
	if s.japOrderProvider != nil {
		if err := s.submitProviderBundleOrderItems(ctx, stored); err != nil {
			return nil, err
		}
		stored, err = s.orderRepo.GetBundleOrderByNumberForUser(ctx, userID, order.OrderNumber)
		if err != nil {
			return nil, errors.New("gagal memuat order bundle sosmed")
		}
	}
	return stored, nil
}

func (s *SosmedBundleOrderService) submitProviderBundleOrderItems(ctx context.Context, order *model.SosmedBundleOrder) error {
	if s == nil || s.japOrderProvider == nil || order == nil {
		return nil
	}
	if len(order.Items) == 0 {
		return nil
	}

	now := time.Now()
	failedMessages := make([]string, 0)
	for i := range order.Items {
		item := &order.Items[i]
		if item.Status != SosmedBundleOrderItemStatusQueued {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(item.ProviderCodeSnapshot), "jap") || strings.TrimSpace(item.ProviderServiceIDSnapshot) == "" {
			item.Status = SosmedBundleOrderItemStatusFailed
			item.ProviderStatus = "failed"
			item.ProviderError = "provider item bundle belum dikonfigurasi"
			failedMessages = append(failedMessages, fmt.Sprintf("%s: %s", item.ServiceCodeSnapshot, item.ProviderError))
			continue
		}
		res, err := s.japOrderProvider.AddOrder(ctx, JAPAddOrderInput{
			ServiceID: item.ProviderServiceIDSnapshot,
			Link:      item.TargetLinkSnapshot,
			Quantity:  item.QuantityUnits,
		})
		if err != nil {
			item.Status = SosmedBundleOrderItemStatusFailed
			item.ProviderStatus = "failed"
			item.ProviderError = truncateSosmedProviderText(err.Error(), 2000)
			failedMessages = append(failedMessages, fmt.Sprintf("%s: %s", item.ServiceCodeSnapshot, item.ProviderError))
			continue
		}
		providerOrderID := ""
		if res != nil {
			providerOrderID = strings.TrimSpace(string(res.Order))
		}
		if providerOrderID == "" {
			item.Status = SosmedBundleOrderItemStatusFailed
			item.ProviderStatus = "failed"
			item.ProviderError = "response JAP tidak berisi provider order id"
			failedMessages = append(failedMessages, fmt.Sprintf("%s: %s", item.ServiceCodeSnapshot, item.ProviderError))
			continue
		}
		item.Status = SosmedBundleOrderItemStatusSubmitted
		item.ProviderOrderID = providerOrderID
		item.ProviderStatus = "submitted"
		item.ProviderError = ""
		item.SubmittedAt = &now
	}

	order.Status = aggregateSosmedBundleOrderStatus(order.Items)
	if len(failedMessages) > 0 {
		order.FailureReason = truncateSosmedProviderText(strings.Join(failedMessages, "; "), 2000)
	} else {
		order.FailureReason = ""
	}
	if err := s.orderRepo.DB().WithContext(ctx).Save(order).Error; err != nil {
		return errors.New("gagal menyimpan status provider bundle sosmed")
	}
	for i := range order.Items {
		if err := s.orderRepo.DB().WithContext(ctx).Save(&order.Items[i]).Error; err != nil {
			return errors.New("gagal menyimpan status item provider bundle sosmed")
		}
	}
	return nil
}

func aggregateSosmedBundleOrderStatus(items []model.SosmedBundleOrderItem) string {
	if len(items) == 0 {
		return SosmedBundleOrderStatusProcessing
	}
	submitted := 0
	failed := 0
	for _, item := range items {
		switch item.Status {
		case SosmedBundleOrderItemStatusFailed:
			failed++
		case SosmedBundleOrderItemStatusSubmitted, "processing", "completed":
			submitted++
		}
	}
	if failed == len(items) {
		return SosmedBundleOrderStatusFailed
	}
	if failed > 0 && submitted > 0 {
		return SosmedBundleOrderStatusPartial
	}
	return SosmedBundleOrderStatusProcessing
}

func (s *SosmedBundleOrderService) ListByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]model.SosmedBundleOrder, int64, error) {
	if s == nil || s.orderRepo == nil {
		return nil, 0, errors.New("layanan bundle sosmed belum siap")
	}
	if userID == uuid.Nil {
		return nil, 0, errors.New("user tidak valid")
	}
	return s.orderRepo.ListBundleOrdersByUser(ctx, userID, page, limit)
}

func (s *SosmedBundleOrderService) GetByOrderNumberForUser(ctx context.Context, userID uuid.UUID, orderNumber string) (*model.SosmedBundleOrder, error) {
	if s == nil || s.orderRepo == nil {
		return nil, errors.New("layanan bundle sosmed belum siap")
	}
	if userID == uuid.Nil {
		return nil, errors.New("user tidak valid")
	}
	orderNumber = strings.TrimSpace(orderNumber)
	if orderNumber == "" {
		return nil, errors.New("nomor order tidak valid")
	}
	order, err := s.orderRepo.GetBundleOrderByNumberForUser(ctx, userID, orderNumber)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat order bundle sosmed")
	}
	return order, nil
}

func (s *SosmedBundleOrderService) AdminList(ctx context.Context, status string, page, limit int) ([]model.SosmedBundleOrder, int64, error) {
	if s == nil || s.orderRepo == nil {
		return nil, 0, errors.New("layanan bundle sosmed belum siap")
	}
	status = strings.ToLower(strings.TrimSpace(status))
	return s.orderRepo.AdminListBundleOrders(ctx, status, page, limit)
}

func (s *SosmedBundleOrderService) AdminGetByOrderNumber(ctx context.Context, orderNumber string) (*model.SosmedBundleOrder, error) {
	if s == nil || s.orderRepo == nil {
		return nil, errors.New("layanan bundle sosmed belum siap")
	}
	orderNumber = strings.TrimSpace(orderNumber)
	if orderNumber == "" {
		return nil, errors.New("nomor order tidak valid")
	}
	order, err := s.orderRepo.AdminGetBundleOrderByNumber(ctx, orderNumber)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat order bundle sosmed")
	}
	return order, nil
}

func sosmedBundleOrderWalletChargeRef(orderID uuid.UUID) string {
	return fmt.Sprintf("sosmed_bundle_order:%s:charge", orderID.String())
}

func normalizeSosmedBundleIdempotencyKey(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 80 {
		return ""
	}
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == ':' {
			continue
		}
		return ""
	}
	return value
}

func generateSosmedBundleOrderNumber(now time.Time, orderID uuid.UUID) string {
	return fmt.Sprintf("SB-%s-%s", now.Format("20060102"), shortSosmedWalletRef(orderID.String()))
}

func buildSosmedBundleOrderTitleSnapshot(variant *model.SosmedBundleVariant) string {
	if variant == nil {
		return "Paket Sosmed"
	}
	packageTitle := strings.TrimSpace(variant.Package.Title)
	variantName := strings.TrimSpace(variant.Name)
	if packageTitle == "" {
		packageTitle = strings.TrimSpace(variant.Package.Key)
	}
	if variantName == "" {
		variantName = strings.TrimSpace(variant.Key)
	}
	if packageTitle == "" {
		packageTitle = "Paket Sosmed"
	}
	if variantName == "" {
		return packageTitle
	}
	return fmt.Sprintf("%s - %s", packageTitle, variantName)
}

func buildSosmedBundleOrderItems(variant *model.SosmedBundleVariant, pricing *SosmedBundlePricingResult, targetLink string) []model.SosmedBundleOrderItem {
	if variant == nil || pricing == nil {
		return nil
	}
	items := make([]model.SosmedBundleOrderItem, 0, len(pricing.Items))
	for idx, line := range pricing.Items {
		var serviceID uuid.UUID
		if parsed, err := uuid.Parse(strings.TrimSpace(line.SosmedServiceID)); err == nil {
			serviceID = parsed
		}
		if serviceID == uuid.Nil && idx < len(variant.Items) {
			serviceID = variant.Items[idx].SosmedServiceID
		}
		items = append(items, model.SosmedBundleOrderItem{
			SosmedServiceID:           serviceID,
			ServiceCodeSnapshot:       line.ServiceCodeSnapshot,
			ServiceTitleSnapshot:      line.ServiceTitleSnapshot,
			ProviderCodeSnapshot:      line.ProviderCodeSnapshot,
			ProviderServiceIDSnapshot: line.ProviderServiceIDSnapshot,
			QuantityUnits:             line.QuantityUnits,
			UnitPricePer1KSnapshot:    line.UnitPricePer1KSnapshot,
			LinePrice:                 line.LinePrice,
			CostPriceSnapshot:         line.CostPriceSnapshot,
			TargetLinkSnapshot:        targetLink,
			Status:                    SosmedBundleOrderItemStatusQueued,
		})
	}
	return items
}
