package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// --- Pure logic tests (no DB, runs everywhere) ---

func TestParseSosmedRefillPeriodDays(t *testing.T) {
	cases := []struct {
		input    string
		expected int
	}{
		// Common formatted values (output of formatSosmedRefillValue)
		{"30 Hari", 30},
		{"Otomatis 30 Hari", 30},
		{"365 Hari", 365},
		{"Seumur Layanan", 365},

		// Zero / no refill
		{"Tidak Ada", 0},
		{"-", 0},
		{"N/A", 0},
		{"NA", 0},
		{"No", 0},
		{"None", 0},
		{"Tidak", 0},
		{"Stabil (Non Drop)", 0},
		{"", 0},

		// Edge cases
		{"7 Hari", 7},
		{"90 Hari", 90},
		{"  30  Hari  ", 30},

		// Raw provider values (before formatting)
		{"Auto-Refill 30D", 30},
		{"auto refill 30d", 30},
		{"30D", 30},
	}

	for _, tc := range cases {
		got := parseSosmedRefillPeriodDays(tc.input)
		if got != tc.expected {
			t.Errorf("parseSosmedRefillPeriodDays(%q) = %d, want %d", tc.input, got, tc.expected)
		}
	}
}

func TestPopulateSosmedOrderRefill(t *testing.T) {
	t.Run("eligible service with 30 day refill", func(t *testing.T) {
		order := &model.SosmedOrder{}
		svc := &model.SosmedService{
			Refill:                  "30 Hari",
			ProviderRefillSupported: true,
		}
		populateSosmedOrderRefill(order, svc)

		if !order.RefillEligible {
			t.Fatal("expected RefillEligible=true")
		}
		if order.RefillPeriodDays != 30 {
			t.Fatalf("expected RefillPeriodDays=30, got %d", order.RefillPeriodDays)
		}
		if order.RefillDeadline == nil {
			t.Fatal("expected RefillDeadline to be set")
		}
		if order.RefillStatus != "none" {
			t.Fatalf("expected RefillStatus=none, got %s", order.RefillStatus)
		}

		// Deadline should be ~30 days from now.
		expected := time.Now().Add(30 * 24 * time.Hour)
		diff := order.RefillDeadline.Sub(expected)
		if diff < -5*time.Second || diff > 5*time.Second {
			t.Fatalf("RefillDeadline off by %v", diff)
		}
	})

	t.Run("non-refill service", func(t *testing.T) {
		order := &model.SosmedOrder{}
		svc := &model.SosmedService{
			Refill:                  "Tidak Ada",
			ProviderRefillSupported: false,
		}
		populateSosmedOrderRefill(order, svc)

		if order.RefillEligible {
			t.Fatal("expected RefillEligible=false")
		}
		if order.RefillDeadline != nil {
			t.Fatal("expected RefillDeadline=nil")
		}
	})

	t.Run("provider supported but no refill string", func(t *testing.T) {
		order := &model.SosmedOrder{}
		svc := &model.SosmedService{
			Refill:                  "",
			ProviderRefillSupported: true,
		}
		populateSosmedOrderRefill(order, svc)

		if !order.RefillEligible {
			t.Fatal("expected RefillEligible=true from ProviderRefillSupported")
		}
		if order.RefillPeriodDays != 0 {
			t.Fatalf("expected RefillPeriodDays=0 (no parseable period), got %d", order.RefillPeriodDays)
		}
		if order.RefillDeadline != nil {
			t.Fatal("expected RefillDeadline=nil when period is 0")
		}
	})

	t.Run("nil inputs", func(t *testing.T) {
		// Should not panic.
		populateSosmedOrderRefill(nil, nil)
		populateSosmedOrderRefill(&model.SosmedOrder{}, nil)
		populateSosmedOrderRefill(nil, &model.SosmedService{})
	})
}

// --- DB-backed service tests (require CGO/sqlite, run on rdpkhorur) ---

func seedSosmedRefillService(t *testing.T, db *gorm.DB, id uuid.UUID) *model.SosmedService {
	t.Helper()

	serviceItem := &model.SosmedService{
		ID:                      id,
		CategoryCode:            "followers",
		Code:                    "instagram-followers-6331",
		Title:                   "Instagram Followers Hemat",
		ProviderCode:            "jap",
		ProviderServiceID:       "6331",
		CheckoutPrice:           19000,
		IsActive:                true,
		Refill:                  "30 Hari",
		ProviderRefillSupported: true,
	}
	if err := db.Create(serviceItem).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}
	return serviceItem
}

func TestSosmedOrderService_UserRequestRefill(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.Notification{},
	); err != nil {
		t.Fatalf("migrate refill test models: %v", err)
	}

	buyer := &model.User{
		ID: uuid.New(), Name: "Refill Buyer", Email: "refill-buyer@example.com",
		Password: "hashed", Role: "user", IsActive: true,
	}
	other := &model.User{
		ID: uuid.New(), Name: "Other User", Email: "refill-other@example.com",
		Password: "hashed", Role: "user", IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}
	if err := db.Create(other).Error; err != nil {
		t.Fatalf("create other: %v", err)
	}

	serviceItem := seedSosmedRefillService(t, db, uuid.New())

	deadline := time.Now().Add(30 * 24 * time.Hour)
	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/example",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusSuccess,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "JAP-REFILL-001",
		ProviderStatus:    "Completed",
		RefillEligible:    true,
		RefillPeriodDays:  30,
		RefillDeadline:    &deadline,
		RefillStatus:      "none",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{}
	orderSvc := NewSosmedOrderService(
		repository.NewSosmedOrderRepo(db),
		repository.NewSosmedServiceRepo(db),
		repository.NewNotificationRepo(db),
	).SetJAPOrderProvider(fakeJAP)

	// Test 1: Other user should be denied.
	_, err := orderSvc.UserRequestRefill(context.Background(), order.ID, other.ID)
	if err == nil || !strings.Contains(err.Error(), "akses ditolak") {
		t.Fatalf("expected access denied for other user, got: %v", err)
	}

	// Test 2: Successful refill claim.
	detail, err := orderSvc.UserRequestRefill(context.Background(), order.ID, buyer.ID)
	if err != nil {
		t.Fatalf("user request refill: %v", err)
	}
	if detail.Order.RefillStatus != "requested" {
		t.Fatalf("expected refill_status=requested, got %s", detail.Order.RefillStatus)
	}
	if detail.Order.RefillProviderOrderID != "REFILL-1001" {
		t.Fatalf("expected refill provider id REFILL-1001, got %q", detail.Order.RefillProviderOrderID)
	}
	if detail.Order.RefillProviderStatus != "submitted" {
		t.Fatalf("expected refill provider status submitted, got %q", detail.Order.RefillProviderStatus)
	}
	if detail.Order.RefillRequestedAt == nil {
		t.Fatal("expected refill_requested_at to be set")
	}
	if len(fakeJAP.refillInputs) != 1 || fakeJAP.refillInputs[0] != "JAP-REFILL-001" {
		t.Fatalf("unexpected refill inputs: %+v", fakeJAP.refillInputs)
	}

	// Test 3: Cannot claim while active.
	_, err = orderSvc.UserRequestRefill(context.Background(), order.ID, buyer.ID)
	if err == nil || !strings.Contains(err.Error(), "sedang diproses") {
		t.Fatalf("expected active refill block, got: %v", err)
	}

	// Test 4: Check event was created.
	var eventCount int64
	if err := db.Model(&model.SosmedOrderEvent{}).
		Where("order_id = ?", order.ID).
		Count(&eventCount).Error; err != nil {
		t.Fatalf("count refill events: %v", err)
	}
	if eventCount < 1 {
		t.Fatalf("expected at least 1 refill event, got %d", eventCount)
	}

	// Test 5: Check notification was created.
	var notifCount int64
	if err := db.Model(&model.Notification{}).
		Where("user_id = ?", buyer.ID).
		Count(&notifCount).Error; err != nil {
		t.Fatalf("count refill notifications: %v", err)
	}
	if notifCount < 1 {
		t.Fatalf("expected at least 1 refill notification, got %d", notifCount)
	}
}

func TestSosmedOrderService_UserRequestRefillLocksBeforeProviderCall(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
	); err != nil {
		t.Fatalf("migrate refill lock models: %v", err)
	}

	buyer := &model.User{
		ID: uuid.New(), Name: "Refill Lock Buyer", Email: "refill-lock@example.com",
		Password: "hashed", Role: "user", IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := seedSosmedRefillService(t, db, uuid.New())
	deadline := time.Now().Add(30 * 24 * time.Hour)
	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/example",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusSuccess,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "JAP-REFILL-LOCK-001",
		ProviderStatus:    "Completed",
		RefillEligible:    true,
		RefillPeriodDays:  30,
		RefillDeadline:    &deadline,
		RefillStatus:      "none",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	started := make(chan struct{})
	release := make(chan struct{})
	fakeJAP := &fakeSosmedJAPOrderProvider{
		refillStarted: started,
		refillRelease: release,
	}
	orderSvc := NewSosmedOrderService(
		repository.NewSosmedOrderRepo(db),
		repository.NewSosmedServiceRepo(db),
		nil,
	).SetJAPOrderProvider(fakeJAP)

	done := make(chan error, 1)
	go func() {
		_, err := orderSvc.UserRequestRefill(context.Background(), order.ID, buyer.ID)
		done <- err
	}()

	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for first refill request to reach provider")
	}

	_, err := orderSvc.UserRequestRefill(context.Background(), order.ID, buyer.ID)
	if err == nil || !strings.Contains(err.Error(), "sedang diproses") {
		t.Fatalf("expected second request to be blocked while first is in-flight, got: %v", err)
	}

	close(release)
	if err := <-done; err != nil {
		t.Fatalf("first refill request failed: %v", err)
	}

	fakeJAP.mu.Lock()
	callCount := len(fakeJAP.refillInputs)
	fakeJAP.mu.Unlock()
	if callCount != 1 {
		t.Fatalf("expected exactly 1 provider refill call, got %d", callCount)
	}
}

func TestSosmedOrderService_UserRequestRefillFailure(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
	); err != nil {
		t.Fatalf("migrate refill failure models: %v", err)
	}

	buyer := &model.User{
		ID: uuid.New(), Name: "Refill Fail Buyer", Email: "refill-fail@example.com",
		Password: "hashed", Role: "user", IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := seedSosmedRefillService(t, db, uuid.New())
	deadline := time.Now().Add(30 * 24 * time.Hour)
	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/example",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusSuccess,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "JAP-REFILL-FAIL-001",
		ProviderStatus:    "Completed",
		RefillEligible:    true,
		RefillPeriodDays:  30,
		RefillDeadline:    &deadline,
		RefillStatus:      "none",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{refillErr: errors.New("JAP refill error")}
	orderSvc := NewSosmedOrderService(
		repository.NewSosmedOrderRepo(db),
		repository.NewSosmedServiceRepo(db),
		nil,
	).SetJAPOrderProvider(fakeJAP)

	_, err := orderSvc.UserRequestRefill(context.Background(), order.ID, buyer.ID)
	if err == nil || !strings.Contains(err.Error(), "gagal mengirim refill") {
		t.Fatalf("expected refill failure error, got: %v", err)
	}

	// Order should have refill_status=failed and error stored.
	var orderAfter model.SosmedOrder
	if err := db.First(&orderAfter, "id = ?", order.ID).Error; err != nil {
		t.Fatalf("load order after refill failure: %v", err)
	}
	if orderAfter.RefillStatus != "failed" {
		t.Fatalf("expected refill_status=failed, got %s", orderAfter.RefillStatus)
	}
	if !strings.Contains(orderAfter.RefillProviderError, "JAP refill error") {
		t.Fatalf("expected refill error stored, got %q", orderAfter.RefillProviderError)
	}
	if orderAfter.RefillRequestedAt == nil {
		t.Fatal("expected refill_requested_at to be set even on failure")
	}
}

func TestSosmedOrderService_UserRequestRefillValidation(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
	); err != nil {
		t.Fatalf("migrate refill validation models: %v", err)
	}

	buyer := &model.User{
		ID: uuid.New(), Name: "Refill Validator", Email: "refill-validate@example.com",
		Password: "hashed", Role: "user", IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{}
	serviceItem := seedSosmedRefillService(t, db, uuid.New())

	t.Run("not eligible", func(t *testing.T) {
		order := &model.SosmedOrder{
			ID: uuid.New(), UserID: buyer.ID, ServiceID: serviceItem.ID,
			ServiceCode: "test", ServiceTitle: "test", TargetLink: "https://x.com/a",
			Quantity: 1, UnitPrice: 1000, TotalPrice: 1000,
			PaymentMethod: "wallet", PaymentStatus: "paid", OrderStatus: sosmedOrderStatusSuccess,
			ProviderCode: "jap", ProviderServiceID: "1", ProviderOrderID: "JAP-1",
			RefillEligible: false, RefillStatus: "none",
		}
		if err := db.Create(order).Error; err != nil {
			t.Fatalf("create: %v", err)
		}
		svc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), nil, nil).SetJAPOrderProvider(fakeJAP)
		_, err := svc.UserRequestRefill(context.Background(), order.ID, buyer.ID)
		if err == nil || !strings.Contains(err.Error(), "tidak memiliki garansi") {
			t.Fatalf("expected eligibility error, got: %v", err)
		}
	})

	t.Run("not success status", func(t *testing.T) {
		order := &model.SosmedOrder{
			ID: uuid.New(), UserID: buyer.ID, ServiceID: serviceItem.ID,
			ServiceCode: "test", ServiceTitle: "test", TargetLink: "https://x.com/a",
			Quantity: 1, UnitPrice: 1000, TotalPrice: 1000,
			PaymentMethod: "wallet", PaymentStatus: "paid", OrderStatus: sosmedOrderStatusProcessing,
			ProviderCode: "jap", ProviderServiceID: "1", ProviderOrderID: "JAP-2",
			RefillEligible: true, RefillStatus: "none",
		}
		if err := db.Create(order).Error; err != nil {
			t.Fatalf("create: %v", err)
		}
		svc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), nil, nil).SetJAPOrderProvider(fakeJAP)
		_, err := svc.UserRequestRefill(context.Background(), order.ID, buyer.ID)
		if err == nil || !strings.Contains(err.Error(), "sudah sukses") {
			t.Fatalf("expected status error, got: %v", err)
		}
	})

	t.Run("expired deadline", func(t *testing.T) {
		expired := time.Now().Add(-24 * time.Hour)
		order := &model.SosmedOrder{
			ID: uuid.New(), UserID: buyer.ID, ServiceID: serviceItem.ID,
			ServiceCode: "test", ServiceTitle: "test", TargetLink: "https://x.com/a",
			Quantity: 1, UnitPrice: 1000, TotalPrice: 1000,
			PaymentMethod: "wallet", PaymentStatus: "paid", OrderStatus: sosmedOrderStatusSuccess,
			ProviderCode: "jap", ProviderServiceID: "1", ProviderOrderID: "JAP-3",
			RefillEligible: true, RefillPeriodDays: 30, RefillDeadline: &expired, RefillStatus: "none",
		}
		if err := db.Create(order).Error; err != nil {
			t.Fatalf("create: %v", err)
		}
		svc := NewSosmedOrderService(repository.NewSosmedOrderRepo(db), nil, nil).SetJAPOrderProvider(fakeJAP)
		_, err := svc.UserRequestRefill(context.Background(), order.ID, buyer.ID)
		if err == nil || !strings.Contains(err.Error(), "sudah habis") {
			t.Fatalf("expected expired error, got: %v", err)
		}
	})
}

func TestSosmedOrderService_AdminTriggerRefill(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
		&model.Notification{},
	); err != nil {
		t.Fatalf("migrate admin refill models: %v", err)
	}

	buyer := &model.User{
		ID: uuid.New(), Name: "Refill Owner", Email: "refill-owner@example.com",
		Password: "hashed", Role: "user", IsActive: true,
	}
	admin := &model.User{
		ID: uuid.New(), Name: "Refill Admin", Email: "refill-admin@example.com",
		Password: "hashed", Role: "admin", IsActive: true,
	}
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	serviceItem := seedSosmedRefillService(t, db, uuid.New())
	// Admin can trigger refill even for expired orders (no deadline check).
	expired := time.Now().Add(-24 * time.Hour)
	order := &model.SosmedOrder{
		ID:                uuid.New(),
		UserID:            buyer.ID,
		ServiceID:         serviceItem.ID,
		ServiceCode:       serviceItem.Code,
		ServiceTitle:      serviceItem.Title,
		TargetLink:        "https://instagram.com/example",
		Quantity:          1,
		UnitPrice:         19000,
		TotalPrice:        19000,
		PaymentMethod:     "wallet",
		PaymentStatus:     "paid",
		OrderStatus:       sosmedOrderStatusSuccess,
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderOrderID:   "JAP-ADMIN-REFILL-001",
		ProviderStatus:    "Completed",
		RefillEligible:    true,
		RefillPeriodDays:  30,
		RefillDeadline:    &expired,
		RefillStatus:      "none",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{}
	orderSvc := NewSosmedOrderService(
		repository.NewSosmedOrderRepo(db),
		repository.NewSosmedServiceRepo(db),
		repository.NewNotificationRepo(db),
	).SetJAPOrderProvider(fakeJAP)

	detail, err := orderSvc.AdminTriggerRefill(context.Background(), order.ID, admin.ID)
	if err != nil {
		t.Fatalf("admin trigger refill: %v", err)
	}
	if detail.Order.RefillStatus != "requested" {
		t.Fatalf("expected refill_status=requested, got %s", detail.Order.RefillStatus)
	}
	if detail.Order.RefillProviderOrderID != "REFILL-1001" {
		t.Fatalf("expected refill provider id REFILL-1001, got %q", detail.Order.RefillProviderOrderID)
	}
	if len(fakeJAP.refillInputs) != 1 || fakeJAP.refillInputs[0] != "JAP-ADMIN-REFILL-001" {
		t.Fatalf("unexpected refill inputs: %+v", fakeJAP.refillInputs)
	}

	// Event should record admin actor.
	var events []model.SosmedOrderEvent
	if err := db.Where("order_id = ?", order.ID).Find(&events).Error; err != nil {
		t.Fatalf("load events: %v", err)
	}
	found := false
	for _, ev := range events {
		if strings.Contains(ev.Reason, "admin") && ev.ActorType == "admin" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected admin refill event with actor_type=admin")
	}

	// Notification should go to the order owner (buyer), not the admin.
	var notifs []model.Notification
	if err := db.Where("user_id = ?", buyer.ID).Find(&notifs).Error; err != nil {
		t.Fatalf("load notifications: %v", err)
	}
	if len(notifs) < 1 {
		t.Fatal("expected at least 1 notification for the order owner")
	}
}

func TestSosmedOrderService_AdminSyncProviderStatusSyncsRefill(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.User{},
		&model.SosmedService{},
		&model.SosmedOrder{},
		&model.SosmedOrderEvent{},
	); err != nil {
		t.Fatalf("migrate refill sync models: %v", err)
	}

	buyer := &model.User{
		ID: uuid.New(), Name: "Refill Sync Owner", Email: "refill-sync@example.com",
		Password: "hashed", Role: "user", IsActive: true,
	}
	adminID := uuid.New()
	if err := db.Create(buyer).Error; err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	serviceItem := seedSosmedRefillService(t, db, uuid.New())
	deadline := time.Now().Add(30 * 24 * time.Hour)
	order := &model.SosmedOrder{
		ID:                    uuid.New(),
		UserID:                buyer.ID,
		ServiceID:             serviceItem.ID,
		ServiceCode:           serviceItem.Code,
		ServiceTitle:          serviceItem.Title,
		TargetLink:            "https://instagram.com/example",
		Quantity:              1,
		UnitPrice:             19000,
		TotalPrice:            19000,
		PaymentMethod:         "wallet",
		PaymentStatus:         "paid",
		OrderStatus:           sosmedOrderStatusSuccess,
		ProviderCode:          "jap",
		ProviderServiceID:     "6331",
		ProviderOrderID:       "JAP-REFILL-SYNC-001",
		ProviderStatus:        "Completed",
		RefillEligible:        true,
		RefillPeriodDays:      30,
		RefillDeadline:        &deadline,
		RefillStatus:          sosmedRefillStatusRequested,
		RefillProviderOrderID: "REFILL-SYNC-001",
		RefillProviderStatus:  "Processing",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	fakeJAP := &fakeSosmedJAPOrderProvider{
		statusRes:       &JAPOrderStatusResponse{Status: "Completed"},
		refillStatusRes: &JAPRefillStatusResponse{Status: "Completed"},
	}
	orderSvc := NewSosmedOrderService(
		repository.NewSosmedOrderRepo(db),
		repository.NewSosmedServiceRepo(db),
		nil,
	).SetJAPOrderProvider(fakeJAP)

	detail, err := orderSvc.AdminSyncProviderStatus(context.Background(), order.ID, adminID)
	if err != nil {
		t.Fatalf("sync provider refill: %v", err)
	}
	if detail.Order.RefillStatus != sosmedRefillStatusCompleted {
		t.Fatalf("expected refill completed, got %s", detail.Order.RefillStatus)
	}
	if detail.Order.RefillCompletedAt == nil {
		t.Fatal("expected refill completed timestamp")
	}
	if detail.Order.RefillProviderStatus != "Completed" {
		t.Fatalf("expected provider refill status Completed, got %q", detail.Order.RefillProviderStatus)
	}

	fakeJAP.mu.Lock()
	refillStatusInputs := append([]string(nil), fakeJAP.refillStatusInputs...)
	fakeJAP.mu.Unlock()
	if len(refillStatusInputs) != 1 || refillStatusInputs[0] != "REFILL-SYNC-001" {
		t.Fatalf("unexpected refill status inputs: %+v", refillStatusInputs)
	}
}
