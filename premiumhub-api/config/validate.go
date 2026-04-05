package config

import (
	"errors"
	"strconv"
	"strings"
	"time"
)

func (c *Config) Validate() error {
	var problems []string

	appEnv := strings.ToLower(strings.TrimSpace(c.AppEnv))
	jwtSecret := strings.TrimSpace(c.JWTSecret)
	if jwtSecret == "" || strings.Contains(jwtSecret, "changeme-secret") {
		problems = append(problems, "JWT_SECRET belum aman (masih default/kosong)")
	}
	if len(jwtSecret) > 0 && len(jwtSecret) < 32 {
		problems = append(problems, "JWT_SECRET minimal 32 karakter")
	}

	sameSite := strings.ToLower(strings.TrimSpace(c.CookieSameSite))
	if sameSite == "" {
		sameSite = "lax"
	}
	switch sameSite {
	case "lax", "strict", "none":
	default:
		problems = append(problems, "COOKIE_SAMESITE harus salah satu: lax|strict|none")
	}
	if sameSite == "none" && !c.CookieSecure {
		problems = append(problems, "COOKIE_SECURE wajib true kalau COOKIE_SAMESITE=none")
	}

	if v := strings.TrimSpace(c.AuthRateLimitMax); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			problems = append(problems, "AUTH_RATE_LIMIT_MAX harus angka > 0")
		}
	}
	if v := strings.TrimSpace(c.AuthRateLimitWindow); v != "" {
		if _, err := time.ParseDuration(v); err != nil {
			problems = append(problems, "AUTH_RATE_LIMIT_WINDOW harus format duration valid (contoh: 1m, 30s)")
		}
	}
	if v := strings.TrimSpace(c.FiveSimHTTPTimeoutSec); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 120 {
			problems = append(problems, "FIVESIM_HTTP_TIMEOUT_SEC harus angka 1-120")
		}
	}
	if v := strings.TrimSpace(c.FiveSimWalletPriceMultiplier); v != "" {
		n, err := strconv.ParseFloat(v, 64)
		if err != nil || n <= 0 || n > 1_000_000 {
			problems = append(problems, "FIVESIM_WALLET_PRICE_MULTIPLIER harus angka > 0 dan <= 1000000")
		}
	}
	if v := strings.TrimSpace(c.FiveSimWalletMinDebit); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 || n > 1_000_000_000 {
			problems = append(problems, "FIVESIM_WALLET_MIN_DEBIT harus angka > 0 dan <= 1000000000")
		}
	}

	if appEnv == "production" {
		if strings.TrimSpace(c.NeticonAPIKey) == "" {
			problems = append(problems, "NETICON_API_KEY wajib diisi di production")
		}
		if strings.TrimSpace(c.NeticonUserID) == "" {
			problems = append(problems, "NETICON_USER_ID wajib diisi di production")
		}
		if strings.TrimSpace(c.NeticonBaseURL) == "" {
			problems = append(problems, "NETICON_BASE_URL wajib diisi di production")
		}
		if strings.TrimSpace(c.FiveSimAPIKey) == "" {
			problems = append(problems, "FIVESIM_API_KEY wajib diisi di production")
		}
	}

	if len(problems) == 0 {
		return nil
	}

	return errors.New(strings.Join(problems, "; "))
}
