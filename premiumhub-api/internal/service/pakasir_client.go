package service

import (
	"bytes"
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

type PakasirClient interface {
	CreateTransaction(ctx context.Context, method, orderID string, amount int64) (*PakasirCreateResult, []byte, error)
	TransactionDetail(ctx context.Context, orderID string, amount int64) (*PakasirDetailResult, []byte, error)
	TransactionCancel(ctx context.Context, orderID string, amount int64) ([]byte, error)
}

type pakasirHTTPClient struct {
	baseURL string
	project string
	apiKey  string
	client  *http.Client
}

type pakasirCreateTransactionResponse struct {
	Payment struct {
		Project       string `json:"project"`
		OrderID       string `json:"order_id"`
		Amount        int64  `json:"amount"`
		Fee           int64  `json:"fee"`
		TotalPayment  int64  `json:"total_payment"`
		PaymentMethod string `json:"payment_method"`
		PaymentNumber string `json:"payment_number"`
		ExpiredAt     string `json:"expired_at"`
	} `json:"payment"`
}

type pakasirTransactionDetailResponse struct {
	Transaction struct {
		Amount        int64  `json:"amount"`
		OrderID       string `json:"order_id"`
		Project       string `json:"project"`
		Status        string `json:"status"`
		PaymentMethod string `json:"payment_method"`
		CompletedAt   string `json:"completed_at"`
	} `json:"transaction"`
}

type PakasirCreateResult struct {
	OrderID       string
	PaymentMethod string
	PaymentNumber string
	Amount        int64
	Fee           int64
	TotalPayment  int64
	ExpiredAt     time.Time
}

type PakasirDetailResult struct {
	OrderID       string
	Amount        int64
	Status        string
	PaymentMethod string
	CompletedAt   *time.Time
}

var pakasirPaymentMethodSet = map[string]struct{}{
	"qris":           {},
	"cimb_niaga_va":  {},
	"bni_va":         {},
	"sampoerna_va":   {},
	"bnc_va":         {},
	"maybank_va":     {},
	"permata_va":     {},
	"atm_bersama_va": {},
	"artha_graha_va": {},
	"bri_va":         {},
	"paypal":         {},
}

func NewPakasirClient(cfg *config.Config) PakasirClient {
	timeoutSec := 12
	baseURL := "https://app.pakasir.com"
	project := ""
	apiKey := ""

	if cfg != nil {
		if n, err := strconv.Atoi(strings.TrimSpace(cfg.PakasirHTTPTimeoutSec)); err == nil && n > 0 {
			timeoutSec = n
		}
		if v := strings.TrimSpace(cfg.PakasirBaseURL); v != "" {
			baseURL = strings.TrimRight(v, "/")
		}
		project = strings.TrimSpace(cfg.PakasirProject)
		apiKey = strings.TrimSpace(cfg.PakasirAPIKey)
	}

	return &pakasirHTTPClient{
		baseURL: baseURL,
		project: project,
		apiKey:  apiKey,
		client: &http.Client{
			Timeout: time.Duration(timeoutSec) * time.Second,
		},
	}
}

func NormalizePakasirPaymentMethod(raw string) string {
	method := strings.ToLower(strings.TrimSpace(raw))
	if method == "" {
		return ""
	}
	if _, ok := pakasirPaymentMethodSet[method]; ok {
		return method
	}
	return ""
}

func NormalizePakasirStatus(raw string) string {
	status := strings.ToUpper(strings.TrimSpace(raw))
	switch status {
	case "SUCCESS", "PAID", "COMPLETED":
		return "COMPLETED"
	case "CANCELLED", "CANCELED", "DENY", "FAILED", "FAILURE":
		return "FAILED"
	case "EXPIRE", "EXPIRED":
		return "EXPIRED"
	case "PENDING", "WAITING":
		return "PENDING"
	default:
		return status
	}
}

func IsPakasirPaidStatus(raw string) bool {
	return NormalizePakasirStatus(raw) == "COMPLETED"
}

func parsePakasirTimestamp(raw string, fallback time.Time) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	if ts, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return ts.UTC()
	}
	if ts, err := time.Parse(time.RFC3339, raw); err == nil {
		return ts.UTC()
	}
	return fallback
}

func (c *pakasirHTTPClient) CreateTransaction(ctx context.Context, method, orderID string, amount int64) (*PakasirCreateResult, []byte, error) {
	method = NormalizePakasirPaymentMethod(method)
	orderID = strings.TrimSpace(orderID)

	if err := c.validateConfig(); err != nil {
		return nil, nil, err
	}
	if method == "" {
		return nil, nil, errors.New("metode pembayaran tidak valid")
	}
	if orderID == "" {
		return nil, nil, errors.New("order_id wajib diisi")
	}
	if amount <= 0 {
		return nil, nil, errors.New("amount harus lebih dari 0")
	}

	payload := map[string]any{
		"project":  c.project,
		"order_id": orderID,
		"amount":   amount,
		"api_key":  c.apiKey,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/transactioncreate/"+url.PathEscape(method), bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "premiumhub-api/1.0")

	respBody, err := c.do(httpReq)
	if err != nil {
		return nil, nil, err
	}

	var parsed pakasirCreateTransactionResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, respBody, fmt.Errorf("response pakasir transactioncreate tidak valid")
	}

	paymentMethod := NormalizePakasirPaymentMethod(parsed.Payment.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = method
	}
	paymentNumber := strings.TrimSpace(parsed.Payment.PaymentNumber)
	if paymentNumber == "" {
		return nil, respBody, fmt.Errorf("pakasir transactioncreate mengembalikan payment_number kosong")
	}
	orderOut := strings.TrimSpace(parsed.Payment.OrderID)
	if orderOut == "" {
		orderOut = orderID
	}
	amountOut := parsed.Payment.Amount
	if amountOut <= 0 {
		amountOut = amount
	}
	totalPayment := parsed.Payment.TotalPayment
	if totalPayment <= 0 {
		totalPayment = amountOut
	}
	expiredAt := parsePakasirTimestamp(parsed.Payment.ExpiredAt, time.Now().UTC().Add(15*time.Minute))

	return &PakasirCreateResult{
		OrderID:       orderOut,
		PaymentMethod: paymentMethod,
		PaymentNumber: paymentNumber,
		Amount:        amountOut,
		Fee:           parsed.Payment.Fee,
		TotalPayment:  totalPayment,
		ExpiredAt:     expiredAt,
	}, respBody, nil
}

func (c *pakasirHTTPClient) TransactionDetail(ctx context.Context, orderID string, amount int64) (*PakasirDetailResult, []byte, error) {
	orderID = strings.TrimSpace(orderID)
	if err := c.validateConfig(); err != nil {
		return nil, nil, err
	}
	if orderID == "" {
		return nil, nil, errors.New("order_id wajib diisi")
	}
	if amount <= 0 {
		return nil, nil, errors.New("amount harus lebih dari 0")
	}

	query := url.Values{}
	query.Set("project", c.project)
	query.Set("amount", strconv.FormatInt(amount, 10))
	query.Set("order_id", orderID)
	query.Set("api_key", c.apiKey)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/transactiondetail?"+query.Encode(), nil)
	if err != nil {
		return nil, nil, err
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "premiumhub-api/1.0")

	respBody, err := c.do(httpReq)
	if err != nil {
		return nil, nil, err
	}

	var parsed pakasirTransactionDetailResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, respBody, fmt.Errorf("response pakasir transactiondetail tidak valid")
	}

	orderOut := strings.TrimSpace(parsed.Transaction.OrderID)
	if orderOut == "" {
		return nil, respBody, fmt.Errorf("pakasir transactiondetail mengembalikan order_id kosong")
	}
	amountOut := parsed.Transaction.Amount
	if amountOut <= 0 {
		amountOut = amount
	}
	paymentMethod := NormalizePakasirPaymentMethod(parsed.Transaction.PaymentMethod)
	status := NormalizePakasirStatus(parsed.Transaction.Status)

	var completedAt *time.Time
	if strings.TrimSpace(parsed.Transaction.CompletedAt) != "" {
		ts := parsePakasirTimestamp(parsed.Transaction.CompletedAt, time.Now().UTC())
		completedAt = &ts
	}

	return &PakasirDetailResult{
		OrderID:       orderOut,
		Amount:        amountOut,
		Status:        status,
		PaymentMethod: paymentMethod,
		CompletedAt:   completedAt,
	}, respBody, nil
}

func (c *pakasirHTTPClient) TransactionCancel(ctx context.Context, orderID string, amount int64) ([]byte, error) {
	orderID = strings.TrimSpace(orderID)
	if err := c.validateConfig(); err != nil {
		return nil, err
	}
	if orderID == "" {
		return nil, errors.New("order_id wajib diisi")
	}
	if amount <= 0 {
		return nil, errors.New("amount harus lebih dari 0")
	}

	payload := map[string]any{
		"project":  c.project,
		"order_id": orderID,
		"amount":   amount,
		"api_key":  c.apiKey,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/transactioncancel", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "premiumhub-api/1.0")

	return c.do(httpReq)
}

func (c *pakasirHTTPClient) validateConfig() error {
	if strings.TrimSpace(c.project) == "" || strings.TrimSpace(c.apiKey) == "" {
		return errors.New("konfigurasi pakasir belum lengkap")
	}
	if strings.TrimSpace(c.baseURL) == "" {
		return errors.New("PAKASIR_BASE_URL belum diisi")
	}
	return nil
}

func (c *pakasirHTTPClient) do(req *http.Request) ([]byte, error) {
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi pakasir: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca response pakasir")
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("pakasir error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return body, nil
}
