package config

import (
	"strings"
	"testing"
)

func TestConfigValidate(t *testing.T) {
	t.Run("development allows missing duitku creds", func(t *testing.T) {
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

	t.Run("reject malformed http safety config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                  "development",
			JWTSecret:               "super-secure-secret-value-32chars++",
			CookieSameSite:          "lax",
			HTTPReadHeaderTimeout:   "0",
			HTTPReadTimeout:         "bad",
			HTTPWriteTimeout:        "6m",
			HTTPIdleTimeout:         "31m",
			HTTPMaxHeaderBytes:      "0",
			MaxRequestBodyBytes:     "999999999",
			GlobalRateLimitMax:      "0",
			GlobalRateLimitWindow:   "wrong",
			ProviderRateLimitMax:    "-1",
			ProviderRateLimitWindow: "1m",
			PaymentRateLimitMax:     "abc",
			PaymentRateLimitWindow:  "1m",
			WebhookRateLimitMax:     "120",
			WebhookRateLimitWindow:  "bad",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected http safety validation error")
		}
		msg := err.Error()
		for _, expected := range []string{
			"HTTP_READ_HEADER_TIMEOUT",
			"HTTP_READ_TIMEOUT",
			"HTTP_WRITE_TIMEOUT",
			"HTTP_IDLE_TIMEOUT",
			"HTTP_MAX_HEADER_BYTES",
			"MAX_REQUEST_BODY_BYTES",
			"GLOBAL_RATE_LIMIT_MAX",
			"GLOBAL_RATE_LIMIT_WINDOW",
			"PROVIDER_RATE_LIMIT_MAX",
			"PAYMENT_RATE_LIMIT_MAX",
			"WEBHOOK_RATE_LIMIT_WINDOW",
		} {
			if !strings.Contains(msg, expected) {
				t.Fatalf("expected error to contain %q, got: %s", expected, msg)
			}
		}
	})

	t.Run("reject invalid fivesim timeout", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                "development",
			JWTSecret:             "super-secure-secret-value-32chars++",
			CookieSameSite:        "lax",
			AuthRateLimitMax:      "20",
			AuthRateLimitWindow:   "1m",
			FiveSimHTTPTimeoutSec: "500",
		}
		err := cfg.Validate()
		if err == nil || !strings.Contains(err.Error(), "FIVESIM_HTTP_TIMEOUT_SEC") {
			t.Fatalf("expected FIVESIM timeout error, got: %v", err)
		}
	})

	t.Run("reject malformed jap config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:              "development",
			JWTSecret:           "super-secure-secret-value-32chars++",
			CookieSameSite:      "lax",
			AuthRateLimitMax:    "20",
			AuthRateLimitWindow: "1m",
			JAPAPIURL:           "ftp://invalid-jap-endpoint",
			JAPHTTPTimeoutSec:   "300",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected JAP config validation error")
		}
		if !strings.Contains(err.Error(), "JAP_API_URL") || !strings.Contains(err.Error(), "JAP_HTTP_TIMEOUT_SEC") {
			t.Fatalf("expected JAP config errors, got: %v", err)
		}
	})

	t.Run("reject invalid fivesim wallet debit config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                       "development",
			JWTSecret:                    "super-secure-secret-value-32chars++",
			CookieSameSite:               "lax",
			AuthRateLimitMax:             "20",
			AuthRateLimitWindow:          "1m",
			FiveSimWalletPriceMultiplier: "0",
			FiveSimWalletMinDebit:        "-2",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected fivesim wallet debit config error")
		}
		if !strings.Contains(err.Error(), "FIVESIM_WALLET_PRICE_MULTIPLIER") || !strings.Contains(err.Error(), "FIVESIM_WALLET_MIN_DEBIT") {
			t.Fatalf("expected fivesim wallet config errors, got: %v", err)
		}
	})

	t.Run("reject malformed fivesim buy rate limit config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                    "development",
			JWTSecret:                 "super-secure-secret-value-32chars++",
			CookieSameSite:            "lax",
			AuthRateLimitMax:          "20",
			AuthRateLimitWindow:       "1m",
			FiveSimBuyRateLimitMax:    "0",
			FiveSimBuyRateLimitWindow: "bad-window",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected fivesim buy rate limit validation error")
		}
		if !strings.Contains(err.Error(), "FIVESIM_BUY_RATE_LIMIT_MAX") || !strings.Contains(err.Error(), "FIVESIM_BUY_RATE_LIMIT_WINDOW") {
			t.Fatalf("expected fivesim buy rate limit errors, got: %v", err)
		}
	})

	t.Run("production requires duitku fields", func(t *testing.T) {
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
			"DUITKU_MERCHANT_CODE",
			"DUITKU_API_KEY",
			"DUITKU_BASE_URL",
			"PAYMENT_GATEWAY_CALLBACK_URL atau DUITKU_CALLBACK_URL atau FRONTEND_URL",
			"FIVESIM_API_KEY",
		} {
			if !strings.Contains(msg, expected) {
				t.Fatalf("expected error to contain %q, got: %s", expected, msg)
			}
		}
	})

	t.Run("production requires pakasir fields when selected", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                 "production",
			JWTSecret:              "super-secure-secret-value-32chars++",
			PaymentGatewayProvider: "pakasir",
			FiveSimAPIKey:          "FS_xxx",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected validation error")
		}

		msg := err.Error()
		for _, expected := range []string{
			"PAKASIR_PROJECT",
			"PAKASIR_API_KEY",
			"PAKASIR_BASE_URL",
		} {
			if !strings.Contains(msg, expected) {
				t.Fatalf("expected error to contain %q, got: %s", expected, msg)
			}
		}
		if strings.Contains(msg, "DUITKU_MERCHANT_CODE") {
			t.Fatalf("pakasir mode should not require duitku creds, got: %s", msg)
		}
	})

	t.Run("reject invalid payment provider", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                 "development",
			JWTSecret:              "super-secure-secret-value-32chars++",
			PaymentGatewayProvider: "unknown",
		}
		err := cfg.Validate()
		if err == nil || !strings.Contains(err.Error(), "PAYMENT_GATEWAY_PROVIDER") {
			t.Fatalf("expected payment provider error, got: %v", err)
		}
	})

	t.Run("reject malformed wallet reconcile worker config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                               "development",
			JWTSecret:                            "super-secure-secret-value-32chars++",
			CookieSameSite:                       "lax",
			AuthRateLimitMax:                     "20",
			AuthRateLimitWindow:                  "1m",
			WalletTopupReconcileWorkerInterval:   "not-duration",
			WalletTopupReconcileWorkerBatchLimit: "0",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected wallet reconcile worker validation errors")
		}
		if !strings.Contains(err.Error(), "WALLET_TOPUP_RECONCILE_WORKER_INTERVAL") || !strings.Contains(err.Error(), "WALLET_TOPUP_RECONCILE_WORKER_BATCH_LIMIT") {
			t.Fatalf("expected wallet reconcile worker errors, got: %v", err)
		}
	})

	t.Run("reject malformed nokos landing config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                        "development",
			JWTSecret:                     "super-secure-secret-value-32chars++",
			CookieSameSite:                "lax",
			AuthRateLimitMax:              "20",
			AuthRateLimitWindow:           "1m",
			NokosLandingWorkerInterval:    "bad-duration",
			NokosLandingSyncTimeout:       "0",
			NokosLandingStaleAfter:        "48h",
			NokosLandingMethodProbeAmount: "-1",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected nokos landing validation errors")
		}
		if !strings.Contains(err.Error(), "NOKOS_LANDING_WORKER_INTERVAL") ||
			!strings.Contains(err.Error(), "NOKOS_LANDING_SYNC_TIMEOUT") ||
			!strings.Contains(err.Error(), "NOKOS_LANDING_STALE_AFTER") ||
			!strings.Contains(err.Error(), "NOKOS_LANDING_METHOD_PROBE_AMOUNT") {
			t.Fatalf("expected nokos landing config errors, got: %v", err)
		}
	})

	t.Run("reject malformed convert safety config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                            "development",
			JWTSecret:                         "super-secure-secret-value-32chars++",
			CookieSameSite:                    "lax",
			AuthRateLimitMax:                  "20",
			AuthRateLimitWindow:               "1m",
			ConvertCreateRateLimitMax:         "0",
			ConvertCreateRateLimitWindow:      "wrong",
			ConvertProofRateLimitMax:          "-1",
			ConvertProofRateLimitWindow:       "2m",
			ConvertTrackRateLimitMax:          "10",
			ConvertTrackRateLimitWindow:       "oops",
			ConvertAdminStatusRateLimitMax:    "abc",
			ConvertAdminStatusRateLimitWindow: "1m",
			ConvertExpiryWorkerInterval:       "bad-duration",
			ConvertExpiryWorkerBatchLimit:     "20000",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected convert safety validation errors")
		}

		msg := err.Error()
		for _, expected := range []string{
			"CONVERT_CREATE_RATE_LIMIT_MAX",
			"CONVERT_CREATE_RATE_LIMIT_WINDOW",
			"CONVERT_PROOF_RATE_LIMIT_MAX",
			"CONVERT_TRACK_RATE_LIMIT_WINDOW",
			"CONVERT_ADMIN_STATUS_RATE_LIMIT_MAX",
			"CONVERT_EXPIRY_WORKER_INTERVAL",
			"CONVERT_EXPIRY_WORKER_BATCH_LIMIT",
		} {
			if !strings.Contains(msg, expected) {
				t.Fatalf("expected error to contain %q, got: %s", expected, msg)
			}
		}
	})

	t.Run("reject malformed convert proof r2 config", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                        "development",
			JWTSecret:                     "super-secure-secret-value-32chars++",
			CookieSameSite:                "lax",
			AuthRateLimitMax:              "20",
			AuthRateLimitWindow:           "1m",
			ConvertProofStorageMode:       "r2",
			ConvertProofMaxFileMB:         "0",
			ConvertProofR2Endpoint:        "ftp://invalid-endpoint",
			ConvertProofR2Bucket:          "",
			ConvertProofR2AccessKeyID:     "",
			ConvertProofR2SecretAccessKey: "",
			ConvertProofR2PublicBaseURL:   "not-a-url",
			ConvertProofR2UploadTimeout:   "0",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatalf("expected invalid R2 proof storage config")
		}

		msg := err.Error()
		for _, expected := range []string{
			"CONVERT_PROOF_MAX_FILE_MB",
			"CONVERT_PROOF_R2_ENDPOINT",
			"CONVERT_PROOF_R2_BUCKET",
			"CONVERT_PROOF_R2_ACCESS_KEY_ID",
			"CONVERT_PROOF_R2_SECRET_ACCESS_KEY",
			"CONVERT_PROOF_R2_PUBLIC_BASE_URL",
			"CONVERT_PROOF_R2_UPLOAD_TIMEOUT",
		} {
			if !strings.Contains(msg, expected) {
				t.Fatalf("expected error to contain %q, got: %s", expected, msg)
			}
		}
	})

	t.Run("production passes when complete", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                            "Production",
			JWTSecret:                         "super-secure-secret-value-32chars++",
			DuitkuMerchantCode:                "D1234",
			DuitkuAPIKey:                      "DK_xxx",
			DuitkuBaseURL:                     "https://passport.duitku.com",
			DuitkuHTTPTimeoutSec:              "12",
			DuitkuCallbackURL:                 "https://api.example.com/api/v1/payment/webhook",
			FiveSimAPIKey:                     "FS_xxx",
			FiveSimHTTPTimeoutSec:             "15",
			CookieSameSite:                    "strict",
			CookieSecure:                      true,
			AuthRateLimitMax:                  "25",
			AuthRateLimitWindow:               "2m",
			ConvertTrackRateLimitMax:          "120",
			ConvertTrackRateLimitWindow:       "1m",
			ConvertCreateRateLimitMax:         "12",
			ConvertCreateRateLimitWindow:      "1m",
			ConvertProofRateLimitMax:          "20",
			ConvertProofRateLimitWindow:       "5m",
			ConvertAdminStatusRateLimitMax:    "120",
			ConvertAdminStatusRateLimitWindow: "1m",
			ConvertExpiryWorkerInterval:       "1m",
			ConvertExpiryWorkerBatchLimit:     "200",
		}
		if err := cfg.Validate(); err != nil {
			t.Fatalf("expected valid production config, got: %v", err)
		}
	})

	t.Run("production passes with pakasir", func(t *testing.T) {
		cfg := &Config{
			AppEnv:                            "Production",
			JWTSecret:                         "super-secure-secret-value-32chars++",
			PaymentGatewayProvider:            "pakasir",
			PakasirProject:                    "digimarket",
			PakasirAPIKey:                     "PK_xxx",
			PakasirBaseURL:                    "https://app.pakasir.com",
			PakasirHTTPTimeoutSec:             "12",
			FiveSimAPIKey:                     "FS_xxx",
			FiveSimHTTPTimeoutSec:             "15",
			CookieSameSite:                    "strict",
			CookieSecure:                      true,
			AuthRateLimitMax:                  "25",
			AuthRateLimitWindow:               "2m",
			ConvertTrackRateLimitMax:          "120",
			ConvertTrackRateLimitWindow:       "1m",
			ConvertCreateRateLimitMax:         "12",
			ConvertCreateRateLimitWindow:      "1m",
			ConvertProofRateLimitMax:          "20",
			ConvertProofRateLimitWindow:       "5m",
			ConvertAdminStatusRateLimitMax:    "120",
			ConvertAdminStatusRateLimitWindow: "1m",
			ConvertExpiryWorkerInterval:       "1m",
			ConvertExpiryWorkerBatchLimit:     "200",
		}
		if err := cfg.Validate(); err != nil {
			t.Fatalf("expected valid pakasir production config, got: %v", err)
		}
	})
}
