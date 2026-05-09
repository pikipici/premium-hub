package service

import (
	"testing"
	"time"

	"premiumhub-api/config"
)

func TestSosmedProviderSyncWorkerSettingsParsesConfig(t *testing.T) {
	settings := sosmedProviderSyncWorkerSettings(&config.Config{
		SosmedProviderSyncWorkerEnabled:    true,
		SosmedProviderSyncWorkerInterval:   "2m",
		SosmedProviderSyncWorkerBatchLimit: "17",
		SosmedProviderSyncWorkerStaleAfter: "45m",
		SosmedProviderSyncWorkerTimeout:    "12s",
	})

	if !settings.enabled {
		t.Fatalf("expected worker enabled")
	}
	if settings.interval != 2*time.Minute {
		t.Fatalf("expected interval 2m, got %s", settings.interval)
	}
	if settings.batchLimit != 17 {
		t.Fatalf("expected batch limit 17, got %d", settings.batchLimit)
	}
	if settings.staleAfter != 45*time.Minute {
		t.Fatalf("expected stale after 45m, got %s", settings.staleAfter)
	}
	if settings.timeout != 12*time.Second {
		t.Fatalf("expected timeout 12s, got %s", settings.timeout)
	}
}

func TestSosmedProviderSyncWorkerSettingsFallsBackToSafeDefaults(t *testing.T) {
	settings := sosmedProviderSyncWorkerSettings(&config.Config{
		SosmedProviderSyncWorkerEnabled:    true,
		SosmedProviderSyncWorkerInterval:   "not-a-duration",
		SosmedProviderSyncWorkerBatchLimit: "0",
		SosmedProviderSyncWorkerStaleAfter: "bad",
		SosmedProviderSyncWorkerTimeout:    "bad",
	})

	if !settings.enabled {
		t.Fatalf("expected worker enabled")
	}
	if settings.interval != time.Minute {
		t.Fatalf("expected fallback interval 1m, got %s", settings.interval)
	}
	if settings.batchLimit != 20 {
		t.Fatalf("expected fallback batch limit 20, got %d", settings.batchLimit)
	}
	if settings.staleAfter != 30*time.Minute {
		t.Fatalf("expected fallback stale after 30m, got %s", settings.staleAfter)
	}
	if settings.timeout != 45*time.Second {
		t.Fatalf("expected fallback timeout 45s, got %s", settings.timeout)
	}
}

func TestSosmedProviderSyncWorkerSettingsClampsUnsafeConfig(t *testing.T) {
	t.Run("minimums", func(t *testing.T) {
		settings := sosmedProviderSyncWorkerSettings(&config.Config{
			SosmedProviderSyncWorkerEnabled:    true,
			SosmedProviderSyncWorkerInterval:   "1ns",
			SosmedProviderSyncWorkerBatchLimit: "1",
			SosmedProviderSyncWorkerStaleAfter: "1ns",
			SosmedProviderSyncWorkerTimeout:    "1ns",
		})

		if settings.interval != 30*time.Second {
			t.Fatalf("expected minimum interval 30s, got %s", settings.interval)
		}
		if settings.batchLimit != 1 {
			t.Fatalf("expected minimum batch limit 1, got %d", settings.batchLimit)
		}
		if settings.staleAfter != 5*time.Minute {
			t.Fatalf("expected minimum stale after 5m, got %s", settings.staleAfter)
		}
		if settings.timeout != 5*time.Second {
			t.Fatalf("expected minimum timeout 5s, got %s", settings.timeout)
		}
	})

	t.Run("maximums", func(t *testing.T) {
		settings := sosmedProviderSyncWorkerSettings(&config.Config{
			SosmedProviderSyncWorkerEnabled:    true,
			SosmedProviderSyncWorkerInterval:   "48h",
			SosmedProviderSyncWorkerBatchLimit: "9999",
			SosmedProviderSyncWorkerStaleAfter: "72h",
			SosmedProviderSyncWorkerTimeout:    "1h",
		})

		if settings.interval != 30*time.Minute {
			t.Fatalf("expected maximum interval 30m, got %s", settings.interval)
		}
		if settings.batchLimit != 100 {
			t.Fatalf("expected maximum batch limit 100, got %d", settings.batchLimit)
		}
		if settings.staleAfter != 24*time.Hour {
			t.Fatalf("expected maximum stale after 24h, got %s", settings.staleAfter)
		}
		if settings.timeout != 5*time.Minute {
			t.Fatalf("expected maximum timeout 5m, got %s", settings.timeout)
		}
	})
}
