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
	"premiumhub-api/pkg/hash"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func openAuthAPITestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	if err := db.AutoMigrate(&model.User{}, &model.AuthSession{}); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	return db
}

func seedAuthAPIUser(t *testing.T, db *gorm.DB, email, password string) *model.User {
	t.Helper()

	hashed, err := hash.Password(password)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	user := &model.User{
		ID:       uuid.New(),
		Name:     "Auth Tester",
		Email:    email,
		Password: hashed,
		Role:     "user",
		IsActive: true,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	return user
}

func doAuthJSONRequest(t *testing.T, r http.Handler, method, path string, payload any, cookies ...*http.Cookie) (int, apiEnvelope, *http.Response) {
	t.Helper()

	var body bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&body).Encode(payload); err != nil {
			t.Fatalf("encode payload: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, &body)
	req.Header.Set("Content-Type", "application/json")
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var env apiEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode response: %v (body=%s)", err, w.Body.String())
	}

	return w.Code, env, w.Result()
}

func mustResponseCookie(t *testing.T, res *http.Response, name string) *http.Cookie {
	t.Helper()

	for _, cookie := range res.Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}

	t.Fatalf("cookie %s not found", name)
	return nil
}

func TestAuthLoginCookieTTLMatchesConfig(t *testing.T) {
	db := openAuthAPITestDB(t)
	seedAuthAPIUser(t, db, "cookie-ttl@example.com", "secret123")

	cfg := &config.Config{
		FrontendURL:         "http://localhost:3000",
		JWTSecret:           "super-secure-secret-value-32chars++",
		JWTExpiry:           "2h30m",
		RefreshTokenExpiry:  "72h",
		AuthRateLimitMax:    "100",
		AuthRateLimitWindow: "1m",
	}

	r := Setup(db, cfg)
	code, env, res := doAuthJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email":    "cookie-ttl@example.com",
		"password": "secret123",
	})
	if code != http.StatusOK || !env.Success {
		t.Fatalf("login failed: code=%d msg=%s", code, env.Message)
	}

	accessCookie := mustResponseCookie(t, res, "access_token")
	refreshCookie := mustResponseCookie(t, res, "refresh_token")

	if accessCookie.MaxAge != int((150*time.Minute)/time.Second) {
		t.Fatalf("unexpected access max-age: %d", accessCookie.MaxAge)
	}
	if refreshCookie.MaxAge != int((72*time.Hour)/time.Second) {
		t.Fatalf("unexpected refresh max-age: %d", refreshCookie.MaxAge)
	}
	if !accessCookie.HttpOnly || !refreshCookie.HttpOnly {
		t.Fatalf("auth cookies should be httpOnly")
	}
}

func TestAuthSessionRestoresExpiredAccessWithRefresh(t *testing.T) {
	db := openAuthAPITestDB(t)
	seedAuthAPIUser(t, db, "restore@example.com", "secret123")

	cfg := &config.Config{
		FrontendURL:         "http://localhost:3000",
		JWTSecret:           "super-secure-secret-value-32chars++",
		JWTExpiry:           "1s",
		RefreshTokenExpiry:  "1h",
		AuthRateLimitMax:    "100",
		AuthRateLimitWindow: "1m",
	}

	r := Setup(db, cfg)
	code, env, res := doAuthJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email":    "restore@example.com",
		"password": "secret123",
	})
	if code != http.StatusOK || !env.Success {
		t.Fatalf("login failed: code=%d msg=%s", code, env.Message)
	}

	accessCookie := mustResponseCookie(t, res, "access_token")
	refreshCookie := mustResponseCookie(t, res, "refresh_token")

	time.Sleep(1200 * time.Millisecond)

	code, env, res = doAuthJSONRequest(t, r, http.MethodGet, "/api/v1/auth/session", nil, accessCookie, refreshCookie)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("session restore failed: code=%d msg=%s", code, env.Message)
	}

	var payload struct {
		User struct {
			Email string `json:"email"`
		} `json:"user"`
	}
	if err := json.Unmarshal(env.Data, &payload); err != nil {
		t.Fatalf("decode session payload: %v", err)
	}
	if payload.User.Email != "restore@example.com" {
		t.Fatalf("unexpected session user: %+v", payload.User)
	}

	newAccessCookie := mustResponseCookie(t, res, "access_token")
	newRefreshCookie := mustResponseCookie(t, res, "refresh_token")
	if newAccessCookie.Value == "" || newRefreshCookie.Value == "" {
		t.Fatalf("expected rotated cookies to be set")
	}
	if newRefreshCookie.Value == refreshCookie.Value {
		t.Fatalf("refresh token should rotate during restore")
	}
}

func TestAuthSessionExpiredRefreshClearsCookies(t *testing.T) {
	db := openAuthAPITestDB(t)
	seedAuthAPIUser(t, db, "expired@example.com", "secret123")

	cfg := &config.Config{
		FrontendURL:         "http://localhost:3000",
		JWTSecret:           "super-secure-secret-value-32chars++",
		JWTExpiry:           "1s",
		RefreshTokenExpiry:  "1s",
		AuthRateLimitMax:    "100",
		AuthRateLimitWindow: "1m",
	}

	r := Setup(db, cfg)
	code, env, res := doAuthJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email":    "expired@example.com",
		"password": "secret123",
	})
	if code != http.StatusOK || !env.Success {
		t.Fatalf("login failed: code=%d msg=%s", code, env.Message)
	}

	accessCookie := mustResponseCookie(t, res, "access_token")
	refreshCookie := mustResponseCookie(t, res, "refresh_token")

	time.Sleep(1200 * time.Millisecond)

	code, env, res = doAuthJSONRequest(t, r, http.MethodGet, "/api/v1/auth/session", nil, accessCookie, refreshCookie)
	if code != http.StatusUnauthorized || env.Success {
		t.Fatalf("expected unauthorized session restore, got code=%d msg=%s", code, env.Message)
	}

	clearedAccess := mustResponseCookie(t, res, "access_token")
	clearedRefresh := mustResponseCookie(t, res, "refresh_token")
	if clearedAccess.MaxAge >= 0 || clearedRefresh.MaxAge >= 0 {
		t.Fatalf("expired session should clear auth cookies")
	}
}

func TestAuthLogoutRevokesRefreshSession(t *testing.T) {
	db := openAuthAPITestDB(t)
	seedAuthAPIUser(t, db, "logout@example.com", "secret123")

	cfg := &config.Config{
		FrontendURL:         "http://localhost:3000",
		JWTSecret:           "super-secure-secret-value-32chars++",
		JWTExpiry:           "1s",
		RefreshTokenExpiry:  "1h",
		AuthRateLimitMax:    "100",
		AuthRateLimitWindow: "1m",
	}

	r := Setup(db, cfg)
	code, env, res := doAuthJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email":    "logout@example.com",
		"password": "secret123",
	})
	if code != http.StatusOK || !env.Success {
		t.Fatalf("login failed: code=%d msg=%s", code, env.Message)
	}

	accessCookie := mustResponseCookie(t, res, "access_token")
	refreshCookie := mustResponseCookie(t, res, "refresh_token")

	code, env, _ = doAuthJSONRequest(t, r, http.MethodPost, "/api/v1/auth/logout", nil, accessCookie, refreshCookie)
	if code != http.StatusOK || !env.Success {
		t.Fatalf("logout failed: code=%d msg=%s", code, env.Message)
	}

	time.Sleep(1200 * time.Millisecond)

	code, env, _ = doAuthJSONRequest(t, r, http.MethodGet, "/api/v1/auth/session", nil, accessCookie, refreshCookie)
	if code != http.StatusUnauthorized || env.Success {
		t.Fatalf("revoked refresh token should not restore session: code=%d msg=%s", code, env.Message)
	}
}
