package config

import (
	"errors"
	"strings"
)

func (c *Config) Validate() error {
	var problems []string

	appEnv := strings.ToLower(strings.TrimSpace(c.AppEnv))
	jwtSecret := strings.TrimSpace(c.JWTSecret)
	if jwtSecret == "" || strings.Contains(jwtSecret, "changeme-secret") {
		problems = append(problems, "JWT_SECRET belum aman (masih default/kosong)")
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
	}

	if len(problems) == 0 {
		return nil
	}

	return errors.New(strings.Join(problems, "; "))
}
