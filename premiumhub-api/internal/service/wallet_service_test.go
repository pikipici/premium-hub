package service

import (
	"context"
	"errors"
	"fmt"
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

type fakeNeticonClient struct {
	lastID      int
	requestHits int
	checkHits   int
	statusMap   map[string]string
	requestErr  error
	checkErr    map[string]error
}

func newFakeNeticonClient() *fakeNeticonClient {
	return &fakeNeticonClient{
		statusMap: map[string]string{},
		checkErr:  map[string]error{},
	}
}

func (f *fakeNeticonClient) RequestDeposit(_ context.Context, amount int64) (*NeticonDepositResult, []byte, error) {
	if f.requestErr != nil {
		return nil, nil, f.requestErr
	}

	f.lastID++
	f.requestHits++
	trxID := fmt.Sprintf("TRX-%d", f.lastID)
	if _, ok := f.statusMap[trxID]; !ok {
		f.statusMap[trxID] = "pending"
	}
	return &NeticonDepositResult{Result: true, TrxID: trxID, Amount: amount}, []byte(`{"result":true}`), nil
}

func (f *fakeNeticonClient) CheckStatus(_ context.Context, trxID string) (*NeticonStatusResult, []byte, error) {
	f.checkHits++
	if err := f.checkErr[trxID]; err != nil {
		return nil, nil, err
	}

	status := f.statusMap[trxID]
	if status == "" {
		status = "pending"
	}
	return &NeticonStatusResult{Result: true, Status: status}, []byte(`{"result":true}`), nil
}

func setupWalletService(t *testing.T) (*WalletService, *gorm.DB, *fakeNeticonClient, *model.User) {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	err = db.AutoMigrate(
		&model.User{},
		&model.Notification{},
		&model.WalletTopup{},
		&model.WalletLedger{},
	)
	if err != nil {
		t.Fatalf("migrate: %v", err)
	}

	user := &model.User{
		ID:            uuid.New(),
		Name:          "Test User",
		Email:         fmt.Sprintf("test-%s@example.com", uuid.NewString()),
		Password:      "hashed",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 0,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	cfg := &config.Config{WalletTopupExpiryMinutes: "15"}
	fake := newFakeNeticonClient()
	walletSvc := NewWalletService(
		cfg,
		repository.NewUserRepo(db),
		repository.NewWalletRepo(db),
		repository.NewNotificationRepo(db),
		fake,
	)

	return walletSvc, db, fake, user
}

func mustParseUUID(t *testing.T, id string) uuid.UUID {
	t.Helper()
	u, err := uuid.Parse(id)
	if err != nil {
		t.Fatalf("parse uuid: %v", err)
	}
	return u
}

func mustLoadUser(t *testing.T, db *gorm.DB, userID uuid.UUID) model.User {
	t.Helper()
	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	return user
}

func mustLoadTopup(t *testing.T, db *gorm.DB, topupID string) model.WalletTopup {
	t.Helper()
	var topup model.WalletTopup
	if err := db.First(&topup, "id = ?", mustParseUUID(t, topupID)).Error; err != nil {
		t.Fatalf("load topup: %v", err)
	}
	return topup
}

func TestWalletCreateTopupIdempotent(t *testing.T) {
	svc, _, fake, user := setupWalletService(t)

	first, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{
		Amount:         50000,
		IdempotencyKey: "req-12345",
	})
	if err != nil {
		t.Fatalf("create topup first: %v", err)
	}
	if first.Status != "pending" {
		t.Fatalf("expected pending, got %s", first.Status)
	}
	if first.UniqueCode < 100 || first.UniqueCode > 999 {
		t.Fatalf("unique code out of range: %d", first.UniqueCode)
	}
	if first.PayableAmount != first.RequestedAmount+int64(first.UniqueCode) {
		t.Fatalf("payable mismatch: %d vs %d + %d", first.PayableAmount, first.RequestedAmount, first.UniqueCode)
	}

	second, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{
		Amount:         50000,
		IdempotencyKey: "req-12345",
	})
	if err != nil {
		t.Fatalf("create topup second: %v", err)
	}

	if first.ID != second.ID {
		t.Fatalf("idempotency failed: %s != %s", first.ID, second.ID)
	}
	if fake.requestHits != 1 {
		t.Fatalf("neticon request should run once, got %d", fake.requestHits)
	}
}

func TestWalletCreateTopupValidationAndBlockedUser(t *testing.T) {
	svc, db, _, user := setupWalletService(t)

	_, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 999})
	if err == nil || !strings.Contains(err.Error(), "minimal topup") {
		t.Fatalf("expected minimum amount error, got: %v", err)
	}

	_, err = svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 1_000_000_001})
	if err == nil || !strings.Contains(err.Error(), "terlalu besar") {
		t.Fatalf("expected max amount error, got: %v", err)
	}

	if err := db.Model(&model.User{}).Where("id = ?", user.ID).Update("is_active", false).Error; err != nil {
		t.Fatalf("deactivate user: %v", err)
	}

	_, err = svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000})
	if err == nil || !strings.Contains(err.Error(), "akun diblokir") {
		t.Fatalf("expected blocked user error, got: %v", err)
	}
}

func TestWalletGetBalanceBlockedUser(t *testing.T) {
	svc, db, _, user := setupWalletService(t)

	if err := db.Model(&model.User{}).Where("id = ?", user.ID).Update("is_active", false).Error; err != nil {
		t.Fatalf("deactivate user: %v", err)
	}

	_, err := svc.GetBalance(user.ID)
	if err == nil || !strings.Contains(err.Error(), "akun diblokir") {
		t.Fatalf("expected blocked user error, got: %v", err)
	}
}

func TestWalletCheckTopupSuccessCreditsOnce(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	fake.statusMap[topup.ProviderTrxID] = "success"

	id := mustParseUUID(t, topup.ID)
	updated, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup: %v", err)
	}
	if updated.Status != "success" {
		t.Fatalf("expected success, got %s", updated.Status)
	}

	checkHitsAfterFirst := fake.checkHits
	updated2, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup second: %v", err)
	}
	if updated2.Status != "success" {
		t.Fatalf("expected success on second check, got %s", updated2.Status)
	}
	if fake.checkHits != checkHitsAfterFirst {
		t.Fatalf("final status should not re-check provider, hits: %d -> %d", checkHitsAfterFirst, fake.checkHits)
	}

	dbUser := mustLoadUser(t, db, user.ID)
	if dbUser.WalletBalance != topup.PayableAmount {
		t.Fatalf("unexpected wallet balance: got %d want %d", dbUser.WalletBalance, topup.PayableAmount)
	}

	var ledgerCount int64
	if err := db.Model(&model.WalletLedger{}).Where("user_id = ?", user.ID).Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count ledger: %v", err)
	}
	if ledgerCount != 1 {
		t.Fatalf("ledger should be 1 row, got %d", ledgerCount)
	}

	var notifCount int64
	if err := db.Model(&model.Notification{}).Where("user_id = ?", user.ID).Count(&notifCount).Error; err != nil {
		t.Fatalf("count notif: %v", err)
	}
	if notifCount != 1 {
		t.Fatalf("notification should be 1 row, got %d", notifCount)
	}
}

func TestWalletCheckTopupFailedDoesNotCredit(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}
	fake.statusMap[topup.ProviderTrxID] = "cancel"

	id := mustParseUUID(t, topup.ID)
	updated, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup: %v", err)
	}
	if updated.Status != "failed" {
		t.Fatalf("expected failed, got %s", updated.Status)
	}

	dbUser := mustLoadUser(t, db, user.ID)
	if dbUser.WalletBalance != 0 {
		t.Fatalf("wallet should stay 0, got %d", dbUser.WalletBalance)
	}

	var ledgerCount int64
	if err := db.Model(&model.WalletLedger{}).Where("user_id = ?", user.ID).Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count ledger: %v", err)
	}
	if ledgerCount != 0 {
		t.Fatalf("ledger should be 0 row, got %d", ledgerCount)
	}
}

func TestWalletCheckTopupExpired(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}
	fake.statusMap[topup.ProviderTrxID] = "expire"

	id := mustParseUUID(t, topup.ID)
	updated, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup: %v", err)
	}
	if updated.Status != "expired" {
		t.Fatalf("expected expired, got %s", updated.Status)
	}

	dbUser := mustLoadUser(t, db, user.ID)
	if dbUser.WalletBalance != 0 {
		t.Fatalf("wallet should stay 0, got %d", dbUser.WalletBalance)
	}
}

func TestWalletCheckTopupSkipsProviderIfAlreadyFinal(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	if err := db.Model(&model.WalletTopup{}).
		Where("id = ?", mustParseUUID(t, topup.ID)).
		Update("status", "failed").Error; err != nil {
		t.Fatalf("set final status: %v", err)
	}

	before := fake.checkHits
	updated, err := svc.CheckTopupStatus(context.Background(), user.ID, mustParseUUID(t, topup.ID))
	if err != nil {
		t.Fatalf("check topup: %v", err)
	}
	if updated.Status != "failed" {
		t.Fatalf("expected failed, got %s", updated.Status)
	}
	if fake.checkHits != before {
		t.Fatalf("provider should not be called for final status")
	}
}

func TestWalletAdminRecheckTopup(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 15000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}
	fake.statusMap[topup.ProviderTrxID] = "success"

	updated, err := svc.AdminRecheckTopup(context.Background(), mustParseUUID(t, topup.ID))
	if err != nil {
		t.Fatalf("admin recheck: %v", err)
	}
	if updated.Status != "success" {
		t.Fatalf("expected success, got %s", updated.Status)
	}

	dbUser := mustLoadUser(t, db, user.ID)
	if dbUser.WalletBalance != topup.PayableAmount {
		t.Fatalf("unexpected wallet balance: got %d want %d", dbUser.WalletBalance, topup.PayableAmount)
	}

	_, err = svc.AdminRecheckTopup(context.Background(), uuid.New())
	if err == nil || !strings.Contains(err.Error(), "topup tidak ditemukan") {
		t.Fatalf("expected topup not found, got: %v", err)
	}
}

func TestWalletReconcilePendingMixedStatusesAndErrors(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topupSuccess, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 12000, IdempotencyKey: "rec-1"})
	if err != nil {
		t.Fatalf("create topup success: %v", err)
	}
	topupPending, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 13000, IdempotencyKey: "rec-2"})
	if err != nil {
		t.Fatalf("create topup pending: %v", err)
	}
	topupFailed, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 14000, IdempotencyKey: "rec-3"})
	if err != nil {
		t.Fatalf("create topup failed: %v", err)
	}
	topupExpired, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 15000, IdempotencyKey: "rec-4"})
	if err != nil {
		t.Fatalf("create topup expired: %v", err)
	}
	topupError, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 16000, IdempotencyKey: "rec-5"})
	if err != nil {
		t.Fatalf("create topup error: %v", err)
	}

	fake.statusMap[topupSuccess.ProviderTrxID] = "success"
	fake.statusMap[topupPending.ProviderTrxID] = "pending"
	fake.statusMap[topupFailed.ProviderTrxID] = "cancel"
	fake.statusMap[topupExpired.ProviderTrxID] = "expire"
	fake.checkErr[topupError.ProviderTrxID] = errors.New("gateway timeout")

	res, err := svc.ReconcilePending(context.Background(), 100)
	if err != nil {
		t.Fatalf("reconcile: %v", err)
	}

	if res.Checked != 5 || res.Settled != 1 || res.Pending != 1 || res.Failed != 1 || res.Expired != 1 {
		t.Fatalf("unexpected reconcile result: %+v", res)
	}
	if len(res.Errors) != 1 || !strings.Contains(res.Errors[0], topupError.ID) {
		t.Fatalf("unexpected reconcile errors: %+v", res.Errors)
	}

	dbUser := mustLoadUser(t, db, user.ID)
	if dbUser.WalletBalance != topupSuccess.PayableAmount {
		t.Fatalf("unexpected balance after reconcile: got %d want %d", dbUser.WalletBalance, topupSuccess.PayableAmount)
	}

	expiredAfter := mustLoadTopup(t, db, topupExpired.ID)
	if expiredAfter.Status != "expired" {
		t.Fatalf("expected expired status, got %s", expiredAfter.Status)
	}
}

func TestWalletReconcilePendingLimitBounds(t *testing.T) {
	svc, _, fake, user := setupWalletService(t)

	for i := 0; i < 3; i++ {
		topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 12000, IdempotencyKey: fmt.Sprintf("lim-%d", i)})
		if err != nil {
			t.Fatalf("create topup %d: %v", i, err)
		}
		fake.statusMap[topup.ProviderTrxID] = "pending"
	}

	res, err := svc.ReconcilePending(context.Background(), -1)
	if err != nil {
		t.Fatalf("reconcile with negative limit: %v", err)
	}
	if res.Checked != 3 {
		t.Fatalf("expected checked 3, got %d", res.Checked)
	}
}

func TestWalletListAndGetRequireActiveUser(t *testing.T) {
	svc, db, _, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 20000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	if err := db.Model(&model.User{}).Where("id = ?", user.ID).Update("is_active", false).Error; err != nil {
		t.Fatalf("deactivate user: %v", err)
	}

	if _, err := svc.ListTopups(user.ID, 1, 20); err == nil || !strings.Contains(err.Error(), "akun diblokir") {
		t.Fatalf("expected blocked on list topups, got: %v", err)
	}
	if _, err := svc.ListLedger(user.ID, 1, 20); err == nil || !strings.Contains(err.Error(), "akun diblokir") {
		t.Fatalf("expected blocked on list ledger, got: %v", err)
	}
	if _, err := svc.GetTopupByID(user.ID, mustParseUUID(t, topup.ID)); err == nil || !strings.Contains(err.Error(), "akun diblokir") {
		t.Fatalf("expected blocked on get topup, got: %v", err)
	}
}

func TestWalletTopupOverdueFlag(t *testing.T) {
	svc, db, _, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 25000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	past := time.Now().Add(-10 * time.Minute)
	if err := db.Model(&model.WalletTopup{}).
		Where("id = ?", mustParseUUID(t, topup.ID)).
		Update("expires_at", past).Error; err != nil {
		t.Fatalf("set expires_at: %v", err)
	}

	res, err := svc.GetTopupByID(user.ID, mustParseUUID(t, topup.ID))
	if err != nil {
		t.Fatalf("get topup: %v", err)
	}
	if !res.IsOverdue {
		t.Fatalf("expected is_overdue=true")
	}
}

func TestWalletHelpers(t *testing.T) {
	t.Run("normalize idempotency key", func(t *testing.T) {
		key := normalizeIdempotencyKey("  ABC-123  ")
		if key != "abc-123" {
			t.Fatalf("unexpected normalized key: %s", key)
		}
		if normalizeIdempotencyKey("") != "" {
			t.Fatalf("empty key should stay empty")
		}
		long := strings.Repeat("x", 120)
		if len(normalizeIdempotencyKey(long)) != 80 {
			t.Fatalf("long key should be trimmed to 80")
		}
	})

	t.Run("provider status mapping", func(t *testing.T) {
		cases := map[string]string{
			"success":     "success",
			" settlement": "success",
			"capture":     "success",
			"paid":        "success",
			"cancel":      "failed",
			"deny":        "failed",
			"failed":      "failed",
			"expire":      "expired",
			"expired":     "expired",
			"unknown":     "pending",
		}
		for in, want := range cases {
			if got := mapProviderStatus(in); got != want {
				t.Fatalf("mapProviderStatus(%q) = %q, want %q", in, got, want)
			}
		}
	})

	t.Run("topup expiry duration bounds", func(t *testing.T) {
		svc := &WalletService{cfg: &config.Config{WalletTopupExpiryMinutes: "abc"}}
		if got := svc.topupExpiryDuration(); got != 15*time.Minute {
			t.Fatalf("default expiry expected 15m, got %s", got)
		}

		svc.cfg.WalletTopupExpiryMinutes = "0"
		if got := svc.topupExpiryDuration(); got != 15*time.Minute {
			t.Fatalf("zero expiry expected 15m, got %s", got)
		}

		svc.cfg.WalletTopupExpiryMinutes = "999"
		if got := svc.topupExpiryDuration(); got != 120*time.Minute {
			t.Fatalf("max expiry expected 120m, got %s", got)
		}
	})
}
