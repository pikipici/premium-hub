package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"gorm.io/gorm"
)

const nokosLandingSourceFiveSim = "5sim"

type nokosLandingFiveSimClient interface {
	GetCountries(ctx context.Context) (map[string]any, error)
	GetProviderOrderHistory(ctx context.Context, category string, limit, offset int, order string, reverse bool) (map[string]any, error)
}

type nokosLandingPaymentGatewayClient interface {
	ListPaymentMethods(ctx context.Context, amount int64) ([]GatewayPaymentMethod, []byte, error)
}

type NokosLandingSummaryResponse struct {
	Source           string     `json:"source"`
	CountriesCount   int64      `json:"countries_count"`
	SentTotalAllTime int64      `json:"sent_total_all_time"`
	PaymentMethods   []string   `json:"payment_methods"`
	LastSyncedAt     *time.Time `json:"last_synced_at"`
	IsStale          bool       `json:"is_stale"`
	LastSyncStatus   string     `json:"last_sync_status"`
}

type NokosLandingCountriesResponse struct {
	Source         string                      `json:"source"`
	Countries      []model.NokosLandingCountry `json:"countries"`
	CountriesCount int64                       `json:"countries_count"`
	LastSyncedAt   *time.Time                  `json:"last_synced_at"`
	IsStale        bool                        `json:"is_stale"`
	LastSyncStatus string                      `json:"last_sync_status"`
}

type NokosLandingSummaryService struct {
	cfg     *config.Config
	repo    *repository.NokosLandingSummaryRepo
	fiveSim nokosLandingFiveSimClient
	gateway nokosLandingPaymentGatewayClient

	syncMu sync.Mutex
}

func NewNokosLandingSummaryService(
	cfg *config.Config,
	repo *repository.NokosLandingSummaryRepo,
	fiveSim nokosLandingFiveSimClient,
	gateway nokosLandingPaymentGatewayClient,
) *NokosLandingSummaryService {
	if fiveSim == nil {
		fiveSim = NewFiveSimClient(cfg)
	}
	if gateway == nil {
		gateway = NewPaymentGatewayClient(cfg)
	}
	return &NokosLandingSummaryService{
		cfg:     cfg,
		repo:    repo,
		fiveSim: fiveSim,
		gateway: gateway,
	}
}

func (s *NokosLandingSummaryService) GetPublicSummary(ctx context.Context) (*NokosLandingSummaryResponse, error) {
	row, err := s.getSnapshot(ctx)
	if err != nil {
		return nil, err
	}
	return s.toResponse(row), nil
}

func (s *NokosLandingSummaryService) GetPublicCountries(ctx context.Context) (*NokosLandingCountriesResponse, error) {
	row, err := s.getSnapshot(ctx)
	if err != nil {
		return nil, err
	}
	return s.toCountriesResponse(row), nil
}

func (s *NokosLandingSummaryService) getSnapshot(ctx context.Context) (*model.NokosLandingSummary, error) {
	row, err := s.repo.FindBySource(nokosLandingSourceFiveSim)
	if err != nil {
		if !errorsIsNotFound(err) {
			return nil, err
		}
		row = &model.NokosLandingSummary{Source: nokosLandingSourceFiveSim}
	}

	if s.isStale(row.LastSyncedAt) {
		timeout := parseConvertWorkerDuration(s.cfg.NokosLandingSyncTimeout, 25*time.Second)
		syncCtx, cancel := context.WithTimeout(ctx, timeout)
		if err := s.Sync(syncCtx); err != nil {
			log.Printf("[nokos-landing] on-demand sync failed: %v", err)
		}
		cancel()

		if refreshed, loadErr := s.repo.FindBySource(nokosLandingSourceFiveSim); loadErr == nil {
			row = refreshed
		}
	}

	return row, nil
}

func (s *NokosLandingSummaryService) Sync(ctx context.Context) error {
	s.syncMu.Lock()
	defer s.syncMu.Unlock()

	row, err := s.repo.FindBySource(nokosLandingSourceFiveSim)
	if err != nil {
		if !errorsIsNotFound(err) {
			return err
		}
		row = &model.NokosLandingSummary{Source: nokosLandingSourceFiveSim}
	}

	countriesCount := row.CountriesCount
	countries := append([]model.NokosLandingCountry{}, row.Countries...)
	activationTotal := row.ActivationSentTotal
	hostingTotal := row.HostingSentTotal
	paymentMethods := row.PaymentMethods

	errorsList := make([]string, 0, 4)

	if fetchedCountries, e := s.fetchCountries(ctx); e != nil {
		errorsList = append(errorsList, "countries:"+e.Error())
	} else {
		countries = fetchedCountries
		countriesCount = int64(len(fetchedCountries))
	}

	if count, e := s.fetchSentTotalByCategory(ctx, "activation"); e != nil {
		errorsList = append(errorsList, "activation_sales:"+e.Error())
	} else {
		activationTotal = count
	}

	if count, e := s.fetchSentTotalByCategory(ctx, "hosting"); e != nil {
		errorsList = append(errorsList, "hosting_sales:"+e.Error())
	} else {
		hostingTotal = count
	}

	if methods, e := s.fetchActivePaymentMethods(ctx); e != nil {
		errorsList = append(errorsList, "payment_methods:"+e.Error())
	} else {
		paymentMethods = methods
	}

	now := time.Now().UTC()
	row.CountriesCount = countriesCount
	row.Countries = countries
	row.ActivationSentTotal = activationTotal
	row.HostingSentTotal = hostingTotal
	row.SentTotalAllTime = activationTotal + hostingTotal
	row.PaymentMethods = paymentMethods
	row.LastSyncedAt = &now

	if len(errorsList) == 0 {
		row.LastSyncStatus = "ok"
		row.LastSyncError = ""
	} else {
		row.LastSyncStatus = "degraded"
		row.LastSyncError = strings.Join(errorsList, "; ")
	}

	if err := s.repo.Save(row); err != nil {
		return err
	}

	if len(errorsList) == 0 {
		log.Printf("[nokos-landing] sync ok countries=%d sent_total=%d methods=%v", row.CountriesCount, row.SentTotalAllTime, row.PaymentMethods)
	} else {
		log.Printf("[nokos-landing] sync degraded countries=%d sent_total=%d methods=%v errors=%s", row.CountriesCount, row.SentTotalAllTime, row.PaymentMethods, row.LastSyncError)
	}

	return nil
}

func (s *NokosLandingSummaryService) fetchCountries(ctx context.Context) ([]model.NokosLandingCountry, error) {
	res, err := s.fiveSim.GetCountries(ctx)
	if err != nil {
		return nil, err
	}
	if len(res) == 0 {
		return []model.NokosLandingCountry{}, nil
	}

	countries := make([]model.NokosLandingCountry, 0, len(res))
	for key, raw := range res {
		upper := strings.ToUpper(strings.TrimSpace(key))
		switch upper {
		case "DATA", "TOTAL", "STATUSES", "PRODUCTNAMES":
			continue
		}

		rec, ok := raw.(map[string]any)
		if !ok {
			continue
		}

		iso := strings.ToUpper(firstMapKey(rec["iso"]))
		dialCode := firstMapKey(rec["prefix"])
		name := strings.TrimSpace(asString(rec["text_en"]))
		if name == "" {
			name = strings.TrimSpace(asString(rec["name"]))
		}
		if name == "" {
			name = titleFromSlug(key)
		}

		countryKey := strings.ToUpper(strings.TrimSpace(iso))
		if countryKey == "" {
			countryKey = strings.ToUpper(strings.TrimSpace(key))
		}

		countries = append(countries, model.NokosLandingCountry{
			Key:      countryKey,
			Name:     name,
			ISO:      strings.ToUpper(strings.TrimSpace(iso)),
			DialCode: strings.TrimSpace(dialCode),
		})
	}

	sort.Slice(countries, func(i, j int) bool {
		if countries[i].Name == countries[j].Name {
			return countries[i].Key < countries[j].Key
		}
		return countries[i].Name < countries[j].Name
	})

	return countries, nil
}

func (s *NokosLandingSummaryService) fetchSentTotalByCategory(ctx context.Context, category string) (int64, error) {
	res, err := s.fiveSim.GetProviderOrderHistory(ctx, category, 1, 0, "id", true)
	if err != nil {
		return 0, err
	}

	if total, ok := sumStatusesCount(res); ok {
		return total, nil
	}

	batch := 100
	offset := 0
	var total int64
	for page := 0; page < 2000; page++ {
		pageRes, e := s.fiveSim.GetProviderOrderHistory(ctx, category, batch, offset, "id", true)
		if e != nil {
			return 0, e
		}

		rows, n := historyRows(pageRes)
		if n == 0 {
			break
		}

		total += countNonCanceledRows(rows)
		offset += n
		if n < batch {
			break
		}
	}

	return total, nil
}

func (s *NokosLandingSummaryService) fetchActivePaymentMethods(ctx context.Context) ([]string, error) {
	if !gatewayCredentialsConfigured(s.cfg) {
		return []string{}, nil
	}

	probeAmount := int64(parseConvertWorkerPositiveInt(s.cfg.NokosLandingMethodProbeAmount, 10000))
	methods, _, err := s.gateway.ListPaymentMethods(ctx, probeAmount)
	if err != nil {
		return nil, err
	}

	activeSet := make(map[string]struct{}, len(methods))
	provider := PaymentGatewayProvider(s.cfg)
	for _, method := range methods {
		code := NormalizePaymentGatewayMethodForProvider(provider, method.Method)
		if code == "" {
			continue
		}
		activeSet[code] = struct{}{}
	}

	candidates := parseMethodCandidatesForProvider(provider, s.cfg.NokosLandingMethodCandidates)
	if len(candidates) == 0 {
		active := make([]string, 0, len(activeSet))
		for method := range activeSet {
			active = append(active, method)
		}
		sort.Strings(active)
		return active, nil
	}

	active := make([]string, 0, len(candidates))
	for _, method := range candidates {
		if _, ok := activeSet[method]; ok {
			active = append(active, method)
		}
	}
	return active, nil
}

func parseMethodCandidates(raw string) []string {
	return parseMethodCandidatesForProvider(paymentGatewayProviderDuitku, raw)
}

func parseMethodCandidatesForProvider(provider, raw string) []string {
	if strings.TrimSpace(raw) == "" {
		raw = "SP,BR,I1,BT"
	}

	seen := map[string]struct{}{}
	out := make([]string, 0, 8)
	for _, part := range strings.Split(raw, ",") {
		method := NormalizePaymentGatewayMethodForProvider(provider, part)
		if method == "" {
			continue
		}
		if _, ok := seen[method]; ok {
			continue
		}
		seen[method] = struct{}{}
		out = append(out, method)
	}
	return out
}

func sumStatusesCount(res map[string]any) (int64, bool) {
	statusesNode, ok := res["Statuses"]
	if !ok || statusesNode == nil {
		return 0, false
	}

	statuses, ok := statusesNode.(map[string]any)
	if !ok || len(statuses) == 0 {
		return 0, false
	}

	var total int64
	for rawStatus, rawCount := range statuses {
		status := normalizeFiveSimOrderStatus(rawStatus)
		if status == fiveSimStatusCanceled || status == fiveSimStatusBanned {
			continue
		}
		n := asInt64(rawCount)
		if n > 0 {
			total += n
		}
	}

	return total, true
}

func historyRows(res map[string]any) ([]map[string]any, int) {
	node, ok := res["Data"]
	if !ok || node == nil {
		return nil, 0
	}

	items, ok := node.([]any)
	if !ok {
		return nil, 0
	}
	rows := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if rec, ok := item.(map[string]any); ok {
			rows = append(rows, rec)
		}
	}
	return rows, len(rows)
}

func countNonCanceledRows(rows []map[string]any) int64 {
	var total int64
	for _, row := range rows {
		status, _ := row["status"].(string)
		norm := normalizeFiveSimOrderStatus(status)
		if norm == fiveSimStatusCanceled || norm == fiveSimStatusBanned {
			continue
		}
		total++
	}
	return total
}

func firstMapKey(v any) string {
	switch m := v.(type) {
	case map[string]any:
		for key := range m {
			return strings.TrimSpace(key)
		}
	case map[string]string:
		for key := range m {
			return strings.TrimSpace(key)
		}
	}
	return ""
}

func asString(v any) string {
	switch s := v.(type) {
	case string:
		return s
	case fmt.Stringer:
		return s.String()
	case json.Number:
		return s.String()
	}
	return ""
}

func titleFromSlug(slug string) string {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return ""
	}
	parts := strings.FieldsFunc(slug, func(r rune) bool {
		return r == '-' || r == '_' || r == ' '
	})
	if len(parts) == 0 {
		parts = []string{slug}
	}
	for i := range parts {
		p := strings.ToLower(parts[i])
		if p == "" {
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + p[1:]
	}
	return strings.Join(parts, " ")
}

func asInt64(v any) int64 {
	switch n := v.(type) {
	case int:
		return int64(n)
	case int32:
		return int64(n)
	case int64:
		return n
	case float32:
		return int64(n)
	case float64:
		return int64(n)
	case json.Number:
		i, err := n.Int64()
		if err == nil {
			return i
		}
		f, err := n.Float64()
		if err == nil {
			return int64(f)
		}
	case string:
		i, err := strconv.ParseInt(strings.TrimSpace(n), 10, 64)
		if err == nil {
			return i
		}
		f, err := strconv.ParseFloat(strings.TrimSpace(n), 64)
		if err == nil {
			return int64(f)
		}
	}
	return 0
}

func (s *NokosLandingSummaryService) isStale(lastSyncedAt *time.Time) bool {
	if lastSyncedAt == nil {
		return true
	}
	staleAfter := parseConvertWorkerDuration(s.cfg.NokosLandingStaleAfter, 30*time.Minute)
	return time.Since(lastSyncedAt.UTC()) > staleAfter
}

func (s *NokosLandingSummaryService) toResponse(row *model.NokosLandingSummary) *NokosLandingSummaryResponse {
	if row == nil {
		return &NokosLandingSummaryResponse{
			Source:           nokosLandingSourceFiveSim,
			CountriesCount:   0,
			SentTotalAllTime: 0,
			PaymentMethods:   []string{},
			LastSyncedAt:     nil,
			IsStale:          true,
			LastSyncStatus:   "unknown",
		}
	}

	return &NokosLandingSummaryResponse{
		Source:           row.Source,
		CountriesCount:   row.CountriesCount,
		SentTotalAllTime: row.SentTotalAllTime,
		PaymentMethods:   append([]string{}, row.PaymentMethods...),
		LastSyncedAt:     row.LastSyncedAt,
		IsStale:          s.isStale(row.LastSyncedAt),
		LastSyncStatus:   row.LastSyncStatus,
	}
}

func (s *NokosLandingSummaryService) toCountriesResponse(row *model.NokosLandingSummary) *NokosLandingCountriesResponse {
	if row == nil {
		return &NokosLandingCountriesResponse{
			Source:         nokosLandingSourceFiveSim,
			Countries:      []model.NokosLandingCountry{},
			CountriesCount: 0,
			LastSyncedAt:   nil,
			IsStale:        true,
			LastSyncStatus: "unknown",
		}
	}

	countries := append([]model.NokosLandingCountry{}, row.Countries...)
	return &NokosLandingCountriesResponse{
		Source:         row.Source,
		Countries:      countries,
		CountriesCount: row.CountriesCount,
		LastSyncedAt:   row.LastSyncedAt,
		IsStale:        s.isStale(row.LastSyncedAt),
		LastSyncStatus: row.LastSyncStatus,
	}
}

func errorsIsNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
