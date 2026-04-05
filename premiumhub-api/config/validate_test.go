package config

import (
	"strings"
	"testing"
)

func TestConfigValidate(t *testing.T) {
	t.Run("development allows missing neticon creds", func(t *testing.T) {
		cfg := &Config{
			AppEnv:              "development",
			JWTSecret:           "super-secure-secret-value-32chars++",
			CookieSameSite:      "lax",
			AuthRateLimitMax:    "20",
			AuthRateLimitWindow: "1m",
		}
		if err := cfg.Validate(); err != nil {
			t.Fatalf("expected valid config, got: %v", err)
		}
	})

	t.Run("reject default jwt secret", func(t *testing.T) {
		cfg := &Config{
			AppEnv:    "development",
			JWTSecret: "changeme-secret-32chars-minimum!!",
		}
		err := cfg.Validate()
		if err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
			t.Fatalf("expected JWT secret error, got: %v", err)
		}
	})

	t.Run("reject short jwt secret", func(t *testing.T) {
		cfg := &Config{
			AppEnv:    "development",
			JWTSecret: "short-secret",
		}
		err := cfg.Validate()
		if err == nil || !strings.Contains(err.Error(), "minimal 32") {
			t.Fatalf("expected short jwt secret error, got: %v", err)
		}
	})

	t.Run("reject insecure samesite none", func(t *testing.T) {
		cfg := &Config{
			AppEnv:         "development",
			JWTSecret:      "super-secure-secret-value-32chars++",
			CookieSameSite: "none",
			CookieSecure:   false,
		}
		err := cfg.Validate()
		if err == nil || !strings.Contains(err.Error(), "COOKIE_SECURE") {
			t.Fatalf("expected cookie secure error, got: %v", err)
		}
	})

	t.Run("reject malformed auth rate config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:              "development",
			JWTSecret:           "super-secure-secret-value-32chars++",
			CookieSameSite:      "lax",
			AuthRateLimitMax:    "0",
			AuthRateLimitWindow: "not-duration",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected auth rate validation error")
		}
		if !strings.Contains(err.Error(), "AUTH_RATE_LIMIT_MAX") || !strings.Contains(err.Error(), "AUTH_RATE_LIMIT_WINDOW") {
			t.Fatalf("expected auth rate limit errors, got: %v", err)
		}
	})

	t.Run("production requires neticon fields", func(t *testing.T) {
		cfg := &Config{
			AppEnv:    "production",
			JWTSecret: "super-secure-secret-value-32chars++",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected validation error")
		}

		msg := err.Error()
		for _, expected := range []string{
			"NETICON_API_KEY",
			"NETICON_USER_ID",
			"NETICON_BASE_URL",
		} {
			if !strings.Contains(msg, expected) {
				t.Fatalf("expected error to contain %q, got: %s", expected, msg)
			}
		}
	})

	t.Run("production passes when complete", func(t *testing.T) {
		cfg := &Config{
			AppEnv:              "Production",
			JWTSecret:           "super-secure-secret-value-32chars++",
			NeticonAPIKey:       "NP_xxx",
			NeticonUserID:       "MERCHANT_01",
			NeticonBaseURL:      "https://qris.neticonpay.my.id/qris.php",
			CookieSameSite:      "strict",
			CookieSecure:        true,
			AuthRateLimitMax:    "25",
			AuthRateLimitWindow: "2m",
		}
		if err := cfg.Validate(); err != nil {
			t.Fatalf("expected valid production config, got: %v", err)
		}
	})
}
