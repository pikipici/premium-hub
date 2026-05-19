package service

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ----- buy-side test fixture -----

type gmailBuyFixture struct {
	orderSvc   *GmailOrderService
	pricingSvc *GmailPricingService
	gmailSvc   *GmailService
	db         *gorm.DB
	buyer      *model.User
	seller     *model.User
	pricingRow *model.GmailPricing
}

func setupGmailBuyService(t *testing.T) *gmailBuyFixture {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Notification{},
		&model.WalletLedger{},
		&model.GmailAccount{},
		&model.GmailOrder{},
		&model.GmailPricing{},
		&model.GmailStrike{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	buyer := &model.User{
		ID:                uuid.New(),
		Name:              "Buyer",
		Email:             fmt.Sprintf("buyer-%s@example.com", uuid.NewString()),
		Password:          "hashed",
		Role:              "user",
		IsActive:          true,
		WalletBalance:     1_000_000, // 1jt buat coverage bulk
		WalletBalanceEarn: 0,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}
	seller := &model.User{
		ID:       uuid.New(),
		Name:     "Seller",
		Email:    fmt.Sprintf("seller-%s@example.com", uuid.NewString()),
		Password: "hashed",
		Role:     "user",
		IsActive: true,
	}
	if err := db.Create(seller).Error; err != nil {
		t.Fatalf("create seller: %v", err)
	}

	pricing := &model.GmailPricing{
		ID:                    uuid.New(),
		BuyPrice:              3000,
		SellPrice:             5000,
		LowInventoryThreshold: 20,
	}
	if err := db.Create(pricing).Error; err != nil {
		t.Fatalf("create pricing: %v", err)
	}

	cfg := &config.Config{
		GmailGeneratedEmailPrefix: "premium",
		GmailMaxPendingPerUser:    3,
		GmailSlotExpiryHours:      6,
		GmailStrikeWindowDays:     30,
		GmailStrikeBanDays:        30,
		GmailStrikeThreshold:      3,
		GmailBuyMaxQtyPerOrder:    50,
	}

	cipher := mustTestStockCipher(t)
	gmailRepo := repository.NewGmailAccountRepo(db)
	gmailPricingRepo := repository.NewGmailPricingRepo(db)
	gmailStrikeRepo := repository.NewGmailStrikeRepo(db)
	gmailOrderRepo := repository.NewGmailOrderRepo(db)
	walletRepo := repository.NewWalletRepo(db)
	notifRepo := repository.NewNotificationRepo(db)

	gmailSvc := NewGmailService(
		cfg, gmailRepo, gmailPricingRepo, gmailStrikeRepo,
		walletRepo, repository.NewUserRepo(db), notifRepo, cipher,
	)
	pricingSvc := NewGmailPricingService(gmailPricingRepo)
	orderSvc := NewGmailOrderService(
		cfg, gmailRepo, gmailOrderRepo, walletRepo, notifRepo,
		pricingSvc, cipher,
	)

	return &gmailBuyFixture{
		orderSvc:   orderSvc,
		pricingSvc: pricingSvc,
		gmailSvc:   gmailSvc,
		db:         db,
		buyer:      buyer,
		seller:     seller,
		pricingRow: pricing,
	}
}

// helper: seed N verified gmail rows ready for sale.
func (f *gmailBuyFixture) seedVerifiedInventory(t *testing.T, n int, cipher interface{ Encrypt(string) (string, error) }) []model.GmailAccount {
	t.Helper()
	rows := make([]model.GmailAccount, 0, n)
	for i := 0; i < n; i++ {
		plainPw := fmt.Sprintf("plain-pwd-%d-secret", i)
		enc, err := cipher.Encrypt(plainPw)
		if err != nil {
			t.Fatalf("encrypt: %v", err)
		}
		now := time.Now().Add(-time.Duration(n-i) * time.Minute)
		g := &model.GmailAccount{
			ID:                 uuid.New(),
			CreatedByUserID:    f.seller.ID,
			Status:             model.GmailStatusVerified,
			Email:              fmt.Sprintf("inv-%s@gmail.com", uuid.NewString()[:8]),
			PasswordEnc:        enc,
			PasswordVersion:    model.GmailPasswordVersionPostVerify,
			VerifiedAt:         &now,
			SellerPayoutAmount: 3000,
			CreatedAt:          now,
			UpdatedAt:          now,
		}
		if err := f.db.Create(g).Error; err != nil {
			t.Fatalf("seed gmail: %v", err)
		}
		rows = append(rows, *g)
	}
	return rows
}

// ----- CalculateTotal tests (pure math) -----

func TestGmailPricing_CalculateTotal_NoBulk(t *testing.T) {
	f := setupGmailBuyService(t)
	gross, discount, net, err := f.pricingSvc.CalculateTotal(5)
	if err != nil {
		t.Fatalf("CalculateTotal: %v", err)
	}
	if gross != 25000 {
		t.Errorf("gross = %d, want 25000", gross)
	}
	if discount != 0 {
		t.Errorf("discount = %d, want 0", discount)
	}
	if net != 25000 {
		t.Errorf("net = %d, want 25000", net)
	}
}

func TestGmailPricing_CalculateTotal_BulkTier(t *testing.T) {
	f := setupGmailBuyService(t)
	// Enable bulk discount: 10% at 10+, 20% at 50+
	f.pricingRow.BulkDiscountEnabled = true
	f.pricingRow.BulkDiscountTiers = `[{"min_qty":10,"discount_pct":10},{"min_qty":50,"discount_pct":20}]`
	if err := f.db.Save(f.pricingRow).Error; err != nil {
		t.Fatalf("save pricing: %v", err)
	}

	cases := []struct {
		qty   int64
		gross int64
		disc  int64
		net   int64
	}{
		{5, 25000, 0, 25000},          // below first tier
		{10, 50000, 5000, 45000},      // exactly first tier
		{49, 245000, 24500, 220500},   // first tier still applies
		{50, 250000, 50000, 200000},   // hit second tier
	}
	for _, tc := range cases {
		g, d, n, err := f.pricingSvc.CalculateTotal(tc.qty)
		if err != nil {
			t.Errorf("qty=%d: err %v", tc.qty, err)
			continue
		}
		if g != tc.gross || d != tc.disc || n != tc.net {
			t.Errorf("qty=%d: got (%d,%d,%d), want (%d,%d,%d)",
				tc.qty, g, d, n, tc.gross, tc.disc, tc.net)
		}
	}
}

func TestGmailPricing_CalculateTotal_QtyZero(t *testing.T) {
	f := setupGmailBuyService(t)
	if _, _, _, err := f.pricingSvc.CalculateTotal(0); err == nil {
		t.Error("expected error for qty=0")
	}
	if _, _, _, err := f.pricingSvc.CalculateTotal(-1); err == nil {
		t.Error("expected error for negative qty")
	}
}

// ----- AdminUpdate validation tests -----

func TestGmailPricing_AdminUpdate_MarginGuard(t *testing.T) {
	f := setupGmailBuyService(t)
	// Try set sell_price <= buy_price.
	sell := int64(2000)
	_, err := f.pricingSvc.AdminUpdate(uuid.New(), GmailPricingUpdateInput{
		SellPrice: &sell,
	})
	if err == nil {
		t.Error("expected margin guard error")
	}
}

func TestGmailPricing_AdminUpdate_TierValidation(t *testing.T) {
	f := setupGmailBuyService(t)
	// Invalid: pct out of range
	_, err := f.pricingSvc.AdminUpdate(uuid.New(), GmailPricingUpdateInput{
		BulkDiscountTiers: []GmailDiscountTier{{MinQty: 10, DiscountPct: 150}},
	})
	if err == nil {
		t.Error("expected tier pct out-of-range error")
	}
	// Invalid: duplicate min_qty
	_, err = f.pricingSvc.AdminUpdate(uuid.New(), GmailPricingUpdateInput{
		BulkDiscountTiers: []GmailDiscountTier{
			{MinQty: 10, DiscountPct: 5},
			{MinQty: 10, DiscountPct: 10},
		},
	})
	if err == nil {
		t.Error("expected duplicate min_qty error")
	}
}

func TestGmailPricing_AdminUpdate_NoFieldsTouched(t *testing.T) {
	f := setupGmailBuyService(t)
	_, err := f.pricingSvc.AdminUpdate(uuid.New(), GmailPricingUpdateInput{})
	if err == nil {
		t.Error("expected no-op error")
	}
}

// ----- Buy tests -----

func TestGmailBuy_Single_Success(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 5, cipher)

	res, err := f.orderSvc.Buy(f.buyer.ID, 1)
	if err != nil {
		t.Fatalf("Buy: %v", err)
	}
	if res.Order.Quantity != 1 {
		t.Errorf("qty = %d, want 1", res.Order.Quantity)
	}
	if res.Order.NetAmount != 5000 {
		t.Errorf("net = %d, want 5000", res.Order.NetAmount)
	}
	if len(res.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(res.Items))
	}
	if res.Items[0].Email == "" || res.Items[0].Password == "" {
		t.Error("creds missing in response")
	}

	// Buyer balance debited.
	var buyer model.User
	f.db.First(&buyer, "id = ?", f.buyer.ID)
	if buyer.WalletBalance != 1_000_000-5000 {
		t.Errorf("balance = %d, want %d", buyer.WalletBalance, 1_000_000-5000)
	}

	// Gmail row marked sold.
	var sold model.GmailAccount
	f.db.First(&sold, "id = ?", res.Items[0].GmailAccountID)
	if sold.Status != model.GmailStatusSold {
		t.Errorf("status = %s, want sold", sold.Status)
	}
	if sold.SoldOrderID == nil || *sold.SoldOrderID != res.Order.ID {
		t.Error("sold_order_id not chained")
	}

	// Ledger row written with pocket=spend, type=debit.
	var ledger model.WalletLedger
	f.db.Where("user_id = ?", f.buyer.ID).First(&ledger)
	if ledger.Type != "debit" || ledger.Pocket != model.WalletPocketSpend {
		t.Errorf("ledger type/pocket = %s/%s", ledger.Type, ledger.Pocket)
	}
	if ledger.Category != model.LedgerCategoryGmailBuyDebit {
		t.Errorf("ledger category = %s", ledger.Category)
	}
}

func TestGmailBuy_Bulk_Success(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 20, cipher)

	res, err := f.orderSvc.Buy(f.buyer.ID, 5)
	if err != nil {
		t.Fatalf("Buy: %v", err)
	}
	if res.Order.NetAmount != 25000 {
		t.Errorf("net = %d, want 25000", res.Order.NetAmount)
	}
	if len(res.Items) != 5 {
		t.Errorf("items = %d, want 5", len(res.Items))
	}
}

func TestGmailBuy_BulkWithDiscount(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 20, cipher)

	// Enable 10% discount at 10+
	f.pricingRow.BulkDiscountEnabled = true
	f.pricingRow.BulkDiscountTiers = `[{"min_qty":10,"discount_pct":10}]`
	f.db.Save(f.pricingRow)

	res, err := f.orderSvc.Buy(f.buyer.ID, 10)
	if err != nil {
		t.Fatalf("Buy: %v", err)
	}
	if res.Order.GrossAmount != 50000 {
		t.Errorf("gross = %d, want 50000", res.Order.GrossAmount)
	}
	if res.Order.DiscountAmount != 5000 {
		t.Errorf("discount = %d, want 5000", res.Order.DiscountAmount)
	}
	if res.Order.NetAmount != 45000 {
		t.Errorf("net = %d, want 45000", res.Order.NetAmount)
	}
}

func TestGmailBuy_StockExhausted_FullRollback(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 3, cipher)

	originalBalance := f.buyer.WalletBalance
	_, err := f.orderSvc.Buy(f.buyer.ID, 5)
	if err == nil {
		t.Fatal("expected stock-exhausted error")
	}

	// Verify rollback: balance unchanged
	var buyer model.User
	f.db.First(&buyer, "id = ?", f.buyer.ID)
	if buyer.WalletBalance != originalBalance {
		t.Errorf("balance changed after rollback: %d -> %d", originalBalance, buyer.WalletBalance)
	}
	// No order row
	var orderCount int64
	f.db.Model(&model.GmailOrder{}).Count(&orderCount)
	if orderCount != 0 {
		t.Errorf("order rows = %d, want 0 (rollback)", orderCount)
	}
	// No gmail rows marked sold
	var soldCount int64
	f.db.Model(&model.GmailAccount{}).Where("status = ?", model.GmailStatusSold).Count(&soldCount)
	if soldCount != 0 {
		t.Errorf("sold gmail = %d, want 0 (rollback)", soldCount)
	}
	// No ledger rows
	var ledgerCount int64
	f.db.Model(&model.WalletLedger{}).Count(&ledgerCount)
	if ledgerCount != 0 {
		t.Errorf("ledger rows = %d, want 0 (rollback)", ledgerCount)
	}
}

func TestGmailBuy_InsufficientBalance_FullRollback(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 100, cipher)

	// Drain buyer balance to 1000.
	f.buyer.WalletBalance = 1000
	f.db.Save(f.buyer)

	_, err := f.orderSvc.Buy(f.buyer.ID, 5) // needs 25000
	if err == nil {
		t.Fatal("expected insufficient-balance error")
	}

	// Inventory all still verified.
	var verified int64
	f.db.Model(&model.GmailAccount{}).Where("status = ?", model.GmailStatusVerified).Count(&verified)
	if verified != 100 {
		t.Errorf("verified = %d, want 100 (no claim leaked)", verified)
	}
}

func TestGmailBuy_QtyOverMax(t *testing.T) {
	f := setupGmailBuyService(t)
	_, err := f.orderSvc.Buy(f.buyer.ID, 51) // max is 50
	if err == nil {
		t.Fatal("expected max-qty error")
	}
}

// CRITICAL: parallel buys must NOT overcommit stock.
func TestGmailBuy_NoRaceOnStock(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 5, cipher)

	const concurrent = 5
	var wg sync.WaitGroup
	var soldOk int32

	for i := 0; i < concurrent; i++ {
		// Bikin buyer baru per goroutine biar tiap buyer punya saldo
		// independen. Ini test inventory race, bukan balance race.
		buyer := &model.User{
			ID:            uuid.New(),
			Name:          "B",
			Email:         fmt.Sprintf("p-%s@x.com", uuid.NewString()),
			Password:      "h",
			Role:          "user",
			IsActive:      true,
			WalletBalance: 100000,
		}
		f.db.Create(buyer)

		wg.Add(1)
		go func(b *model.User) {
			defer wg.Done()
			_, err := f.orderSvc.Buy(b.ID, 2)
			if err == nil {
				atomic.AddInt32(&soldOk, 1)
			}
		}(buyer)
	}
	wg.Wait()

	// Total sold gmail should equal sum of successful buys × 2.
	var sold int64
	f.db.Model(&model.GmailAccount{}).Where("status = ?", model.GmailStatusSold).Count(&sold)
	if sold > 5 {
		t.Errorf("OVERCOMMIT: sold %d gmail (stock was 5)", sold)
	}
	if int(soldOk)*2 != int(sold) {
		t.Errorf("inconsistency: %d successful buys but %d sold rows", soldOk, sold)
	}
}

// ----- GetMyOrderWithCreds tests -----

func TestGmailBuy_GetMyOrder_Success(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 3, cipher)

	res, err := f.orderSvc.Buy(f.buyer.ID, 2)
	if err != nil {
		t.Fatalf("Buy: %v", err)
	}

	out, err := f.orderSvc.GetMyOrderWithCreds(f.buyer.ID, res.Order.ID)
	if err != nil {
		t.Fatalf("GetMyOrderWithCreds: %v", err)
	}
	if out.Order.ID != res.Order.ID {
		t.Error("order id mismatch")
	}
	if len(out.Items) != 2 {
		t.Errorf("items = %d, want 2", len(out.Items))
	}
	for _, item := range out.Items {
		if item.Email == "" || item.Password == "" {
			t.Error("creds missing")
		}
	}
}

func TestGmailBuy_GetMyOrder_AuthScoped(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 3, cipher)

	res, err := f.orderSvc.Buy(f.buyer.ID, 1)
	if err != nil {
		t.Fatalf("Buy: %v", err)
	}

	// Other user tries to access — must fail.
	otherID := uuid.New()
	_, err = f.orderSvc.GetMyOrderWithCreds(otherID, res.Order.ID)
	if err == nil {
		t.Fatal("expected not-found for cross-user access")
	}
}

// ----- ListMyOrders auth scoping -----

func TestGmailBuy_ListMyOrders_OnlyOwn(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 5, cipher)

	// Buyer A buys.
	if _, err := f.orderSvc.Buy(f.buyer.ID, 1); err != nil {
		t.Fatalf("Buy A: %v", err)
	}

	// Buyer B (other user) buys.
	otherBuyer := &model.User{
		ID:            uuid.New(),
		Name:          "Other",
		Email:         fmt.Sprintf("other-%s@x.com", uuid.NewString()),
		Password:      "h",
		Role:          "user",
		IsActive:      true,
		WalletBalance: 100000,
	}
	f.db.Create(otherBuyer)
	if _, err := f.orderSvc.Buy(otherBuyer.ID, 1); err != nil {
		t.Fatalf("Buy B: %v", err)
	}

	// Buyer A lists — should see only own.
	rows, _, err := f.orderSvc.ListMyOrders(f.buyer.ID, 1, 10)
	if err != nil {
		t.Fatalf("ListMyOrders: %v", err)
	}
	for _, r := range rows {
		if r.UserID != f.buyer.ID {
			t.Errorf("leaked other user's order: %s", r.ID)
		}
	}
}

// ----- Pricing snapshot stable mid-tx -----

func TestGmailBuy_PricingFrozenInTx(t *testing.T) {
	f := setupGmailBuyService(t)
	cipher := mustTestStockCipher(t)
	f.seedVerifiedInventory(t, 3, cipher)

	res, err := f.orderSvc.Buy(f.buyer.ID, 1)
	if err != nil {
		t.Fatalf("Buy: %v", err)
	}
	originalUnit := res.Order.UnitPrice

	// Admin bumps sell_price.
	f.pricingRow.SellPrice = 9999
	f.db.Save(f.pricingRow)

	// Verify stored unit price is the snapshot, not new sell_price.
	var stored model.GmailOrder
	f.db.First(&stored, "id = ?", res.Order.ID)
	if stored.UnitPrice != originalUnit {
		t.Errorf("unit_price = %d, want %d (snapshot)", stored.UnitPrice, originalUnit)
	}
}
