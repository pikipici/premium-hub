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

type fakeNokosPakasirClient struct {
	activeMethods map[string]bool
	createErr     map[string]error
	createCalls   []string
	cancelCalls   int
}

func (f *fakeNokosPakasirClient) CreateTransaction(_ context.Context, method, orderID string, amount int64) (*PakasirCreateResult, []byte, error) {
	f.createCalls = append(f.createCalls, method)
	if f.createErr != nil {
		if err, ok := f.createErr[method]; ok && err != nil {
			return nil, nil, err
		}
	}
	if f.activeMethods != nil {
		if ok := f.activeMethods[method]; !ok {
			return nil, nil, errors.New("method unavailable")
		}
	}
	return &PakasirCreateResult{
		OrderID:       orderID,
		PaymentMethod: method,
		Amount:        amount,
		TotalPayment:  amount,
		ExpiredAt:     time.Now().UTC().Add(15 * time.Minute),
	}, []byte(`{"ok":true}`), nil
}

func (f *fakeNokosPakasirClient) TransactionCancel(_ context.Context, _ string, _ int64) ([]byte, error) {
	f.cancelCalls++
	return []byte(`{"ok":true}`), nil
}

func setupNokosLandingService(t *testing.T) (*NokosLandingSummaryService, *repository.NokosLandingSummaryRepo, *gorm.DB, *fakeNokosFiveSimClient, *fakeNokosPakasirClient) {
	t.Helper()

	dsn := fmt.Sprintf("file:%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.NokosLandingSummary{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repo := repository.NewNokosLandingSummaryRepo(db)
	fiveSim := &fakeNokosFiveSimClient{}
	pakasir := &fakeNokosPakasirClient{}
	cfg := &config.Config{
		PakasirProject:                "digimarket",
		PakasirAPIKey:                 "PK_test",
		NokosLandingMethodCandidates:  "qris,bri_va,bni_va,permata_va",
		NokosLandingMethodProbeAmount: "10000",
		NokosLandingStaleAfter:        "30m",
		NokosLandingSyncTimeout:       "25s",
	}

	svc := NewNokosLandingSummaryService(cfg, repo, fiveSim, pakasir)
	return svc, repo, db, fiveSim, pakasir
}

func TestNokosLandingSummarySync_UsesProviderDataAndFiltersStatuses(t *testing.T) {
	svc, repo, _, fiveSim, pakasir := setupNokosLandingService(t)

	fiveSim.countries = map[string]any{
		"indonesia":    map[string]any{"iso": "ID"},
		"unitedstates": map[string]any{"iso": "US"},
		"singapore":    map[string]any{"iso": "SG"},
	}
	fiveSim.history = map[string]map[int]map[string]any{
		"activation": {
			0: {
				"Statuses": map[string]any{
					"PENDING":  10,
					"FINISHED": 20,
					"CANCELED": 3,
					"BANNED":   2,
				},
			},
		},
		"hosting": {
			0: {
				"Statuses": map[string]any{
					"RECEIVED": 5,
					"BANNED":   1,
				},
			},
		},
	}
	pakasir.activeMethods = map[string]bool{
		"qris":   true,
		"bni_va": true,
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
	if row.ActivationSentTotal != 30 {
		t.Fatalf("activation_sent_total mismatch: got %d want 30", row.ActivationSentTotal)
	}
	if row.HostingSentTotal != 5 {
		t.Fatalf("hosting_sent_total mismatch: got %d want 5", row.HostingSentTotal)
	}
	if row.SentTotalAllTime != 35 {
		t.Fatalf("sent_total_all_time mismatch: got %d want 35", row.SentTotalAllTime)
	}

	expectedMethods := []string{"qris", "bni_va"}
	if !reflect.DeepEqual(row.PaymentMethods, expectedMethods) {
		t.Fatalf("payment methods mismatch: got %v want %v", row.PaymentMethods, expectedMethods)
	}
	if row.LastSyncStatus != "ok" {
		t.Fatalf("expected last_sync_status ok, got %s", row.LastSyncStatus)
	}
}

func TestNokosLandingSummaryGetPublicSummary_OnDemandSyncWhenMissing(t *testing.T) {
	svc, _, _, fiveSim, pakasir := setupNokosLandingService(t)
	fiveSim.countries = map[string]any{
		"indonesia": map[string]any{"iso": "ID"},
	}
	fiveSim.history = map[string]map[int]map[string]any{
		"activation": {0: {"Statuses": map[string]any{"FINISHED": 12}}},
		"hosting":    {0: {"Statuses": map[string]any{"RECEIVED": 8}}},
	}
	pakasir.activeMethods = map[string]bool{"qris": true}

	res, err := svc.GetPublicSummary(context.Background())
	if err != nil {
		t.Fatalf("get public summary: %v", err)
	}

	if res.CountriesCount != 1 {
		t.Fatalf("countries_count mismatch: got %d want 1", res.CountriesCount)
	}
	if res.SentTotalAllTime != 20 {
		t.Fatalf("sent_total_all_time mismatch: got %d want 20", res.SentTotalAllTime)
	}
	if res.IsStale {
		t.Fatalf("expected fresh summary")
	}
}

func TestNokosLandingSummarySync_DegradedWhenPartialFailure(t *testing.T) {
	svc, repo, _, fiveSim, pakasir := setupNokosLandingService(t)
	fiveSim.countriesErr = errors.New("provider down")
	fiveSim.history = map[string]map[int]map[string]any{
		"activation": {0: {"Statuses": map[string]any{"FINISHED": 1}}},
		"hosting":    {0: {"Statuses": map[string]any{"FINISHED": 2}}},
	}
	pakasir.activeMethods = map[string]bool{"qris": true}

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
	if row.SentTotalAllTime != 3 {
		t.Fatalf("sent_total_all_time mismatch: got %d want 3", row.SentTotalAllTime)
	}
}

func TestNokosLandingSummarySync_FallbackToPageScanWhenStatusesMissing(t *testing.T) {
	svc, repo, _, fiveSim, pakasir := setupNokosLandingService(t)
	fiveSim.countries = map[string]any{"indonesia": map[string]any{"iso": "ID"}}
	fiveSim.history = map[string]map[int]map[string]any{
		"activation": {
			0: {
				"Data": []any{
					map[string]any{"status": "finished"},
					map[string]any{"status": "canceled"},
				},
			},
			2: {"Data": []any{}},
		},
		"hosting": {
			0: {
				"Data": []any{
					map[string]any{"status": "received"},
				},
			},
			1: {"Data": []any{}},
		},
	}
	pakasir.activeMethods = map[string]bool{"qris": true}

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
