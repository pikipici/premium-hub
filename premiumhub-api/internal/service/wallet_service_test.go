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

type fakeGatewayWalletClient struct {
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

func newFakeGatewayWalletClient() *fakeGatewayWalletClient {
	return &fakeGatewayWalletClient{
		statusMap:   map[string]string{},
		detailErr:   map[string]error{},
		methodMap:   map[string]string{},
		amountMap:   map[string]int64{},
		completedAt: map[string]*time.Time{},
	}
}

func (f *fakeGatewayWalletClient) CreateTransaction(_ context.Context, input GatewayCreateTransactionInput) (*GatewayCreateResult, []byte, error) {
	if f.createErr != nil {
		return nil, nil, f.createErr
	}
	f.createHits++
	f.lastID++
	orderID := input.OrderID
	if strings.TrimSpace(orderID) == "" {
		orderID = fmt.Sprintf("WLT-%d", f.lastID)
	}
	method := NormalizePaymentGatewayMethod(input.PaymentMethod)
	if method == "" {
		method = defaultDuitkuPaymentMethod
	}
	if _, ok := f.statusMap[orderID]; !ok {
		f.statusMap[orderID] = "PENDING"
	}
	f.methodMap[orderID] = method
	f.amountMap[orderID] = input.Amount
	return &GatewayCreateResult{
		OrderID:       orderID,
		Reference:     "DUT-" + orderID,
		PaymentMethod: method,
		PaymentNumber: "000201...",
		Amount:        input.Amount,
		TotalPayment:  input.Amount + 3000,
		ExpiredAt:     time.Now().UTC().Add(15 * time.Minute),
	}, []byte(`{"ok":true}`), nil
}

func (f *fakeGatewayWalletClient) TransactionDetail(_ context.Context, orderID string, amount int64) (*GatewayDetailResult, []byte, error) {
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
		method = defaultDuitkuPaymentMethod
	}
	if amount <= 0 {
		amount = f.amountMap[orderID]
	}
	return &GatewayDetailResult{
		OrderID:       orderID,
		Amount:        amount,
		Status:        NormalizePaymentGatewayStatus(status),
		PaymentMethod: method,
		CompletedAt:   f.completedAt[orderID],
	}, []byte(`{"ok":true}`), nil
}

func (f *fakeGatewayWalletClient) ListPaymentMethods(_ context.Context, _ int64) ([]GatewayPaymentMethod, []byte, error) {
	return []GatewayPaymentMethod{{Method: "SP", Name: "QRIS"}}, []byte(`{"ok":true}`), nil
}

func setupWalletService(t *testing.T) (*WalletService, *gorm.DB, *fakeGatewayWalletClient, *model.User) {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	err = db.AutoMigrate(
		&model.User{},
		&model.Product{},
		&model.ProductPrice{},
		&model.Stock{},
		&model.Order{},
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
		DuitkuMerchantCode:       "premiumhub",
		DuitkuAPIKey:             "DK_test",
		DuitkuBaseURL:            "https://passport.duitku.com",
		DuitkuHTTPTimeoutSec:     "12",
		FrontendURL:              "https://example.com",
	}
	fake := newFakeGatewayWalletClient()
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

func seedWalletOrderFixture(t *testing.T, db *gorm.DB, userID uuid.UUID, priceAmount, walletBalance int64) (*model.Order, *model.Stock) {
	t.Helper()

	if err := db.Model(&model.User{}).Where("id = ?", userID).Update("wallet_balance", walletBalance).Error; err != nil {
		t.Fatalf("seed wallet balance: %v", err)
	}

	product := &model.Product{
		ID:        uuid.New(),
		Name:      "Wallet Product",
		Slug:      "wallet-product-" + uuid.NewString()[:8],
		Category:  "streaming",
		IsActive:  true,
		IsPopular: false,
	}
	if err := db.Create(product).Error; err != nil {
		t.Fatalf("seed product: %v", err)
	}

	price := &model.ProductPrice{
		ID:          uuid.New(),
		ProductID:   product.ID,
		AccountType: "shared",
		Duration:    1,
		Price:       priceAmount,
		IsActive:    true,
	}
	if err := db.Create(price).Error; err != nil {
		t.Fatalf("seed price: %v", err)
	}

	stock := &model.Stock{
		ID:          uuid.New(),
		ProductID:   product.ID,
		AccountType: "shared",
		Email:       "stock-" + uuid.NewString()[:8] + "@example.com",
		Password:    "pass123",
		ProfileName: "profile-1",
		Status:      "available",
	}
	if err := db.Create(stock).Error; err != nil {
		t.Fatalf("seed stock: %v", err)
	}

	order := &model.Order{
		ID:            uuid.New(),
		UserID:        userID,
		PriceID:       price.ID,
		TotalPrice:    priceAmount,
		PaymentMethod: "wallet",
		PaymentStatus: "pending",
		OrderStatus:   "pending",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("seed order: %v", err)
	}

	return order, stock
}

func TestWalletCreateTopupIdempotent(t *testing.T) {
	svc, _, fake, user := setupWalletService(t)

	first, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{
		Amount:         50000,
		IdempotencyKey: "req-12345",
		PaymentMethod:  "SP",
	})
	if err != nil {
		t.Fatalf("create topup first: %v", err)
	}
	if first.Status != "pending" {
		t.Fatalf("expected pending, got %s", first.Status)
	}
	if first.Provider != "duitku" {
		t.Fatalf("expected provider duitku, got %s", first.Provider)
	}
	if strings.TrimSpace(first.GatewayRef) == "" {
		t.Fatalf("gateway ref should not be empty")
	}

	second, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{
		Amount:         50000,
		IdempotencyKey: "req-12345",
		PaymentMethod:  "SP",
	})
	if err != nil {
		t.Fatalf("create topup second: %v", err)
	}

	if first.ID != second.ID {
		t.Fatalf("idempotency failed: %s != %s", first.ID, second.ID)
	}
	if fake.createHits != 1 {
		t.Fatalf("gateway create should run once, got %d", fake.createHits)
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

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, PaymentMethod: "SP"})
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

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 12000, PaymentMethod: "SP"})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	fake.statusMap[topup.GatewayRef] = "COMPLETED"

	if err := svc.HandleGatewayWebhook(context.Background(), WalletGatewayWebhookInput{
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

	successSig := BuildDuitkuCallbackSignature("premiumhub", 12000, topup.GatewayRef, "DK_test")
	if err := svc.HandleGatewayWebhook(context.Background(), WalletGatewayWebhookInput{
		OrderID:   topup.GatewayRef,
		Project:   "premiumhub",
		Status:    "COMPLETED",
		Amount:    12000,
		Signature: successSig,
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

	topup, err := svc.CreateTopup(context.Background(), user.ID, CreateTopupInput{Amount: 10000, PaymentMethod: "SP"})
	if err != nil {
		t.Fatalf("create topup: %v", err)
	}

	fake.statusMap[topup.GatewayRef] = "COMPLETED"

	payableSig := BuildDuitkuCallbackSignature("premiumhub", topup.PayableAmount, topup.GatewayRef, "DK_test")
	if err := svc.HandleGatewayWebhook(context.Background(), WalletGatewayWebhookInput{
		OrderID:   topup.GatewayRef,
		Project:   "premiumhub",
		Status:    "COMPLETED",
		Amount:    topup.PayableAmount,
		Signature: payableSig,
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

func TestWalletPayOrderWithWalletSuccessAndIdempotent(t *testing.T) {
	svc, db, _, user := setupWalletService(t)
	order, stock := seedWalletOrderFixture(t, db, user.ID, 50000, 70000)

	paid, err := svc.PayOrderWithWallet(context.Background(), user.ID, order.ID)
	if err != nil {
		t.Fatalf("pay order wallet: %v", err)
	}
	if paid.Amount != 50000 || paid.BalanceBefore != 70000 || paid.BalanceAfter != 20000 {
		t.Fatalf("unexpected payment result: %+v", paid)
	}

	userAfter := mustLoadUser(t, db, user.ID)
	if userAfter.WalletBalance != 20000 {
		t.Fatalf("expected balance 20000, got %d", userAfter.WalletBalance)
	}

	var storedOrder model.Order
	if err := db.Preload("Stock").First(&storedOrder, "id = ?", order.ID).Error; err != nil {
		t.Fatalf("load order: %v", err)
	}
	if storedOrder.PaymentStatus != "paid" || storedOrder.OrderStatus != "active" || storedOrder.PaymentMethod != "wallet" {
		t.Fatalf("order not settled by wallet: %+v", storedOrder)
	}
	if storedOrder.StockID == nil {
		t.Fatalf("expected stock id assigned")
	}

	var usedStock model.Stock
	if err := db.First(&usedStock, "id = ?", stock.ID).Error; err != nil {
		t.Fatalf("load stock: %v", err)
	}
	if usedStock.Status != "used" {
		t.Fatalf("expected stock used, got %s", usedStock.Status)
	}

	var ledgers []model.WalletLedger
	if err := db.Where("user_id = ?", user.ID).Order("created_at ASC").Find(&ledgers).Error; err != nil {
		t.Fatalf("load ledgers: %v", err)
	}
	if len(ledgers) != 1 {
		t.Fatalf("expected single wallet charge ledger, got %d", len(ledgers))
	}
	if ledgers[0].Category != "product_purchase" || ledgers[0].Type != "debit" || ledgers[0].Amount != 50000 {
		t.Fatalf("unexpected ledger payload: %+v", ledgers[0])
	}
	if !strings.HasPrefix(ledgers[0].Reference, "order_wallet:") {
		t.Fatalf("unexpected wallet charge reference: %s", ledgers[0].Reference)
	}

	paidAgain, err := svc.PayOrderWithWallet(context.Background(), user.ID, order.ID)
	if err != nil {
		t.Fatalf("pay order wallet idempotent: %v", err)
	}
	if paidAgain.BalanceBefore != 20000 || paidAgain.BalanceAfter != 20000 {
		t.Fatalf("idempotent result should keep balance unchanged: %+v", paidAgain)
	}

	var ledgerCount int64
	if err := db.Model(&model.WalletLedger{}).Where("reference = ?", ledgers[0].Reference).Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count ledgers: %v", err)
	}
	if ledgerCount != 1 {
		t.Fatalf("expected charge ledger once, got %d", ledgerCount)
	}
}

func TestWalletPayOrderWithWalletValidation(t *testing.T) {
	svc, db, _, user := setupWalletService(t)
	order, _ := seedWalletOrderFixture(t, db, user.ID, 50000, 10000)

	if _, err := svc.PayOrderWithWallet(context.Background(), user.ID, order.ID); err == nil || !strings.Contains(err.Error(), "saldo wallet tidak cukup") {
		t.Fatalf("expected insufficient balance error, got: %v", err)
	}

	if _, err := svc.PayOrderWithWallet(context.Background(), uuid.New(), order.ID); err == nil || !strings.Contains(err.Error(), "user tidak ditemukan") {
		t.Fatalf("expected missing user error, got: %v", err)
	}

	stockOrder, stock := seedWalletOrderFixture(t, db, user.ID, 20000, 50000)
	if err := db.Model(&model.Stock{}).Where("id = ?", stock.ID).Update("status", "used").Error; err != nil {
		t.Fatalf("mark stock used: %v", err)
	}
	if _, err := svc.PayOrderWithWallet(context.Background(), user.ID, stockOrder.ID); err == nil || !strings.Contains(err.Error(), "stok tidak tersedia") {
		t.Fatalf("expected stock unavailable error, got: %v", err)
	}
}

func TestWalletListLedgerSanitizesInternalCopy(t *testing.T) {
	svc, db, _, user := setupWalletService(t)

	topupID := uuid.New()
	rows := []model.WalletLedger{
		{
			ID:            uuid.New(),
			UserID:        user.ID,
			TopupID:       &topupID,
			Type:          "credit",
			Category:      "topup",
			Amount:        10000,
			BalanceBefore: 0,
			BalanceAfter:  10000,
			Reference:     "wallet_topup:dea9538f-e42e-4b47-8d46-98dd460f9ef2",
			Description:   "Topup wallet via Duitku (WLT-123)",
		},
		{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "debit",
			Category:      "5sim_purchase",
			Amount:        380,
			BalanceBefore: 10000,
			BalanceAfter:  9620,
			Reference:     "fivesim_order:987393457:charge",
			Description:   "Pembelian 5sim activation (indonesia/virtual53/michat), provider_price=0.030800, multiplier=18500.000000",
		},
		{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "credit",
			Category:      "5sim_refund",
			Amount:        380,
			BalanceBefore: 9620,
			BalanceAfter:  10000,
			Reference:     "fivesim_order:987393457:refund",
			Description:   "Refund otomatis 5sim provider_order_id=987393457 status=CANCELED reason=manual-cancel",
		},
		{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "debit",
			Category:      "product_purchase",
			Amount:        50000,
			BalanceBefore: 100000,
			BalanceAfter:  50000,
			Reference:     "order_wallet:7f9057d5-5c33-4ad2-a454-331f65aa60c5:charge",
			Description:   "Pembelian produk premium order 7f9057d5 via wallet",
		},
		{
			ID:            uuid.New(),
			UserID:        user.ID,
			Type:          "credit",
			Category:      "manual_adjustment",
			Amount:        5000,
			BalanceBefore: 10000,
			BalanceAfter:  15000,
			Reference:     "manual_nokos_live_test:20260413054215",
			Description:   "Topup manual live test nokos",
		},
	}

	if err := db.Create(&rows).Error; err != nil {
		t.Fatalf("seed wallet ledger rows: %v", err)
	}

	res, err := svc.ListLedger(user.ID, 1, 20)
	if err != nil {
		t.Fatalf("list ledger: %v", err)
	}

	if len(res.Ledgers) < 5 {
		t.Fatalf("expected at least 5 ledgers, got %d", len(res.Ledgers))
	}

	byCategory := map[string]WalletLedgerResponse{}
	for _, ledger := range res.Ledgers {
		if _, exists := byCategory[ledger.Category]; !exists {
			byCategory[ledger.Category] = ledger
		}
	}

	topupLedger, ok := byCategory["topup"]
	if !ok {
		t.Fatalf("expected topup ledger in response")
	}
	if topupLedger.Description != "Top up saldo" {
		t.Fatalf("unexpected topup description: %s", topupLedger.Description)
	}
	if !strings.HasPrefix(topupLedger.Reference, "Top up #") {
		t.Fatalf("unexpected topup reference: %s", topupLedger.Reference)
	}

	purchaseLedger, ok := byCategory["5sim_purchase"]
	if !ok {
		t.Fatalf("expected purchase ledger in response")
	}
	if purchaseLedger.Description != "Pembelian nomor OTP" {
		t.Fatalf("unexpected purchase description: %s", purchaseLedger.Description)
	}
	if purchaseLedger.Reference != "Pembelian #987393457" {
		t.Fatalf("unexpected purchase reference: %s", purchaseLedger.Reference)
	}

	refundLedger, ok := byCategory["5sim_refund"]
	if !ok {
		t.Fatalf("expected refund ledger in response")
	}
	if refundLedger.Description != "Refund nomor OTP" {
		t.Fatalf("unexpected refund description: %s", refundLedger.Description)
	}
	if refundLedger.Reference != "Refund #987393457" {
		t.Fatalf("unexpected refund reference: %s", refundLedger.Reference)
	}

	productLedger, ok := byCategory["product_purchase"]
	if !ok {
		t.Fatalf("expected product purchase ledger in response")
	}
	if productLedger.Description != "Pembelian produk premium" {
		t.Fatalf("unexpected product purchase description: %s", productLedger.Description)
	}
	if !strings.HasPrefix(productLedger.Reference, "Pembelian order #") {
		t.Fatalf("unexpected product purchase reference: %s", productLedger.Reference)
	}

	for _, ledger := range res.Ledgers {
		combined := strings.ToLower(ledger.Description + " " + ledger.Reference)
		if strings.Contains(combined, "pakasir") || strings.Contains(combined, "provider") || strings.Contains(combined, "5sim") {
			t.Fatalf("internal wording leaked in user ledger response: %q", combined)
		}
	}
}
