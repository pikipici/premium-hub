package service

import (
	"errors"
	"sort"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

// Key constants — harus cocok dengan GATEWAY_METHODS di PaymentMethodSelector.tsx
const (
	PayMethodWallet    = "wallet"
	PayMethodQRIS      = "qris"
	PayMethodBCAVA     = "bca_va"
	PayMethodBNIVA     = "bni_va"
	PayMethodBRIVA     = "bri_va"
	PayMethodMandiriVA = "mandiri_va"
	PayMethodOVO       = "ovo"
	PayMethodDANA      = "dana"
	PayMethodShopeePay = "shopeepay"
)

type PaymentMethodSettingService struct {
	repo *repository.PaymentMethodSettingRepo
}

func NewPaymentMethodSettingService(repo *repository.PaymentMethodSettingRepo) *PaymentMethodSettingService {
	return &PaymentMethodSettingService{repo: repo}
}

// UpdatePaymentMethodSettingsInput adalah body untuk PUT admin endpoint.
type UpdatePaymentMethodSettingsInput struct {
	Items []UpdatePaymentMethodSettingItem `json:"items" binding:"required"`
}

type UpdatePaymentMethodSettingItem struct {
	Key             string `json:"key" binding:"required"`
	IsEnabled       *bool  `json:"is_enabled" binding:"required"`
	UnavailableNote string `json:"unavailable_note"`
}

// DefaultPaymentMethodSettings mendefinisikan semua metode yang tersedia.
// Hanya wallet yang enabled by default; semua gateway method disabled.
func DefaultPaymentMethodSettings() []model.PaymentMethodSetting {
	return []model.PaymentMethodSetting{
		{Key: PayMethodWallet, Label: "Saldo Wallet", IsEnabled: true, UnavailableNote: "", SortOrder: 1},
		{Key: PayMethodQRIS, Label: "QRIS", IsEnabled: false, UnavailableNote: "Segera hadir", SortOrder: 2},
		{Key: PayMethodBCAVA, Label: "BCA Virtual Account", IsEnabled: false, UnavailableNote: "Segera hadir", SortOrder: 3},
		{Key: PayMethodBNIVA, Label: "BNI Virtual Account", IsEnabled: false, UnavailableNote: "Segera hadir", SortOrder: 4},
		{Key: PayMethodBRIVA, Label: "BRI Virtual Account", IsEnabled: false, UnavailableNote: "Segera hadir", SortOrder: 5},
		{Key: PayMethodMandiriVA, Label: "Mandiri Virtual Account", IsEnabled: false, UnavailableNote: "Segera hadir", SortOrder: 6},
		{Key: PayMethodOVO, Label: "OVO", IsEnabled: false, UnavailableNote: "Segera hadir", SortOrder: 7},
		{Key: PayMethodDANA, Label: "DANA", IsEnabled: false, UnavailableNote: "Segera hadir", SortOrder: 8},
		{Key: PayMethodShopeePay, Label: "ShopeePay", IsEnabled: false, UnavailableNote: "Segera hadir", SortOrder: 9},
	}
}

func paymentMethodDefaultKeySet() map[string]bool {
	out := map[string]bool{}
	for _, item := range DefaultPaymentMethodSettings() {
		out[item.Key] = true
	}
	return out
}

func (s *PaymentMethodSettingService) ensureDefaults() error {
	if s == nil || s.repo == nil {
		return errors.New("repo payment method setting belum siap")
	}
	return s.repo.EnsureDefaults(DefaultPaymentMethodSettings())
}

// List mengembalikan semua metode (untuk admin).
func (s *PaymentMethodSettingService) List() ([]model.PaymentMethodSetting, error) {
	if err := s.ensureDefaults(); err != nil {
		return nil, errors.New("gagal menyiapkan setting metode pembayaran")
	}

	rows, err := s.repo.List()
	if err != nil {
		return nil, errors.New("gagal memuat setting metode pembayaran")
	}

	allowed := paymentMethodDefaultKeySet()
	filtered := make([]model.PaymentMethodSetting, 0, len(rows))
	for _, row := range rows {
		if allowed[strings.TrimSpace(row.Key)] {
			filtered = append(filtered, row)
		}
	}

	sortPaymentMethodSettings(filtered)
	return filtered, nil
}

// PublicList mengembalikan semua metode (enabled maupun disabled) — FE butuh
// data disabled untuk render grayed-out state + keterangan.
func (s *PaymentMethodSettingService) PublicList() ([]model.PaymentMethodSetting, error) {
	return s.List()
}

// Update memperbarui is_enabled dan unavailable_note per item.
func (s *PaymentMethodSettingService) Update(input UpdatePaymentMethodSettingsInput) ([]model.PaymentMethodSetting, error) {
	if err := s.ensureDefaults(); err != nil {
		return nil, errors.New("gagal menyiapkan setting metode pembayaran")
	}

	allowed := paymentMethodDefaultKeySet()
	for _, item := range input.Items {
		key := strings.TrimSpace(item.Key)
		if !allowed[key] {
			return nil, errors.New("key metode pembayaran tidak valid: " + key)
		}
		if item.IsEnabled == nil {
			return nil, errors.New("is_enabled wajib diisi")
		}

		row, err := s.repo.FindByKey(key)
		if err != nil {
			return nil, errors.New("setting metode pembayaran tidak ditemukan")
		}
		row.IsEnabled = *item.IsEnabled
		row.UnavailableNote = item.UnavailableNote
		if err := s.repo.Update(row); err != nil {
			return nil, errors.New("gagal update setting metode pembayaran")
		}
	}

	return s.List()
}

func sortPaymentMethodSettings(items []model.PaymentMethodSetting) {
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].SortOrder != items[j].SortOrder {
			return items[i].SortOrder < items[j].SortOrder
		}
		return items[i].Key < items[j].Key
	})
}
