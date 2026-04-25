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

	"premiumhub-api/internal/model"
)

const (
	defaultSosmedResellerFXMode      = "fixed"
	defaultSosmedResellerFXRate      = 17000
	defaultSosmedResellerFXLiveURL   = "https://open.er-api.com/v6/latest/USD"
	defaultSosmedResellerFXCodePrefx = "jap-"
	defaultSosmedResellerProvider    = sosmedJAPProviderCode
)

type sosmedTextReplacement struct {
	pattern     *regexp.Regexp
	replacement string
}

var (
	sosmedResellerUSDPattern = regexp.MustCompile(`(?i)USD\s*([0-9]+(?:\.[0-9]+)?)`)
	sosmedCodeSuffixPattern  = regexp.MustCompile(`([0-9]+)$`)

	sosmedProviderTagPattern       = regexp.MustCompile(`(?i)\s*\(JAP\s*#?\d+\)\s*$`)
	sosmedTitleAutoDayPattern      = regexp.MustCompile(`(?i)\bAuto[-\s]*([0-9]{1,4})\s*D\b`)
	sosmedTitleDurationDayPattern  = regexp.MustCompile(`(?i)\b([0-9]{1,4})\s*D\b`)
	sosmedTitleDurationDaysPattern = regexp.MustCompile(`(?i)\b([0-9]{1,4})\s*Days?\b`)
	sosmedTitleTrailingDayPattern  = regexp.MustCompile(`(?i)^(.+?)\s+([0-9]{1,4}\s+Hari)$`)

	sosmedRefillAutoDayPattern = regexp.MustCompile(`(?i)^auto(?:[-\s]*refill)?\s*([0-9]{1,4})\s*(?:d|days?)$`)
	sosmedRefillDayPattern     = regexp.MustCompile(`(?i)^([0-9]{1,4})\s*(?:d|days?)$`)

	sosmedRatePerTimePattern = regexp.MustCompile(`(?i)^\s*(up\s*to\s+)?([0-9]+(?:\.[0-9]+)?)([km]?)\s*/\s*(d|day|days|hr|hrs|hour|hours)\s*$`)

	sosmedTitleGlossaryReplacements = []sosmedTextReplacement{
		{pattern: regexp.MustCompile(`(?i)\bReactions?\s+Mixed\b`), replacement: "Reaksi Campuran"},
		{pattern: regexp.MustCompile(`(?i)\bNon[\s-]?Drop\b`), replacement: "Stabil"},
		{pattern: regexp.MustCompile(`(?i)\bAll\s+Videos?\b`), replacement: "Semua Video"},
		{pattern: regexp.MustCompile(`(?i)\bAuto[-\s]*Refill\b`), replacement: "Refill Otomatis"},
		{pattern: regexp.MustCompile(`(?i)\bREAL\b`), replacement: "Akun Asli"},
		{pattern: regexp.MustCompile(`(?i)\bHQ\b`), replacement: "Kualitas Tinggi"},
	}
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
	ProviderCode    string   `json:"provider_code"`
	DryRun          bool     `json:"dry_run"`
}

type RepriceSosmedResellerResult struct {
	Mode            string  `json:"mode"`
	RateSource      string  `json:"rate_source"`
	RateUsed        float64 `json:"rate_used"`
	Warning         string  `json:"warning,omitempty"`
	CodePrefix      string  `json:"code_prefix"`
	ProviderCode    string  `json:"provider_code"`
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
	providerCode := strings.TrimSpace(strings.ToLower(input.ProviderCode))
	if codePrefix == "" {
		codePrefix = defaultSosmedResellerFXCodePrefx
	}
	if providerCode == "" {
		providerCode = defaultSosmedResellerProvider
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
		ProviderCode:    providerCode,
		IncludeInactive: includeInactive,
		DryRun:          input.DryRun,
		Total:           len(items),
	}

	for idx := range items {
		item := &items[idx]
		if !matchesSosmedResellerCandidate(*item, providerCode, codePrefix) {
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
		if suffix := extractSosmedProviderServiceID(*item); suffix != "" {
			pricePer1K += fmt.Sprintf(" • JAP#%s", suffix)
		}

		nextTitle := item.Title
		nextProviderTitle := item.ProviderTitle
		nextRefill := item.Refill
		nextETA := item.ETA

		if shouldFormatSosmedProviderCopy(*item) {
			providerTitle := strings.TrimSpace(item.ProviderTitle)
			if providerTitle == "" {
				providerTitle = strings.TrimSpace(item.Title)
			}

			if providerTitle != "" {
				nextProviderTitle = providerTitle
				if formattedTitle := formatSosmedDisplayTitle(providerTitle); formattedTitle != "" {
					nextTitle = formattedTitle
				}
			}

			if formattedRefill := formatSosmedRefillValue(item.Refill); formattedRefill != "" {
				nextRefill = formattedRefill
			}
			if formattedETA := formatSosmedETAValue(item.ETA); formattedETA != "" {
				nextETA = formattedETA
			}
		}

		if item.PriceStart == priceStart && item.PricePer1K == pricePer1K &&
			item.Title == nextTitle && item.ProviderTitle == nextProviderTitle &&
			item.Refill == nextRefill && item.ETA == nextETA {
			continue
		}

		if !input.DryRun {
			item.PriceStart = priceStart
			item.PricePer1K = pricePer1K
			item.Title = nextTitle
			item.ProviderTitle = nextProviderTitle
			item.Refill = nextRefill
			item.ETA = nextETA
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

func matchesSosmedResellerCandidate(item model.SosmedService, providerCode, codePrefix string) bool {
	if providerCode != "" && strings.EqualFold(strings.TrimSpace(item.ProviderCode), providerCode) {
		return true
	}
	if codePrefix != "" && strings.HasPrefix(strings.ToLower(strings.TrimSpace(item.Code)), codePrefix) {
		return true
	}
	return false
}

func shouldFormatSosmedProviderCopy(item model.SosmedService) bool {
	return matchesSosmedResellerCandidate(item, defaultSosmedResellerProvider, defaultSosmedResellerFXCodePrefx)
}

func formatSosmedDisplayTitle(providerTitle string) string {
	title := strings.TrimSpace(providerTitle)
	if title == "" {
		return ""
	}

	title = sosmedProviderTagPattern.ReplaceAllString(title, "")
	title = strings.Join(strings.Fields(title), " ")
	if title == "" {
		return ""
	}

	for _, replacement := range sosmedTitleGlossaryReplacements {
		title = replacement.pattern.ReplaceAllString(title, replacement.replacement)
	}

	title = sosmedTitleAutoDayPattern.ReplaceAllString(title, "Refill Otomatis $1 Hari")
	title = sosmedTitleDurationDaysPattern.ReplaceAllString(title, "$1 Hari")
	title = sosmedTitleDurationDayPattern.ReplaceAllString(title, "$1 Hari")
	title = strings.Join(strings.Fields(title), " ")

	if match := sosmedTitleTrailingDayPattern.FindStringSubmatch(title); len(match) == 3 {
		prefix := strings.TrimSpace(match[1])
		duration := strings.TrimSpace(match[2])
		if prefix != "" && duration != "" && !strings.HasSuffix(strings.ToLower(prefix), "refill otomatis") {
			title = fmt.Sprintf("%s (%s)", prefix, duration)
		}
	}

	return strings.TrimSpace(title)
}

func formatSosmedRefillValue(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}

	normalized := strings.ToLower(strings.Join(strings.Fields(value), " "))
	switch normalized {
	case "-", "n/a", "na":
		return "-"
	case "no", "none", "tidak", "tidak ada":
		return "Tidak Ada"
	case "lifetime":
		return "Seumur Layanan"
	}

	if strings.Contains(normalized, "non drop") || strings.Contains(normalized, "nondrop") {
		return "Stabil (Non Drop)"
	}

	if match := sosmedRefillAutoDayPattern.FindStringSubmatch(value); len(match) == 2 {
		return fmt.Sprintf("Otomatis %s Hari", strings.TrimSpace(match[1]))
	}
	if match := sosmedRefillDayPattern.FindStringSubmatch(value); len(match) == 2 {
		return fmt.Sprintf("%s Hari", strings.TrimSpace(match[1]))
	}

	value = sosmedTitleDurationDaysPattern.ReplaceAllString(value, "$1 Hari")
	value = sosmedTitleDurationDayPattern.ReplaceAllString(value, "$1 Hari")
	value = strings.ReplaceAll(value, "Auto-Refill", "Otomatis")
	value = strings.ReplaceAll(value, "auto-refill", "Otomatis")
	value = strings.ReplaceAll(value, "Auto Refill", "Otomatis")
	value = strings.ReplaceAll(value, "auto refill", "Otomatis")
	value = strings.Join(strings.Fields(value), " ")

	return strings.TrimSpace(value)
}

func formatSosmedETAValue(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	if value == "-" {
		return "-"
	}

	if match := sosmedRatePerTimePattern.FindStringSubmatch(value); len(match) == 5 {
		prefix := ""
		if strings.TrimSpace(match[1]) != "" {
			prefix = "Hingga "
		}

		amount := strings.TrimSpace(match[2])
		suffix := strings.ToUpper(strings.TrimSpace(match[3]))
		periodToken := strings.ToLower(strings.TrimSpace(match[4]))

		switch suffix {
		case "K":
			amount += " rb"
		case "M":
			amount += " jt"
		}

		period := "hari"
		switch periodToken {
		case "hr", "hrs", "hour", "hours":
			period = "jam"
		}

		return strings.TrimSpace(prefix + amount + "/" + period)
	}

	value = strings.ReplaceAll(value, "Hrs", "Jam")
	value = strings.ReplaceAll(value, "hrs", "jam")
	value = strings.ReplaceAll(value, "Hr", "Jam")
	value = strings.ReplaceAll(value, "hr", "jam")
	value = strings.ReplaceAll(value, "Hours", "Jam")
	value = strings.ReplaceAll(value, "hours", "jam")
	value = strings.ReplaceAll(value, "Hour", "Jam")
	value = strings.ReplaceAll(value, "hour", "jam")
	value = strings.ReplaceAll(value, "Days", "Hari")
	value = strings.ReplaceAll(value, "days", "hari")
	value = strings.ReplaceAll(value, "Day", "Hari")
	value = strings.ReplaceAll(value, "day", "hari")
	value = strings.Join(strings.Fields(value), " ")

	return strings.TrimSpace(value)
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

func extractSosmedProviderServiceID(item model.SosmedService) string {
	if value := strings.TrimSpace(item.ProviderServiceID); value != "" {
		return value
	}
	return extractSosmedServiceNumericSuffix(item.Code)
}
