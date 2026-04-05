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

type forcedReadErr struct{}

func (forcedReadErr) Read(_ []byte) (int, error) {
	return 0, errors.New("forced rand read error")
}

func registerQueryFailOnNth(t *testing.T, db *gorm.DB, table string, nth int, msg string) func() {
	t.Helper()
	name := "fail_query_" + table + "_" + uuid.NewString()
	count := 0
	if err := db.Callback().Query().Before("gorm:query").Register(name, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == table {
			count++
			if count == nth {
				tx.AddError(errors.New(msg))
			}
		}
	}); err != nil {
		t.Fatalf("register query fail callback: %v", err)
	}
	return func() {
		_ = db.Callback().Query().Remove(name)
	}
}

func registerWalletTopupDuplicateRaceInjector(t *testing.T, db *gorm.DB) func() {
	t.Helper()
	name := "inject_wallet_topup_duplicate_" + uuid.NewString()
	inserted := false
	if err := db.Callback().Create().Before("gorm:create").Register(name, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "wallet_topups" || inserted {
			return
		}
		topup, ok := tx.Statement.Dest.(*model.WalletTopup)
		if !ok || topup == nil {
			return
		}

		inserted = true
		dup := *topup
		dup.ID = uuid.New()
		dup.ProviderTrxID = "DUP-" + uuid.NewString()[:8]
		if err := db.Session(&gorm.Session{NewDB: true, SkipHooks: true}).Create(&dup).Error; err != nil {
			tx.AddError(err)
		}
	}); err != nil {
		t.Fatalf("register duplicate injector callback: %v", err)
	}
	return func() {
		_ = db.Callback().Create().Remove(name)
	}
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

func TestWalletBalanceListAndLedgerSuccessAndErrors(t *testing.T) {
	svc, _, fake, user := setupWalletService(t)

	balance, err := svc.GetBalance(user.ID)
	if err != nil {
		t.Fatalf("get balance: %v", err)
	}
	if balance.Balance != 0 {
		t.Fatalf("initial balance should be 0")
	}

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "list-1"})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}
	fake.statusMap[topup.ProviderTrxID] = "success"
	if _, err := svc.CheckTopupStatus(context.Background(), user.ID, mustParseUUID(t, topup.ID)); err != nil {
		t.Fatalf("check topup: %v", err)
	}

	rows, err := svc.ListTopups(user.ID, 0, 0)
	if err != nil {
		t.Fatalf("list topups default paging: %v", err)
	}
	if len(rows.Topups) == 0 {
		t.Fatalf("expected topups rows")
	}

	rowsLimited, err := svc.ListTopups(user.ID, 1, 1000)
	if err != nil {
		t.Fatalf("list topups limit clamp: %v", err)
	}
	if len(rowsLimited.Topups) == 0 {
		t.Fatalf("expected topups rows with clamped limit")
	}

	ledgerRows, err := svc.ListLedger(user.ID, 0, 0)
	if err != nil {
		t.Fatalf("list ledger default paging: %v", err)
	}
	if len(ledgerRows.Ledgers) == 0 {
		t.Fatalf("expected ledger rows")
	}
	if ledgerRows.Ledgers[0].Reference == "" {
		t.Fatalf("ledger reference should be set")
	}

	ledgerRowsLimited, err := svc.ListLedger(user.ID, 1, 1000)
	if err != nil {
		t.Fatalf("list ledger limit clamp: %v", err)
	}
	if len(ledgerRowsLimited.Ledgers) == 0 {
		t.Fatalf("expected ledger rows with clamped limit")
	}

	dbNoTopup := setupCoreDB(t)
	userNoTopup := seedUser(t, dbNoTopup, "wallet-list-err@example.com", true)
	svcNoTopup := NewWalletService(&config.Config{WalletTopupExpiryMinutes: "15"}, repository.NewUserRepo(dbNoTopup), repository.NewWalletRepo(dbNoTopup), repository.NewNotificationRepo(dbNoTopup), newFakeNeticonClient())
	if err := dbNoTopup.Migrator().DropTable(&model.WalletTopup{}); err != nil {
		t.Fatalf("drop wallet_topups: %v", err)
	}
	if _, err := svcNoTopup.ListTopups(userNoTopup.ID, 1, 20); err == nil || !strings.Contains(err.Error(), "gagal memuat daftar topup") {
		t.Fatalf("expected list topups repo error, got: %v", err)
	}

	dbNoLedger := setupCoreDB(t)
	userNoLedger := seedUser(t, dbNoLedger, "wallet-ledger-err@example.com", true)
	svcNoLedger := NewWalletService(&config.Config{WalletTopupExpiryMinutes: "15"}, repository.NewUserRepo(dbNoLedger), repository.NewWalletRepo(dbNoLedger), repository.NewNotificationRepo(dbNoLedger), newFakeNeticonClient())
	if err := dbNoLedger.Migrator().DropTable(&model.WalletLedger{}); err != nil {
		t.Fatalf("drop wallet_ledgers: %v", err)
	}
	if _, err := svcNoLedger.ListLedger(userNoLedger.ID, 1, 20); err == nil || !strings.Contains(err.Error(), "gagal memuat riwayat wallet") {
		t.Fatalf("expected list ledger repo error, got: %v", err)
	}

	if _, err := svcNoLedger.GetBalance(uuid.New()); err == nil || !strings.Contains(err.Error(), "user tidak ditemukan") {
		t.Fatalf("expected get balance user not found, got: %v", err)
	}
}

func TestWalletCreateTopupErrorBranches(t *testing.T) {
	t.Run("idempotency lookup error", func(t *testing.T) {
		svc, db, _, user := setupWalletService(t)
		if err := db.Migrator().DropTable(&model.WalletTopup{}); err != nil {
			t.Fatalf("drop wallet_topups: %v", err)
		}
		_, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "idem-err"})
		if err == nil || !strings.Contains(err.Error(), "gagal cek idempotency") {
			t.Fatalf("expected idempotency lookup error, got: %v", err)
		}
	})

	t.Run("unique code generator error", func(t *testing.T) {
		svc, _, _, user := setupWalletService(t)
		oldReader := walletRandReader
		walletRandReader = forcedReadErr{}
		defer func() { walletRandReader = oldReader }()

		_, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "rand-fail"})
		if err == nil || !strings.Contains(err.Error(), "gagal membuat kode unik") {
			t.Fatalf("expected unique code error, got: %v", err)
		}
	})

	t.Run("provider request error", func(t *testing.T) {
		svc, _, fake, user := setupWalletService(t)
		fake.requestErr = errors.New("provider down")
		_, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "provider-fail"})
		if err == nil || !strings.Contains(err.Error(), "gagal membuat invoice topup") {
			t.Fatalf("expected provider request error, got: %v", err)
		}
	})

	t.Run("save topup error without fallback", func(t *testing.T) {
		svc, db, _, user := setupWalletService(t)
		removeCreateFail := registerCreateFailCallback(t, db, "wallet_topups", "forced create fail")
		_, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "save-fail-no-fallback"})
		removeCreateFail()
		if err == nil || !strings.Contains(err.Error(), "gagal menyimpan topup") {
			t.Fatalf("expected save topup error, got: %v", err)
		}
	})

	t.Run("save topup error with fallback existing", func(t *testing.T) {
		svc, db, _, user := setupWalletService(t)
		removeDupInjector := registerWalletTopupDuplicateRaceInjector(t, db)
		res, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "save-fail-fallback"})
		removeDupInjector()
		if err != nil {
			t.Fatalf("expected fallback topup, got err: %v", err)
		}
		if res.IdempotencyKey != "save-fail-fallback" {
			t.Fatalf("expected fallback idempotency key, got %s", res.IdempotencyKey)
		}
	})
}

func TestWalletCheckAdminAndReconcileErrorBranches(t *testing.T) {
	t.Run("check topup not found", func(t *testing.T) {
		svc, _, _, user := setupWalletService(t)
		if _, err := svc.GetTopupByID(user.ID, uuid.New()); err == nil || !strings.Contains(err.Error(), "topup tidak ditemukan") {
			t.Fatalf("expected get topup not found, got: %v", err)
		}
		_, err := svc.CheckTopupStatus(context.Background(), user.ID, uuid.New())
		if err == nil || !strings.Contains(err.Error(), "topup tidak ditemukan") {
			t.Fatalf("expected topup not found, got: %v", err)
		}
	})

	t.Run("check topup blocked user", func(t *testing.T) {
		svc, db, _, user := setupWalletService(t)
		topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "blocked-check"})
		if err != nil {
			t.Fatalf("create topup: %v", err)
		}
		if err := db.Model(&model.User{}).Where("id = ?", user.ID).Update("is_active", false).Error; err != nil {
			t.Fatalf("deactivate user: %v", err)
		}
		_, err = svc.CheckTopupStatus(context.Background(), user.ID, mustParseUUID(t, topup.ID))
		if err == nil || !strings.Contains(err.Error(), "akun diblokir") {
			t.Fatalf("expected blocked user error, got: %v", err)
		}
	})

	t.Run("check topup sync error", func(t *testing.T) {
		svc, _, fake, user := setupWalletService(t)
		topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "sync-err"})
		if err != nil {
			t.Fatalf("create topup: %v", err)
		}
		fake.checkErr[topup.ProviderTrxID] = errors.New("provider check failed")
		_, err = svc.CheckTopupStatus(context.Background(), user.ID, mustParseUUID(t, topup.ID))
		if err == nil || !strings.Contains(err.Error(), "gagal cek status topup") {
			t.Fatalf("expected sync error, got: %v", err)
		}
	})

	t.Run("check topup reload error", func(t *testing.T) {
		svc, db, fake, user := setupWalletService(t)
		topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "reload-err"})
		if err != nil {
			t.Fatalf("create topup: %v", err)
		}
		fake.statusMap[topup.ProviderTrxID] = "pending"
		removeQueryFail := registerQueryFailOnNth(t, db, "wallet_topups", 3, "forced reload error")
		_, err = svc.CheckTopupStatus(context.Background(), user.ID, mustParseUUID(t, topup.ID))
		removeQueryFail()
		if err == nil || !strings.Contains(err.Error(), "gagal memuat status topup") {
			t.Fatalf("expected reload error, got: %v", err)
		}
	})

	t.Run("admin recheck sync and reload errors", func(t *testing.T) {
		svc, db, fake, user := setupWalletService(t)
		topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "admin-err"})
		if err != nil {
			t.Fatalf("create topup: %v", err)
		}

		fake.checkErr[topup.ProviderTrxID] = errors.New("admin sync err")
		_, err = svc.AdminRecheckTopup(context.Background(), mustParseUUID(t, topup.ID))
		if err == nil || !strings.Contains(err.Error(), "gagal cek status topup") {
			t.Fatalf("expected admin sync error, got: %v", err)
		}

		delete(fake.checkErr, topup.ProviderTrxID)
		removeQueryFail := registerQueryFailOnNth(t, db, "wallet_topups", 3, "forced admin reload error")
		_, err = svc.AdminRecheckTopup(context.Background(), mustParseUUID(t, topup.ID))
		removeQueryFail()
		if err == nil || !strings.Contains(err.Error(), "gagal memuat topup") {
			t.Fatalf("expected admin reload error, got: %v", err)
		}
	})

	t.Run("reconcile pending table error", func(t *testing.T) {
		svc, db, _, _ := setupWalletService(t)
		if err := db.Migrator().DropTable(&model.WalletTopup{}); err != nil {
			t.Fatalf("drop wallet_topups: %v", err)
		}
		_, err := svc.ReconcilePending(context.Background(), 10)
		if err == nil || !strings.Contains(err.Error(), "gagal memuat pending topup") {
			t.Fatalf("expected reconcile list error, got: %v", err)
		}
	})

	t.Run("reconcile latest fetch error", func(t *testing.T) {
		svc, db, fake, user := setupWalletService(t)
		topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "rec-fetch-err"})
		if err != nil {
			t.Fatalf("create topup: %v", err)
		}
		fake.statusMap[topup.ProviderTrxID] = "pending"
		removeQueryFail := registerQueryFailOnNth(t, db, "wallet_topups", 3, "forced reconcile fetch error")
		res, err := svc.ReconcilePending(context.Background(), 20)
		removeQueryFail()
		if err != nil {
			t.Fatalf("reconcile should continue on fetch error: %v", err)
		}
		if len(res.Errors) == 0 {
			t.Fatalf("expected reconcile errors when latest fetch fails")
		}
	})

	t.Run("reconcile caps limit and truncates errors", func(t *testing.T) {
		svc, _, fake, user := setupWalletService(t)
		for i := 0; i < 25; i++ {
			topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: fmt.Sprintf("err-%d", i)})
			if err != nil {
				t.Fatalf("create topup %d: %v", i, err)
			}
			fake.checkErr[topup.ProviderTrxID] = errors.New("forced check error")
		}
		res, err := svc.ReconcilePending(context.Background(), 5000)
		if err != nil {
			t.Fatalf("reconcile large limit: %v", err)
		}
		if res.Checked != 25 {
			t.Fatalf("expected checked 25, got %d", res.Checked)
		}
		if len(res.Errors) != 20 {
			t.Fatalf("errors should be truncated to 20, got %d", len(res.Errors))
		}
	})
}

func TestWalletInternalMethodBranches(t *testing.T) {
	t.Run("new service uses provided neticon", func(t *testing.T) {
		db := setupCoreDB(t)
		user := seedUser(t, db, "wallet-ctor@example.com", true)
		_ = user
		provided := newFakeNeticonClient()
		svc := NewWalletService(&config.Config{WalletTopupExpiryMinutes: "15"}, repository.NewUserRepo(db), repository.NewWalletRepo(db), repository.NewNotificationRepo(db), provided)
		if svc.neticon != provided {
			t.Fatalf("expected provided neticon client")
		}

		svcNil := NewWalletService(&config.Config{NeticonBaseURL: "https://example.com", NeticonAPIKey: "k", NeticonUserID: "u", WalletTopupExpiryMinutes: "15"}, repository.NewUserRepo(db), repository.NewWalletRepo(db), repository.NewNotificationRepo(db), nil)
		if svcNil.neticon == nil {
			t.Fatalf("expected auto neticon client when nil provided")
		}
	})

	t.Run("settle success and internal branches", func(t *testing.T) {
		svc, db, _, user := setupWalletService(t)

		if err := svc.settleSuccess(uuid.New(), "success", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "topup tidak ditemukan") {
			t.Fatalf("expected topup not found, got: %v", err)
		}

		topupSuccess := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "T-S1", IdempotencyKey: "s1", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "success", ProviderStatus: "success", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupSuccess).Error; err != nil {
			t.Fatalf("create topup success row: %v", err)
		}
		if err := svc.settleSuccess(topupSuccess.ID, "success", []byte(`{}`)); err != nil {
			t.Fatalf("settle success already-success should pass: %v", err)
		}

		removeTopupUpdateFail := registerUpdateFailCallback(t, db, "wallet_topups", "forced topup save error")
		if err := svc.settleSuccess(topupSuccess.ID, "success", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "gagal update topup") {
			removeTopupUpdateFail()
			t.Fatalf("expected topup save error, got: %v", err)
		}
		removeTopupUpdateFail()

		topupFailed := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "T-S2", IdempotencyKey: "s2", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "failed", ProviderStatus: "failed", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupFailed).Error; err != nil {
			t.Fatalf("create topup failed row: %v", err)
		}
		if err := svc.settleSuccess(topupFailed.ID, "failed", []byte(`{}`)); err != nil {
			t.Fatalf("settle success non-pending should pass: %v", err)
		}
		removeNonPendingSaveFail := registerUpdateFailCallback(t, db, "wallet_topups", "forced non-pending save error")
		if err := svc.settleSuccess(topupFailed.ID, "failed", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "gagal update topup") {
			removeNonPendingSaveFail()
			t.Fatalf("expected non-pending save error, got: %v", err)
		}
		removeNonPendingSaveFail()

		topupLedgerExists := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "T-S3", IdempotencyKey: "s3", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "pending", ProviderStatus: "pending", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupLedgerExists).Error; err != nil {
			t.Fatalf("create topup ledger exists row: %v", err)
		}
		if err := db.Create(&model.WalletLedger{ID: uuid.New(), UserID: user.ID, TopupID: &topupLedgerExists.ID, Type: "credit", Category: "topup", Amount: topupLedgerExists.PayableAmount, BalanceBefore: 0, BalanceAfter: topupLedgerExists.PayableAmount, Reference: fmt.Sprintf("wallet_topup:%s", topupLedgerExists.ID.String()), Description: "dup"}).Error; err != nil {
			t.Fatalf("create duplicate ledger row: %v", err)
		}
		if err := svc.settleSuccess(topupLedgerExists.ID, "success", []byte(`{}`)); err != nil {
			t.Fatalf("settle success with existing ledger should pass: %v", err)
		}

		topupNoUser := &model.WalletTopup{ID: uuid.New(), UserID: uuid.New(), ProviderTrxID: "T-S4", IdempotencyKey: "s4", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "pending", ProviderStatus: "pending", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupNoUser).Error; err != nil {
			t.Fatalf("create topup no user row: %v", err)
		}
		if err := svc.settleSuccess(topupNoUser.ID, "success", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "user tidak ditemukan") {
			t.Fatalf("expected user not found, got: %v", err)
		}

		topupSaveUserErr := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "T-S5", IdempotencyKey: "s5", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "pending", ProviderStatus: "pending", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupSaveUserErr).Error; err != nil {
			t.Fatalf("create topup save user err row: %v", err)
		}
		removeUserUpdateFail := registerUpdateFailCallback(t, db, "users", "forced user save error")
		if err := svc.settleSuccess(topupSaveUserErr.ID, "success", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "gagal update saldo wallet") {
			removeUserUpdateFail()
			t.Fatalf("expected save user error, got: %v", err)
		}
		removeUserUpdateFail()

		topupLedgerCreateErr := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "T-S6", IdempotencyKey: "s6", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "pending", ProviderStatus: "pending", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupLedgerCreateErr).Error; err != nil {
			t.Fatalf("create topup ledger create err row: %v", err)
		}
		removeLedgerCreateFail := registerCreateFailCallback(t, db, "wallet_ledgers", "forced ledger create error")
		if err := svc.settleSuccess(topupLedgerCreateErr.ID, "success", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "gagal menulis ledger wallet") {
			removeLedgerCreateFail()
			t.Fatalf("expected ledger create error, got: %v", err)
		}
		removeLedgerCreateFail()

		topupFinalizeErr := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "T-S7", IdempotencyKey: "s7", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "pending", ProviderStatus: "pending", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupFinalizeErr).Error; err != nil {
			t.Fatalf("create topup finalize err row: %v", err)
		}
		removeFinalizeFail := registerUpdateFailCallback(t, db, "wallet_topups", "forced finalize topup error")
		if err := svc.settleSuccess(topupFinalizeErr.ID, "success", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "gagal finalize topup") {
			removeFinalizeFail()
			t.Fatalf("expected finalize topup error, got: %v", err)
		}
		removeFinalizeFail()

		topupLedgerLookupErr := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "T-S8", IdempotencyKey: "s8", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "pending", ProviderStatus: "pending", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupLedgerLookupErr).Error; err != nil {
			t.Fatalf("create topup ledger lookup err row: %v", err)
		}
		if err := db.Migrator().DropTable(&model.WalletLedger{}); err != nil {
			t.Fatalf("drop wallet_ledgers: %v", err)
		}
		if err := svc.settleSuccess(topupLedgerLookupErr.ID, "success", []byte(`{}`)); err == nil {
			t.Fatalf("expected ledger lookup error")
		}
	})

	t.Run("mark final and touch pending branches", func(t *testing.T) {
		svc, db, _, user := setupWalletService(t)
		if err := svc.markFinalStatus(uuid.New(), "pending", "pending", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "status final tidak valid") {
			t.Fatalf("expected invalid final status error, got: %v", err)
		}
		if err := svc.markFinalStatus(uuid.New(), "failed", "failed", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "topup tidak ditemukan") {
			t.Fatalf("expected topup not found on mark final, got: %v", err)
		}
		if err := svc.touchPending(uuid.New(), "pending", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "topup tidak ditemukan") {
			t.Fatalf("expected topup not found on touch pending, got: %v", err)
		}

		topupSuccess := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "MF-1", IdempotencyKey: "mf1", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "success", ProviderStatus: "success", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupSuccess).Error; err != nil {
			t.Fatalf("create mark final success row: %v", err)
		}
		if err := svc.markFinalStatus(topupSuccess.ID, "failed", "failed", []byte(`{}`)); err != nil {
			t.Fatalf("mark final on success row should pass: %v", err)
		}
		removeTopupSaveFail := registerUpdateFailCallback(t, db, "wallet_topups", "forced mark final save error")
		if err := svc.markFinalStatus(topupSuccess.ID, "failed", "failed", []byte(`{}`)); err == nil || !strings.Contains(err.Error(), "forced mark final save error") {
			removeTopupSaveFail()
			t.Fatalf("expected mark final save error, got: %v", err)
		}
		removeTopupSaveFail()

		topupPending := &model.WalletTopup{ID: uuid.New(), UserID: user.ID, ProviderTrxID: "MF-2", IdempotencyKey: "mf2", RequestedAmount: 10000, UniqueCode: 111, PayableAmount: 10111, Status: "pending", ProviderStatus: "pending", ExpiresAt: time.Now().Add(10 * time.Minute)}
		if err := db.Create(topupPending).Error; err != nil {
			t.Fatalf("create mark final pending row: %v", err)
		}
		if err := svc.markFinalStatus(topupPending.ID, "failed", "cancel", []byte(`{"ok":1}`)); err != nil {
			t.Fatalf("mark final pending should pass: %v", err)
		}

		if err := svc.touchPending(topupPending.ID, "pending", []byte(`{"ok":1}`)); err != nil {
			t.Fatalf("touch pending should pass: %v", err)
		}
		removeTouchFail := registerUpdateFailCallback(t, db, "wallet_topups", "forced touch pending save error")
		if err := svc.touchPending(topupPending.ID, "pending", []byte(`{"ok":1}`)); err == nil || !strings.Contains(err.Error(), "forced touch pending save error") {
			removeTouchFail()
			t.Fatalf("expected touch pending save error, got: %v", err)
		}
		removeTouchFail()
	})
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
