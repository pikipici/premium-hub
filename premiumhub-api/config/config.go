package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort, AppEnv                                                     string
	DBHost, DBPort, DBUser, DBPassword, DBName                          string
	JWTSecret, JWTExpiry                                                string
	MidtransServerKey, MidtransClientKey, MidtransEnv                   string
	NeticonBaseURL, NeticonAPIKey, NeticonUserID, NeticonHTTPTimeoutSec string
	FiveSimBaseURL, FiveSimAPIKey, FiveSimHTTPTimeoutSec                string
	FiveSimWalletPriceMultiplier, FiveSimWalletMinDebit                 string
	WalletTopupExpiryMinutes                                            string
	SMTPHost, SMTPPort, SMTPUser, SMTPPass, FrontendURL                 string
	CookieDomain, CookieSameSite                                        string
	CookieSecure                                                        bool
	GoogleClientID                                                      string
	AuthRateLimitMax, AuthRateLimitWindow                               string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file")
	}

	appEnv := e("APP_ENV", "development")
	isProd := strings.EqualFold(strings.TrimSpace(appEnv), "production")

	return &Config{
		AppPort:                      e("APP_PORT", "8080"),
		AppEnv:                       appEnv,
		DBHost:                       e("DB_HOST", "localhost"),
		DBPort:                       e("DB_PORT", "5432"),
		DBUser:                       e("DB_USER", "postgres"),
		DBPassword:                   e("DB_PASSWORD", ""),
		DBName:                       e("DB_NAME", "premiumhub"),
		JWTSecret:                    e("JWT_SECRET", "changeme-secret-32chars-minimum!!"),
		JWTExpiry:                    e("JWT_EXPIRY", "24h"),
		MidtransServerKey:            e("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:            e("MIDTRANS_CLIENT_KEY", ""),
		MidtransEnv:                  e("MIDTRANS_ENV", "sandbox"),
		NeticonBaseURL:               e("NETICON_BASE_URL", "https://qris.neticonpay.my.id/qris.php"),
		NeticonAPIKey:                e("NETICON_API_KEY", ""),
		NeticonUserID:                e("NETICON_USER_ID", ""),
		NeticonHTTPTimeoutSec:        e("NETICON_HTTP_TIMEOUT_SEC", "10"),
		FiveSimBaseURL:               e("FIVESIM_BASE_URL", "https://5sim.net/v1"),
		FiveSimAPIKey:                e("FIVESIM_API_KEY", ""),
		FiveSimHTTPTimeoutSec:        e("FIVESIM_HTTP_TIMEOUT_SEC", "15"),
		FiveSimWalletPriceMultiplier: e("FIVESIM_WALLET_PRICE_MULTIPLIER", "1"),
		FiveSimWalletMinDebit:        e("FIVESIM_WALLET_MIN_DEBIT", "1"),
		WalletTopupExpiryMinutes:     e("WALLET_TOPUP_EXPIRY_MINUTES", "15"),
		SMTPHost:                     e("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:                     e("SMTP_PORT", "587"),
		SMTPUser:                     e("SMTP_USER", ""),
		SMTPPass:                     e("SMTP_PASS", ""),
		FrontendURL:                  e("FRONTEND_URL", "http://localhost:3000"),
		CookieDomain:                 e("COOKIE_DOMAIN", ""),
		CookieSameSite:               e("COOKIE_SAMESITE", "lax"),
		CookieSecure:                 eb("COOKIE_SECURE", isProd),
		GoogleClientID:               e("GOOGLE_CLIENT_ID", ""),
		AuthRateLimitMax:             e("AUTH_RATE_LIMIT_MAX", "20"),
		AuthRateLimitWindow:          e("AUTH_RATE_LIMIT_WINDOW", "1m"),
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
