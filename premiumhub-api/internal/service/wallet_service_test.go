package service

import (
	"context"
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

type fakePakasirWalletClient struct {
	lastID      int
	createHits  int
	detailHits  int
	statusMap   map[string]string
	createErr   error
	detailErr   map[string]error
	methodMap   map[string]string
	amountMap   map[string]int64
	completedAt map[string]*time.Time
}

func newFakePakasirWalletClient() *fakePakasirWalletClient {
	return &fakePakasirWalletClient{
		statusMap:   map[string]string{},
		detailErr:   map[string]error{},
		methodMap:   map[string]string{},
		amountMap:   map[string]int64{},
		completedAt: map[string]*time.Time{},
	}
}

func (f *fakePakasirWalletClient) CreateTransaction(_ context.Context, method, orderID string, amount int64) (*PakasirCreateResult, []byte, error) {
	if f.createErr != nil {
		return nil, nil, f.createErr
	}
	f.createHits++
	f.lastID++
	if strings.TrimSpace(orderID) == "" {
		orderID = fmt.Sprintf("WLT-%d", f.lastID)
	}
	if _, ok := f.statusMap[orderID]; !ok {
		f.statusMap[orderID] = "PENDING"
	}
	f.methodMap[orderID] = method
	f.amountMap[orderID] = amount
	return &PakasirCreateResult{
		OrderID:       orderID,
		PaymentMethod: method,
		PaymentNumber: "000201...",
		Amount:        amount,
		TotalPayment:  amount + 3000,
		ExpiredAt:     time.Now().UTC().Add(15 * time.Minute),
	}, []byte(`{"ok":true}`), nil
}

func (f *fakePakasirWalletClient) TransactionDetail(_ context.Context, orderID string, amount int64) (*PakasirDetailResult, []byte, error) {
	f.detailHits++
	if err := f.detailErr[orderID]; err != nil {
		return nil, nil, err
	}
	status := f.statusMap[orderID]
	if status == "" {
		status = "PENDING"
	}
	method := f.methodMap[orderID]
	if method == "" {
		method = "qris"
	}
	if amount <= 0 {
		amount = f.amountMap[orderID]
	}
	return &PakasirDetailResult{
		OrderID:       orderID,
		Amount:        amount,
		Status:        NormalizePakasirStatus(status),
		PaymentMethod: method,
		CompletedAt:   f.completedAt[orderID],
	}, []byte(`{"ok":true}`), nil
}

func (f *fakePakasirWalletClient) TransactionCancel(_ context.Context, _ string, _ int64) ([]byte, error) {
	return []byte(`{"ok":true}`), nil
}

func setupWalletService(t *testing.T) (*WalletService, *gorm.DB, *fakePakasirWalletClient, *model.User) {
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

	cfg := &config.Config{
		WalletTopupExpiryMinutes: "15",
		PakasirProject:           "premiumhub",
		PakasirAPIKey:            "PK_test",
		PakasirBaseURL:           "https://app.pakasir.com",
		PakasirHTTPTimeoutSec:    "12",
	}
	fake := newFakePakasirWalletClient()
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

func TestWalletCreateTopupIdempotent(t *testing.T) {
	svc, _, fake, user := setupWalletService(t)

	first, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{
		Amount:         50000,
		IdempotencyKey: "req-12345",
		PaymentMethod:  "qris",
	})
	if err != nil {
		t.Fatalf("create topup first: %v", err)
	}
	if first.Status != "pending" {
		t.Fatalf("expected pending, got %s", first.Status)
	}
	if first.Provider != "pakasir" {
		t.Fatalf("expected provider pakasir, got %s", first.Provider)
	}
	if strings.TrimSpace(first.GatewayRef) == "" {
		t.Fatalf("gateway ref should not be empty")
	}

	second, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{
		Amount:         50000,
		IdempotencyKey: "req-12345",
		PaymentMethod:  "qris",
	})
	if err != nil {
		t.Fatalf("create topup second: %v", err)
	}

	if first.ID != second.ID {
		t.Fatalf("idempotency failed: %s != %s", first.ID, second.ID)
	}
	if fake.createHits != 1 {
		t.Fatalf("pakasir create should run once, got %d", fake.createHits)
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

func TestWalletCheckTopupSuccessCreditsOnce(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, PaymentMethod: "qris"})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	fake.statusMap[topup.GatewayRef] = "COMPLETED"

	id := mustParseUUID(t, topup.ID)
	updated, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup: %v", err)
	}
	if updated.Status != "success" {
		t.Fatalf("expected success, got %s", updated.Status)
	}

	checkHitsAfterFirst := fake.detailHits
	updated2, err := svc.CheckTopupStatus(context.Background(), user.ID, id)
	if err != nil {
		t.Fatalf("check topup second: %v", err)
	}
	if updated2.Status != "success" {
		t.Fatalf("expected success second, got %s", updated2.Status)
	}
	if fake.detailHits != checkHitsAfterFirst {
		t.Fatalf("expected no extra provider checks after success")
	}

	userAfter := mustLoadUser(t, db, user.ID)
	if userAfter.WalletBalance != 10000 {
		t.Fatalf("expected wallet balance 10000, got %d", userAfter.WalletBalance)
	}

	var ledgers []model.WalletLedger
	if err := db.Where("user_id = ?", user.ID).Find(&ledgers).Error; err != nil {
		t.Fatalf("load ledger: %v", err)
	}
	if len(ledgers) != 1 {
		t.Fatalf("expected one ledger entry, got %d", len(ledgers))
	}
	if ledgers[0].Amount != 10000 {
		t.Fatalf("expected credit amount 10000, got %d", ledgers[0].Amount)
	}
}

func TestWalletHandleWebhook(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 12000, PaymentMethod: "qris"})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	fake.statusMap[topup.GatewayRef] = "COMPLETED"

	if err := svc.HandlePakasirWebhook(context.Background(), WalletPakasirWebhookInput{
		OrderID: topup.GatewayRef,
		Project: "wrong-project",
		Status:  "COMPLETED",
		Amount:  12000,
	}); err != nil {
		t.Fatalf("project mismatch should be ignored, got err: %v", err)
	}

	userAfterMismatch := mustLoadUser(t, db, user.ID)
	if userAfterMismatch.WalletBalance != 0 {
		t.Fatalf("expected no credit on mismatch project")
	}

	if err := svc.HandlePakasirWebhook(context.Background(), WalletPakasirWebhookInput{
		OrderID: topup.GatewayRef,
		Project: "premiumhub",
		Status:  "COMPLETED",
		Amount:  12000,
	}); err != nil {
		t.Fatalf("webhook success expected: %v", err)
	}

	userAfter := mustLoadUser(t, db, user.ID)
	if userAfter.WalletBalance != 12000 {
		t.Fatalf("expected wallet balance 12000, got %d", userAfter.WalletBalance)
	}
}

func TestWalletHandleWebhookAcceptsPayableAmount(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, PaymentMethod: "qris"})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	fake.statusMap[topup.GatewayRef] = "COMPLETED"

	if err := svc.HandlePakasirWebhook(context.Background(), WalletPakasirWebhookInput{
		OrderID: topup.GatewayRef,
		Project: "premiumhub",
		Status:  "COMPLETED",
		Amount:  topup.PayableAmount,
	}); err != nil {
		t.Fatalf("webhook with payable amount should be accepted: %v", err)
	}

	userAfter := mustLoadUser(t, db, user.ID)
	if userAfter.WalletBalance != 10000 {
		t.Fatalf("expected wallet balance 10000, got %d", userAfter.WalletBalance)
	}
}

func TestWalletReconcilePending(t *testing.T) {
	svc, db, fake, user := setupWalletService(t)

	topupPending, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, IdempotencyKey: "pending"})
	if err != nil {
		t.Fatalf("create pending topup: %v", err)
	}
	topupSuccess, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 15000, IdempotencyKey: "success"})
	if err != nil {
		t.Fatalf("create success topup: %v", err)
	}

	fake.statusMap[topupPending.GatewayRef] = "PENDING"
	fake.statusMap[topupSuccess.GatewayRef] = "COMPLETED"

	res, err := svc.ReconcilePending(context.Background(), 10)
	if err != nil {
		t.Fatalf("reconcile pending: %v", err)
	}

	if res.Checked < 2 {
		t.Fatalf("expected checked >= 2, got %d", res.Checked)
	}
	if res.Settled < 1 {
		t.Fatalf("expected settled >= 1, got %d", res.Settled)
	}

	userAfter := mustLoadUser(t, db, user.ID)
	if userAfter.WalletBalance != 15000 {
		t.Fatalf("expected wallet balance 15000, got %d", userAfter.WalletBalance)
	}
}
