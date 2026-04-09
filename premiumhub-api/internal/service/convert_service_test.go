package service

import (
	"context"
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupConvertService(t *testing.T) (*ConvertService, *gorm.DB, *model.User, *model.User) {
	t.Helper()

	db := setupCoreDB(t)
	if err := db.AutoMigrate(
		&model.ConvertOrder{},
		&model.ConvertOrderEvent{},
		&model.ConvertProof{},
		&model.ConvertPricingRule{},
		&model.ConvertLimitRule{},
		&model.ConvertTrackingToken{},
	); err != nil {
		t.Fatalf("migrate convert tables: %v", err)
	}

	member := seedUser(t, db, "convert-member@example.com", true)
	admin := seedUser(t, db, "convert-admin@example.com", true)
	if err := db.Model(&model.User{}).Where("id = ?", admin.ID).Update("role", "admin").Error; err != nil {
		t.Fatalf("set admin role: %v", err)
	}

	svc := NewConvertService(repository.NewUserRepo(db), repository.NewConvertRepo(db))
	return svc, db, member, admin
}

func createBaselineConvertOrder(t *testing.T, svc *ConvertService, userID uuid.UUID, idempotencyKey string) *ConvertOrderDetailResponse {
	t.Helper()

	res, err := svc.CreateOrder(context.Background(), userID, CreateConvertOrderInput{
		AssetType:                "pulsa",
		SourceAmount:             100_000,
		SourceChannel:            "Telkomsel",
		SourceAccount:            "081234567890",
		DestinationBank:          "BCA",
		DestinationAccountNumber: "1234567890",
		DestinationAccountName:   "Budi Santoso",
		IsGuest:                  false,
		IdempotencyKey:           idempotencyKey,
	})
	if err != nil {
		t.Fatalf("create convert order: %v", err)
	}
	return res
}

func TestConvertServiceCreateOrderDefaultRulesAndSnapshot(t *testing.T) {
	svc, db, member, _ := setupConvertService(t)

	res := createBaselineConvertOrder(t, svc, member.ID, "idem-cvt-001")
	if res.Order.Status != convertStatusPendingTransfer {
		t.Fatalf("unexpected status: %s", res.Order.Status)
	}
	if res.Order.TrackingToken == "" {
		t.Fatalf("tracking token should not be empty")
	}
	if res.Order.ConvertedAmount != 85_000 {
		t.Fatalf("unexpected converted amount: got %d want %d", res.Order.ConvertedAmount, 85_000)
	}
	if res.Order.PricingSnapshot.PPNAmount != 275 {
		t.Fatalf("unexpected ppn amount: got %d want %d", res.Order.PricingSnapshot.PPNAmount, 275)
	}
	if res.Order.TotalFee != 9_275 {
		t.Fatalf("unexpected total fee: got %d want %d", res.Order.TotalFee, 9_275)
	}
	if res.Order.ReceiveAmount != 75_725 {
		t.Fatalf("unexpected receive amount: got %d want %d", res.Order.ReceiveAmount, 75_725)
	}
	if len(res.Events) != 1 || res.Events[0].ToStatus != convertStatusPendingTransfer {
		t.Fatalf("unexpected events: %+v", res.Events)
	}

	var pricingCount int64
	if err := db.Model(&model.ConvertPricingRule{}).Count(&pricingCount).Error; err != nil {
		t.Fatalf("count pricing rules: %v", err)
	}
	if pricingCount != 3 {
		t.Fatalf("expected 3 default pricing rules, got %d", pricingCount)
	}

	var limitCount int64
	if err := db.Model(&model.ConvertLimitRule{}).Count(&limitCount).Error; err != nil {
		t.Fatalf("count limit rules: %v", err)
	}
	if limitCount != 3 {
		t.Fatalf("expected 3 default limit rules, got %d", limitCount)
	}
}

func TestConvertServiceCreateOrderIdempotency(t *testing.T) {
	svc, db, member, _ := setupConvertService(t)

	first := createBaselineConvertOrder(t, svc, member.ID, "idem-cvt-abc")
	second := createBaselineConvertOrder(t, svc, member.ID, "idem-cvt-abc")

	if first.Order.ID != second.Order.ID {
		t.Fatalf("idempotency should return same order id, got %s and %s", first.Order.ID, second.Order.ID)
	}

	var total int64
	if err := db.Model(&model.ConvertOrder{}).Count(&total).Error; err != nil {
		t.Fatalf("count convert orders: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected single order row, got %d", total)
	}
}

func TestConvertServiceUploadProofMovesToWaitingReview(t *testing.T) {
	svc, _, member, _ := setupConvertService(t)

	order := createBaselineConvertOrder(t, svc, member.ID, "idem-proof-001")
	orderID := uuid.MustParse(order.Order.ID)

	updated, err := svc.UploadProof(context.Background(), member.ID, orderID, UploadConvertProofInput{
		FileURL: "https://cdn.example.com/proofs/order-1.jpg",
		Note:    "bukti transfer",
	})
	if err != nil {
		t.Fatalf("upload proof: %v", err)
	}

	if updated.Order.Status != convertStatusWaitingReview {
		t.Fatalf("expected waiting_review, got %s", updated.Order.Status)
	}
	if len(updated.Proofs) == 0 {
		t.Fatalf("expected at least one proof")
	}

	hasWaitingReviewEvent := false
	for _, event := range updated.Events {
		if event.ToStatus == convertStatusWaitingReview {
			hasWaitingReviewEvent = true
			break
		}
	}
	if !hasWaitingReviewEvent {
		t.Fatalf("waiting_review event not found in %+v", updated.Events)
	}
}

func TestConvertServiceAdminStatusTransition(t *testing.T) {
	svc, _, member, admin := setupConvertService(t)

	order := createBaselineConvertOrder(t, svc, member.ID, "idem-admin-flow")
	orderID := uuid.MustParse(order.Order.ID)

	if _, err := svc.UploadProof(context.Background(), member.ID, orderID, UploadConvertProofInput{FileURL: "https://example.com/proof.png"}); err != nil {
		t.Fatalf("upload proof: %v", err)
	}

	_, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{
		ToStatus: convertStatusProcessing,
		Reason:   "langsung proses",
	})
	if err == nil || !strings.Contains(err.Error(), "transisi status tidak valid") {
		t.Fatalf("expected invalid transition error, got: %v", err)
	}

	if _, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusApproved, Reason: "valid"}); err != nil {
		t.Fatalf("approve status: %v", err)
	}
	if _, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusProcessing, Reason: "mulai proses"}); err != nil {
		t.Fatalf("processing status: %v", err)
	}
	final, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusSuccess, Reason: "berhasil"})
	if err != nil {
		t.Fatalf("success status: %v", err)
	}

	if final.Order.Status != convertStatusSuccess {
		t.Fatalf("expected final status success, got %s", final.Order.Status)
	}
}

func TestConvertServiceTrackOrderByToken(t *testing.T) {
	svc, _, member, _ := setupConvertService(t)

	order := createBaselineConvertOrder(t, svc, member.ID, "idem-track")
	tracked, err := svc.TrackOrderByToken(order.Order.TrackingToken)
	if err != nil {
		t.Fatalf("track order: %v", err)
	}

	if tracked.Order.ID != order.Order.ID {
		t.Fatalf("tracked order mismatch: got %s want %s", tracked.Order.ID, order.Order.ID)
	}
}

func TestConvertServiceDailyLimitValidation(t *testing.T) {
	svc, _, member, _ := setupConvertService(t)

	_, err := svc.UpdateLimitRules(UpdateConvertLimitsInput{Rules: []ConvertLimitRuleInput{
		{
			AssetType:             "pulsa",
			Enabled:               true,
			AllowGuest:            true,
			RequireLogin:          false,
			MinAmount:             10_000,
			MaxAmount:             100_000,
			DailyLimit:            120_000,
			ManualReviewThreshold: 50_000,
		},
	}})
	if err != nil {
		t.Fatalf("update limit rules: %v", err)
	}

	_, err = svc.CreateOrder(context.Background(), member.ID, CreateConvertOrderInput{
		AssetType:                "pulsa",
		SourceAmount:             80_000,
		SourceChannel:            "Telkomsel",
		SourceAccount:            "081111111111",
		DestinationBank:          "BCA",
		DestinationAccountNumber: "1234567890",
		DestinationAccountName:   "Tester",
		IdempotencyKey:           "daily-limit-1",
	})
	if err != nil {
		t.Fatalf("create first order: %v", err)
	}

	_, err = svc.CreateOrder(context.Background(), member.ID, CreateConvertOrderInput{
		AssetType:                "pulsa",
		SourceAmount:             50_000,
		SourceChannel:            "Telkomsel",
		SourceAccount:            "082222222222",
		DestinationBank:          "BCA",
		DestinationAccountNumber: "1234567890",
		DestinationAccountName:   "Tester",
		IdempotencyKey:           "daily-limit-2",
	})
	if err == nil || !strings.Contains(err.Error(), "limit harian") {
		t.Fatalf("expected daily limit error, got: %v", err)
	}
}
