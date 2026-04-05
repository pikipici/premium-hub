package config

import (
	"strings"
	"testing"
)

func TestConfigValidate(t *testing.T) {
	t.Run("development allows missing neticon creds", func(t *testing.T) {
		cfg := &Config{
			AppEnv:    "development",
			JWTSecret: "super-secure-secret-value",
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

	t.Run("production requires neticon fields", func(t *testing.T) {
		cfg := &Config{
			AppEnv:    "production",
			JWTSecret: "super-secure-secret-value",
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
			AppEnv:         "Production",
			JWTSecret:      "super-secure-secret-value",
			NeticonAPIKey:  "NP_xxx",
			NeticonUserID:  "MERCHANT_01",
			NeticonBaseURL: "https://qris.neticonpay.my.id/qris.php",
		}
		if err := cfg.Validate(); err != nil {
			t.Fatalf("expected valid production config, got: %v", err)
		}
	})
}
