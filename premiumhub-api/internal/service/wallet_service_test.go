package service

import (
	"context"
	"fmt"
	"testing"

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
	statusMap   map[string]string
}

func newFakeNeticonClient() *fakeNeticonClient {
	return &fakeNeticonClient{statusMap: map[string]string{}}
}

func (f *fakeNeticonClient) RequestDeposit(_ context.Context, amount int64) (*NeticonDepositResult, []byte, error) {
	f.lastID++
	f.requestHits++
	trxID := fmt.Sprintf("TRX-%d", f.lastID)
	if _, ok := f.statusMap[trxID]; !ok {
		f.statusMap[trxID] = "pending"
	}
	return &NeticonDepositResult{Result: true, TrxID: trxID, Amount: amount}, []byte(`{"result":true}`), nil
}

func (f *fakeNeticonClient) CheckStatus(_ context.Context, trxID string) (*NeticonStatusResult, []byte, error) {
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
		Email:         "test@example.com",
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

func TestWalletCheckTopupSuccessCreditsOnce(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	fake.statusMap[topup.ProviderTrxID] = "success"

	id, _ := uuid.Parse(topup.ID)
	updated, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup: %v", err)
	}
	if updated.Status != "success" {
		t.Fatalf("expected success, got %s", updated.Status)
	}

	updated2, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup second: %v", err)
	}
	if updated2.Status != "success" {
		t.Fatalf("expected success on second check, got %s", updated2.Status)
	}

	var dbUser model.User
	if err := db.First(&dbUser, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
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
}

func TestWalletCheckTopupExpired(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}
	fake.statusMap[topup.ProviderTrxID] = "expire"

	id, _ := uuid.Parse(topup.ID)
	updated, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup: %v", err)
	}
	if updated.Status != "expired" {
		t.Fatalf("expected expired, got %s", updated.Status)
	}

	var dbUser model.User
	if err := db.First(&dbUser, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if dbUser.WalletBalance != 0 {
		t.Fatalf("wallet should stay 0, got %d", dbUser.WalletBalance)
	}
}

func TestWalletReconcilePending(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topupSuccess, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 12000, IdempotencyKey: "rec-1"})
	if err != nil {
		t.Fatalf("create topup 1: %v", err)
	}
	topupPending, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 13000, IdempotencyKey: "rec-2"})
	if err != nil {
		t.Fatalf("create topup 2: %v", err)
	}

	fake.statusMap[topupSuccess.ProviderTrxID] = "success"
	fake.statusMap[topupPending.ProviderTrxID] = "pending"

	res, err := svc.ReconcilePending(context.Background(), 20)
	if err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	if res.Checked != 2 || res.Settled != 1 || res.Pending != 1 {
		t.Fatalf("unexpected reconcile result: %+v", res)
	}

	var dbUser model.User
	if err := db.First(&dbUser, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if dbUser.WalletBalance != topupSuccess.PayableAmount {
		t.Fatalf("unexpected balance after reconcile: got %d want %d", dbUser.WalletBalance, topupSuccess.PayableAmount)
	}
}
