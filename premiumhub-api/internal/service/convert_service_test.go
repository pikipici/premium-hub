package service

import (
	"context"
	"strings"
	"testing"
	"time"

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

	_, err = svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusSuccess, Reason: "berhasil"})
	if err == nil || !strings.Contains(err.Error(), "unggah bukti penyelesaian admin") {
		t.Fatalf("expected settlement proof guard error, got: %v", err)
	}

	if _, err := svc.AdminUploadSettlementProof(context.Background(), admin.ID, orderID, UploadConvertProofInput{
		FileURL: "https://cdn.example.com/settlement-proof-1.png",
		Note:    "transfer ke user berhasil",
	}); err != nil {
		t.Fatalf("upload settlement proof: %v", err)
	}

	final, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusSuccess, Reason: "berhasil"})
	if err != nil {
		t.Fatalf("success status: %v", err)
	}

	if final.Order.Status != convertStatusSuccess {
		t.Fatalf("expected final status success, got %s", final.Order.Status)
	}
	if len(final.AdminSettlementProofs) == 0 {
		t.Fatalf("expected admin settlement proofs in detail")
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

func TestConvertServiceCreateGuestOrderAndUploadProofByToken(t *testing.T) {
	svc, db, _, _ := setupConvertService(t)

	res, err := svc.CreateGuestOrder(context.Background(), CreateConvertOrderInput{
		AssetType:                "pulsa",
		SourceAmount:             125_000,
		SourceChannel:            "Telkomsel",
		SourceAccount:            "081299991234",
		DestinationBank:          "BCA",
		DestinationAccountNumber: "9876543210",
		DestinationAccountName:   "Guest User",
		IdempotencyKey:           "guest-service-001",
	})
	if err != nil {
		t.Fatalf("create guest order: %v", err)
	}
	if !res.Order.IsGuest {
		t.Fatalf("expected is_guest=true")
	}
	if res.Order.TrackingToken == "" {
		t.Fatalf("tracking token should not be empty for guest order")
	}

	var guestBridge model.User
	if err := db.Where("email = ?", convertGuestBridgeEmail).First(&guestBridge).Error; err != nil {
		t.Fatalf("guest bridge user should exist: %v", err)
	}

	updated, err := svc.UploadProofByTrackingToken(context.Background(), res.Order.TrackingToken, UploadConvertProofInput{
		FileURL: "https://cdn.example.com/guest-proof-service.png",
		Note:    "guest proof by token",
	})
	if err != nil {
		t.Fatalf("upload proof by token: %v", err)
	}
	if updated.Order.Status != convertStatusWaitingReview {
		t.Fatalf("expected waiting_review, got %s", updated.Order.Status)
	}
	if len(updated.Proofs) == 0 {
		t.Fatalf("expected proofs to be recorded")
	}
}

func TestConvertServiceAdminUploadSettlementProof(t *testing.T) {
	svc, _, member, admin := setupConvertService(t)

	order := createBaselineConvertOrder(t, svc, member.ID, "idem-settlement-upload")
	orderID := uuid.MustParse(order.Order.ID)

	if _, err := svc.UploadProof(context.Background(), member.ID, orderID, UploadConvertProofInput{FileURL: "https://example.com/user-proof.png"}); err != nil {
		t.Fatalf("upload user proof: %v", err)
	}
	if _, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusApproved, Reason: "valid"}); err != nil {
		t.Fatalf("approve status: %v", err)
	}

	detail, err := svc.AdminUploadSettlementProof(context.Background(), admin.ID, orderID, UploadConvertProofInput{
		FileURL: "https://example.com/admin-settlement-proof.png",
		Note:    "sudah transfer",
	})
	if err != nil {
		t.Fatalf("admin upload settlement proof: %v", err)
	}

	if len(detail.AdminSettlementProofs) == 0 {
		t.Fatalf("expected admin settlement proof after upload")
	}
	if detail.AdminSettlementProofs[0].ProofType != convertProofTypeAdminSettlement {
		t.Fatalf("unexpected proof type: %s", detail.AdminSettlementProofs[0].ProofType)
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

func TestConvertDayRangeReturnsUTCBoundariesForTimezone(t *testing.T) {
	now := time.Date(2026, time.April, 13, 23, 58, 26, 0, time.UTC)

	start, end := convertDayRange(now, "Asia/Jakarta")

	expectedStart := time.Date(2026, time.April, 13, 17, 0, 0, 0, time.UTC)
	expectedEnd := expectedStart.Add(24 * time.Hour)

	if !start.Equal(expectedStart) {
		t.Fatalf("unexpected start boundary: got %s want %s", start, expectedStart)
	}
	if !end.Equal(expectedEnd) {
		t.Fatalf("unexpected end boundary: got %s want %s", end, expectedEnd)
	}
	if start.Location() != time.UTC || end.Location() != time.UTC {
		t.Fatalf("boundaries should be normalized to UTC, got %s and %s", start.Location(), end.Location())
	}
}

func TestConvertServiceUploadProofRejectedWhenOrderFinal(t *testing.T) {
	svc, _, member, admin := setupConvertService(t)

	order := createBaselineConvertOrder(t, svc, member.ID, "idem-final-proof")
	orderID := uuid.MustParse(order.Order.ID)

	if _, err := svc.UploadProof(context.Background(), member.ID, orderID, UploadConvertProofInput{FileURL: "https://example.com/proof-1.png"}); err != nil {
		t.Fatalf("upload proof first: %v", err)
	}
	if _, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusApproved, Reason: "ok"}); err != nil {
		t.Fatalf("approve: %v", err)
	}
	if _, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusProcessing, Reason: "proses"}); err != nil {
		t.Fatalf("processing: %v", err)
	}
	if _, err := svc.AdminUploadSettlementProof(context.Background(), admin.ID, orderID, UploadConvertProofInput{FileURL: "https://example.com/admin-settlement-proof.png"}); err != nil {
		t.Fatalf("upload settlement proof: %v", err)
	}
	if _, err := svc.AdminUpdateOrderStatus(context.Background(), admin.ID, orderID, AdminUpdateConvertStatusInput{ToStatus: convertStatusSuccess, Reason: "done"}); err != nil {
		t.Fatalf("success: %v", err)
	}

	_, err := svc.UploadProof(context.Background(), member.ID, orderID, UploadConvertProofInput{FileURL: "https://example.com/proof-2.png"})
	if err == nil || !strings.Contains(err.Error(), "sudah final") {
		t.Fatalf("expected order final upload error, got: %v", err)
	}
}

func TestConvertServiceExpirePendingOrders(t *testing.T) {
	svc, db, member, _ := setupConvertService(t)

	order := createBaselineConvertOrder(t, svc, member.ID, "idem-expire-1")
	orderID := uuid.MustParse(order.Order.ID)

	past := time.Now().Add(-2 * time.Hour)
	if err := db.Model(&model.ConvertOrder{}).Where("id = ?", orderID).Update("expires_at", past).Error; err != nil {
		t.Fatalf("set expired at: %v", err)
	}

	result, err := svc.ExpirePendingOrders(context.Background(), 100)
	if err != nil {
		t.Fatalf("expire pending orders: %v", err)
	}
	if result.Expired != 1 {
		t.Fatalf("expected 1 expired order, got %d (checked=%d)", result.Expired, result.Checked)
	}

	detail, err := svc.GetOrderByUser(member.ID, orderID)
	if err != nil {
		t.Fatalf("get order by user: %v", err)
	}
	if detail.Order.Status != convertStatusExpired {
		t.Fatalf("expected expired status, got %s", detail.Order.Status)
	}

	hasExpiredEvent := false
	for _, event := range detail.Events {
		if event.ToStatus == convertStatusExpired {
			hasExpiredEvent = true
			break
		}
	}
	if !hasExpiredEvent {
		t.Fatalf("expected expired event in timeline")
	}

	if _, err := svc.TrackOrderByToken(order.Order.TrackingToken); err == nil {
		t.Fatalf("tracking token should be inactive after scheduler expiration")
	}
}
