package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort, AppEnv                                                      string
	DBHost, DBPort, DBUser, DBPassword, DBName                           string
	JWTSecret, JWTExpiry                                                 string
	MidtransServerKey, MidtransClientKey, MidtransEnv                    string
	NeticonBaseURL, NeticonAPIKey, NeticonUserID, NeticonHTTPTimeoutSec  string
	FiveSimBaseURL, FiveSimAPIKey, FiveSimHTTPTimeoutSec                 string
	FiveSimWalletPriceMultiplier, FiveSimWalletMinDebit                  string
	FiveSimReconcileWorkerInterval, FiveSimReconcileWorkerBatchLimit     string
	FiveSimReconcileSyncMinAge, FiveSimOrderMaxWaitingDuration           string
	FiveSimResolveNotFoundThreshold, FiveSimResolveNotFoundMinAge        string
	FiveSimReconcileWorkerEnabled                                        bool
	WalletTopupExpiryMinutes                                             string
	SMTPHost, SMTPPort, SMTPUser, SMTPPass, FrontendURL                  string
	CookieDomain, CookieSameSite                                         string
	CookieSecure                                                         bool
	GoogleClientID                                                       string
	AuthRateLimitMax, AuthRateLimitWindow                                string
	ConvertTrackRateLimitMax, ConvertTrackRateLimitWindow                string
	ConvertCreateRateLimitMax, ConvertCreateRateLimitWindow              string
	ConvertProofRateLimitMax, ConvertProofRateLimitWindow                string
	ConvertAdminStatusRateLimitMax, ConvertAdminStatusRateLimitWindow    string
	ConvertExpiryWorkerEnabled                                           bool
	ConvertExpiryWorkerInterval, ConvertExpiryWorkerBatchLimit           string
	ConvertProofStorageMode, ConvertProofLocalDir, ConvertProofMaxFileMB string
	ConvertProofR2Endpoint, ConvertProofR2Bucket, ConvertProofR2Region   string
	ConvertProofR2AccessKeyID, ConvertProofR2SecretAccessKey             string
	ConvertProofR2PublicBaseURL, ConvertProofR2Prefix                    string
	ConvertProofR2UploadTimeout                                          string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file")
	}

	appEnv := e("APP_ENV", "development")
	isProd := strings.EqualFold(strings.TrimSpace(appEnv), "production")

	return &Config{
		AppPort:                           e("APP_PORT", "8080"),
		AppEnv:                            appEnv,
		DBHost:                            e("DB_HOST", "localhost"),
		DBPort:                            e("DB_PORT", "5432"),
		DBUser:                            e("DB_USER", "postgres"),
		DBPassword:                        e("DB_PASSWORD", ""),
		DBName:                            e("DB_NAME", "premiumhub"),
		JWTSecret:                         e("JWT_SECRET", "changeme-secret-32chars-minimum!!"),
		JWTExpiry:                         e("JWT_EXPIRY", "24h"),
		MidtransServerKey:                 e("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:                 e("MIDTRANS_CLIENT_KEY", ""),
		MidtransEnv:                       e("MIDTRANS_ENV", "sandbox"),
		NeticonBaseURL:                    e("NETICON_BASE_URL", "https://qris.neticonpay.my.id/qris.php"),
		NeticonAPIKey:                     e("NETICON_API_KEY", ""),
		NeticonUserID:                     e("NETICON_USER_ID", ""),
		NeticonHTTPTimeoutSec:             e("NETICON_HTTP_TIMEOUT_SEC", "10"),
		FiveSimBaseURL:                    e("FIVESIM_BASE_URL", "https://5sim.net/v1"),
		FiveSimAPIKey:                     e("FIVESIM_API_KEY", ""),
		FiveSimHTTPTimeoutSec:             e("FIVESIM_HTTP_TIMEOUT_SEC", "15"),
		FiveSimWalletPriceMultiplier:      e("FIVESIM_WALLET_PRICE_MULTIPLIER", "1"),
		FiveSimWalletMinDebit:             e("FIVESIM_WALLET_MIN_DEBIT", "1"),
		FiveSimReconcileWorkerEnabled:     eb("FIVESIM_RECONCILE_WORKER_ENABLED", true),
		FiveSimReconcileWorkerInterval:    e("FIVESIM_RECONCILE_WORKER_INTERVAL", "1m"),
		FiveSimReconcileWorkerBatchLimit:  e("FIVESIM_RECONCILE_WORKER_BATCH_LIMIT", "200"),
		FiveSimReconcileSyncMinAge:        e("FIVESIM_RECONCILE_SYNC_MIN_AGE", "45s"),
		FiveSimOrderMaxWaitingDuration:    e("FIVESIM_ORDER_MAX_WAITING_DURATION", "15m"),
		FiveSimResolveNotFoundThreshold:   e("FIVESIM_RESOLVE_NOT_FOUND_THRESHOLD", "3"),
		FiveSimResolveNotFoundMinAge:      e("FIVESIM_RESOLVE_NOT_FOUND_MIN_AGE", "3m"),
		WalletTopupExpiryMinutes:          e("WALLET_TOPUP_EXPIRY_MINUTES", "15"),
		SMTPHost:                          e("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:                          e("SMTP_PORT", "587"),
		SMTPUser:                          e("SMTP_USER", ""),
		SMTPPass:                          e("SMTP_PASS", ""),
		FrontendURL:                       e("FRONTEND_URL", "http://localhost:3000"),
		CookieDomain:                      e("COOKIE_DOMAIN", ""),
		CookieSameSite:                    e("COOKIE_SAMESITE", "lax"),
		CookieSecure:                      eb("COOKIE_SECURE", isProd),
		GoogleClientID:                    e("GOOGLE_CLIENT_ID", ""),
		AuthRateLimitMax:                  e("AUTH_RATE_LIMIT_MAX", "20"),
		AuthRateLimitWindow:               e("AUTH_RATE_LIMIT_WINDOW", "1m"),
		ConvertTrackRateLimitMax:          e("CONVERT_TRACK_RATE_LIMIT_MAX", "120"),
		ConvertTrackRateLimitWindow:       e("CONVERT_TRACK_RATE_LIMIT_WINDOW", "1m"),
		ConvertCreateRateLimitMax:         e("CONVERT_CREATE_RATE_LIMIT_MAX", "12"),
		ConvertCreateRateLimitWindow:      e("CONVERT_CREATE_RATE_LIMIT_WINDOW", "1m"),
		ConvertProofRateLimitMax:          e("CONVERT_PROOF_RATE_LIMIT_MAX", "20"),
		ConvertProofRateLimitWindow:       e("CONVERT_PROOF_RATE_LIMIT_WINDOW", "5m"),
		ConvertAdminStatusRateLimitMax:    e("CONVERT_ADMIN_STATUS_RATE_LIMIT_MAX", "120"),
		ConvertAdminStatusRateLimitWindow: e("CONVERT_ADMIN_STATUS_RATE_LIMIT_WINDOW", "1m"),
		ConvertExpiryWorkerEnabled:        eb("CONVERT_EXPIRY_WORKER_ENABLED", true),
		ConvertExpiryWorkerInterval:       e("CONVERT_EXPIRY_WORKER_INTERVAL", "1m"),
		ConvertExpiryWorkerBatchLimit:     e("CONVERT_EXPIRY_WORKER_BATCH_LIMIT", "200"),
		ConvertProofStorageMode:           e("CONVERT_PROOF_STORAGE_MODE", "local"),
		ConvertProofLocalDir:              e("CONVERT_PROOF_LOCAL_DIR", "runtime/convert-proofs"),
		ConvertProofMaxFileMB:             e("CONVERT_PROOF_MAX_FILE_MB", "10"),
		ConvertProofR2Endpoint:            e("CONVERT_PROOF_R2_ENDPOINT", ""),
		ConvertProofR2Bucket:              e("CONVERT_PROOF_R2_BUCKET", ""),
		ConvertProofR2Region:              e("CONVERT_PROOF_R2_REGION", "auto"),
		ConvertProofR2AccessKeyID:         e("CONVERT_PROOF_R2_ACCESS_KEY_ID", ""),
		ConvertProofR2SecretAccessKey:     e("CONVERT_PROOF_R2_SECRET_ACCESS_KEY", ""),
		ConvertProofR2PublicBaseURL:       e("CONVERT_PROOF_R2_PUBLIC_BASE_URL", ""),
		ConvertProofR2Prefix:              e("CONVERT_PROOF_R2_PREFIX", "convert-proofs"),
		ConvertProofR2UploadTimeout:       e("CONVERT_PROOF_R2_UPLOAD_TIMEOUT", "45s"),
	}
}

func e(k, fb string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fb
}

func eb(k string, fb bool) bool {
	v, ok := os.LookupEnv(k)
	if !ok {
		return fb
	}

	s := strings.TrimSpace(strings.ToLower(v))
	switch s {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fb
	}
}
