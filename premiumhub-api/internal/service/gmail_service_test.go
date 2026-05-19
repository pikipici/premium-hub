package service

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ----- gmail test fixture helper -----

type gmailFixture struct {
	svc        *GmailService
	db         *gorm.DB
	user       *model.User
	admin      *model.User
	pricingRow *model.GmailPricing
}

func setupGmailService(t *testing.T) *gmailFixture {
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
		&model.GmailPricing{},
		&model.GmailStrike{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	user := &model.User{
		ID:                uuid.New(),
		Name:              "Seller User",
		Email:             fmt.Sprintf("seller-%s@example.com", uuid.NewString()),
		Password:          "hashed",
		Role:              "user",
		IsActive:          true,
		WalletBalance:     0,
		WalletBalanceEarn: 0,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	admin := &model.User{
		ID:       uuid.New(),
		Name:     "Admin",
		Email:    fmt.Sprintf("admin-%s@example.com", uuid.NewString()),
		Password: "hashed",
		Role:     "admin",
		IsActive: true,
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	pricing := &model.GmailPricing{
		ID:                  uuid.New(),
		BuyPrice:            3000,
		SellPrice:           5000,
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
	}

	cipher := mustTestStockCipher(t)
	svc := NewGmailService(
		cfg,
		repository.NewGmailAccountRepo(db),
		repository.NewGmailPricingRepo(db),
		repository.NewGmailStrikeRepo(db),
		repository.NewWalletRepo(db),
		repository.NewUserRepo(db),
		repository.NewNotificationRepo(db),
		cipher,
	)

	return &gmailFixture{
		svc:        svc,
		db:         db,
		user:       user,
		admin:      admin,
		pricingRow: pricing,
	}
}

// helper: directly seed a slot in any status, bypassing service flow.
func (f *gmailFixture) seedSlot(t *testing.T, status string, age time.Duration) *model.GmailAccount {
	t.Helper()
	now := time.Now().Add(-age)
	g := &model.GmailAccount{
		ID:              uuid.New(),
		CreatedByUserID: f.user.ID,
		Status:          status,
		Email:           fmt.Sprintf("seed-%s@gmail.com", uuid.NewString()[:8]),
		PasswordEnc:     "encrypted-password",
		PasswordVersion: model.GmailPasswordVersionInitial,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if status == model.GmailStatusPendingCreate {
		expiry := now.Add(6 * time.Hour)
		g.SlotExpiresAt = &expiry
	}
	if status == model.GmailStatusPendingVerify {
		submitted := now
		g.SubmittedAt = &submitted
	}
	if err := f.db.Create(g).Error; err != nil {
		t.Fatalf("seed slot: %v", err)
	}
	return g
}

// ----- RequestSlot tests -----

func TestGmail_RequestSlot_Success(t *testing.T) {
	f := setupGmailService(t)
	res, err := f.svc.RequestSlot(f.user.ID)
	if err != nil {
		t.Fatalf("RequestSlot: %v", err)
	}
	if res == nil || res.GmailAccount == nil {
		t.Fatal("expected SlotResponse")
	}
	if res.GmailAccount.Status != model.GmailStatusPendingCreate {
		t.Errorf("status = %s, want pending_create", res.GmailAccount.Status)
	}
	if res.PlainPassword == "" {
		t.Error("plain password not returned")
	}
	if len(res.PlainPassword) < 12 {
		t.Errorf("plain password too short: %d chars", len(res.PlainPassword))
	}
	if res.GmailAccount.SlotExpiresAt == nil {
		t.Error("slot_expires_at not set")
	}
	// PasswordEnc must be set (encrypted) and != plain.
	if res.GmailAccount.PasswordEnc == "" {
		t.Error("encrypted password missing")
	}
	if res.GmailAccount.PasswordEnc == res.PlainPassword {
		t.Error("password stored in plaintext (security bug)")
	}
}

func TestGmail_RequestSlot_BannedUser(t *testing.T) {
	f := setupGmailService(t)
	banUntil := time.Now().Add(7 * 24 * time.Hour)
	f.user.GmailSellBannedUntil = &banUntil
	if err := f.db.Save(f.user).Error; err != nil {
		t.Fatalf("update ban: %v", err)
	}
	_, err := f.svc.RequestSlot(f.user.ID)
	if err == nil {
		t.Fatal("expected error for banned user")
	}
}

func TestGmail_RequestSlot_BanExpired(t *testing.T) {
	f := setupGmailService(t)
	banUntil := time.Now().Add(-1 * time.Hour) // ban already expired
	f.user.GmailSellBannedUntil = &banUntil
	if err := f.db.Save(f.user).Error; err != nil {
		t.Fatalf("update ban: %v", err)
	}
	_, err := f.svc.RequestSlot(f.user.ID)
	if err != nil {
		t.Fatalf("expected success after ban expired, got: %v", err)
	}
}

func TestGmail_RequestSlot_MaxPendingHit(t *testing.T) {
	f := setupGmailService(t)
	// Seed max pending slots directly.
	for i := 0; i < 3; i++ {
		f.seedSlot(t, model.GmailStatusPendingCreate, 0)
	}
	_, err := f.svc.RequestSlot(f.user.ID)
	if err == nil {
		t.Fatal("expected max-pending error")
	}
}

// ISSUE-1 regression: parallel requests should NOT bypass max-pending.
func TestGmail_RequestSlot_NoRaceOnMaxPending(t *testing.T) {
	f := setupGmailService(t)
	// Pre-seed 2 pending; max is 3, so only 1 of 5 parallel calls
	// should succeed (the other 4 must be rejected).
	for i := 0; i < 2; i++ {
		f.seedSlot(t, model.GmailStatusPendingCreate, 0)
	}

	const concurrent = 5
	var wg sync.WaitGroup
	results := make([]error, concurrent)
	for i := 0; i < concurrent; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, err := f.svc.RequestSlot(f.user.ID)
			results[idx] = err
		}(i)
	}
	wg.Wait()

	// Count actual pending in DB.
	var n int64
	if err := f.db.Model(&model.GmailAccount{}).
		Where("created_by_user_id = ? AND status IN ?",
			f.user.ID,
			[]string{model.GmailStatusPendingCreate, model.GmailStatusPendingVerify}).
		Count(&n).Error; err != nil {
		t.Fatalf("count pending: %v", err)
	}
	if n > 3 {
		t.Errorf("max-pending violated: %d pending slots in DB (max 3)", n)
	}
}

// ----- SubmitSlot tests -----

func TestGmail_SubmitSlot_Success(t *testing.T) {
	f := setupGmailService(t)
	res, err := f.svc.RequestSlot(f.user.ID)
	if err != nil {
		t.Fatalf("RequestSlot: %v", err)
	}
	g, err := f.svc.SubmitSlot(f.user.ID, res.GmailAccount.ID)
	if err != nil {
		t.Fatalf("SubmitSlot: %v", err)
	}
	if g.Status != model.GmailStatusPendingVerify {
		t.Errorf("status = %s, want pending_verify", g.Status)
	}
	if g.SubmittedAt == nil {
		t.Error("submitted_at not set")
	}
}

func TestGmail_SubmitSlot_NotOwner(t *testing.T) {
	f := setupGmailService(t)
	res, err := f.svc.RequestSlot(f.user.ID)
	if err != nil {
		t.Fatalf("RequestSlot: %v", err)
	}
	otherUser := uuid.New()
	_, err = f.svc.SubmitSlot(otherUser, res.GmailAccount.ID)
	if err == nil {
		t.Fatal("expected ownership error")
	}
}

func TestGmail_SubmitSlot_AlreadySubmitted(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingVerify, 0)
	_, err := f.svc.SubmitSlot(f.user.ID, g.ID)
	if err == nil {
		t.Fatal("expected status error")
	}
}

func TestGmail_SubmitSlot_Expired(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingCreate, 7*time.Hour)
	// Manually set expiry to past.
	expired := time.Now().Add(-1 * time.Hour)
	g.SlotExpiresAt = &expired
	if err := f.db.Save(g).Error; err != nil {
		t.Fatalf("update expiry: %v", err)
	}
	_, err := f.svc.SubmitSlot(f.user.ID, g.ID)
	if err == nil {
		t.Fatal("expected expired error")
	}
}

// ----- AdminVerify tests -----

func TestGmail_AdminVerify_CreditsEarnPocket(t *testing.T) {
	f := setupGmailService(t)
	res, _ := f.svc.RequestSlot(f.user.ID)
	if _, err := f.svc.SubmitSlot(f.user.ID, res.GmailAccount.ID); err != nil {
		t.Fatalf("submit: %v", err)
	}

	g, err := f.svc.AdminVerify(f.admin.ID, res.GmailAccount.ID, "new-secure-password-12345")
	if err != nil {
		t.Fatalf("AdminVerify: %v", err)
	}
	if g.Status != model.GmailStatusVerified {
		t.Errorf("status = %s, want verified", g.Status)
	}
	if g.VerifiedAt == nil {
		t.Error("verified_at not set")
	}
	if g.VerifiedByAdminID == nil || *g.VerifiedByAdminID != f.admin.ID {
		t.Error("verified_by_admin_id not set correctly")
	}
	if g.SellerPayoutAmount != 3000 {
		t.Errorf("payout = %d, want 3000", g.SellerPayoutAmount)
	}
	if g.SellerPayoutLedgerID == nil {
		t.Error("seller_payout_ledger_id not set")
	}
	if g.PasswordVersion != model.GmailPasswordVersionPostVerify {
		t.Errorf("password_version = %s, want post_verify", g.PasswordVersion)
	}

	// Check user earn balance updated.
	var user model.User
	if err := f.db.First(&user, "id = ?", f.user.ID).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if user.WalletBalanceEarn != 3000 {
		t.Errorf("earn balance = %d, want 3000", user.WalletBalanceEarn)
	}

	// Check ledger row exists with correct pocket+category.
	var ledger model.WalletLedger
	if err := f.db.Where("user_id = ?", f.user.ID).First(&ledger).Error; err != nil {
		t.Fatalf("load ledger: %v", err)
	}
	if ledger.Type != "credit" {
		t.Errorf("ledger.Type = %s, want credit", ledger.Type)
	}
	if ledger.Pocket != model.WalletPocketEarn {
		t.Errorf("ledger.Pocket = %s, want earn", ledger.Pocket)
	}
	if ledger.Category != model.LedgerCategoryGmailSellPayout {
		t.Errorf("ledger.Category = %s, want %s", ledger.Category, model.LedgerCategoryGmailSellPayout)
	}
	if ledger.Amount != 3000 {
		t.Errorf("ledger.Amount = %d, want 3000", ledger.Amount)
	}
}

func TestGmail_AdminVerify_RejectsShortPassword(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingVerify, 0)
	_, err := f.svc.AdminVerify(f.admin.ID, g.ID, "short")
	if err == nil {
		t.Fatal("expected min-length error")
	}
}

func TestGmail_AdminVerify_RejectsNonPendingVerify(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingCreate, 0)
	_, err := f.svc.AdminVerify(f.admin.ID, g.ID, "valid-password-12345")
	if err == nil {
		t.Fatal("expected status error")
	}
}

// Idempotency: verifying twice must not double-credit.
func TestGmail_AdminVerify_Idempotent(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingVerify, 0)
	_, err := f.svc.AdminVerify(f.admin.ID, g.ID, "valid-password-12345")
	if err != nil {
		t.Fatalf("first verify: %v", err)
	}
	// Second call should fail because status is now "verified".
	_, err = f.svc.AdminVerify(f.admin.ID, g.ID, "another-valid-pwd-67890")
	if err == nil {
		t.Fatal("expected double-verify rejection")
	}
	// Earn balance should still be 3000, not 6000.
	var user model.User
	f.db.First(&user, "id = ?", f.user.ID)
	if user.WalletBalanceEarn != 3000 {
		t.Errorf("earn balance = %d, want 3000 (no double-credit)", user.WalletBalanceEarn)
	}
}

// ----- AdminReject + Strike + Ban tests -----

func TestGmail_AdminReject_CreatesStrike(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingVerify, 0)
	_, err := f.svc.AdminReject(f.admin.ID, g.ID, model.GmailStrikeReasonRecoverySet, "found recovery email")
	if err != nil {
		t.Fatalf("AdminReject: %v", err)
	}

	var strikes []model.GmailStrike
	f.db.Where("user_id = ?", f.user.ID).Find(&strikes)
	if len(strikes) != 1 {
		t.Errorf("strikes = %d, want 1", len(strikes))
	}
	if strikes[0].Reason != model.GmailStrikeReasonRecoverySet {
		t.Errorf("reason = %s, want %s", strikes[0].Reason, model.GmailStrikeReasonRecoverySet)
	}
}

func TestGmail_AdminReject_RejectsInvalidReason(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingVerify, 0)
	_, err := f.svc.AdminReject(f.admin.ID, g.ID, "invalid_made_up_reason", "")
	if err == nil {
		t.Fatal("expected reason whitelist error")
	}
}

func TestGmail_AdminReject_AutoBanAt3Strikes(t *testing.T) {
	f := setupGmailService(t)
	// Seed 2 prior strikes within window.
	for i := 0; i < 2; i++ {
		dummyG := f.seedSlot(t, model.GmailStatusRejected, time.Duration(i)*time.Hour)
		strike := &model.GmailStrike{
			ID:             uuid.New(),
			UserID:         f.user.ID,
			GmailAccountID: dummyG.ID,
			Reason:         model.GmailStrikeReasonLoginFailed,
			AdminID:        f.admin.ID,
			CreatedAt:      time.Now().Add(-time.Duration(i+1) * time.Hour),
		}
		f.db.Create(strike)
	}

	// 3rd strike triggers ban.
	g := f.seedSlot(t, model.GmailStatusPendingVerify, 0)
	_, err := f.svc.AdminReject(f.admin.ID, g.ID, model.GmailStrikeReasonRecoverySet, "")
	if err != nil {
		t.Fatalf("AdminReject: %v", err)
	}

	var user model.User
	f.db.First(&user, "id = ?", f.user.ID)
	if user.GmailSellBannedUntil == nil {
		t.Fatal("user not banned after 3 strikes")
	}
	if !user.GmailSellBannedUntil.After(time.Now()) {
		t.Error("ban_until should be in the future")
	}
}

func TestGmail_AdminReject_OldStrikesOutOfWindow(t *testing.T) {
	f := setupGmailService(t)
	// Seed 2 old strikes (out of 30d window).
	for i := 0; i < 2; i++ {
		dummyG := f.seedSlot(t, model.GmailStatusRejected, 50*24*time.Hour)
		strike := &model.GmailStrike{
			ID:             uuid.New(),
			UserID:         f.user.ID,
			GmailAccountID: dummyG.ID,
			Reason:         model.GmailStrikeReasonLoginFailed,
			AdminID:        f.admin.ID,
			CreatedAt:      time.Now().Add(-40 * 24 * time.Hour),
		}
		f.db.Create(strike)
	}
	// Fresh 1st strike — should NOT trigger ban (old ones out of window).
	g := f.seedSlot(t, model.GmailStatusPendingVerify, 0)
	_, err := f.svc.AdminReject(f.admin.ID, g.ID, model.GmailStrikeReasonRecoverySet, "")
	if err != nil {
		t.Fatalf("AdminReject: %v", err)
	}
	var user model.User
	f.db.First(&user, "id = ?", f.user.ID)
	if user.GmailSellBannedUntil != nil {
		t.Error("user should NOT be banned (old strikes out of window)")
	}
}

// ----- MarkExpired tests -----

func TestGmail_MarkExpired_Success(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingCreate, 0)
	if err := f.svc.MarkExpired(g.ID); err != nil {
		t.Fatalf("MarkExpired: %v", err)
	}
	var loaded model.GmailAccount
	f.db.First(&loaded, "id = ?", g.ID)
	if loaded.Status != model.GmailStatusExpired {
		t.Errorf("status = %s, want expired", loaded.Status)
	}
}

func TestGmail_MarkExpired_SkipsNonPending(t *testing.T) {
	f := setupGmailService(t)
	g := f.seedSlot(t, model.GmailStatusPendingVerify, 0)
	if err := f.svc.MarkExpired(g.ID); err != nil {
		t.Fatalf("MarkExpired: %v", err)
	}
	var loaded model.GmailAccount
	f.db.First(&loaded, "id = ?", g.ID)
	if loaded.Status == model.GmailStatusExpired {
		t.Error("non-pending slot should NOT be expired")
	}
}

// ----- AdminGetCredentials tests -----

func TestGmail_AdminGetCredentials_DecryptsCorrectly(t *testing.T) {
	f := setupGmailService(t)
	res, _ := f.svc.RequestSlot(f.user.ID)
	email, pw, err := f.svc.AdminGetCredentials(res.GmailAccount.ID)
	if err != nil {
		t.Fatalf("AdminGetCredentials: %v", err)
	}
	if email != res.GmailAccount.Email {
		t.Errorf("email = %s, want %s", email, res.GmailAccount.Email)
	}
	if pw != res.PlainPassword {
		t.Errorf("decrypted password mismatch")
	}
}

// ----- ListMySlots auth scoping -----

func TestGmail_ListMySlots_OnlyOwnSlots(t *testing.T) {
	f := setupGmailService(t)
	// User A's slot (default user)
	f.seedSlot(t, model.GmailStatusPendingCreate, 0)
	// User B's slot (another user)
	otherUser := &model.User{
		ID:       uuid.New(),
		Name:     "Other User",
		Email:    fmt.Sprintf("other-%s@example.com", uuid.NewString()),
		Password: "hashed",
		Role:     "user",
		IsActive: true,
	}
	f.db.Create(otherUser)
	otherSlot := &model.GmailAccount{
		ID:              uuid.New(),
		CreatedByUserID: otherUser.ID,
		Status:          model.GmailStatusPendingCreate,
		Email:           "other-slot@gmail.com",
		PasswordEnc:     "enc",
		PasswordVersion: model.GmailPasswordVersionInitial,
	}
	f.db.Create(otherSlot)

	rows, _, err := f.svc.ListMySlots(f.user.ID, "", 1, 10)
	if err != nil {
		t.Fatalf("ListMySlots: %v", err)
	}
	for _, r := range rows {
		if r.CreatedByUserID != f.user.ID {
			t.Errorf("leaked other user's slot: %s", r.ID)
		}
	}
}
