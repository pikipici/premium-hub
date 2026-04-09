package routes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	jwtpkg "premiumhub-api/pkg/jwt"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type apiEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
	Meta    *struct {
		Page       int   `json:"page"`
		Limit      int   `json:"limit"`
		Total      int64 `json:"total"`
		TotalPages int   `json:"total_pages"`
	} `json:"meta,omitempty"`
}

type convertOrderDTO struct {
	ID            string `json:"id"`
	TrackingToken string `json:"tracking_token"`
	Status        string `json:"status"`
}

type convertProofDTO struct {
	ID      string `json:"id"`
	FileURL string `json:"file_url"`
}

type convertOrderDetailDTO struct {
	Order  convertOrderDTO   `json:"order"`
	Proofs []convertProofDTO `json:"proofs"`
}

type expireResultDTO struct {
	Checked int `json:"checked"`
	Expired int `json:"expired"`
}

func openConvertAPITestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.ConvertOrder{},
		&model.ConvertOrderEvent{},
		&model.ConvertProof{},
		&model.ConvertPricingRule{},
		&model.ConvertLimitRule{},
		&model.ConvertTrackingToken{},
	); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	return db
}

func seedConvertAPIUser(t *testing.T, db *gorm.DB, role, email string) *model.User {
	t.Helper()

	u := &model.User{
		ID:       uuid.New(),
		Name:     "Convert Tester",
		Email:    email,
		Password: "not-used-here",
		Role:     role,
		IsActive: true,
	}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return u
}

func mustToken(t *testing.T, user *model.User, secret string) string {
	t.Helper()
	tok, err := jwtpkg.Generate(user.ID, user.Role, secret, time.Hour)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return tok
}

func doJSONRequest(t *testing.T, r http.Handler, method, path, token string, payload any) (int, apiEnvelope) {
	t.Helper()

	var body bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&body).Encode(payload); err != nil {
			t.Fatalf("encode payload: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, &body)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var env apiEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode response: %v (body=%s)", err, w.Body.String())
	}

	return w.Code, env
}

func TestConvertAPIUserFlow(t *testing.T) {
	db := openConvertAPITestDB(t)
	cfg := &config.Config{
		AppEnv:                     "development",
		FrontendURL:                "http://localhost:3000",
		JWTSecret:                  "super-secure-secret-value-32chars++",
		ConvertExpiryWorkerEnabled: false,
	}
	r := Setup(db, cfg)

	user := seedConvertAPIUser(t, db, "user", "convert-user-flow@example.com")
	token := mustToken(t, user, cfg.JWTSecret)

	createPayload := map[string]any{
		"asset_type":                 "pulsa",
		"source_amount":              120000,
		"source_channel":             "Telkomsel",
		"source_account":             "081234567890",
		"destination_bank":           "BCA",
		"destination_account_number": "1234567890",
		"destination_account_name":   "Budi Santoso",
		"idempotency_key":            "api-flow-001",
	}
	code, env := doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/orders", token, createPayload)
	if code != http.StatusCreated || !env.Success {
		t.Fatalf("create order failed: code=%d msg=%s", code, env.Message)
	}

	var created convertOrderDetailDTO
	if err := json.Unmarshal(env.Data, &created); err != nil {
		t.Fatalf("decode create data: %v", err)
	}
	if created.Order.ID == "" || created.Order.TrackingToken == "" {
		t.Fatalf("invalid create response: %+v", created.Order)
	}
	if created.Order.Status != "pending_transfer" {
		t.Fatalf("unexpected initial status: %s", created.Order.Status)
	}

	code, env = doJSONRequest(t, r, http.MethodGet, "/api/v1/convert/orders?page=1&limit=10", token, nil)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("list orders failed: code=%d msg=%s", code, env.Message)
	}
	var list []convertOrderDTO
	if err := json.Unmarshal(env.Data, &list); err != nil {
		t.Fatalf("decode list data: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.Order.ID {
		t.Fatalf("unexpected order list: %+v", list)
	}

	code, env = doJSONRequest(t, r, http.MethodGet, "/api/v1/convert/orders/"+created.Order.ID, token, nil)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("get detail failed: code=%d msg=%s", code, env.Message)
	}
	var detail convertOrderDetailDTO
	if err := json.Unmarshal(env.Data, &detail); err != nil {
		t.Fatalf("decode detail data: %v", err)
	}
	if detail.Order.Status != "pending_transfer" {
		t.Fatalf("unexpected status before proof: %s", detail.Order.Status)
	}

	code, env = doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/orders/"+created.Order.ID+"/proofs", token, map[string]any{
		"file_url": "https://cdn.example.com/proof/order-001.png",
		"note":     "bukti transfer",
	})
	if code != http.StatusOK || !env.Success {
		t.Fatalf("upload proof failed: code=%d msg=%s", code, env.Message)
	}
	if err := json.Unmarshal(env.Data, &detail); err != nil {
		t.Fatalf("decode detail after proof: %v", err)
	}
	if detail.Order.Status != "waiting_review" {
		t.Fatalf("status should become waiting_review, got %s", detail.Order.Status)
	}

	code, env = doJSONRequest(t, r, http.MethodGet, "/api/v1/convert/track/"+created.Order.TrackingToken, "", nil)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("track order failed: code=%d msg=%s", code, env.Message)
	}
	if err := json.Unmarshal(env.Data, &detail); err != nil {
		t.Fatalf("decode track data: %v", err)
	}
	if detail.Order.ID != created.Order.ID {
		t.Fatalf("tracked order mismatch: got=%s want=%s", detail.Order.ID, created.Order.ID)
	}
}

func TestConvertAPIGuestFlow(t *testing.T) {
	db := openConvertAPITestDB(t)
	cfg := &config.Config{
		AppEnv:                     "development",
		FrontendURL:                "http://localhost:3000",
		JWTSecret:                  "super-secure-secret-value-32chars++",
		ConvertExpiryWorkerEnabled: false,
	}
	r := Setup(db, cfg)

	createPayload := map[string]any{
		"asset_type":                 "pulsa",
		"source_amount":              110000,
		"source_channel":             "Telkomsel",
		"source_account":             "081298761234",
		"destination_bank":           "BCA",
		"destination_account_number": "1234567890",
		"destination_account_name":   "Guest Convert",
		"idempotency_key":            "guest-flow-001",
	}
	code, env := doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/guest/orders", "", createPayload)
	if code != http.StatusCreated || !env.Success {
		t.Fatalf("create guest order failed: code=%d msg=%s", code, env.Message)
	}

	var created convertOrderDetailDTO
	if err := json.Unmarshal(env.Data, &created); err != nil {
		t.Fatalf("decode guest create data: %v", err)
	}
	if created.Order.ID == "" || created.Order.TrackingToken == "" {
		t.Fatalf("invalid guest create response: %+v", created.Order)
	}
	if created.Order.Status != "pending_transfer" {
		t.Fatalf("unexpected guest initial status: %s", created.Order.Status)
	}

	code, env = doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/track/"+created.Order.TrackingToken+"/proofs", "", map[string]any{
		"file_url": "https://cdn.example.com/guest-proof.png",
		"note":     "guest upload proof",
	})
	if code != http.StatusOK || !env.Success {
		t.Fatalf("upload guest proof failed: code=%d msg=%s", code, env.Message)
	}

	var detail convertOrderDetailDTO
	if err := json.Unmarshal(env.Data, &detail); err != nil {
		t.Fatalf("decode guest proof response: %v", err)
	}
	if detail.Order.Status != "waiting_review" {
		t.Fatalf("expected waiting_review after guest proof, got %s", detail.Order.Status)
	}

	code, env = doJSONRequest(t, r, http.MethodGet, "/api/v1/convert/track/"+created.Order.TrackingToken, "", nil)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("track guest order failed: code=%d msg=%s", code, env.Message)
	}
	if err := json.Unmarshal(env.Data, &detail); err != nil {
		t.Fatalf("decode guest track response: %v", err)
	}
	if detail.Order.Status != "waiting_review" {
		t.Fatalf("expected waiting_review in guest track, got %s", detail.Order.Status)
	}
}

func TestConvertAPIRateLimitOnCreateOrder(t *testing.T) {
	db := openConvertAPITestDB(t)
	cfg := &config.Config{
		AppEnv:                       "development",
		FrontendURL:                  "http://localhost:3000",
		JWTSecret:                    "super-secure-secret-value-32chars++",
		ConvertCreateRateLimitMax:    "1",
		ConvertCreateRateLimitWindow: "1h",
		ConvertExpiryWorkerEnabled:   false,
	}
	r := Setup(db, cfg)

	user := seedConvertAPIUser(t, db, "user", "convert-user-ratelimit@example.com")
	token := mustToken(t, user, cfg.JWTSecret)

	payload := map[string]any{
		"asset_type":                 "pulsa",
		"source_amount":              120000,
		"source_channel":             "Telkomsel",
		"source_account":             "081234567890",
		"destination_bank":           "BCA",
		"destination_account_number": "1234567890",
		"destination_account_name":   "Budi Santoso",
		"idempotency_key":            "api-ratelimit-001",
	}

	code, env := doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/orders", token, payload)
	if code != http.StatusCreated || !env.Success {
		t.Fatalf("first create failed: code=%d msg=%s", code, env.Message)
	}

	payload["idempotency_key"] = "api-ratelimit-002"
	code, env = doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/orders", token, payload)
	if code != http.StatusTooManyRequests || env.Success {
		t.Fatalf("second create should be rate-limited, got code=%d success=%v msg=%s", code, env.Success, env.Message)
	}
}

func TestConvertAPIAdminGetOrderDetail(t *testing.T) {
	db := openConvertAPITestDB(t)
	cfg := &config.Config{
		AppEnv:                     "development",
		FrontendURL:                "http://localhost:3000",
		JWTSecret:                  "super-secure-secret-value-32chars++",
		ConvertExpiryWorkerEnabled: false,
	}
	r := Setup(db, cfg)

	user := seedConvertAPIUser(t, db, "user", "convert-user-admin-detail@example.com")
	admin := seedConvertAPIUser(t, db, "admin", "convert-admin-detail@example.com")
	userToken := mustToken(t, user, cfg.JWTSecret)
	adminToken := mustToken(t, admin, cfg.JWTSecret)

	createPayload := map[string]any{
		"asset_type":                 "pulsa",
		"source_amount":              120000,
		"source_channel":             "Telkomsel",
		"source_account":             "081234567890",
		"destination_bank":           "BCA",
		"destination_account_number": "1234567890",
		"destination_account_name":   "Budi Santoso",
		"idempotency_key":            "api-admin-detail-001",
	}
	code, env := doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/orders", userToken, createPayload)
	if code != http.StatusCreated || !env.Success {
		t.Fatalf("create order failed: code=%d msg=%s", code, env.Message)
	}

	var created convertOrderDetailDTO
	if err := json.Unmarshal(env.Data, &created); err != nil {
		t.Fatalf("decode create data: %v", err)
	}

	code, env = doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/orders/"+created.Order.ID+"/proofs", userToken, map[string]any{
		"file_url": "https://cdn.example.com/proof/order-001.png",
		"note":     "bukti transfer",
	})
	if code != http.StatusOK || !env.Success {
		t.Fatalf("upload proof failed: code=%d msg=%s", code, env.Message)
	}

	code, env = doJSONRequest(t, r, http.MethodGet, "/api/v1/admin/convert/orders/"+created.Order.ID, adminToken, nil)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("admin get order detail failed: code=%d msg=%s", code, env.Message)
	}

	var detail convertOrderDetailDTO
	if err := json.Unmarshal(env.Data, &detail); err != nil {
		t.Fatalf("decode admin detail: %v", err)
	}
	if detail.Order.ID != created.Order.ID {
		t.Fatalf("unexpected order id: got=%s want=%s", detail.Order.ID, created.Order.ID)
	}
	if len(detail.Proofs) == 0 {
		t.Fatalf("expected proofs in admin detail")
	}
	if detail.Proofs[0].FileURL == "" {
		t.Fatalf("expected proof file_url in admin detail")
	}
}

func TestConvertAPIAdminExpirePending(t *testing.T) {
	db := openConvertAPITestDB(t)
	cfg := &config.Config{
		AppEnv:                     "development",
		FrontendURL:                "http://localhost:3000",
		JWTSecret:                  "super-secure-secret-value-32chars++",
		ConvertExpiryWorkerEnabled: false,
	}
	r := Setup(db, cfg)

	user := seedConvertAPIUser(t, db, "user", "convert-user-expire@example.com")
	admin := seedConvertAPIUser(t, db, "admin", "convert-admin-expire@example.com")
	userToken := mustToken(t, user, cfg.JWTSecret)
	adminToken := mustToken(t, admin, cfg.JWTSecret)

	createPayload := map[string]any{
		"asset_type":                 "pulsa",
		"source_amount":              120000,
		"source_channel":             "Telkomsel",
		"source_account":             "081234567890",
		"destination_bank":           "BCA",
		"destination_account_number": "1234567890",
		"destination_account_name":   "Budi Santoso",
		"idempotency_key":            "api-expire-001",
	}
	code, env := doJSONRequest(t, r, http.MethodPost, "/api/v1/convert/orders", userToken, createPayload)
	if code != http.StatusCreated || !env.Success {
		t.Fatalf("create order failed: code=%d msg=%s", code, env.Message)
	}

	var created convertOrderDetailDTO
	if err := json.Unmarshal(env.Data, &created); err != nil {
		t.Fatalf("decode create data: %v", err)
	}

	orderID, err := uuid.Parse(created.Order.ID)
	if err != nil {
		t.Fatalf("parse order id: %v", err)
	}

	if err := db.Model(&model.ConvertOrder{}).Where("id = ?", orderID).Update("expires_at", time.Now().Add(-2*time.Hour)).Error; err != nil {
		t.Fatalf("set order expiry in past: %v", err)
	}

	code, env = doJSONRequest(t, r, http.MethodPost, "/api/v1/admin/convert/orders/expire-pending?limit=50", adminToken, nil)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("expire pending failed: code=%d msg=%s", code, env.Message)
	}

	var expireRes expireResultDTO
	if err := json.Unmarshal(env.Data, &expireRes); err != nil {
		t.Fatalf("decode expire result: %v", err)
	}
	if expireRes.Expired < 1 {
		t.Fatalf("expected at least 1 expired order, got %+v", expireRes)
	}

	code, env = doJSONRequest(t, r, http.MethodGet, "/api/v1/convert/track/"+created.Order.TrackingToken, "", nil)
	if code != http.StatusBadRequest || env.Success {
		t.Fatalf("tracking should fail after expire, got code=%d success=%v msg=%s", code, env.Success, env.Message)
	}

	code, env = doJSONRequest(t, r, http.MethodGet, "/api/v1/convert/orders/"+created.Order.ID, userToken, nil)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("get order detail after expire failed: code=%d msg=%s", code, env.Message)
	}
	var detail convertOrderDetailDTO
	if err := json.Unmarshal(env.Data, &detail); err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	if detail.Order.Status != "expired" {
		t.Fatalf("expected expired status, got %s", detail.Order.Status)
	}
}
