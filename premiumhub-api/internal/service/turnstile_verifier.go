package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/config"
)

const defaultTurnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type TurnstileVerifier interface {
	Verify(ctx context.Context, token, remoteIP string) (bool, error)
}

type turnstileVerifier struct {
	enabled   bool
	secretKey string
	verifyURL string
	client    *http.Client
}

type turnstileVerifyResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

func NewTurnstileVerifier(cfg *config.Config) TurnstileVerifier {
	timeoutSec := 8
	enabled := false
	secretKey := ""
	verifyURL := defaultTurnstileVerifyURL

	if cfg != nil {
		enabled = cfg.AuthTurnstileEnabled
		secretKey = strings.TrimSpace(cfg.TurnstileSecretKey)
		if v := strings.TrimSpace(cfg.TurnstileVerifyURL); v != "" {
			verifyURL = v
		}
		if n, err := strconv.Atoi(strings.TrimSpace(cfg.TurnstileHTTPTimeoutSec)); err == nil && n > 0 {
			timeoutSec = n
		}
	}

	return &turnstileVerifier{
		enabled:   enabled,
		secretKey: secretKey,
		verifyURL: verifyURL,
		client: &http.Client{
			Timeout: time.Duration(timeoutSec) * time.Second,
		},
	}
}

func (v *turnstileVerifier) Verify(ctx context.Context, token, remoteIP string) (bool, error) {
	if !v.enabled {
		return true, nil
	}
	if strings.TrimSpace(v.secretKey) == "" {
		return false, errors.New("TURNSTILE_SECRET_KEY belum diisi")
	}

	token = strings.TrimSpace(token)
	if token == "" {
		return false, nil
	}

	form := url.Values{}
	form.Set("secret", v.secretKey)
	form.Set("response", token)
	if ip := strings.TrimSpace(remoteIP); ip != "" {
		form.Set("remoteip", ip)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.verifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "premiumhub-api/1.0")

	resp, err := v.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("gagal menghubungi turnstile: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return false, errors.New("gagal membaca response turnstile")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return false, fmt.Errorf("turnstile error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed turnstileVerifyResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return false, errors.New("response turnstile tidak valid")
	}

	return parsed.Success, nil
}
