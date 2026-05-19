package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailPricingService wraps the single-row GmailPricing config table
// with bulk-tier discount math + admin update validation.
type GmailPricingService struct {
	repo *repository.GmailPricingRepo
}

func NewGmailPricingService(repo *repository.GmailPricingRepo) *GmailPricingService {
	return &GmailPricingService{repo: repo}
}

// GmailDiscountTier is the parsed shape of one row in the
// BulkDiscountTiers JSON array stored on GmailPricing.
type GmailDiscountTier struct {
	MinQty      int64 `json:"min_qty"`
	DiscountPct int   `json:"discount_pct"`
}

// PricingPreview is what /public/gmail/pricing returns — sell_price
// + tiers preview if bulk discount enabled. Buy_price is admin-only.
type PricingPreview struct {
	SellPrice           int64               `json:"sell_price"`
	BulkDiscountEnabled bool                `json:"bulk_discount_enabled"`
	Tiers               []GmailDiscountTier `json:"tiers,omitempty"`
}

// GmailPricingUpdateInput is the admin update body. All fields are
// optional but at least one must be present.
type GmailPricingUpdateInput struct {
	BuyPrice              *int64               `json:"buy_price"`
	SellPrice             *int64               `json:"sell_price"`
	BulkDiscountEnabled   *bool                `json:"bulk_discount_enabled"`
	BulkDiscountTiers     []GmailDiscountTier  `json:"bulk_discount_tiers"`
	LowInventoryThreshold *int                 `json:"low_inventory_threshold"`
}

// GetActive returns the current pricing config row (single-row table).
func (s *GmailPricingService) GetActive() (*model.GmailPricing, error) {
	return s.repo.Get()
}

// GetActiveTx variant for in-tx reads (e.g. inside Buy flow).
func (s *GmailPricingService) GetActiveTx(tx *gorm.DB) (*model.GmailPricing, error) {
	return s.repo.GetTx(tx)
}

// PricingPreview returns the public-facing slice of pricing info —
// sell_price always, tiers only if bulk_discount_enabled.
func (s *GmailPricingService) PricingPreview() (*PricingPreview, error) {
	p, err := s.repo.Get()
	if err != nil {
		return nil, err
	}
	out := &PricingPreview{
		SellPrice:           p.SellPrice,
		BulkDiscountEnabled: p.BulkDiscountEnabled,
	}
	if p.BulkDiscountEnabled {
		tiers, _ := parseTiers(p.BulkDiscountTiers)
		out.Tiers = tiers
	}
	return out, nil
}

// CalculateTotal computes gross/discount/net for a given quantity.
//
//	gross    = qty * sell_price
//	discount = gross * (highest_matching_tier.pct / 100), 0 if no tier
//	net      = gross - discount
//
// Tiers evaluated highest-min-qty-first that qty satisfies. Returns
// non-nil error only on bad input or storage failure.
func (s *GmailPricingService) CalculateTotal(qty int64) (int64, int64, int64, error) {
	if qty < 1 {
		return 0, 0, 0, errors.New("quantity minimal 1")
	}
	p, err := s.repo.Get()
	if err != nil {
		return 0, 0, 0, errors.New("gagal load pricing config")
	}
	return calcTotalFromPricing(p, qty)
}

// CalculateTotalTx is the in-tx variant — used by Buy() to read
// pricing inside the transaction so admin updates mid-buy don't
// shift the price under the buyer.
func (s *GmailPricingService) CalculateTotalTx(tx *gorm.DB, qty int64) (int64, int64, int64, error) {
	if qty < 1 {
		return 0, 0, 0, errors.New("quantity minimal 1")
	}
	p, err := s.repo.GetTx(tx)
	if err != nil {
		return 0, 0, 0, errors.New("gagal load pricing config")
	}
	return calcTotalFromPricing(p, qty)
}

// calcTotalFromPricing is the pure math portion — exposed via the two
// CalculateTotal* wrappers but isolated so it's easy to unit-test
// without touching the DB.
func calcTotalFromPricing(p *model.GmailPricing, qty int64) (int64, int64, int64, error) {
	gross := qty * p.SellPrice
	if gross < 0 {
		return 0, 0, 0, errors.New("perhitungan harga overflow")
	}
	var discount int64
	if p.BulkDiscountEnabled {
		tiers, err := parseTiers(p.BulkDiscountTiers)
		if err != nil {
			return 0, 0, 0, fmt.Errorf("config tier rusak: %w", err)
		}
		// Find highest min_qty tier that qty satisfies.
		bestPct := 0
		for _, t := range tiers {
			if qty >= t.MinQty && t.DiscountPct > bestPct {
				bestPct = t.DiscountPct
			}
		}
		if bestPct > 0 {
			discount = gross * int64(bestPct) / 100
		}
	}
	net := gross - discount
	return gross, discount, net, nil
}

// AdminUpdate validates + persists pricing changes. At least one
// field must be provided; sell_price must remain > buy_price (margin
// guard); tier JSON must be valid + ascending min_qty + non-overlapping.
func (s *GmailPricingService) AdminUpdate(adminID uuid.UUID, input GmailPricingUpdateInput) (*model.GmailPricing, error) {
	current, err := s.repo.Get()
	if err != nil {
		return nil, errors.New("gagal load pricing")
	}

	updated := *current
	touched := false

	if input.BuyPrice != nil {
		if *input.BuyPrice <= 0 {
			return nil, errors.New("buy_price harus > 0")
		}
		updated.BuyPrice = *input.BuyPrice
		touched = true
	}
	if input.SellPrice != nil {
		if *input.SellPrice <= 0 {
			return nil, errors.New("sell_price harus > 0")
		}
		updated.SellPrice = *input.SellPrice
		touched = true
	}
	// Margin guard — sell_price must exceed buy_price after both changes
	// land. Use updated values to check, not the original ones.
	if updated.SellPrice <= updated.BuyPrice {
		return nil, errors.New("sell_price harus > buy_price (margin guard)")
	}

	if input.BulkDiscountEnabled != nil {
		updated.BulkDiscountEnabled = *input.BulkDiscountEnabled
		touched = true
	}
	if input.BulkDiscountTiers != nil {
		// Validate tiers — ascending min_qty, no duplicates, pct 1-99.
		if err := validateTiers(input.BulkDiscountTiers); err != nil {
			return nil, err
		}
		raw, err := json.Marshal(input.BulkDiscountTiers)
		if err != nil {
			return nil, errors.New("gagal serialize tiers")
		}
		updated.BulkDiscountTiers = string(raw)
		touched = true
	}
	if input.LowInventoryThreshold != nil {
		if *input.LowInventoryThreshold < 0 {
			return nil, errors.New("low_inventory_threshold tidak boleh negatif")
		}
		updated.LowInventoryThreshold = *input.LowInventoryThreshold
		touched = true
	}

	if !touched {
		return nil, errors.New("tidak ada field yang diubah")
	}

	updated.UpdatedByAdminID = &adminID
	if err := s.repo.Save(&updated); err != nil {
		return nil, errors.New("gagal simpan pricing")
	}
	return &updated, nil
}

// ----- helpers -----

func parseTiers(raw string) ([]GmailDiscountTier, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	var tiers []GmailDiscountTier
	if err := json.Unmarshal([]byte(raw), &tiers); err != nil {
		return nil, fmt.Errorf("invalid tier JSON: %w", err)
	}
	return tiers, nil
}

func validateTiers(tiers []GmailDiscountTier) error {
	if len(tiers) == 0 {
		return nil // empty = no tiers, valid
	}
	// Sort + check ascending unique min_qty + valid pct.
	sorted := make([]GmailDiscountTier, len(tiers))
	copy(sorted, tiers)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].MinQty < sorted[j].MinQty
	})
	prevMin := int64(-1)
	for _, t := range sorted {
		if t.MinQty <= 0 {
			return fmt.Errorf("tier min_qty harus > 0 (got %d)", t.MinQty)
		}
		if t.MinQty == prevMin {
			return fmt.Errorf("duplicate min_qty %d", t.MinQty)
		}
		if t.DiscountPct < 1 || t.DiscountPct > 99 {
			return fmt.Errorf("tier discount_pct harus 1-99 (got %d)", t.DiscountPct)
		}
		prevMin = t.MinQty
	}
	return nil
}
