package service

import (
	"fmt"
	"testing"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupActivityService(t *testing.T) (*ActivityService, *gorm.DB, *model.User) {
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
		&model.Order{},
		&model.WalletLedger{},
	)
	if err != nil {
		t.Fatalf("migrate: %v", err)
	}

	user := &model.User{
		ID:       uuid.New(),
		Name:     "User Activity",
		Email:    fmt.Sprintf("activity-%s@example.com", uuid.NewString()),
		Password: "hashed",
		Role:     "user",
		IsActive: true,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	otherUser := &model.User{
		ID:       uuid.New(),
		Name:     "Other User",
		Email:    fmt.Sprintf("other-%s@example.com", uuid.NewString()),
		Password: "hashed",
		Role:     "user",
		IsActive: true,
	}
	if err := db.Create(otherUser).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	product := &model.Product{
		ID:       uuid.New(),
		Name:     "Netflix Premium",
		Slug:     "netflix-premium",
		Category: "premium",
		Icon:     "🎬",
		IsActive: true,
	}
	if err := db.Create(product).Error; err != nil {
		t.Fatalf("create product: %v", err)
	}

	price := &model.ProductPrice{
		ID:          uuid.New(),
		ProductID:   product.ID,
		Duration:    1,
		AccountType: "sharing",
		Price:       45000,
		IsActive:    true,
	}
	if err := db.Create(price).Error; err != nil {
		t.Fatalf("create price: %v", err)
	}

	now := time.Now().UTC()
	premiumTime := now.Add(-3 * time.Hour)
	purchaseTime := now.Add(-2 * time.Hour)
	refundTime := now.Add(-1 * time.Hour)

	premiumOrder := &model.Order{
		ID:            uuid.New(),
		UserID:        user.ID,
		PriceID:       price.ID,
		TotalPrice:    45000,
		PaymentStatus: "paid",
		OrderStatus:   "active",
		CreatedAt:     premiumTime,
		UpdatedAt:     premiumTime,
	}
	if err := db.Create(premiumOrder).Error; err != nil {
		t.Fatalf("create premium order: %v", err)
	}

	if err := db.Create(&model.WalletLedger{
		ID:            uuid.New(),
		UserID:        user.ID,
		Type:          "debit",
		Category:      "5sim_purchase",
		Amount:        10000,
		BalanceBefore: 50000,
		BalanceAfter:  40000,
		Reference:     "fivesim_order:991122:charge",
		Description:   "Pembelian nomor OTP",
		CreatedAt:     purchaseTime,
	}).Error; err != nil {
		t.Fatalf("create ledger purchase: %v", err)
	}

	if err := db.Create(&model.WalletLedger{
		ID:            uuid.New(),
		UserID:        user.ID,
		Type:          "credit",
		Category:      "5sim_refund",
		Amount:        10000,
		BalanceBefore: 40000,
		BalanceAfter:  50000,
		Reference:     "fivesim_order:991122:refund",
		Description:   "Refund nomor OTP",
		CreatedAt:     refundTime,
	}).Error; err != nil {
		t.Fatalf("create ledger refund: %v", err)
	}

	if err := db.Create(&model.Order{
		ID:            uuid.New(),
		UserID:        otherUser.ID,
		PriceID:       price.ID,
		TotalPrice:    99999,
		PaymentStatus: "paid",
		OrderStatus:   "active",
		CreatedAt:     now,
		UpdatedAt:     now,
	}).Error; err != nil {
		t.Fatalf("create other user order: %v", err)
	}

	svc := NewActivityService(repository.NewActivityRepo(db))
	return svc, db, user
}

func TestActivityServiceListByUser(t *testing.T) {
	svc, _, user := setupActivityService(t)

	items, total, err := svc.ListByUser(user.ID, 1, 20)
	if err != nil {
		t.Fatalf("list activity: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected total 3, got %d", total)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(items))
	}

	if items[0].Source != "nokos" || items[0].Kind != "nokos_refund" {
		t.Fatalf("expected latest item nokos refund, got source=%s kind=%s", items[0].Source, items[0].Kind)
	}
	if items[0].Direction != "credit" {
		t.Fatalf("expected refund direction credit, got %s", items[0].Direction)
	}
	if items[0].Subtitle != "Refund #991122" {
		t.Fatalf("unexpected refund subtitle: %s", items[0].Subtitle)
	}

	if items[1].Source != "nokos" || items[1].Kind != "nokos_purchase" {
		t.Fatalf("expected second item nokos purchase, got source=%s kind=%s", items[1].Source, items[1].Kind)
	}
	if items[1].Direction != "debit" {
		t.Fatalf("expected purchase direction debit, got %s", items[1].Direction)
	}
	if items[1].Subtitle != "Pembelian #991122" {
		t.Fatalf("unexpected purchase subtitle: %s", items[1].Subtitle)
	}

	if items[2].Source != "premium_apps" || items[2].Kind != "premium_order" {
		t.Fatalf("expected third item premium order, got source=%s kind=%s", items[2].Source, items[2].Kind)
	}
	if items[2].Subtitle != "1 bulan • sharing" {
		t.Fatalf("unexpected premium subtitle: %s", items[2].Subtitle)
	}
}

func TestActivityServicePagination(t *testing.T) {
	svc, _, user := setupActivityService(t)

	items, total, err := svc.ListByUser(user.ID, 2, 2)
	if err != nil {
		t.Fatalf("list activity page 2: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected total 3, got %d", total)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item on page 2, got %d", len(items))
	}
	if items[0].Source != "premium_apps" {
		t.Fatalf("expected remaining item premium_apps, got %s", items[0].Source)
	}
}
