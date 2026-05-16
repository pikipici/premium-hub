package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DigiConnectService struct {
	cfg        *config.Config
	repo       *repository.DigiConnectRepo
	walletRepo *repository.WalletRepo
	httpClient *http.Client
}

type DigiConnectSummaryResponse struct {
	Enabled              bool       `json:"enabled"`
	Status               string     `json:"status"`
	ActivePlanCode       string     `json:"active_plan_code,omitempty"`
	ExpiresAt            *time.Time `json:"expires_at,omitempty"`
	PayPerRequestEnabled bool       `json:"pay_per_request_enabled"`
	APIKeysCount         int        `json:"api_keys_count"`
}

type DigiConnectAPIKeyResponse struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	KeyPrefix  string     `json:"key_prefix"`
	MaskedKey  string     `json:"masked_key"`
	PlainKey   string     `json:"plain_key,omitempty"`
	Status     string     `json:"status"`
	LastUsedAt *time.Time `json:"last_used_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

type DigiConnectRequestListResponse struct {
	ID              string     `json:"id"`
	RequestID       string     `json:"request_id"`
	ServiceAlias    string     `json:"service_alias"`
	RequestType     string     `json:"request_type"`
	PlanCode        string     `json:"plan_code,omitempty"`
	RouterProvider  string     `json:"router_provider,omitempty"`
	RouterModel     string     `json:"router_model,omitempty"`
	Status          string     `json:"status"`
	InputPreview    string     `json:"input_preview"`
	BillingDecision string     `json:"billing_decision"`
	BillingStatus   string     `json:"billing_status"`
	BillingSource   string     `json:"billing_source"`
	Amount          int64      `json:"amount"`
	Currency        string     `json:"currency"`
	PublicErrorCode string     `json:"public_error_code,omitempty"`
	RouterStatus    int        `json:"router_status"`
	RouterLatencyMS int64      `json:"router_latency_ms"`
	StartedAt       *time.Time `json:"started_at"`
	CompletedAt     *time.Time `json:"completed_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

type DigiConnectAdminOverviewResponse struct {
	Router        map[string]interface{} `json:"router"`
	StatusCounts  map[string]int64       `json:"status_counts"`
	TodayCounts   map[string]int64       `json:"today_counts"`
	ChargedCount  int64                  `json:"charged_count"`
	ChargedAmount int64                  `json:"charged_amount"`
	GeneratedAt   time.Time              `json:"generated_at"`
}

type DigiConnectDashboardResponse struct {
	GeneratedAt time.Time                          `json:"generated_at"`
	Plans       []DigiConnectPlanDashboardResponse `json:"plans"`
}

type DigiConnectPlanDashboardResponse struct {
	Plan              DigiConnectPlanResponse          `json:"plan"`
	Entitlement       *model.DigiConnectEntitlement    `json:"entitlement,omitempty"`
	Stats             DigiConnectPlanStatsResponse     `json:"stats"`
	RecentRequests    []DigiConnectRequestListResponse `json:"recent_requests"`
	DashboardHeadline string                           `json:"dashboard_headline"`
	DashboardSummary  string                           `json:"dashboard_summary"`
}

type DigiConnectPlanStatsResponse struct {
	TotalRequests  int64      `json:"total_requests"`
	CompletedCount int64      `json:"completed_count"`
	ChargedAmount  int64      `json:"charged_amount"`
	AvgLatencyMS   int64      `json:"avg_latency_ms"`
	LastRequestAt  *time.Time `json:"last_request_at,omitempty"`
}

type DigiConnectCreateAPIKeyInput struct {
	Name string `json:"name"`
}

type DigiConnectAPIRequestInput struct {
	Service  string                 `json:"service"`
	Type     string                 `json:"type"`
	Input    string                 `json:"input"`
	Options  map[string]interface{} `json:"options"`
	Metadata map[string]interface{} `json:"metadata"`
}

type DigiConnectPlanTabResponse struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	PlanCode  string `json:"plan_code"`
	Badge     string `json:"badge,omitempty"`
	SortOrder int    `json:"sort_order"`
}

type DigiConnectPlanResponse struct {
	Code                 string   `json:"code"`
	TabKey               string   `json:"tab_key"`
	TabLabel             string   `json:"tab_label"`
	Name                 string   `json:"name"`
	ShortName            string   `json:"short_name"`
	Description          string   `json:"description"`
	Price                int64    `json:"price"`
	PriceLabel           string   `json:"price_label"`
	BillingModel         string   `json:"billing_model"`
	DurationDays         int      `json:"duration_days"`
	DailyFairUseLimit    int      `json:"daily_fair_use_limit"`
	PayPerRequestEnabled bool     `json:"pay_per_request_enabled"`
	ModelLabels          []string `json:"model_labels,omitempty"`
	ModelIDs             []string `json:"model_ids,omitempty"`
	Features             []string `json:"features,omitempty"`
	CTA                  string   `json:"cta"`
	StockManaged         bool     `json:"stock_managed"`
	StockTotal           int      `json:"stock_total,omitempty"`
	StockUsed            int      `json:"stock_used,omitempty"`
	StockRemaining       int      `json:"stock_remaining,omitempty"`
	Available            bool     `json:"available"`
	UnavailableReason    string   `json:"unavailable_reason,omitempty"`
}

type DigiConnectPlansResponse struct {
	DefaultTab string                       `json:"default_tab"`
	Tabs       []DigiConnectPlanTabResponse `json:"tabs"`
	Plans      []DigiConnectPlanResponse    `json:"plans"`
}

type DigiConnectCheckoutInput struct {
	PlanCode string `json:"plan_code" binding:"required"`
}

type DigiConnectProvisionEntitlementInput struct {
	UserID                      string `json:"user_id" binding:"required"`
	PlanCode                    string `json:"plan_code"`
	BillingModel                string `json:"billing_model"`
	Price                       int64  `json:"price"`
	DurationDays                int    `json:"duration_days"`
	PayPerRequestEnabled        bool   `json:"pay_per_request_enabled"`
	OveragePayPerRequestEnabled bool   `json:"overage_pay_per_request_enabled"`
	DailyFairUseLimit           int    `json:"daily_fair_use_limit"`
	CustomRateLimitProfile      string `json:"custom_rate_limit_profile"`
}

func NewDigiConnectService(cfg *config.Config, repo *repository.DigiConnectRepo) *DigiConnectService {
	return &DigiConnectService{cfg: cfg, repo: repo, httpClient: &http.Client{Timeout: parseDigiConnectTimeout(cfg)}}
}

func (s *DigiConnectService) SetWalletRepo(walletRepo *repository.WalletRepo) *DigiConnectService {
	s.walletRepo = walletRepo
	return s
}

const digiConnectTwoDayStockTotal = 10

var digiConnectCXModelLabels = []string{"GPT 5.5", "GPT 5.4", "GPT 5.3 Codex", "GPT 5.3 Codex XHigh", "GPT 5.3 Codex High", "GPT 5.3 Codex Low", "GPT 5.3 Codex None", "GPT 5.3 Codex Spark", "GPT 5.2 Codex", "GPT 5.2", "GPT 5.1 Codex Max", "GPT 5.1 Codex"}

var digiConnectCXModelIDs = []string{"cx/gpt-5.5", "cx/gpt-5.4", "cx/gpt-5.3-codex", "cx/gpt-5.3-codex-xhigh", "cx/gpt-5.3-codex-high", "cx/gpt-5.3-codex-low", "cx/gpt-5.3-codex-none", "cx/gpt-5.3-codex-spark", "cx/gpt-5.2-codex", "cx/gpt-5.2", "cx/gpt-5.1-codex-max", "cx/gpt-5.1-codex"}

var digiConnectPremiumModelIDs = []string{"kr/claude-opus-4.6", "kr/claude-opus-4.7", "kr/auto", "kr/claude-opus-4.5", "kr/claude-sonnet-4.6", "kr/claude-sonnet-4.5", "kr/claude-haiku-4.5", "kr/deepseek-3.2", "kr/qwen3-coder-next", "kr/glm-5", "kr/MiniMax-M2.5"}

type digiConnectRouterPlanRoute struct {
	Provider string
	ModelIDs []string
}

type digiConnectResolvedRouterRoute struct {
	Provider string
	ModelID  string
}

var digiConnectRouterPlanRoutes = map[string]digiConnectRouterPlanRoute{
	"digiconnect_ppr_hemat":   {Provider: "codex", ModelIDs: digiConnectCXModelIDs},
	"digiconnect_ppr_premium": {Provider: "kiro", ModelIDs: digiConnectPremiumModelIDs},
	"digiconnect_2d":          {Provider: "codex", ModelIDs: digiConnectCXModelIDs},
}

func routeDigiConnectRequest(planCode string, input DigiConnectAPIRequestInput) digiConnectResolvedRouterRoute {
	planRoute, ok := digiConnectRouterPlanRoutes[strings.TrimSpace(planCode)]
	if !ok || len(planRoute.ModelIDs) == 0 {
		planRoute = digiConnectRouterPlanRoute{Provider: "codex", ModelIDs: digiConnectCXModelIDs}
	}
	selectedModel := strings.TrimSpace(optionString(input.Options, "model"))
	if !containsString(planRoute.ModelIDs, selectedModel) {
		selectedModel = planRoute.ModelIDs[0]
	}
	return digiConnectResolvedRouterRoute{Provider: planRoute.Provider, ModelID: selectedModel}
}

func optionString(options map[string]interface{}, key string) string {
	if options == nil {
		return ""
	}
	value, _ := options[key].(string)
	return value
}

func containsString(values []string, needle string) bool {
	needle = strings.TrimSpace(needle)
	if needle == "" {
		return false
	}
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

func (s *DigiConnectService) PublicPlans() []DigiConnectPlanResponse {
	return s.PublicPlansView().Plans
}

func (s *DigiConnectService) PublicPlansView() DigiConnectPlansResponse {
	now := time.Now()
	twoDayStockUsed := int64(0)
	if s.repo != nil {
		if count, err := s.repo.CountActiveEntitlementsByPlan("digiconnect_2d", now); err == nil {
			twoDayStockUsed = count
		}
	}
	twoDayRemaining := digiConnectTwoDayStockTotal - int(twoDayStockUsed)
	if twoDayRemaining < 0 {
		twoDayRemaining = 0
	}
	twoDayAvailable := twoDayRemaining > 0
	plans := []DigiConnectPlanResponse{
		{
			Code:                 "digiconnect_ppr_hemat",
			TabKey:               "ppr_hemat",
			TabLabel:             "Rp150/request",
			Name:                 "Bayar per Request Hemat",
			ShortName:            "Hemat",
			Description:          "Akses model GPT pilihan dengan biaya lebih ringan, bayar hanya request billable yang berhasil.",
			Price:                150,
			PriceLabel:           "Rp150/request",
			BillingModel:         "pay_per_request",
			PayPerRequestEnabled: true,
			ModelLabels:          digiConnectCXModelLabels,
			ModelIDs:             digiConnectCXModelIDs,
			Features:             []string{"Bayar hanya request sukses", "Cocok untuk workflow hemat", "OpenAI-compatible Models, Chat, dan Responses"},
			CTA:                  "Aktifkan Rp150/request",
			Available:            true,
		},
		{
			Code:                 "digiconnect_ppr_premium",
			TabKey:               "ppr_premium",
			TabLabel:             "Rp200/request",
			Name:                 "Bayar per Request Premium",
			ShortName:            "Premium",
			Description:          "Akses model AI premium tanpa paket durasi, cocok buat workflow yang butuh pilihan model lebih kuat.",
			Price:                200,
			PriceLabel:           "Rp200/request",
			BillingModel:         "pay_per_request",
			PayPerRequestEnabled: true,
			ModelLabels:          []string{"Claude Opus 4.6", "Claude Opus 4.7", "Auto", "Claude Opus 4.5", "Claude Sonnet 4.6", "Claude Sonnet 4.5", "Claude Haiku 4.5", "DeepSeek 3.2", "Qwen3 Coder Next", "GLM 5", "MiniMax M2.5"},
			ModelIDs:             digiConnectPremiumModelIDs,
			Features:             []string{"Model premium dan auto-router", "Bayar hanya request sukses", "OpenAI-compatible Models, Chat, dan Responses"},
			CTA:                  "Aktifkan Rp200/request",
			Available:            true,
		},
		{
			Code:                 "digiconnect_2d",
			TabKey:               "package_2d",
			TabLabel:             "Paket 2 hari",
			Name:                 "Paket 2 Hari",
			ShortName:            "2 Hari",
			Description:          "Aktif 2 hari untuk request fair-use. Cocok buat sprint pendek, testing intensif, atau demo client.",
			Price:                15000,
			PriceLabel:           "Rp15.000 / 2 hari",
			BillingModel:         "duration_package",
			DurationDays:         2,
			DailyFairUseLimit:    1000,
			PayPerRequestEnabled: false,
			ModelLabels:          digiConnectCXModelLabels,
			ModelIDs:             digiConnectCXModelIDs,
			Features:             []string{"Aktif 2 hari sejak checkout", "Fair-use 1000 request per hari", "Stok terbatas untuk menjaga kapasitas"},
			CTA:                  "Beli paket Rp15.000",
			StockManaged:         true,
			StockTotal:           digiConnectTwoDayStockTotal,
			StockUsed:            int(twoDayStockUsed),
			StockRemaining:       twoDayRemaining,
			Available:            twoDayAvailable,
			UnavailableReason:    map[bool]string{true: "", false: "stok_habis"}[twoDayAvailable],
		},
	}
	return DigiConnectPlansResponse{
		DefaultTab: plans[0].TabKey,
		Tabs:       tabsForDigiConnectPlans(plans),
		Plans:      plans,
	}
}

func tabsForDigiConnectPlans(plans []DigiConnectPlanResponse) []DigiConnectPlanTabResponse {
	tabs := make([]DigiConnectPlanTabResponse, 0, len(plans))
	for i, plan := range plans {
		tabs = append(tabs, DigiConnectPlanTabResponse{Key: plan.TabKey, Label: plan.TabLabel, PlanCode: plan.Code, Badge: plan.ShortName, SortOrder: i + 1})
	}
	return tabs
}

func dashboardHeadlineForDigiConnectPlan(plan DigiConnectPlanResponse) string {
	switch plan.Code {
	case "digiconnect_ppr_hemat":
		return "Dashboard request hemat"
	case "digiconnect_ppr_premium":
		return "Dashboard model premium"
	case "digiconnect_2d":
		return "Dashboard paket 2 hari"
	default:
		return "Dashboard " + plan.Name
	}
}

func dashboardSummaryForDigiConnectPlan(plan DigiConnectPlanResponse) string {
	switch plan.Code {
	case "digiconnect_ppr_hemat":
		return "Pantau request hemat, saldo terpakai, dan model CX yang sering dipakai."
	case "digiconnect_ppr_premium":
		return "Pantau request premium, biaya wallet, dan akses model kelas atas."
	case "digiconnect_2d":
		return "Pantau masa aktif paket, fair-use harian, stok, dan request yang masuk ke kuota paket."
	default:
		return plan.Description
	}
}

func (s *DigiConnectService) Summary(userID uuid.UUID) (*DigiConnectSummaryResponse, error) {
	keys, err := s.repo.ListAPIKeysByUser(userID)
	if err != nil {
		return nil, err
	}
	res := &DigiConnectSummaryResponse{Enabled: s.cfg != nil && s.cfg.DigiConnectEnabled, Status: "inactive", APIKeysCount: len(keys)}
	entitlement, err := s.repo.FindActiveEntitlementByUser(userID, time.Now())
	if err == nil {
		res.Status = entitlement.Status
		res.ActivePlanCode = entitlement.PlanCode
		res.ExpiresAt = entitlement.ExpiresAt
		res.PayPerRequestEnabled = entitlement.PayPerRequestEnabled
		return res, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return res, nil
	}
	return nil, err
}

func (s *DigiConnectService) ListAPIKeys(userID uuid.UUID) ([]DigiConnectAPIKeyResponse, error) {
	rows, err := s.repo.ListAPIKeysByUser(userID)
	if err != nil {
		return nil, err
	}
	res := make([]DigiConnectAPIKeyResponse, 0, len(rows))
	for _, row := range rows {
		res = append(res, mapDigiConnectAPIKey(row, ""))
	}
	return res, nil
}

func (s *DigiConnectService) ListEntitlements(userID uuid.UUID) ([]model.DigiConnectEntitlement, error) {
	return s.repo.ListEntitlementsByUser(userID)
}

func (s *DigiConnectService) ListRequests(userID uuid.UUID, page, limit int) ([]DigiConnectRequestListResponse, int64, error) {
	rows, total, err := s.repo.ListRequestsByUser(userID, page, limit)
	if err != nil {
		return nil, 0, err
	}
	return mapDigiConnectRequests(rows), total, nil
}

func (s *DigiConnectService) Dashboard(userID uuid.UUID) (*DigiConnectDashboardResponse, error) {
	now := time.Now()
	plans := s.PublicPlans()
	entitlements, err := s.repo.ListEntitlementsByUser(userID)
	if err != nil {
		return nil, err
	}
	entitlementByPlan := make(map[string]*model.DigiConnectEntitlement, len(entitlements))
	for i := range entitlements {
		item := &entitlements[i]
		if item.Status == "active" && (item.ExpiresAt == nil || item.ExpiresAt.After(now)) {
			if existing := entitlementByPlan[item.PlanCode]; existing == nil || item.CreatedAt.After(existing.CreatedAt) {
				entitlementByPlan[item.PlanCode] = item
			}
		}
	}
	statsByPlan, err := s.repo.RequestPlanStatsByUser(userID, time.Time{})
	if err != nil {
		return nil, err
	}
	items := make([]DigiConnectPlanDashboardResponse, 0, len(plans))
	for _, plan := range plans {
		recentRows, err := s.repo.ListRequestsByUserAndPlan(userID, plan.Code, 5)
		if err != nil {
			return nil, err
		}
		stat := statsByPlan[plan.Code]
		items = append(items, DigiConnectPlanDashboardResponse{
			Plan:              plan,
			Entitlement:       entitlementByPlan[plan.Code],
			Stats:             DigiConnectPlanStatsResponse{TotalRequests: stat.TotalRequests, CompletedCount: stat.CompletedCount, ChargedAmount: stat.ChargedAmount, AvgLatencyMS: int64(stat.AvgLatencyMS + 0.5), LastRequestAt: stat.LastRequestAt},
			RecentRequests:    mapDigiConnectRequests(recentRows),
			DashboardHeadline: dashboardHeadlineForDigiConnectPlan(plan),
			DashboardSummary:  dashboardSummaryForDigiConnectPlan(plan),
		})
	}
	return &DigiConnectDashboardResponse{GeneratedAt: now, Plans: items}, nil
}

func (s *DigiConnectService) AdminListRequests(filter repository.DigiConnectAdminRequestFilter) ([]model.DigiConnectRequest, int64, error) {
	return s.repo.AdminListRequests(filter)
}

func (s *DigiConnectService) AdminListEntitlements(userID uuid.UUID, page, limit int) ([]model.DigiConnectEntitlement, int64, error) {
	return s.repo.AdminListEntitlements(userID, page, limit)
}

func (s *DigiConnectService) CheckoutWithWallet(userID uuid.UUID, input DigiConnectCheckoutInput) (*model.DigiConnectEntitlement, error) {
	if s.walletRepo == nil {
		return nil, errors.New("wallet belum dikonfigurasi")
	}
	var selected *DigiConnectPlanResponse
	for _, plan := range s.PublicPlans() {
		if plan.Code == strings.TrimSpace(input.PlanCode) {
			p := plan
			selected = &p
			break
		}
	}
	if selected == nil {
		return nil, errors.New("plan DigiConnect tidak valid")
	}
	var entitlement *model.DigiConnectEntitlement
	reference := "digiconnect:plan:" + userID.String() + ":" + selected.Code + ":" + time.Now().Format("20060102150405")
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		user, err := s.walletRepo.LockUserByIDTx(tx, userID)
		if err != nil {
			return err
		}
		now := time.Now()
		var expiresAt *time.Time
		if selected.DurationDays > 0 {
			expiry := now.AddDate(0, 0, selected.DurationDays)
			expiresAt = &expiry
		}
		if selected.StockManaged && selected.StockRemaining <= 0 {
			return errors.New("stok paket DigiConnect sedang habis")
		}
		if selected.BillingModel != "pay_per_request" {
			if user.WalletBalance < selected.Price {
				return errors.New("saldo wallet tidak cukup")
			}
			before := user.WalletBalance
			after := before - selected.Price
			user.WalletBalance = after
			if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
				return err
			}
			if err := s.walletRepo.CreateLedgerTx(tx, &model.WalletLedger{UserID: userID, Type: "debit", Category: "digiconnect_plan", Amount: selected.Price, BalanceBefore: before, BalanceAfter: after, Reference: reference, Description: "Pembelian paket " + selected.Name}); err != nil {
				return err
			}
		} else if user.WalletBalance < selected.Price {
			return errors.New("saldo wallet minimal harus cukup untuk 1 request")
		}
		entitlement = &model.DigiConnectEntitlement{UserID: userID, PlanCode: selected.Code, BillingModel: selected.BillingModel, Status: "active", Price: selected.Price, StartsAt: now, ExpiresAt: expiresAt, PayPerRequestEnabled: selected.PayPerRequestEnabled, OveragePayPerRequestEnabled: true, DailyFairUseLimit: selected.DailyFairUseLimit}
		return tx.Create(entitlement).Error
	})
	if err != nil {
		return nil, err
	}
	return entitlement, nil
}

func (s *DigiConnectService) AdminProvisionEntitlement(input DigiConnectProvisionEntitlementInput) (*model.DigiConnectEntitlement, error) {
	userID, err := uuid.Parse(strings.TrimSpace(input.UserID))
	if err != nil {
		return nil, errors.New("user_id tidak valid")
	}
	planCode := strings.TrimSpace(input.PlanCode)
	if planCode == "" {
		planCode = "digiconnect_starter"
	}
	billingModel := strings.TrimSpace(input.BillingModel)
	if billingModel == "" {
		billingModel = "manual_admin"
	}
	durationDays := input.DurationDays
	if durationDays <= 0 {
		durationDays = 30
	}
	if input.Price < 0 {
		return nil, errors.New("harga tidak valid")
	}
	if input.DailyFairUseLimit < 0 {
		return nil, errors.New("daily fair use tidak valid")
	}
	now := time.Now()
	expiresAt := now.AddDate(0, 0, durationDays)
	entitlement := &model.DigiConnectEntitlement{UserID: userID, PlanCode: planCode, BillingModel: billingModel, Status: "active", Price: input.Price, StartsAt: now, ExpiresAt: &expiresAt, PayPerRequestEnabled: input.PayPerRequestEnabled, OveragePayPerRequestEnabled: input.OveragePayPerRequestEnabled, DailyFairUseLimit: input.DailyFairUseLimit, CustomRateLimitProfile: strings.TrimSpace(input.CustomRateLimitProfile)}
	if err := s.repo.CreateEntitlement(entitlement); err != nil {
		return nil, err
	}
	return entitlement, nil
}

func (s *DigiConnectService) AdminOverview() (*DigiConnectAdminOverviewResponse, error) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	statusCounts, err := s.repo.RequestStatusCounts(time.Time{})
	if err != nil {
		return nil, err
	}
	todayCounts, err := s.repo.RequestStatusCounts(startOfDay)
	if err != nil {
		return nil, err
	}
	chargedCount, chargedAmount, err := s.repo.RequestBillingSum(startOfDay)
	if err != nil {
		return nil, err
	}
	return &DigiConnectAdminOverviewResponse{Router: s.RouterHealth(), StatusCounts: statusCounts, TodayCounts: todayCounts, ChargedCount: chargedCount, ChargedAmount: chargedAmount, GeneratedAt: now}, nil
}

func (s *DigiConnectService) CreateAPIKey(userID uuid.UUID, input DigiConnectCreateAPIKeyInput) (*DigiConnectAPIKeyResponse, error) {
	material, err := GenerateDigiConnectAPIKey()
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = "Default key"
	}
	key := &model.DigiConnectAPIKey{UserID: userID, Name: name, KeyPrefix: material.Prefix, KeyHash: material.Hash, Status: "active"}
	if err := s.repo.CreateAPIKey(key); err != nil {
		return nil, err
	}
	res := mapDigiConnectAPIKey(*key, material.Plain)
	return &res, nil
}

func (s *DigiConnectService) RouterHealth() map[string]interface{} {
	base := ""
	if s.cfg != nil {
		base = strings.TrimRight(s.cfg.DigiConnectRouterBaseURL, "/")
	}
	return map[string]interface{}{"status": "not_checked", "router_configured": base != "", "checked_at": time.Now()}
}

type OpenAICompatibleResponseInput struct {
	Model           string                 `json:"model"`
	Input           interface{}            `json:"input"`
	Instructions    string                 `json:"instructions"`
	Temperature     *float64               `json:"temperature"`
	MaxOutputTokens *int                   `json:"max_output_tokens"`
	Metadata        map[string]interface{} `json:"metadata"`
}

type OpenAICompatibleChatMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type OpenAICompatibleChatInput struct {
	Model       string                        `json:"model"`
	Messages    []OpenAICompatibleChatMessage `json:"messages"`
	Temperature *float64                      `json:"temperature"`
	MaxTokens   *int                          `json:"max_tokens"`
	Stream      bool                          `json:"stream"`
	Metadata    map[string]interface{}        `json:"metadata"`
}

func (s *DigiConnectService) OpenAICompatibleModels(apiKey string) ([]string, DigiConnectPublicError) {
	key, entitlement, publicErr := s.validateOpenAICompatibleAccess(apiKey)
	_ = key
	if publicErr.Code != "" {
		return nil, publicErr
	}
	return modelIDsForDigiConnectEntitlement(entitlement), DigiConnectPublicError{}
}

func (s *DigiConnectService) CreateOpenAICompatibleResponse(ctx context.Context, apiKey string, input OpenAICompatibleResponseInput, idempotencyKey string) (map[string]interface{}, DigiConnectPublicError) {
	_, entitlement, publicErr := s.validateOpenAICompatibleAccess(apiKey)
	if publicErr.Code != "" {
		return nil, publicErr
	}
	modelID := strings.TrimSpace(input.Model)
	if modelID == "" || !containsDigiConnectModel(modelIDsForDigiConnectEntitlement(entitlement), modelID) {
		return nil, MapDigiConnectPublicError("UNSUPPORTED_TYPE")
	}
	textInput := normalizeOpenAICompatibleInput(input.Input)
	if strings.TrimSpace(input.Instructions) != "" {
		textInput = strings.TrimSpace(input.Instructions) + "\n\n" + textInput
	}
	options := map[string]interface{}{"model": modelID}
	if input.Temperature != nil {
		options["temperature"] = *input.Temperature
	}
	if input.MaxOutputTokens != nil {
		options["max_output_tokens"] = *input.MaxOutputTokens
	}
	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metadata["compat"] = "openai_responses"
	res, err := s.CreateAPIRequest(ctx, apiKey, DigiConnectAPIRequestInput{Service: "digiconnect-smart", Type: "text", Input: textInput, Options: options, Metadata: metadata}, idempotencyKey)
	if err.Code != "" {
		return nil, err
	}
	requestID, _ := res["request_id"].(string)
	if requestID == "" {
		requestID = "resp_" + uuid.NewString()
	}
	return map[string]interface{}{
		"id":         requestID,
		"object":     "response",
		"created_at": time.Now().Unix(),
		"model":      modelID,
		"status":     "completed",
		"output": []map[string]interface{}{{
			"id":     "msg_" + uuid.NewString(),
			"type":   "message",
			"role":   "assistant",
			"status": "completed",
			"content": []map[string]interface{}{{
				"type":        "output_text",
				"text":        extractDigiConnectText(res),
				"annotations": []interface{}{},
			}},
		}},
		"usage":       openAICompatibleUsageFromResult(res),
		"digiconnect": res,
	}, DigiConnectPublicError{}
}

func (s *DigiConnectService) CreateOpenAICompatibleChatCompletion(ctx context.Context, apiKey string, input OpenAICompatibleChatInput, idempotencyKey string) (map[string]interface{}, DigiConnectPublicError) {
	_, entitlement, publicErr := s.validateOpenAICompatibleAccess(apiKey)
	if publicErr.Code != "" {
		return nil, publicErr
	}
	modelID := strings.TrimSpace(input.Model)
	if modelID == "" || !containsDigiConnectModel(modelIDsForDigiConnectEntitlement(entitlement), modelID) {
		return nil, MapDigiConnectPublicError("UNSUPPORTED_TYPE")
	}
	if len(input.Messages) == 0 {
		return nil, MapDigiConnectPublicError("MISSING_INPUT")
	}
	textInput := normalizeOpenAICompatibleMessages(input.Messages)
	options := map[string]interface{}{"model": modelID}
	if input.Temperature != nil {
		options["temperature"] = *input.Temperature
	}
	if input.MaxTokens != nil {
		options["max_tokens"] = *input.MaxTokens
	}
	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metadata["compat"] = "openai_chat_completions"
	res, err := s.CreateAPIRequest(ctx, apiKey, DigiConnectAPIRequestInput{Service: "digiconnect-smart", Type: "text", Input: textInput, Options: options, Metadata: metadata}, idempotencyKey)
	if err.Code != "" {
		return nil, err
	}
	requestID, _ := res["request_id"].(string)
	if requestID == "" {
		requestID = "chatcmpl_" + uuid.NewString()
	}
	return map[string]interface{}{
		"id":      requestID,
		"object":  "chat.completion",
		"created": time.Now().Unix(),
		"model":   modelID,
		"choices": []map[string]interface{}{{
			"index":         0,
			"message":       map[string]interface{}{"role": "assistant", "content": extractDigiConnectText(res)},
			"finish_reason": "stop",
		}},
		"usage":       map[string]int{"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
		"digiconnect": res,
	}, DigiConnectPublicError{}
}

func (s *DigiConnectService) validateOpenAICompatibleAccess(apiKey string) (*model.DigiConnectAPIKey, *model.DigiConnectEntitlement, DigiConnectPublicError) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, nil, MapDigiConnectPublicError("MISSING_API_KEY")
	}
	key, err := s.repo.FindAPIKeyByHash(HashDigiConnectSecret(apiKey))
	if err != nil || key.Status != "active" {
		return nil, nil, MapDigiConnectPublicError("INVALID_API_KEY")
	}
	entitlement, err := s.repo.FindActiveEntitlementByUser(key.UserID, time.Now())
	if err != nil || entitlement == nil || entitlement.ID == uuid.Nil {
		return nil, nil, MapDigiConnectPublicError("NO_ACTIVE_ENTITLEMENT")
	}
	return key, entitlement, DigiConnectPublicError{}
}

func modelIDsForDigiConnectEntitlement(entitlement *model.DigiConnectEntitlement) []string {
	if entitlement == nil {
		return nil
	}
	if entitlement.PlanCode == "digiconnect_ppr_premium" {
		return digiConnectPremiumModelIDs
	}
	return digiConnectCXModelIDs
}

func containsDigiConnectModel(models []string, modelID string) bool {
	for _, item := range models {
		if item == modelID {
			return true
		}
	}
	return false
}

func normalizeOpenAICompatibleMessages(messages []OpenAICompatibleChatMessage) string {
	parts := make([]string, 0, len(messages))
	for _, message := range messages {
		role := strings.TrimSpace(message.Role)
		if role == "" {
			role = "message"
		}
		content := normalizeOpenAICompatibleInput(message.Content)
		if strings.TrimSpace(content) == "" {
			continue
		}
		parts = append(parts, role+": "+content)
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func normalizeOpenAICompatibleInput(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []interface{}:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			parts = append(parts, normalizeOpenAICompatibleInput(item))
		}
		return strings.TrimSpace(strings.Join(parts, "\n"))
	case map[string]interface{}:
		if text, ok := typed["text"].(string); ok {
			return text
		}
		if content, ok := typed["content"]; ok {
			return normalizeOpenAICompatibleInput(content)
		}
	}
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

func openAICompatibleUsageFromResult(res map[string]interface{}) map[string]int {
	usage := map[string]int{"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
	router, ok := res["router_response"].(map[string]interface{})
	if !ok {
		return usage
	}
	routerUsage, ok := router["usage"].(map[string]interface{})
	if !ok {
		return usage
	}
	for _, key := range []string{"input_tokens", "output_tokens", "total_tokens"} {
		if value, ok := routerUsage[key].(float64); ok {
			usage[key] = int(value)
		}
	}
	return usage
}

func extractDigiConnectText(res map[string]interface{}) string {
	if router, ok := res["router_response"].(map[string]interface{}); ok {
		if text := extractOpenAIResponseText(router); text != "" {
			return text
		}
		if text := extractOpenAIChatText(router); text != "" {
			return text
		}
		for _, key := range []string{"output_text", "text", "content", "message"} {
			if value, ok := router[key].(string); ok && strings.TrimSpace(value) != "" {
				return value
			}
		}
		encoded, _ := json.Marshal(router)
		return string(encoded)
	}
	encoded, _ := json.Marshal(res)
	return string(encoded)
}

func extractOpenAIChatText(router map[string]interface{}) string {
	choices, ok := router["choices"].([]interface{})
	if !ok {
		return ""
	}
	parts := []string{}
	for _, item := range choices {
		choice, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		for _, key := range []string{"message", "delta"} {
			message, ok := choice[key].(map[string]interface{})
			if !ok {
				continue
			}
			if content, ok := message["content"].(string); ok && strings.TrimSpace(content) != "" {
				parts = append(parts, strings.TrimSpace(content))
			}
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func extractOpenAIResponseText(router map[string]interface{}) string {
	output, ok := router["output"].([]interface{})
	if !ok {
		return ""
	}
	parts := []string{}
	for _, item := range output {
		message, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		content, ok := message["content"].([]interface{})
		if !ok {
			continue
		}
		for _, contentItem := range content {
			entry, ok := contentItem.(map[string]interface{})
			if !ok {
				continue
			}
			if text, ok := entry["text"].(string); ok && strings.TrimSpace(text) != "" {
				parts = append(parts, strings.TrimSpace(text))
			}
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func (s *DigiConnectService) CreateAPIRequest(ctx context.Context, apiKey string, input DigiConnectAPIRequestInput, idempotencyKey string) (map[string]interface{}, DigiConnectPublicError) {
	if s.cfg == nil || !s.cfg.DigiConnectEnabled {
		return nil, DigiConnectPublicError{Code: "SERVICE_BUSY", HTTPStatus: http.StatusServiceUnavailable, Message: "Jaringan sedang ramai, coba lagi sebentar lagi."}
	}
	if strings.TrimSpace(apiKey) == "" {
		return nil, MapDigiConnectPublicError("MISSING_API_KEY")
	}
	key, err := s.repo.FindAPIKeyByHash(HashDigiConnectSecret(apiKey))
	if err != nil || key.Status != "active" {
		return nil, MapDigiConnectPublicError("INVALID_API_KEY")
	}
	if strings.TrimSpace(input.Input) == "" || strings.TrimSpace(input.Service) == "" || strings.TrimSpace(input.Type) == "" {
		return nil, MapDigiConnectPublicError("MISSING_INPUT")
	}
	if strings.TrimSpace(input.Service) != "digiconnect-smart" || strings.TrimSpace(input.Type) != "text" {
		return nil, MapDigiConnectPublicError("UNSUPPORTED_TYPE")
	}

	payloadHash := hashDigiConnectPayload(input)
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if idempotencyKey != "" {
		existing, err := s.repo.FindRequestByUserAndIdempotencyKey(key.UserID, idempotencyKey)
		if err == nil {
			if checkErr := CheckDigiConnectIdempotency(existing.IdempotencyRequestHash, payloadHash); checkErr != nil {
				return nil, MapDigiConnectPublicError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD")
			}
			return mapDigiConnectRequestResponse(existing, true), DigiConnectPublicError{}
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, MapDigiConnectPublicError("DATABASE_ERROR")
		}
	}

	now := time.Now()
	entitlement, err := s.repo.FindActiveEntitlementByUser(key.UserID, now)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, MapDigiConnectPublicError("DATABASE_ERROR")
	}
	var entitlementState *DigiConnectEntitlementState
	if entitlement != nil && entitlement.ID != uuid.Nil {
		entitlementState = &DigiConnectEntitlementState{Status: entitlement.Status, ExpiresAt: entitlement.ExpiresAt, PayPerRequestEnabled: entitlement.PayPerRequestEnabled, OveragePayPerRequestEnabled: entitlement.OveragePayPerRequestEnabled}
	}
	walletBalance := int64(0)
	if s.walletRepo != nil {
		user, userErr := s.walletRepo.LockUserByIDTx(s.walletRepo.DB(), key.UserID)
		if userErr == nil {
			walletBalance = user.WalletBalance
		}
	}
	payPerRequestPrice := int64(0)
	if entitlement != nil {
		payPerRequestPrice = entitlement.Price
	}
	billing := DecideDigiConnectBilling(now, entitlementState, walletBalance, payPerRequestPrice, false)
	if !billing.Allowed {
		return nil, billingPublicError(billing.Reason)
	}

	requestID := "dc_req_" + uuid.NewString()
	planCode := ""
	if entitlement != nil {
		planCode = entitlement.PlanCode
	}
	routerRoute := routeDigiConnectRequest(planCode, input)
	request := &model.DigiConnectRequest{RequestID: requestID, UserID: key.UserID, APIKeyID: &key.ID, ServiceAlias: input.Service, RequestType: input.Type, PlanCode: planCode, RouterProvider: routerRoute.Provider, RouterModel: routerRoute.ModelID, Status: "processing", InputHash: HashDigiConnectSecret(input.Input), InputPreview: previewDigiConnectInput(input.Input), PayloadHash: payloadHash, IdempotencyRequestHash: payloadHash, BillingDecision: billing.Decision, BillingStatus: "reserved", BillingSource: billing.Source, Amount: billing.Amount, Currency: "IDR", StartedAt: &now}
	if idempotencyKey != "" {
		request.IdempotencyKey = &idempotencyKey
	}
	if optionsJSON, err := json.Marshal(input.Options); err == nil {
		request.OptionsJSON = string(optionsJSON)
	}
	if metadataJSON, err := json.Marshal(input.Metadata); err == nil {
		request.MetadataJSON = string(metadataJSON)
	}
	if externalID, ok := input.Metadata["external_id"].(string); ok {
		request.ExternalID = strings.TrimSpace(externalID)
	}
	if err := s.repo.CreateRequest(request); err != nil {
		return nil, MapDigiConnectPublicError("DATABASE_ERROR")
	}

	routerStarted := time.Now()
	routerRes, routerErr := s.callRouter(ctx, input, routerRoute)
	latency := time.Since(routerStarted).Milliseconds()
	completedAt := time.Now()
	request.RouterLatencyMS = latency
	request.CompletedAt = &completedAt
	if routerErr != nil {
		request.Status = "pending_verification"
		request.BillingDecision = "pending_verification"
		request.BillingStatus = "pending_verification"
		request.PublicErrorCode = "REQUEST_PENDING_VERIFICATION"
		request.PublicErrorMessage = "Request sedang diverifikasi. Cek status beberapa saat lagi."
		request.InternalErrorCode = routerErr.InternalCode
		request.InternalErrorMessage = routerErr.Err.Error()
		_ = s.repo.SaveRequest(request)
		return mapDigiConnectRequestResponse(request, false), MapDigiConnectPublicError(routerErr.InternalCode)
	}
	request.RouterStatus = routerRes.StatusCode
	if routerRes.StatusCode < 200 || routerRes.StatusCode >= 300 {
		request.Status = "failed"
		request.BillingDecision = "rejected"
		request.BillingStatus = "failed"
		request.PublicErrorCode = "UPSTREAM_ERROR"
		request.InternalErrorCode = fmt.Sprintf("NINEROUTER_%d", routerRes.StatusCode)
		_ = s.repo.SaveRequest(request)
		return nil, DigiConnectPublicError{Code: "UPSTREAM_ERROR", HTTPStatus: http.StatusBadGateway, Message: "Layanan sedang mengalami gangguan. Coba lagi nanti."}
	}
	if billing.Source == DigiConnectBillingSourceWallet {
		if err := s.chargeWalletAfterRouterSuccess(ctx, key.UserID, request.ID, billing.Amount); err != nil {
			request.Status = "pending_verification"
			request.BillingDecision = "pending_verification"
			request.BillingStatus = "pending_verification"
			request.InternalErrorCode = "WALLET_CHARGE_FAILED"
			request.InternalErrorMessage = err.Error()
			_ = s.repo.SaveRequest(request)
			return mapDigiConnectRequestResponse(request, false), MapDigiConnectPublicError("NINEROUTER_TIMEOUT")
		}
		request.BillingStatus = DigiConnectBillingStatusCharged
	} else {
		request.BillingStatus = DigiConnectBillingStatusIncluded
	}
	request.Status = "completed"
	if err := s.repo.SaveRequest(request); err != nil {
		return nil, MapDigiConnectPublicError("DATABASE_ERROR")
	}
	res := mapDigiConnectRequestResponse(request, false)
	res["router_response"] = routerRes.Body
	return res, DigiConnectPublicError{}
}

func mapDigiConnectAPIKey(key model.DigiConnectAPIKey, plain string) DigiConnectAPIKeyResponse {
	masked := key.KeyPrefix + "........"
	if plain != "" {
		masked = MaskDigiConnectAPIKey(plain)
	}
	return DigiConnectAPIKeyResponse{ID: key.ID.String(), Name: key.Name, KeyPrefix: key.KeyPrefix, MaskedKey: masked, PlainKey: plain, Status: key.Status, LastUsedAt: key.LastUsedAt, CreatedAt: key.CreatedAt}
}

func mapDigiConnectRequests(rows []model.DigiConnectRequest) []DigiConnectRequestListResponse {
	res := make([]DigiConnectRequestListResponse, 0, len(rows))
	for _, row := range rows {
		res = append(res, DigiConnectRequestListResponse{ID: row.ID.String(), RequestID: row.RequestID, ServiceAlias: row.ServiceAlias, RequestType: row.RequestType, PlanCode: row.PlanCode, RouterProvider: row.RouterProvider, RouterModel: row.RouterModel, Status: row.Status, InputPreview: row.InputPreview, BillingDecision: row.BillingDecision, BillingStatus: row.BillingStatus, BillingSource: row.BillingSource, Amount: row.Amount, Currency: row.Currency, PublicErrorCode: row.PublicErrorCode, RouterStatus: row.RouterStatus, RouterLatencyMS: row.RouterLatencyMS, StartedAt: row.StartedAt, CompletedAt: row.CompletedAt, CreatedAt: row.CreatedAt})
	}
	return res
}

type digiConnectRouterResponse struct {
	StatusCode int
	Body       map[string]interface{}
}

type digiConnectRouterError struct {
	InternalCode string
	Err          error
}

func (s *DigiConnectService) callRouter(ctx context.Context, input DigiConnectAPIRequestInput, route digiConnectResolvedRouterRoute) (*digiConnectRouterResponse, *digiConnectRouterError) {
	baseURL := strings.TrimRight(s.cfg.DigiConnectRouterBaseURL, "/")
	if baseURL == "" {
		return nil, &digiConnectRouterError{InternalCode: "NINEROUTER_HEALTH_FAILED", Err: errors.New("digiconnect router base URL is empty")}
	}
	modelID := strings.TrimSpace(route.ModelID)
	if modelID == "" {
		modelID = digiConnectCXModelIDs[0]
	}
	body := map[string]interface{}{
		"model": modelID,
		"input": input.Input,
	}
	if len(input.Options) > 0 {
		for key, value := range input.Options {
			if key == "model" {
				continue
			}
			body[key] = value
		}
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, &digiConnectRouterError{InternalCode: "INVALID_PAYLOAD", Err: err}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+s.cfg.DigiConnectRouterResponsesPath, bytes.NewReader(encoded))
	if err != nil {
		return nil, &digiConnectRouterError{InternalCode: "NINEROUTER_HEALTH_FAILED", Err: err}
	}
	req.Header.Set("Content-Type", "application/json")
	if provider := strings.TrimSpace(route.Provider); provider != "" {
		req.Header.Set("X-DigiConnect-Router-Provider", provider)
	}
	if token := strings.TrimSpace(s.cfg.DigiConnectRouterInternalAPIKey); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := s.httpClient.Do(req)
	if err != nil {
		return nil, &digiConnectRouterError{InternalCode: "NINEROUTER_TIMEOUT", Err: err}
	}
	defer res.Body.Close()
	raw, readErr := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if readErr != nil {
		return nil, &digiConnectRouterError{InternalCode: "NINEROUTER_INVALID_JSON", Err: readErr}
	}
	decoded := map[string]interface{}{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &decoded); err != nil {
			decoded = map[string]interface{}{"raw_preview": previewDigiConnectInput(string(raw))}
		}
	}
	return &digiConnectRouterResponse{StatusCode: res.StatusCode, Body: decoded}, nil
}

func (s *DigiConnectService) chargeWalletAfterRouterSuccess(ctx context.Context, userID uuid.UUID, requestID uuid.UUID, amount int64) error {
	if s.walletRepo == nil {
		return errors.New("wallet repo belum dikonfigurasi")
	}
	if amount <= 0 {
		return nil
	}
	reference := fmt.Sprintf("digiconnect:%s:charge", requestID.String())
	return s.walletRepo.Transaction(func(tx *gorm.DB) error {
		if ctx != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
		if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, reference); err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		user, err := s.walletRepo.LockUserByIDTx(tx, userID)
		if err != nil {
			return err
		}
		if user.WalletBalance < amount {
			return errors.New("saldo wallet tidak cukup")
		}
		before := user.WalletBalance
		after := before - amount
		user.WalletBalance = after
		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return err
		}
		return s.walletRepo.CreateLedgerTx(tx, &model.WalletLedger{UserID: userID, Type: "debit", Category: "digiconnect_request", Amount: amount, BalanceBefore: before, BalanceAfter: after, Reference: reference, Description: "DigiConnect API request"})
	})
}

func hashDigiConnectPayload(input DigiConnectAPIRequestInput) string {
	encoded, _ := json.Marshal(input)
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:])
}

func previewDigiConnectInput(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 200 {
		return value
	}
	return value[:200]
}

func billingPublicError(reason string) DigiConnectPublicError {
	switch reason {
	case "insufficient_balance":
		return MapDigiConnectPublicError("WALLET_BALANCE_INSUFFICIENT")
	case "fair_use_limit_reached":
		return MapDigiConnectPublicError("DAILY_FAIR_USE_EXCEEDED")
	default:
		return MapDigiConnectPublicError("NO_ACTIVE_ENTITLEMENT")
	}
}

func mapDigiConnectRequestResponse(request *model.DigiConnectRequest, replay bool) map[string]interface{} {
	return map[string]interface{}{
		"request_id":        request.RequestID,
		"status":            request.Status,
		"idempotent_replay": replay,
		"billing": map[string]interface{}{
			"source":   request.BillingSource,
			"decision": request.BillingDecision,
			"status":   request.BillingStatus,
			"amount":   request.Amount,
			"currency": request.Currency,
		},
		"error": map[string]interface{}{
			"code":    request.PublicErrorCode,
			"message": request.PublicErrorMessage,
		},
		"created_at": request.CreatedAt,
	}
}

func parseDigiConnectTimeout(cfg *config.Config) time.Duration {
	if cfg == nil {
		return 60 * time.Second
	}
	d, err := time.ParseDuration(strings.TrimSpace(cfg.DigiConnectRouterTimeoutMS) + "ms")
	if err != nil || d <= 0 {
		return 60 * time.Second
	}
	return d
}
