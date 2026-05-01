package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"premiumhub-api/config"
)

func TestTurnstileVerifier(t *testing.T) {
	t.Run("disabled verifier always passes", func(t *testing.T) {
		verifier := NewTurnstileVerifier(&config.Config{
			AuthTurnstileEnabled: false,
		})
		ok, err := verifier.Verify(context.Background(), "", "")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if !ok {
			t.Fatalf("expected ok=true when disabled")
		}
	})

	t.Run("reject when enabled but secret missing", func(t *testing.T) {
		verifier := NewTurnstileVerifier(&config.Config{
			AuthTurnstileEnabled: true,
		})
		ok, err := verifier.Verify(context.Background(), "token", "127.0.0.1")
		if err == nil {
			t.Fatalf("expected config error")
		}
		if ok {
			t.Fatalf("expected ok=false for invalid config")
		}
	})

	t.Run("sends form fields and accepts success response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				t.Fatalf("expected POST, got %s", r.Method)
			}
			if err := r.ParseForm(); err != nil {
				t.Fatalf("parse form: %v", err)
			}
			if r.Form.Get("secret") != "secret-key" {
				t.Fatalf("unexpected secret: %q", r.Form.Get("secret"))
			}
			if r.Form.Get("response") != "token-123" {
				t.Fatalf("unexpected response token: %q", r.Form.Get("response"))
			}
			if r.Form.Get("remoteip") != "1.2.3.4" {
				t.Fatalf("unexpected remoteip: %q", r.Form.Get("remoteip"))
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"success":true}`))
		}))
		defer server.Close()

		verifier := NewTurnstileVerifier(&config.Config{
			AuthTurnstileEnabled: true,
			TurnstileSecretKey:   "secret-key",
			TurnstileVerifyURL:   server.URL,
		})

		ok, err := verifier.Verify(context.Background(), "token-123", "1.2.3.4")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if !ok {
			t.Fatalf("expected success=true from turnstile response")
		}
	})

	t.Run("returns false without error when token missing", func(t *testing.T) {
		verifier := NewTurnstileVerifier(&config.Config{
			AuthTurnstileEnabled: true,
			TurnstileSecretKey:   "secret-key",
		})
		ok, err := verifier.Verify(context.Background(), "", "127.0.0.1")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if ok {
			t.Fatalf("expected ok=false for empty token")
		}
	})

	t.Run("reject invalid turnstile response payload", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"success":`))
		}))
		defer server.Close()

		verifier := NewTurnstileVerifier(&config.Config{
			AuthTurnstileEnabled: true,
			TurnstileSecretKey:   "secret-key",
			TurnstileVerifyURL:   server.URL,
		})

		ok, err := verifier.Verify(context.Background(), "token", "127.0.0.1")
		if err == nil {
			t.Fatalf("expected parse error")
		}
		if ok {
			t.Fatalf("expected ok=false on invalid payload")
		}
	})

	t.Run("reject turnstile non-2xx status", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "blocked", http.StatusForbidden)
		}))
		defer server.Close()

		verifier := NewTurnstileVerifier(&config.Config{
			AuthTurnstileEnabled: true,
			TurnstileSecretKey:   "secret-key",
			TurnstileVerifyURL:   server.URL,
		})

		ok, err := verifier.Verify(context.Background(), "token", "127.0.0.1")
		if err == nil {
			t.Fatalf("expected non-2xx error")
		}
		if ok {
			t.Fatalf("expected ok=false on non-2xx")
		}
	})
}
