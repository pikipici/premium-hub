package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort, AppEnv                                    string
	DBHost, DBPort, DBUser, DBPassword, DBName         string
	JWTSecret, JWTExpiry                               string
	MidtransServerKey, MidtransClientKey, MidtransEnv  string
	SMTPHost, SMTPPort, SMTPUser, SMTPPass, FrontendURL string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file")
	}
	return &Config{
		AppPort:           e("APP_PORT", "8080"),
		AppEnv:            e("APP_ENV", "development"),
		DBHost:            e("DB_HOST", "localhost"),
		DBPort:            e("DB_PORT", "5432"),
		DBUser:            e("DB_USER", "postgres"),
		DBPassword:        e("DB_PASSWORD", ""),
		DBName:            e("DB_NAME", "premiumhub"),
		JWTSecret:         e("JWT_SECRET", "changeme-secret-32chars-minimum!!"),
		JWTExpiry:         e("JWT_EXPIRY", "24h"),
		MidtransServerKey: e("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey: e("MIDTRANS_CLIENT_KEY", ""),
		MidtransEnv:       e("MIDTRANS_ENV", "sandbox"),
		SMTPHost:          e("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:          e("SMTP_PORT", "587"),
		SMTPUser:          e("SMTP_USER", ""),
		SMTPPass:          e("SMTP_PASS", ""),
		FrontendURL:       e("FRONTEND_URL", "http://localhost:3000"),
	}
}

func e(k, fb string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fb
}
