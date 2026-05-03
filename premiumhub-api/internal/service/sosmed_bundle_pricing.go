package service

import (
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"premiumhub-api/internal/model"
)

const (
	SosmedBundlePriceModeComputed             = "computed"
	SosmedBundlePriceModeFixed                = "fixed"
	SosmedBundlePriceModeComputedWithDiscount = "computed_with_discount"
)

type SosmedBundlePricingResult struct {
	SubtotalPrice     int64                         `json:"subtotal_price"`
	DiscountAmount    int64                         `json:"discount_amount"`
	TotalPrice        int64                         `json:"total_price"`
	CostPriceSnapshot int64                         `json:"cost_price_snapshot"`
	MarginSnapshot    int64                         `json:"margin_snapshot"`
	Items             []SosmedBundlePricingLineItem `json:"items"`
}

type SosmedBundlePricingLineItem struct {
	BundleItemID              string `json:"bundle_item_id,omitempty"`
	SosmedServiceID           string `json:"sosmed_service_id,omitempty"`
	ServiceCodeSnapshot       string `json:"service_code_snapshot"`
	ServiceTitleSnapshot      string `json:"service_title_snapshot"`
	ProviderCodeSnapshot      string `json:"provider_code_snapshot,omitempty"`
	ProviderServiceIDSnapshot string `json:"provider_service_id_snapshot,omitempty"`
	QuantityUnits             int64  `json:"quantity_units"`
	UnitPricePer1KSnapshot    int64  `json:"unit_price_per_1k_snapshot"`
	LinePrice                 int64  `json:"line_price"`
	CostPriceSnapshot         int64  `json:"cost_price_snapshot"`
}

func CalculateSosmedBundlePricing(variant *model.SosmedBundleVariant) (*SosmedBundlePricingResult, error) {
	if variant == nil {
		return nil, errors.New("variant bundle wajib diisi")
	}
	if !variant.IsActive {
		return nil, errors.New("variant bundle sedang nonaktif")
	}
	if len(variant.Items) == 0 {
		return nil, errors.New("variant bundle belum memiliki item layanan")
	}

	result := &SosmedBundlePricingResult{
		Items: make([]SosmedBundlePricingLineItem, 0, len(variant.Items)),
	}

	for _, item := range variant.Items {
		line, err := calculateSosmedBundleLineItem(item)
		if err != nil {
			return nil, err
		}
		result.SubtotalPrice += line.LinePrice
		result.CostPriceSnapshot += line.CostPriceSnapshot
		result.Items = append(result.Items, line)
	}

	priceMode := strings.ToLower(strings.TrimSpace(variant.PriceMode))
	if priceMode == "" {
		priceMode = SosmedBundlePriceModeComputed
	}

	switch priceMode {
	case SosmedBundlePriceModeComputed:
		result.TotalPrice = result.SubtotalPrice
	case SosmedBundlePriceModeFixed:
		if variant.FixedPrice < 0 {
			return nil, errors.New("harga fixed bundle tidak valid")
		}
		result.TotalPrice = variant.FixedPrice
		if result.SubtotalPrice > result.TotalPrice {
			result.DiscountAmount = result.SubtotalPrice - result.TotalPrice
		}
	case SosmedBundlePriceModeComputedWithDiscount:
		discount := calculateSosmedBundleDiscount(result.SubtotalPrice, variant.DiscountPercent, variant.DiscountAmount)
		result.DiscountAmount = discount
		result.TotalPrice = result.SubtotalPrice - discount
	default:
		return nil, fmt.Errorf("mode harga bundle tidak valid: %s", variant.PriceMode)
	}

	if result.TotalPrice < 0 {
		result.TotalPrice = 0
	}
	result.MarginSnapshot = result.TotalPrice - result.CostPriceSnapshot
	return result, nil
}

func calculateSosmedBundleLineItem(item model.SosmedBundleItem) (SosmedBundlePricingLineItem, error) {
	service := item.Service
	serviceCode := strings.TrimSpace(service.Code)
	serviceTitle := strings.TrimSpace(service.Title)
	if serviceTitle == "" {
		serviceTitle = strings.TrimSpace(item.Label)
	}
	if serviceCode == "" && serviceTitle == "" {
		serviceTitle = "layanan bundle"
	}

	if !item.IsActive {
		return SosmedBundlePricingLineItem{}, fmt.Errorf("item bundle %s sedang nonaktif", serviceTitle)
	}
	if !service.IsActive {
		return SosmedBundlePricingLineItem{}, fmt.Errorf("layanan sosmed %s sedang nonaktif", serviceTitle)
	}
	if item.QuantityUnits <= 0 {
		return SosmedBundlePricingLineItem{}, fmt.Errorf("quantity item %s tidak valid", serviceTitle)
	}
	if service.CheckoutPrice <= 0 {
		return SosmedBundlePricingLineItem{}, fmt.Errorf("harga checkout layanan %s belum dikonfigurasi", serviceTitle)
	}
	if err := validateSosmedBundleQuantity(serviceTitle, item.QuantityUnits, service.MinOrder); err != nil {
		return SosmedBundlePricingLineItem{}, err
	}

	linePrice, err := prorateSosmedBundlePerThousand(service.CheckoutPrice, item.QuantityUnits)
	if err != nil {
		return SosmedBundlePricingLineItem{}, err
	}
	costPrice, err := calculateSosmedBundleProviderCost(service.ProviderRate, item.QuantityUnits)
	if err != nil {
		return SosmedBundlePricingLineItem{}, fmt.Errorf("harga modal layanan %s tidak valid", serviceTitle)
	}

	line := SosmedBundlePricingLineItem{
		ServiceCodeSnapshot:       serviceCode,
		ServiceTitleSnapshot:      serviceTitle,
		ProviderCodeSnapshot:      strings.TrimSpace(service.ProviderCode),
		ProviderServiceIDSnapshot: strings.TrimSpace(service.ProviderServiceID),
		QuantityUnits:             item.QuantityUnits,
		UnitPricePer1KSnapshot:    service.CheckoutPrice,
		LinePrice:                 linePrice,
		CostPriceSnapshot:         costPrice,
	}
	if item.ID.String() != "00000000-0000-0000-0000-000000000000" {
		line.BundleItemID = item.ID.String()
	}
	if service.ID.String() != "00000000-0000-0000-0000-000000000000" {
		line.SosmedServiceID = service.ID.String()
	}
	return line, nil
}

func calculateSosmedBundleDiscount(subtotal int64, discountPercent int, discountAmount int64) int64 {
	if subtotal <= 0 {
		return 0
	}
	discount := int64(0)
	if discountPercent > 0 {
		if discountPercent > 100 {
			discountPercent = 100
		}
		discount += int64(math.Floor(float64(subtotal) * float64(discountPercent) / 100))
	}
	if discountAmount > 0 {
		discount += discountAmount
	}
	if discount > subtotal {
		return subtotal
	}
	return discount
}

func prorateSosmedBundlePerThousand(pricePerThousand int64, quantityUnits int64) (int64, error) {
	if pricePerThousand <= 0 || quantityUnits <= 0 {
		return 0, errors.New("harga atau quantity bundle tidak valid")
	}
	if quantityUnits > math.MaxInt64/pricePerThousand {
		return 0, errors.New("harga bundle melebihi batas sistem")
	}
	return (pricePerThousand*quantityUnits + 999) / 1000, nil
}

func calculateSosmedBundleProviderCost(providerRate string, quantityUnits int64) (int64, error) {
	rate, ok, err := parseSosmedBundleMoney(providerRate)
	if err != nil || !ok {
		return 0, err
	}
	if rate <= 0 || quantityUnits <= 0 {
		return 0, nil
	}
	cost := math.Ceil(rate * float64(quantityUnits) / 1000)
	if cost > float64(math.MaxInt64) {
		return 0, errors.New("harga modal bundle melebihi batas sistem")
	}
	return int64(cost), nil
}

func parseSosmedBundleMoney(value string) (float64, bool, error) {
	cleaned := strings.TrimSpace(value)
	if cleaned == "" {
		return 0, false, nil
	}
	cleaned = strings.ReplaceAll(cleaned, "Rp", "")
	cleaned = strings.ReplaceAll(cleaned, "rp", "")
	cleaned = strings.ReplaceAll(cleaned, "IDR", "")
	cleaned = strings.ReplaceAll(cleaned, "idr", "")
	cleaned = strings.ReplaceAll(cleaned, " ", "")
	cleaned = strings.ReplaceAll(cleaned, ",", "")
	rate, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0, true, err
	}
	return rate, true, nil
}

func validateSosmedBundleQuantity(serviceTitle string, quantityUnits int64, minOrderText string) error {
	min, max := parseSosmedBundleMinMax(minOrderText)
	if min > 0 && quantityUnits < min {
		return fmt.Errorf("quantity %s minimum %d", serviceTitle, min)
	}
	if max > 0 && quantityUnits > max {
		return fmt.Errorf("quantity %s maksimum %d", serviceTitle, max)
	}
	return nil
}

func parseSosmedBundleMinMax(value string) (int64, int64) {
	text := strings.ToLower(strings.TrimSpace(value))
	if text == "" {
		return 0, 0
	}

	min := parseSosmedBundleLabeledNumber(text, `(?:min(?:imum)?)\D+(\d[\d\.,]*)`)
	max := parseSosmedBundleLabeledNumber(text, `(?:max(?:imum)?|maks(?:imum)?)\D+(\d[\d\.,]*)`)
	if min > 0 || max > 0 {
		return min, max
	}

	numbers := extractSosmedBundleNumbers(text)
	if len(numbers) >= 2 {
		return numbers[0], numbers[1]
	}
	if len(numbers) == 1 {
		return numbers[0], 0
	}
	return 0, 0
}

func parseSosmedBundleLabeledNumber(text string, pattern string) int64 {
	re := regexp.MustCompile(pattern)
	match := re.FindStringSubmatch(text)
	if len(match) < 2 {
		return 0
	}
	return parseSosmedBundleInteger(match[1])
}

func extractSosmedBundleNumbers(text string) []int64 {
	re := regexp.MustCompile(`\d[\d\.,]*`)
	matches := re.FindAllString(text, -1)
	numbers := make([]int64, 0, len(matches))
	for _, match := range matches {
		if n := parseSosmedBundleInteger(match); n > 0 {
			numbers = append(numbers, n)
		}
	}
	return numbers
}

func parseSosmedBundleInteger(value string) int64 {
	cleaned := strings.ReplaceAll(strings.TrimSpace(value), ".", "")
	cleaned = strings.ReplaceAll(cleaned, ",", "")
	parsed, err := strconv.ParseInt(cleaned, 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}
