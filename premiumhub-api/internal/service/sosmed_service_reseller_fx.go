package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	defaultSosmedResellerFXMode      = "fixed"
	defaultSosmedResellerFXRate      = 17000
	defaultSosmedResellerFXLiveURL   = "https://open.er-api.com/v6/latest/USD"
	defaultSosmedResellerFXCodePrefx = "jap-"
)

var (
	sosmedResellerUSDPattern = regexp.MustCompile(`(?i)USD\s*([0-9]+(?:\.[0-9]+)?)`)
	sosmedCodeSuffixPattern  = regexp.MustCompile(`([0-9]+)$`)
)

type SosmedResellerFXConfig struct {
	Mode        string
	FixedRate   float64
	LiveURL     string
	LiveTimeout time.Duration
}

type RepriceSosmedResellerInput struct {
	Mode            string   `json:"mode"`
	FixedRate       *float64 `json:"fixed_rate"`
	IncludeInactive *bool    `json:"include_inactive"`
	CodePrefix      string   `json:"code_prefix"`
	DryRun          bool     `json:"dry_run"`
}

type RepriceSosmedResellerResult struct {
	Mode            string  `json:"mode"`
	RateSource      string  `json:"rate_source"`
	RateUsed        float64 `json:"rate_used"`
	Warning         string  `json:"warning,omitempty"`
	CodePrefix      string  `json:"code_prefix"`
	IncludeInactive bool    `json:"include_inactive"`
	DryRun          bool    `json:"dry_run"`
	Total           int     `json:"total"`
	Eligible        int     `json:"eligible"`
	Updated         int     `json:"updated"`
	Skipped         int     `json:"skipped"`
}

func NewSosmedResellerFXConfig(mode, fixedRateRaw, liveURL, liveTimeoutRaw string) SosmedResellerFXConfig {
	cfg := SosmedResellerFXConfig{
		Mode:        normalizeResellerFXMode(mode),
		FixedRate:   defaultSosmedResellerFXRate,
		LiveURL:     strings.TrimSpace(liveURL),
		LiveTimeout: 8 * time.Second,
	}

	if cfg.Mode == "" {
		cfg.Mode = defaultSosmedResellerFXMode
	}
	if cfg.LiveURL == "" {
		cfg.LiveURL = defaultSosmedResellerFXLiveURL
	}

	if parsed, err := strconv.ParseFloat(strings.TrimSpace(fixedRateRaw), 64); err == nil && parsed > 0 {
		cfg.FixedRate = parsed
	}

	if parsed, err := time.ParseDuration(strings.TrimSpace(liveTimeoutRaw)); err == nil && parsed > 0 {
		cfg.LiveTimeout = parsed
	}

	return cfg
}

func (s *SosmedServiceService) SetResellerFXConfig(cfg SosmedResellerFXConfig) *SosmedServiceService {
	if normalizeResellerFXMode(cfg.Mode) != "" {
		s.resellerFXConfig.Mode = normalizeResellerFXMode(cfg.Mode)
	}
	if cfg.FixedRate > 0 {
		s.resellerFXConfig.FixedRate = cfg.FixedRate
	}
	if strings.TrimSpace(cfg.LiveURL) != "" {
		s.resellerFXConfig.LiveURL = strings.TrimSpace(cfg.LiveURL)
	}
	if cfg.LiveTimeout > 0 {
		s.resellerFXConfig.LiveTimeout = cfg.LiveTimeout
	}
	if s.resellerFXHTTPClient == nil {
		s.resellerFXHTTPClient = &http.Client{Timeout: s.resellerFXConfig.LiveTimeout}
	}
	return s
}

func (s *SosmedServiceService) RepriceResellerToIDR(ctx context.Context, input RepriceSosmedResellerInput) (*RepriceSosmedResellerResult, error) {
	includeInactive := true
	if input.IncludeInactive != nil {
		includeInactive = *input.IncludeInactive
	}

	codePrefix := strings.TrimSpace(strings.ToLower(input.CodePrefix))
	if codePrefix == "" {
		codePrefix = defaultSosmedResellerFXCodePrefx
	}

	items, err := s.repo.List(includeInactive)
	if err != nil {
		return nil, errors.New("gagal memuat layanan sosmed")
	}

	modeUsed, rateUsed, rateSource, warning, err := s.resolveResellerFXRate(ctx, input.Mode, input.FixedRate)
	if err != nil {
		return nil, err
	}

	result := &RepriceSosmedResellerResult{
		Mode:            modeUsed,
		RateSource:      rateSource,
		RateUsed:        rateUsed,
		Warning:         warning,
		CodePrefix:      codePrefix,
		IncludeInactive: includeInactive,
		DryRun:          input.DryRun,
		Total:           len(items),
	}

	for idx := range items {
		item := &items[idx]
		if codePrefix != "" && !strings.HasPrefix(strings.ToLower(item.Code), codePrefix) {
			result.Skipped++
			continue
		}

		usdPer1K, ok := extractSosmedResellerUSDPer1K(item.PricePer1K, item.PriceStart, item.Summary)
		if !ok || usdPer1K <= 0 {
			result.Skipped++
			continue
		}

		result.Eligible++

		idrPer1K := int64(math.Round(usdPer1K * rateUsed))
		if idrPer1K < 0 {
			idrPer1K = 0
		}
		idrText := formatIDRThousands(idrPer1K)
		usdText := normalizeUSDText(usdPer1K)

		priceStart := fmt.Sprintf("Reseller Rp %s/1K", idrText)
		pricePer1K := fmt.Sprintf("Reseller Rp %s per 1K • USD %s", idrText, usdText)
		if suffix := extractSosmedServiceNumericSuffix(item.Code); suffix != "" {
			pricePer1K += fmt.Sprintf(" • JAP#%s", suffix)
		}

		if item.PriceStart == priceStart && item.PricePer1K == pricePer1K {
			continue
		}

		if !input.DryRun {
			item.PriceStart = priceStart
			item.PricePer1K = pricePer1K
			if err := s.repo.Update(item); err != nil {
				return nil, errors.New("gagal memperbarui harga reseller sosmed")
			}
		}

		result.Updated++
	}

	return result, nil
}

type liveUSDRateResponse struct {
	Result string             `json:"result"`
	Error  string             `json:"error-type"`
	Rates  map[string]float64 `json:"rates"`
}

func (s *SosmedServiceService) resolveResellerFXRate(ctx context.Context, requestedMode string, requestedFixedRate *float64) (modeUsed string, rate float64, source string, warning string, err error) {
	mode := normalizeResellerFXMode(requestedMode)
	if mode == "" {
		mode = s.resellerFXConfig.Mode
	}
	if mode == "" {
		mode = defaultSosmedResellerFXMode
	}

	fixedRate := s.resellerFXConfig.FixedRate
	if requestedFixedRate != nil && *requestedFixedRate > 0 {
		fixedRate = *requestedFixedRate
	}
	if fixedRate <= 0 {
		fixedRate = defaultSosmedResellerFXRate
	}

	if mode == "fixed" {
		return "fixed", fixedRate, "fixed", "", nil
	}

	liveRate, liveErr := s.fetchLiveUSDtoIDR(ctx)
	if liveErr == nil && liveRate > 0 {
		return "live", liveRate, "live", "", nil
	}

	if fixedRate > 0 {
		warn := fmt.Sprintf("Kurs live gagal, fallback ke kurs fixed: %v", liveErr)
		return "fixed", fixedRate, "fixed-fallback", warn, nil
	}

	if liveErr != nil {
		return "", 0, "", "", fmt.Errorf("gagal ambil kurs live: %w", liveErr)
	}

	return "", 0, "", "", errors.New("kurs tidak valid")
}

func (s *SosmedServiceService) fetchLiveUSDtoIDR(ctx context.Context) (float64, error) {
	if s.resellerFXConfig.LiveURL == "" {
		return 0, errors.New("live url belum diatur")
	}

	timeout := s.resellerFXConfig.LiveTimeout
	if timeout <= 0 {
		timeout = 8 * time.Second
	}

	if s.resellerFXHTTPClient == nil || s.resellerFXHTTPClient.Timeout != timeout {
		s.resellerFXHTTPClient = &http.Client{Timeout: timeout}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.resellerFXConfig.LiveURL, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.resellerFXHTTPClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return 0, fmt.Errorf("status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload liveUSDRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, err
	}

	if payload.Result != "" && !strings.EqualFold(payload.Result, "success") {
		if payload.Error != "" {
			return 0, errors.New(payload.Error)
		}
		return 0, fmt.Errorf("provider result: %s", payload.Result)
	}

	rate := payload.Rates["IDR"]
	if rate <= 0 {
		return 0, errors.New("rate IDR tidak ditemukan")
	}
	return rate, nil
}

func normalizeResellerFXMode(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "fixed":
		return "fixed"
	case "live":
		return "live"
	default:
		return ""
	}
}

func extractSosmedResellerUSDPer1K(candidates ...string) (float64, bool) {
	for _, candidate := range candidates {
		raw := strings.TrimSpace(candidate)
		if raw == "" {
			continue
		}
		match := sosmedResellerUSDPattern.FindStringSubmatch(raw)
		if len(match) < 2 {
			continue
		}
		parsed, err := strconv.ParseFloat(strings.TrimSpace(match[1]), 64)
		if err == nil && parsed > 0 {
			return parsed, true
		}
	}
	return 0, false
}

func formatIDRThousands(value int64) string {
	if value < 0 {
		value = 0
	}
	raw := strconv.FormatInt(value, 10)
	if len(raw) <= 3 {
		return raw
	}

	parts := make([]string, 0, (len(raw)+2)/3)
	for len(raw) > 3 {
		parts = append(parts, raw[len(raw)-3:])
		raw = raw[:len(raw)-3]
	}
	if raw != "" {
		parts = append(parts, raw)
	}

	for left, right := 0, len(parts)-1; left < right; left, right = left+1, right-1 {
		parts[left], parts[right] = parts[right], parts[left]
	}

	return strings.Join(parts, ".")
}

func normalizeUSDText(value float64) string {
	if value <= 0 {
		return "0"
	}
	formatted := strconv.FormatFloat(value, 'f', 6, 64)
	formatted = strings.TrimRight(formatted, "0")
	formatted = strings.TrimRight(formatted, ".")
	if strings.HasPrefix(formatted, ".") {
		formatted = "0" + formatted
	}
	if formatted == "" {
		return "0"
	}
	return formatted
}

func extractSosmedServiceNumericSuffix(code string) string {
	match := sosmedCodeSuffixPattern.FindStringSubmatch(strings.TrimSpace(code))
	if len(match) < 2 {
		return ""
	}
	return match[1]
}
