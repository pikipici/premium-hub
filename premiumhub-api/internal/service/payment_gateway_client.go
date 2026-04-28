package service

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/url"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/config"
)

const (
	paymentGatewayProviderDuitku  = "duitku"
	paymentGatewayProviderPakasir = "pakasir"
	defaultDuitkuPaymentMethod    = "SP"
	defaultPakasirPaymentMethod   = "qris"
)

type PaymentGatewayClient interface {
	CreateTransaction(ctx context.Context, input GatewayCreateTransactionInput) (*GatewayCreateResult, []byte, error)
	TransactionDetail(ctx context.Context, merchantOrderID string, amount int64) (*GatewayDetailResult, []byte, error)
	ListPaymentMethods(ctx context.Context, amount int64) ([]GatewayPaymentMethod, []byte, error)
}

type GatewayCreateTransactionInput struct {
	PaymentMethod       string
	OrderID             string
	Amount              int64
	ProductDetails      string
	CustomerName        string
	Email               string
	PhoneNumber         string
	CallbackURL         string
	ReturnURL           string
	ExpiryPeriodMinutes int
}

type GatewayCreateResult struct {
	OrderID       string
	Reference     string
	PaymentMethod string
	PaymentNumber string
	PaymentURL    string
	AppURL        string
	Amount        int64
	Fee           int64
	TotalPayment  int64
	ExpiredAt     time.Time
}

type GatewayDetailResult struct {
	OrderID       string
	Reference     string
	Amount        int64
	Status        string
	PaymentMethod string
	CompletedAt   *time.Time
}

type GatewayPaymentMethod struct {
	Method string
	Name   string
	Image  string
	Fee    string
}

var duitkuPaymentMethodSet = map[string]struct{}{
	"VC": {}, "BC": {}, "M2": {}, "VA": {}, "I1": {}, "B1": {}, "BT": {}, "A1": {},
	"AG": {}, "NC": {}, "BR": {}, "S1": {}, "DM": {}, "BV": {}, "FT": {}, "IR": {},
	"OV": {}, "SA": {}, "LF": {}, "LA": {}, "DA": {}, "SL": {}, "OL": {}, "SP": {},
	"NQ": {}, "GQ": {}, "SQ": {}, "DN": {}, "AT": {}, "JP": {}, "T1": {}, "T2": {},
	"T3": {}, "BQ": {}, "IQ": {}, "DQ": {}, "QD": {}, "LQ": {}, "A2": {},
}

var duitkuPaymentMethodAliases = map[string]string{
	"QRIS":           "SP",
	"QR":             "SP",
	"SHOPEEPAY_QRIS": "SP",
	"NOBU_QRIS":      "NQ",
	"BRI_VA":         "BR",
	"BRIVA":          "BR",
	"BNI_VA":         "I1",
	"PERMATA_VA":     "BT",
	"MAYBANK_VA":     "VA",
	"MANDIRI_VA":     "M2",
	"BCA_VA":         "BC",
	"CIMB_NIAGA_VA":  "B1",
	"BNC_VA":         "NC",
	"SAMPOERNA_VA":   "S1",
	"BSI_VA":         "BV",
	"ATM_BERSAMA_VA": "A1",
	"ARTHA_GRAHA_VA": "AG",
	"DANA":           "DA",
	"OVO":            "OV",
	"SHOPEEPAY":      "SA",
	"LINKAJA":        "LF",
	"LINKAJA_QRIS":   "LQ",
	"DANA_QRIS":      "DQ",
	"DUITKU_QRIS":    "QD",
	"BNC_QRIS":       "BQ",
	"BNI_QRIS":       "IQ",
	"POS_INDONESIA":  "A2",
}

var pakasirPaymentMethodSet = map[string]struct{}{
	"cimb_niaga_va":  {},
	"bni_va":         {},
	"qris":           {},
	"sampoerna_va":   {},
	"bnc_va":         {},
	"maybank_va":     {},
	"permata_va":     {},
	"atm_bersama_va": {},
	"artha_graha_va": {},
	"bri_va":         {},
	"paypal":         {},
}

var pakasirPaymentMethodAliases = map[string]string{
	"QRIS":           "qris",
	"QR":             "qris",
	"SP":             "qris",
	"CIMB_NIAGA_VA":  "cimb_niaga_va",
	"B1":             "cimb_niaga_va",
	"BNI_VA":         "bni_va",
	"I1":             "bni_va",
	"SAMPOERNA_VA":   "sampoerna_va",
	"S1":             "sampoerna_va",
	"BNC_VA":         "bnc_va",
	"NC":             "bnc_va",
	"MAYBANK_VA":     "maybank_va",
	"VA":             "maybank_va",
	"PERMATA_VA":     "permata_va",
	"BT":             "permata_va",
	"ATM_BERSAMA_VA": "atm_bersama_va",
	"A1":             "atm_bersama_va",
	"ARTHA_GRAHA_VA": "artha_graha_va",
	"AG":             "artha_graha_va",
	"BRI_VA":         "bri_va",
	"BRIVA":          "bri_va",
	"BR":             "bri_va",
	"PAYPAL":         "paypal",
}

func NewPaymentGatewayClient(cfg *config.Config) PaymentGatewayClient {
	if PaymentGatewayProvider(cfg) == paymentGatewayProviderPakasir {
		return NewPakasirClient(cfg)
	}
	return NewDuitkuClient(cfg)
}

func PaymentGatewayProvider(cfg *config.Config) string {
	if cfg == nil {
		return paymentGatewayProviderDuitku
	}
	return normalizePaymentGatewayProvider(cfg.PaymentGatewayProvider)
}

func normalizePaymentGatewayProvider(raw string) string {
	provider := strings.ToLower(strings.TrimSpace(raw))
	switch provider {
	case "", paymentGatewayProviderDuitku:
		return paymentGatewayProviderDuitku
	case paymentGatewayProviderPakasir:
		return paymentGatewayProviderPakasir
	default:
		return provider
	}
}

func DefaultPaymentGatewayMethod(cfg *config.Config) string {
	if PaymentGatewayProvider(cfg) == paymentGatewayProviderPakasir {
		return defaultPakasirPaymentMethod
	}
	return defaultDuitkuPaymentMethod
}

func NormalizePaymentGatewayMethod(raw string) string {
	return NormalizePaymentGatewayMethodForProvider(paymentGatewayProviderDuitku, raw)
}

func NormalizePaymentGatewayMethodForProvider(provider, raw string) string {
	if normalizePaymentGatewayProvider(provider) == paymentGatewayProviderPakasir {
		return normalizePakasirPaymentMethod(raw)
	}
	return normalizeDuitkuPaymentMethod(raw)
}

func normalizeDuitkuPaymentMethod(raw string) string {
	method := strings.ToUpper(strings.TrimSpace(raw))
	if method == "" {
		return ""
	}
	method = strings.ReplaceAll(method, "-", "_")
	method = strings.ReplaceAll(method, " ", "_")
	if alias, ok := duitkuPaymentMethodAliases[method]; ok {
		method = alias
	}
	if _, ok := duitkuPaymentMethodSet[method]; ok {
		return method
	}
	if isLikelyDuitkuPaymentMethod(method) {
		return method
	}
	return ""
}

func normalizePakasirPaymentMethod(raw string) string {
	method := strings.TrimSpace(raw)
	if method == "" {
		return ""
	}
	aliasKey := strings.ToUpper(method)
	aliasKey = strings.ReplaceAll(aliasKey, "-", "_")
	aliasKey = strings.ReplaceAll(aliasKey, " ", "_")
	if alias, ok := pakasirPaymentMethodAliases[aliasKey]; ok {
		return alias
	}

	method = strings.ToLower(method)
	method = strings.ReplaceAll(method, "-", "_")
	method = strings.ReplaceAll(method, " ", "_")
	if _, ok := pakasirPaymentMethodSet[method]; ok {
		return method
	}
	return ""
}

func isLikelyDuitkuPaymentMethod(method string) bool {
	if len(method) != 2 {
		return false
	}
	for _, char := range method {
		if (char < 'A' || char > 'Z') && (char < '0' || char > '9') {
			return false
		}
	}
	return true
}

func NormalizePaymentGatewayStatus(raw string) string {
	status := strings.ToUpper(strings.TrimSpace(raw))
	switch status {
	case "0", "00", "SUCCESS", "PAID", "COMPLETED":
		return "COMPLETED"
	case "1", "01", "PENDING", "WAITING", "PROCESS", "PROCESSING":
		return "PENDING"
	case "2", "02", "CANCEL", "CANCELED", "CANCELLED", "DENY", "FAILED", "FAILURE":
		return "FAILED"
	case "EXPIRE", "EXPIRED":
		return "EXPIRED"
	default:
		return status
	}
}

func IsPaymentGatewayPaidStatus(raw string) bool {
	return NormalizePaymentGatewayStatus(raw) == "COMPLETED"
}

func BuildDuitkuInquirySignature(merchantCode, merchantOrderID string, amount int64, apiKey string) string {
	return md5Hex(strings.TrimSpace(merchantCode) + strings.TrimSpace(merchantOrderID) + strconv.FormatInt(amount, 10) + strings.TrimSpace(apiKey))
}

func BuildDuitkuStatusSignature(merchantCode, merchantOrderID, apiKey string) string {
	return md5Hex(strings.TrimSpace(merchantCode) + strings.TrimSpace(merchantOrderID) + strings.TrimSpace(apiKey))
}

func BuildDuitkuCallbackSignature(merchantCode string, amount int64, merchantOrderID, apiKey string) string {
	return md5Hex(strings.TrimSpace(merchantCode) + strconv.FormatInt(amount, 10) + strings.TrimSpace(merchantOrderID) + strings.TrimSpace(apiKey))
}

func BuildDuitkuPaymentMethodSignature(merchantCode string, amount int64, datetime, apiKey string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(merchantCode) + strconv.FormatInt(amount, 10) + strings.TrimSpace(datetime) + strings.TrimSpace(apiKey)))
	return hex.EncodeToString(sum[:])
}

func ValidateDuitkuCallbackSignature(merchantCode string, amount int64, merchantOrderID, apiKey, signature string) bool {
	expected := BuildDuitkuCallbackSignature(merchantCode, amount, merchantOrderID, apiKey)
	actual := strings.ToLower(strings.TrimSpace(signature))
	if actual == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(actual)) == 1
}

func md5Hex(raw string) string {
	sum := md5.Sum([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func gatewayConfigured(cfg *config.Config, client PaymentGatewayClient) bool {
	if cfg == nil || client == nil {
		return false
	}
	return gatewayCredentialsConfigured(cfg)
}

func gatewayCredentialsConfigured(cfg *config.Config) bool {
	if cfg == nil {
		return false
	}
	switch PaymentGatewayProvider(cfg) {
	case paymentGatewayProviderPakasir:
		return strings.TrimSpace(cfg.PakasirProject) != "" && strings.TrimSpace(cfg.PakasirAPIKey) != ""
	default:
		return strings.TrimSpace(cfg.DuitkuMerchantCode) != "" && strings.TrimSpace(cfg.DuitkuAPIKey) != ""
	}
}

func configuredGatewayProject(cfg *config.Config) string {
	if cfg == nil {
		return ""
	}
	if PaymentGatewayProvider(cfg) == paymentGatewayProviderPakasir {
		return strings.TrimSpace(cfg.PakasirProject)
	}
	return strings.TrimSpace(cfg.DuitkuMerchantCode)
}

func gatewayProviderLabel(cfg *config.Config) string {
	return PaymentGatewayProvider(cfg)
}

func defaultGatewayCallbackURL(cfg *config.Config) string {
	if cfg == nil {
		return ""
	}
	if raw := strings.TrimSpace(cfg.PaymentGatewayCallbackURL); raw != "" {
		return raw
	}
	if raw := strings.TrimSpace(cfg.DuitkuCallbackURL); raw != "" {
		return raw
	}
	return joinGatewayPublicURL(cfg.FrontendURL, "/api/v1/payment/webhook")
}

func defaultGatewayReturnURL(cfg *config.Config, fallbackPath string) string {
	if cfg == nil {
		return ""
	}
	if raw := strings.TrimSpace(cfg.PaymentGatewayReturnURL); raw != "" {
		return raw
	}
	if raw := strings.TrimSpace(cfg.DuitkuReturnURL); raw != "" {
		return raw
	}
	return joinGatewayPublicURL(cfg.FrontendURL, fallbackPath)
}

func joinGatewayPublicURL(base, path string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if base == "" {
		return ""
	}
	if strings.TrimSpace(path) == "" {
		return base
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return base + path
}

func gatewayCustomerName(name string) string {
	name = strings.Join(strings.Fields(strings.TrimSpace(name)), " ")
	if name == "" {
		name = "DigiMarket"
	}
	if len(name) > 20 {
		name = strings.TrimSpace(name[:20])
	}
	return name
}
