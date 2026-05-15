package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

const (
	DigiConnectBillingSourceNone            = "none"
	DigiConnectBillingSourceDurationPackage = "duration_package"
	DigiConnectBillingSourceWallet          = "wallet"

	DigiConnectBillingDecisionRejected          = "rejected"
	DigiConnectBillingDecisionIncludedInPackage = "included_in_package"
	DigiConnectBillingDecisionCharged           = "charged"

	DigiConnectBillingStatusNone     = "none"
	DigiConnectBillingStatusIncluded = "included"
	DigiConnectBillingStatusCharged  = "charged"
)

var ErrDigiConnectIdempotencyConflict = errors.New("digiconnect idempotency key reused with different payload")

type DigiConnectAPIKeyMaterial struct {
	Plain  string
	Prefix string
	Hash   string
	Masked string
}

type DigiConnectEntitlementState struct {
	Status                      string
	ExpiresAt                   *time.Time
	PayPerRequestEnabled        bool
	OveragePayPerRequestEnabled bool
}

type DigiConnectBillingDecision struct {
	Allowed  bool
	Source   string
	Decision string
	Status   string
	Amount   int64
	Reason   string
}

func GenerateDigiConnectAPIKey() (DigiConnectAPIKeyMaterial, error) {
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return DigiConnectAPIKeyMaterial{}, err
	}
	plain := "dc_live_" + base64.RawURLEncoding.EncodeToString(raw)
	return BuildDigiConnectAPIKeyMaterial(plain), nil
}

func BuildDigiConnectAPIKeyMaterial(plain string) DigiConnectAPIKeyMaterial {
	plain = strings.TrimSpace(plain)
	prefix := plain
	if len(prefix) > 16 {
		prefix = prefix[:16]
	}
	return DigiConnectAPIKeyMaterial{
		Plain:  plain,
		Prefix: prefix,
		Hash:   HashDigiConnectSecret(plain),
		Masked: MaskDigiConnectAPIKey(plain),
	}
}

func HashDigiConnectSecret(value string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(sum[:])
}

func MaskDigiConnectAPIKey(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 12 {
		return value
	}
	return value[:12] + "........" + value[len(value)-4:]
}

func CheckDigiConnectIdempotency(existingPayloadHash, incomingPayloadHash string) error {
	if strings.TrimSpace(existingPayloadHash) == strings.TrimSpace(incomingPayloadHash) {
		return nil
	}
	return ErrDigiConnectIdempotencyConflict
}

func DecideDigiConnectBilling(now time.Time, entitlement *DigiConnectEntitlementState, walletBalance int64, payPerRequestPrice int64, fairUseExceeded bool) DigiConnectBillingDecision {
	if payPerRequestPrice <= 0 {
		payPerRequestPrice = 150
	}
	if entitlement != nil && strings.EqualFold(strings.TrimSpace(entitlement.Status), "active") {
		if entitlement.ExpiresAt == nil || entitlement.ExpiresAt.After(now) {
			if !fairUseExceeded {
				return DigiConnectBillingDecision{Allowed: true, Source: DigiConnectBillingSourceDurationPackage, Decision: DigiConnectBillingDecisionIncludedInPackage, Status: DigiConnectBillingStatusIncluded}
			}
			if entitlement.OveragePayPerRequestEnabled {
				return decideWalletBilling(walletBalance, payPerRequestPrice)
			}
			return DigiConnectBillingDecision{Allowed: false, Source: DigiConnectBillingSourceDurationPackage, Decision: DigiConnectBillingDecisionRejected, Status: DigiConnectBillingStatusNone, Reason: "fair_use_limit_reached"}
		}
	}
	if entitlement != nil && entitlement.PayPerRequestEnabled {
		return decideWalletBilling(walletBalance, payPerRequestPrice)
	}
	return DigiConnectBillingDecision{Allowed: false, Source: DigiConnectBillingSourceNone, Decision: DigiConnectBillingDecisionRejected, Status: DigiConnectBillingStatusNone, Reason: "plan_required"}
}

func decideWalletBilling(walletBalance int64, price int64) DigiConnectBillingDecision {
	if walletBalance < price {
		return DigiConnectBillingDecision{Allowed: false, Source: DigiConnectBillingSourceWallet, Decision: DigiConnectBillingDecisionRejected, Status: DigiConnectBillingStatusNone, Amount: price, Reason: "insufficient_balance"}
	}
	return DigiConnectBillingDecision{Allowed: true, Source: DigiConnectBillingSourceWallet, Decision: DigiConnectBillingDecisionCharged, Status: DigiConnectBillingStatusCharged, Amount: price}
}

type DigiConnectPublicError struct {
	Code       string
	HTTPStatus int
	Message    string
}

func MapDigiConnectPublicError(internalCode string) DigiConnectPublicError {
	switch strings.TrimSpace(internalCode) {
	case "MISSING_API_KEY", "INVALID_API_KEY", "DISABLED_API_KEY", "REVOKED_API_KEY":
		return DigiConnectPublicError{"UNAUTHORIZED", 401, "API key tidak valid atau tidak ditemukan."}
	case "MISSING_INPUT", "INPUT_TOO_LONG", "INVALID_PAYLOAD", "UNKNOWN_SERVICE_ALIAS", "UNSUPPORTED_TYPE":
		return DigiConnectPublicError{"INVALID_PAYLOAD", 400, "Request tidak valid. Periksa field yang wajib diisi."}
	case "NO_ACTIVE_ENTITLEMENT":
		return DigiConnectPublicError{"PLAN_REQUIRED", 403, "DigiConnect belum aktif. Pilih paket untuk mulai menggunakan API."}
	case "ENTITLEMENT_EXPIRED":
		return DigiConnectPublicError{"PLAN_EXPIRED", 403, "Paket DigiConnect sudah berakhir. Perpanjang paket atau aktifkan bayar per request."}
	case "PAY_PER_REQUEST_NOT_ENABLED":
		return DigiConnectPublicError{"PAY_PER_REQUEST_DISABLED", 403, "Mode bayar per request belum aktif."}
	case "WALLET_BALANCE_INSUFFICIENT":
		return DigiConnectPublicError{"INSUFFICIENT_BALANCE", 402, "Saldo tidak cukup untuk request ini."}
	case "RATE_LIMITED", "API_KEY_RATE_LIMITED", "USER_RATE_LIMITED", "IP_RATE_LIMITED":
		return DigiConnectPublicError{"RATE_LIMITED", 429, "Terlalu banyak request. Coba lagi sebentar lagi."}
	case "DAILY_FAIR_USE_EXCEEDED":
		return DigiConnectPublicError{"FAIR_USE_LIMIT_REACHED", 429, "Pemakaian paket hari ini sedang padat. Coba lagi nanti atau gunakan mode per request."}
	case "ABUSE_SUSPECTED", "SOFT_THROTTLED", "CONCURRENCY_LIMITED":
		return DigiConnectPublicError{"SERVICE_BUSY", 503, "Jaringan sedang ramai, coba lagi sebentar lagi."}
	case "NINEROUTER_TIMEOUT":
		return DigiConnectPublicError{"REQUEST_PENDING_VERIFICATION", 202, "Request sedang diverifikasi. Cek status beberapa saat lagi."}
	case "NINEROUTER_HEALTH_FAILED", "NINEROUTER_CONNECT_REFUSED":
		return DigiConnectPublicError{"ROUTER_UNAVAILABLE", 503, "Layanan sedang tidak tersedia. Coba lagi sebentar lagi."}
	case "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD":
		return DigiConnectPublicError{"IDEMPOTENCY_CONFLICT", 409, "Idempotency-Key sudah dipakai untuk payload berbeda."}
	default:
		return DigiConnectPublicError{"INTERNAL_ERROR", 500, "Terjadi kendala sistem. Coba lagi sebentar lagi."}
	}
}
