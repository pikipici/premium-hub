package config

import (
	"errors"
	"net/url"
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

	validateRate := func(maxRaw, winRaw, maxField, winField string) {
		if v := strings.TrimSpace(maxRaw); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n <= 0 {
				problems = append(problems, maxField+" harus angka > 0")
			}
		}
		if v := strings.TrimSpace(winRaw); v != "" {
			if _, err := time.ParseDuration(v); err != nil {
				problems = append(problems, winField+" harus format duration valid (contoh: 1m, 30s)")
			}
		}
	}

	validateRate(c.ConvertTrackRateLimitMax, c.ConvertTrackRateLimitWindow, "CONVERT_TRACK_RATE_LIMIT_MAX", "CONVERT_TRACK_RATE_LIMIT_WINDOW")
	validateRate(c.ConvertCreateRateLimitMax, c.ConvertCreateRateLimitWindow, "CONVERT_CREATE_RATE_LIMIT_MAX", "CONVERT_CREATE_RATE_LIMIT_WINDOW")
	validateRate(c.ConvertProofRateLimitMax, c.ConvertProofRateLimitWindow, "CONVERT_PROOF_RATE_LIMIT_MAX", "CONVERT_PROOF_RATE_LIMIT_WINDOW")
	validateRate(c.ConvertAdminStatusRateLimitMax, c.ConvertAdminStatusRateLimitWindow, "CONVERT_ADMIN_STATUS_RATE_LIMIT_MAX", "CONVERT_ADMIN_STATUS_RATE_LIMIT_WINDOW")

	if v := strings.TrimSpace(c.ConvertExpiryWorkerInterval); v != "" {
		if _, err := time.ParseDuration(v); err != nil {
			problems = append(problems, "CONVERT_EXPIRY_WORKER_INTERVAL harus format duration valid (contoh: 1m, 30s)")
		}
	}
	if v := strings.TrimSpace(c.ConvertExpiryWorkerBatchLimit); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 10_000 {
			problems = append(problems, "CONVERT_EXPIRY_WORKER_BATCH_LIMIT harus angka 1-10000")
		}
	}

	proofStorageMode := strings.ToLower(strings.TrimSpace(c.ConvertProofStorageMode))
	if proofStorageMode == "" {
		proofStorageMode = "local"
	}
	if proofStorageMode != "local" && proofStorageMode != "r2" {
		problems = append(problems, "CONVERT_PROOF_STORAGE_MODE harus salah satu: local|r2")
	}

	if v := strings.TrimSpace(c.ConvertProofMaxFileMB); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 100 {
			problems = append(problems, "CONVERT_PROOF_MAX_FILE_MB harus angka 1-100")
		}
	}

	if proofStorageMode == "r2" {
		if strings.TrimSpace(c.ConvertProofR2Endpoint) == "" {
			problems = append(problems, "CONVERT_PROOF_R2_ENDPOINT wajib diisi saat CONVERT_PROOF_STORAGE_MODE=r2")
		} else if err := validateHTTPURL(c.ConvertProofR2Endpoint); err != nil {
			problems = append(problems, "CONVERT_PROOF_R2_ENDPOINT tidak valid: "+err.Error())
		}
		if strings.TrimSpace(c.ConvertProofR2Bucket) == "" {
			problems = append(problems, "CONVERT_PROOF_R2_BUCKET wajib diisi saat CONVERT_PROOF_STORAGE_MODE=r2")
		}
		if strings.TrimSpace(c.ConvertProofR2AccessKeyID) == "" {
			problems = append(problems, "CONVERT_PROOF_R2_ACCESS_KEY_ID wajib diisi saat CONVERT_PROOF_STORAGE_MODE=r2")
		}
		if strings.TrimSpace(c.ConvertProofR2SecretAccessKey) == "" {
			problems = append(problems, "CONVERT_PROOF_R2_SECRET_ACCESS_KEY wajib diisi saat CONVERT_PROOF_STORAGE_MODE=r2")
		}
	}

	if v := strings.TrimSpace(c.ConvertProofR2PublicBaseURL); v != "" {
		if err := validateHTTPURL(v); err != nil {
			problems = append(problems, "CONVERT_PROOF_R2_PUBLIC_BASE_URL tidak valid: "+err.Error())
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
	if v := strings.TrimSpace(c.FiveSimReconcileWorkerInterval); v != "" {
		if _, err := time.ParseDuration(v); err != nil {
			problems = append(problems, "FIVESIM_RECONCILE_WORKER_INTERVAL harus format duration valid (contoh: 1m, 30s)")
		}
	}
	if v := strings.TrimSpace(c.FiveSimReconcileWorkerBatchLimit); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 10_000 {
			problems = append(problems, "FIVESIM_RECONCILE_WORKER_BATCH_LIMIT harus angka 1-10000")
		}
	}
	if v := strings.TrimSpace(c.FiveSimReconcileSyncMinAge); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 {
			problems = append(problems, "FIVESIM_RECONCILE_SYNC_MIN_AGE harus format duration valid dan > 0")
		}
	}
	if v := strings.TrimSpace(c.FiveSimOrderMaxWaitingDuration); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 {
			problems = append(problems, "FIVESIM_ORDER_MAX_WAITING_DURATION harus format duration valid dan > 0")
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

func validateHTTPURL(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return errors.New("format URL tidak valid")
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		return errors.New("scheme harus http/https")
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return errors.New("host wajib diisi")
	}
	return nil
}
