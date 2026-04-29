package service

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type fakeNokosFiveSimClient struct {
	countries    map[string]any
	countriesErr error
	history      map[string]map[int]map[string]any
	historyErr   map[string]error
}

func (f *fakeNokosFiveSimClient) GetCountries(_ context.Context) (map[string]any, error) {
	if f.countriesErr != nil {
		return nil, f.countriesErr
	}
	if f.countries == nil {
		return map[string]any{}, nil
	}
	return f.countries, nil
}

func (f *fakeNokosFiveSimClient) GetProviderOrderHistory(_ context.Context, category string, _ int, offset int, _ string, _ bool) (map[string]any, error) {
	if f.historyErr != nil {
		if err, ok := f.historyErr[category]; ok && err != nil {
			return nil, err
		}
	}
	if f.history == nil {
		return map[string]any{"Data": []any{}}, nil
	}
	if rowsByOffset, ok := f.history[category]; ok {
		if payload, ok := rowsByOffset[offset]; ok {
			return payload, nil
		}
	}
	return map[string]any{"Data": []any{}}, nil
}

type fakeNokosGatewayClient struct {
	activeMethods map[string]bool
	listErr       error
	listCalls     int
}

func (f *fakeNokosGatewayClient) ListPaymentMethods(_ context.Context, _ int64) ([]GatewayPaymentMethod, []byte, error) {
	f.listCalls++
	if f.listErr != nil {
		return nil, nil, f.listErr
	}
	methods := []GatewayPaymentMethod{}
	for method, active := range f.activeMethods {
		if active {
			methods = append(methods, GatewayPaymentMethod{Method: method, Name: method})
		}
	}
	return methods, []byte(`{"ok":true}`), nil
}

func setupNokosLandingService(t *testing.T) (*NokosLandingSummaryService, *repository.NokosLandingSummaryRepo, *gorm.DB, *fakeNokosFiveSimClient, *fakeNokosGatewayClient) {
	t.Helper()

	dsn := fmt.Sprintf("file:%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.NokosLandingSummary{}, &model.FiveSimOrder{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repo := repository.NewNokosLandingSummaryRepo(db)
	fiveSim := &fakeNokosFiveSimClient{}
	gateway := &fakeNokosGatewayClient{}
	cfg := &config.Config{
		DuitkuMerchantCode:            "digimarket",
		DuitkuAPIKey:                  "DK_test",
		NokosLandingMethodCandidates:  "SP,BR,I1,BT",
		NokosLandingMethodProbeAmount: "10000",
		NokosLandingStaleAfter:        "30m",
		NokosLandingSyncTimeout:       "25s",
	}

	svc := NewNokosLandingSummaryService(cfg, repo, fiveSim, gateway)
	return svc, repo, db, fiveSim, gateway
}

func seedFiveSimOrders(t *testing.T, db *gorm.DB, rows []model.FiveSimOrder) {
	t.Helper()
	if len(rows) == 0 {
		return
	}
	if err := db.Create(&rows).Error; err != nil {
		t.Fatalf("seed five_sim_orders: %v", err)
	}
}

func TestNokosLandingSummarySync_UsesLocalDataAndFiltersStatuses(t *testing.T) {
	svc, repo, db, fiveSim, gateway := setupNokosLandingService(t)

	fiveSim.countries = map[string]any{
		"indonesia":    map[string]any{"iso": "ID"},
		"unitedstates": map[string]any{"iso": "US"},
		"singapore":    map[string]any{"iso": "SG"},
	}
	userID := uuid.New()
	seedFiveSimOrders(t, db, []model.FiveSimOrder{
		{UserID: userID, ProviderOrderID: 1001, OrderType: "activation", ProviderStatus: "FINISHED"},
		{UserID: userID, ProviderOrderID: 1002, OrderType: "activation", ProviderStatus: "TIMEOUT"},
		{UserID: userID, ProviderOrderID: 1003, OrderType: "activation", ProviderStatus: "PENDING"},
		{UserID: userID, ProviderOrderID: 1004, OrderType: "activation", ProviderStatus: "CANCELED"},
		{UserID: userID, ProviderOrderID: 1005, OrderType: "hosting", ProviderStatus: "FINISHED"},
		{UserID: userID, ProviderOrderID: 1006, OrderType: "hosting", ProviderStatus: "BANNED"},
	})
	gateway.activeMethods = map[string]bool{
		"SP": true,
		"I1": true,
	}

	if err := svc.Sync(context.Background()); err != nil {
		t.Fatalf("sync: %v", err)
	}

	row, err := repo.FindBySource(nokosLandingSourceFiveSim)
	if err != nil {
		t.Fatalf("find snapshot: %v", err)
	}

	if row.CountriesCount != 3 {
		t.Fatalf("countries_count mismatch: got %d want 3", row.CountriesCount)
	}
	if len(row.Countries) != 3 {
		t.Fatalf("countries snapshot mismatch: got %d want 3", len(row.Countries))
	}
	if row.ActivationSentTotal != 3 {
		t.Fatalf("activation_sent_total mismatch: got %d want 3", row.ActivationSentTotal)
	}
	if row.HostingSentTotal != 1 {
		t.Fatalf("hosting_sent_total mismatch: got %d want 1", row.HostingSentTotal)
	}
	if row.SentTotalAllTime != 4 {
		t.Fatalf("sent_total_all_time mismatch: got %d want 4", row.SentTotalAllTime)
	}

	expectedMethods := []string{"SP", "I1"}
	if !reflect.DeepEqual(row.PaymentMethods, expectedMethods) {
		t.Fatalf("payment methods mismatch: got %v want %v", row.PaymentMethods, expectedMethods)
	}
	if row.LastSyncStatus != "ok" {
		t.Fatalf("expected last_sync_status ok, got %s", row.LastSyncStatus)
	}
}

func TestNokosLandingSummaryGetPublicSummary_OnDemandSyncWhenMissing(t *testing.T) {
	svc, _, db, fiveSim, gateway := setupNokosLandingService(t)
	fiveSim.countries = map[string]any{
		"indonesia": map[string]any{"iso": "ID"},
	}
	userID := uuid.New()
	seedFiveSimOrders(t, db, []model.FiveSimOrder{
		{UserID: userID, ProviderOrderID: 2001, OrderType: "activation", ProviderStatus: "FINISHED"},
		{UserID: userID, ProviderOrderID: 2002, OrderType: "hosting", ProviderStatus: "RECEIVED"},
		{UserID: userID, ProviderOrderID: 2003, OrderType: "activation", ProviderStatus: "CANCELED"},
	})
	gateway.activeMethods = map[string]bool{"SP": true}

	res, err := svc.GetPublicSummary(context.Background())
	if err != nil {
		t.Fatalf("get public summary: %v", err)
	}

	if res.CountriesCount != 1 {
		t.Fatalf("countries_count mismatch: got %d want 1", res.CountriesCount)
	}
	if res.SentTotalAllTime != 2 {
		t.Fatalf("sent_total_all_time mismatch: got %d want 2", res.SentTotalAllTime)
	}
	if res.IsStale {
		t.Fatalf("expected fresh summary")
	}
}

func TestNokosLandingSummaryGetPublicCountries(t *testing.T) {
	svc, _, db, fiveSim, gateway := setupNokosLandingService(t)
	fiveSim.countries = map[string]any{
		"indonesia": map[string]any{"iso": map[string]any{"id": 1}, "prefix": map[string]any{"+62": 1}, "text_en": "Indonesia"},
		"japan":     map[string]any{"iso": map[string]any{"jp": 1}, "prefix": map[string]any{"+81": 1}, "text_en": "Japan"},
	}
	userID := uuid.New()
	seedFiveSimOrders(t, db, []model.FiveSimOrder{
		{UserID: userID, ProviderOrderID: 3001, OrderType: "activation", ProviderStatus: "FINISHED"},
	})
	gateway.activeMethods = map[string]bool{"SP": true}

	res, err := svc.GetPublicCountries(context.Background())
	if err != nil {
		t.Fatalf("get public countries: %v", err)
	}

	if res.CountriesCount != 2 {
		t.Fatalf("countries_count mismatch: got %d want 2", res.CountriesCount)
	}
	if len(res.Countries) != 2 {
		t.Fatalf("countries length mismatch: got %d want 2", len(res.Countries))
	}
	if res.Countries[0].ISO == "" || res.Countries[0].DialCode == "" {
		t.Fatalf("expected ISO and dial_code populated, got %+v", res.Countries[0])
	}
}

func TestNokosLandingSummarySync_DegradedWhenPartialFailure(t *testing.T) {
	svc, repo, db, fiveSim, gateway := setupNokosLandingService(t)
	fiveSim.countriesErr = errors.New("provider down")
	userID := uuid.New()
	seedFiveSimOrders(t, db, []model.FiveSimOrder{
		{UserID: userID, ProviderOrderID: 4001, OrderType: "activation", ProviderStatus: "FINISHED"},
		{UserID: userID, ProviderOrderID: 4002, OrderType: "hosting", ProviderStatus: "FINISHED"},
		{UserID: userID, ProviderOrderID: 4003, OrderType: "hosting", ProviderStatus: "CANCELED"},
	})
	gateway.activeMethods = map[string]bool{"SP": true}

	if err := svc.Sync(context.Background()); err != nil {
		t.Fatalf("sync: %v", err)
	}

	row, err := repo.FindBySource(nokosLandingSourceFiveSim)
	if err != nil {
		t.Fatalf("find snapshot: %v", err)
	}
	if row.LastSyncStatus != "degraded" {
		t.Fatalf("expected degraded, got %s", row.LastSyncStatus)
	}
	if !strings.Contains(row.LastSyncError, "countries") {
		t.Fatalf("expected countries error in last_sync_error, got %s", row.LastSyncError)
	}
	if row.SentTotalAllTime != 2 {
		t.Fatalf("sent_total_all_time mismatch: got %d want 2", row.SentTotalAllTime)
	}
}

func TestNokosLandingSummarySync_UsesLocalOrdersForSentTotals(t *testing.T) {
	svc, repo, db, fiveSim, gateway := setupNokosLandingService(t)
	fiveSim.countries = map[string]any{"indonesia": map[string]any{"iso": "ID"}}
	userID := uuid.New()
	seedFiveSimOrders(t, db, []model.FiveSimOrder{
		{UserID: userID, ProviderOrderID: 5001, OrderType: "activation", ProviderStatus: "RECEIVED"},
		{UserID: userID, ProviderOrderID: 5002, OrderType: "activation", ProviderStatus: "TIMEOUT"},
		{UserID: userID, ProviderOrderID: 5003, OrderType: "activation", ProviderStatus: "CANCELED"},
	})
	gateway.activeMethods = map[string]bool{"SP": true}

	if err := svc.Sync(context.Background()); err != nil {
		t.Fatalf("sync: %v", err)
	}

	row, err := repo.FindBySource(nokosLandingSourceFiveSim)
	if err != nil {
		t.Fatalf("find snapshot: %v", err)
	}
	if row.SentTotalAllTime != 2 {
		t.Fatalf("sent_total_all_time mismatch: got %d want 2", row.SentTotalAllTime)
	}
}
