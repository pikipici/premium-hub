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

// ----- warranty fixture -----

type warrantyFixture struct {
	warrantySvc *GmailWarrantyService
	orderSvc    *GmailOrderService
	pricingSvc  *GmailPricingService
	gmailSvc    *GmailService
	db          *gorm.DB
	buyer       *model.User
	seller      *model.User
}

func setupWarrantyService(t *testing.T) *warrantyFixture {
	return setupWarrantyServiceWithBusyTimeout(t, 0)
}

func setupWarrantyServiceWithBusyTimeout(t *testing.T, busyMs int) *warrantyFixture {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	if busyMs > 0 {
		dsn = fmt.Sprintf("%s&_busy_timeout=%d", dsn, busyMs)
	}
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
		&model.GmailClaim{},
		&model.GmailPricing{},
		&model.GmailStrike{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	buyer := &model.User{
		ID: uuid.New(), Name: "Buyer",
		Email: fmt.Sprintf("buyer-%s@x.com", uuid.NewString()),
		Password: "h", Role: "user", IsActive: true,
		WalletBalance: 1_000_000,
	}
	db.Create(buyer)
	seller := &model.User{
		ID: uuid.New(), Name: "Seller",
		Email: fmt.Sprintf("seller-%s@x.com", uuid.NewString()),
		Password: "h", Role: "user", IsActive: true,
	}
	db.Create(seller)

	pricing := &model.GmailPricing{
		ID: uuid.New(), BuyPrice: 3000, SellPrice: 5000,
		LowInventoryThreshold: 20,
	}
	db.Create(pricing)

	cfg := &config.Config{
		GmailGeneratedEmailPrefix: "premium",
		GmailMaxPendingPerUser:    3,
		GmailSlotExpiryHours:      6,
		GmailStrikeWindowDays:     30,
		GmailStrikeBanDays:        30,
		GmailStrikeThreshold:      3,
		GmailBuyMaxQtyPerOrder:    50,
		GmailWarrantyHours:        24,
	}
	cipher := mustTestStockCipher(t)

	gmailRepo := repository.NewGmailAccountRepo(db)
	gmailPricingRepo := repository.NewGmailPricingRepo(db)
	gmailStrikeRepo := repository.NewGmailStrikeRepo(db)
	gmailOrderRepo := repository.NewGmailOrderRepo(db)
	gmailClaimRepo := repository.NewGmailClaimRepo(db)
	walletRepo := repository.NewWalletRepo(db)
	notifRepo := repository.NewNotificationRepo(db)

	gmailSvc := NewGmailService(cfg, gmailRepo, gmailPricingRepo, gmailStrikeRepo,
		walletRepo, repository.NewUserRepo(db), notifRepo, cipher)
	pricingSvc := NewGmailPricingService(gmailPricingRepo)
	orderSvc := NewGmailOrderService(cfg, gmailRepo, gmailOrderRepo, walletRepo,
		notifRepo, pricingSvc, cipher)
	warrantySvc := NewGmailWarrantyService(cfg, gmailRepo, gmailOrderRepo,
		gmailClaimRepo, walletRepo)

	return &warrantyFixture{
		warrantySvc: warrantySvc, orderSvc: orderSvc, pricingSvc: pricingSvc,
		gmailSvc: gmailSvc, db: db, buyer: buyer, seller: seller,
	}
}

func (f *warrantyFixture) seedAndBuy(t *testing.T, qty int, totalInventory int) (*model.GmailOrder, []model.GmailAccount) {
	t.Helper()
	cipher := mustTestStockCipher(t)
	for i := 0; i < totalInventory; i++ {
		plainPw := fmt.Sprintf("pwd-%s", uuid.NewString()[:8])
		enc, _ := cipher.Encrypt(plainPw)
		now := time.Now().Add(-time.Duration(totalInventory-i) * time.Minute)
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
		f.db.Create(g)
	}
	res, err := f.orderSvc.Buy(f.buyer.ID, int64(qty))
	if err != nil {
		t.Fatalf("Buy: %v", err)
	}
	// Hydrate sold gmails attached to order.
	var sold []model.GmailAccount
	f.db.Where("sold_order_id = ?", res.Order.ID).Find(&sold)
	return res.Order, sold
}

// ----- Replacement path -----

func TestWarranty_Replace_Success(t *testing.T) {
	f := setupWarrantyService(t)
	// Buy 1, but seed 3 total inventory so 2 left after buy = replacement available.
	order, sold := f.seedAndBuy(t, 1, 3)

	gm := sold[0]
	res, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, gm.ID, "akun banned dalam 5 menit")
	if err != nil {
		t.Fatalf("CreateClaim: %v", err)
	}
	if res.Claim.Status != model.GmailClaimStatusReplaced {
		t.Errorf("status = %s, want replaced", res.Claim.Status)
	}
	if res.Replacement == nil {
		t.Fatal("expected replacement gmail")
	}
	if res.Claim.ResolutionType != model.GmailClaimResolutionReplaced {
		t.Errorf("resolution = %s, want replaced", res.Claim.ResolutionType)
	}

	// Verify original disposed.
	var orig model.GmailAccount
	f.db.First(&orig, "id = ?", gm.ID)
	if orig.Status != model.GmailStatusDisposed {
		t.Errorf("original status = %s, want disposed", orig.Status)
	}
	if orig.DisposedReason != model.GmailDisposedReasonBannedAfterSale {
		t.Errorf("dispose reason = %s", orig.DisposedReason)
	}

	// Verify replacement chained to same SoldOrderID.
	var rep model.GmailAccount
	f.db.First(&rep, "id = ?", res.Replacement.ID)
	if rep.Status != model.GmailStatusSold {
		t.Errorf("replacement status = %s, want sold", rep.Status)
	}
	if rep.SoldOrderID == nil || *rep.SoldOrderID != order.ID {
		t.Error("replacement not chained to original order")
	}
	if rep.SoldPrice != gm.SoldPrice {
		t.Errorf("replacement sold_price = %d, want %d", rep.SoldPrice, gm.SoldPrice)
	}

	// Buyer balance unchanged (no refund on replace).
	var buyer model.User
	f.db.First(&buyer, "id = ?", f.buyer.ID)
	if buyer.WalletBalance != 1_000_000-5000 {
		t.Errorf("balance = %d, want %d (only original purchase deducted)", buyer.WalletBalance, 1_000_000-5000)
	}
}

// ----- Refund path (inventory empty) -----

func TestWarranty_Refund_WhenNoInventory(t *testing.T) {
	f := setupWarrantyService(t)
	// Buy 1 and seed only 1 — after buy, inventory = 0.
	order, sold := f.seedAndBuy(t, 1, 1)

	gm := sold[0]
	balanceBefore := int64(0)
	var buyer model.User
	f.db.First(&buyer, "id = ?", f.buyer.ID)
	balanceBefore = buyer.WalletBalance

	res, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, gm.ID, "banned")
	if err != nil {
		t.Fatalf("CreateClaim: %v", err)
	}
	if res.Claim.Status != model.GmailClaimStatusRefunded {
		t.Errorf("status = %s, want refunded", res.Claim.Status)
	}
	if res.RefundAmount != gm.SoldPrice {
		t.Errorf("refund = %d, want %d", res.RefundAmount, gm.SoldPrice)
	}
	if res.Claim.RefundLedgerID == nil {
		t.Error("refund ledger id not stamped on claim")
	}

	// Buyer balance credited.
	f.db.First(&buyer, "id = ?", f.buyer.ID)
	if buyer.WalletBalance != balanceBefore+gm.SoldPrice {
		t.Errorf("balance = %d, want %d", buyer.WalletBalance, balanceBefore+gm.SoldPrice)
	}

	// Ledger credit row written.
	var ledger model.WalletLedger
	f.db.First(&ledger, "id = ?", *res.Claim.RefundLedgerID)
	if ledger.Type != "credit" {
		t.Errorf("ledger type = %s, want credit", ledger.Type)
	}
	if ledger.Pocket != model.WalletPocketSpend {
		t.Errorf("ledger pocket = %s, want spend", ledger.Pocket)
	}
	if ledger.Category != model.LedgerCategoryGmailWarrantyRefund {
		t.Errorf("ledger category = %s", ledger.Category)
	}
}

// ----- Auth + ownership enforcement -----

func TestWarranty_OtherUserCannotClaim(t *testing.T) {
	f := setupWarrantyService(t)
	order, sold := f.seedAndBuy(t, 1, 3)
	other := &model.User{
		ID: uuid.New(), Name: "X",
		Email: fmt.Sprintf("other-%s@x.com", uuid.NewString()),
		Password: "h", Role: "user", IsActive: true, WalletBalance: 100,
	}
	f.db.Create(other)

	_, err := f.warrantySvc.CreateClaim(other.ID, order.ID, sold[0].ID, "banned")
	if err == nil {
		t.Fatal("expected ownership error")
	}
}

func TestWarranty_WrongOrderID(t *testing.T) {
	f := setupWarrantyService(t)
	_, sold := f.seedAndBuy(t, 1, 3)
	bogus := uuid.New()
	_, err := f.warrantySvc.CreateClaim(f.buyer.ID, bogus, sold[0].ID, "banned")
	if err == nil {
		t.Fatal("expected mismatched order error")
	}
}

// ----- Warranty window -----

func TestWarranty_ExpiredWindow(t *testing.T) {
	f := setupWarrantyService(t)
	order, sold := f.seedAndBuy(t, 1, 3)
	// Backdate SoldAt to 25h ago.
	pastTime := time.Now().Add(-25 * time.Hour)
	f.db.Model(&model.GmailAccount{}).Where("id = ?", sold[0].ID).
		Update("sold_at", pastTime)

	_, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, sold[0].ID, "banned")
	if err == nil {
		t.Fatal("expected warranty-expired error")
	}
}

// ----- Double claim guard -----

func TestWarranty_NoDoubleClaim(t *testing.T) {
	f := setupWarrantyService(t)
	order, sold := f.seedAndBuy(t, 1, 5)

	// First claim succeeds.
	if _, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, sold[0].ID, "banned"); err != nil {
		t.Fatalf("first claim: %v", err)
	}
	// Second claim on same gmail — must fail.
	_, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, sold[0].ID, "still bad")
	if err == nil {
		t.Fatal("expected double-claim error")
	}
}

// ----- Reason validation -----

func TestWarranty_RejectsEmptyReason(t *testing.T) {
	f := setupWarrantyService(t)
	order, sold := f.seedAndBuy(t, 1, 3)
	_, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, sold[0].ID, "   ")
	if err == nil {
		t.Fatal("expected empty-reason error")
	}
}

// ----- ListByOrder auth -----

func TestWarranty_ListByOrder_AuthScoped(t *testing.T) {
	f := setupWarrantyService(t)
	order, sold := f.seedAndBuy(t, 1, 5)
	_, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, sold[0].ID, "banned")
	if err != nil {
		t.Fatalf("claim: %v", err)
	}

	// Buyer lists their own — sees claim.
	rows, err := f.warrantySvc.ListByOrder(f.buyer.ID, order.ID)
	if err != nil {
		t.Fatalf("ListByOrder: %v", err)
	}
	if len(rows) != 1 {
		t.Errorf("rows = %d, want 1", len(rows))
	}

	// Other user — must error (order ownership check).
	other := uuid.New()
	if _, err := f.warrantySvc.ListByOrder(other, order.ID); err == nil {
		t.Fatal("expected auth error for cross-user list")
	}
}

// ----- Race regression: parallel claims on one gmail -----
//
// SQLite serializes writers (database-level lock), so 5 parallel
// transactions don't actually exercise the row-level FOR UPDATE
// path that Postgres uses in production. We use _busy_timeout to
// let writers wait instead of fail-fast, then assert the unique
// invariant — only ONE claim row exists per gmail_account_id —
// regardless of how many goroutines attempted it. This proves
// the unique index + ExistsForGmailTx guard work end-to-end.
func TestWarranty_NoRace_OneClaimPerGmail(t *testing.T) {
	f := setupWarrantyServiceWithBusyTimeout(t, 5000)
	order, sold := f.seedAndBuy(t, 1, 5)

	const concurrent = 3
	var wg sync.WaitGroup
	var ok int32
	for i := 0; i < concurrent; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, sold[0].ID, "banned")
			if err == nil {
				atomic.AddInt32(&ok, 1)
			}
		}()
	}
	wg.Wait()
	if ok != 1 {
		t.Errorf("got %d claims succeed, want exactly 1 (unique invariant)", ok)
	}
	var claimCount int64
	f.db.Model(&model.GmailClaim{}).Where("gmail_account_id = ?", sold[0].ID).Count(&claimCount)
	if claimCount != 1 {
		t.Errorf("DB claim rows = %d, want 1", claimCount)
	}
}

// ----- Replacement does not consume buyer balance -----

func TestWarranty_ReplaceKeepsBalance(t *testing.T) {
	f := setupWarrantyService(t)
	order, sold := f.seedAndBuy(t, 1, 3)
	var buyer model.User
	f.db.First(&buyer, "id = ?", f.buyer.ID)
	balBefore := buyer.WalletBalance
	if _, err := f.warrantySvc.CreateClaim(f.buyer.ID, order.ID, sold[0].ID, "banned"); err != nil {
		t.Fatalf("claim: %v", err)
	}
	f.db.First(&buyer, "id = ?", f.buyer.ID)
	if buyer.WalletBalance != balBefore {
		t.Errorf("balance changed on replace: %d -> %d", balBefore, buyer.WalletBalance)
	}
}
