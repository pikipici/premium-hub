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

type pakasirHTTPClient struct {
	baseURL string
	project string
	apiKey  string
	client  *http.Client
}

type pakasirCreateRequest struct {
	Project string `json:"project"`
	OrderID string `json:"order_id"`
	Amount  int64  `json:"amount"`
	APIKey  string `json:"api_key"`
}

type pakasirCreateResponse struct {
	Payment pakasirPayment `json:"payment"`
}

type pakasirPayment struct {
	Project       string       `json:"project"`
	OrderID       string       `json:"order_id"`
	Amount        duitkuAmount `json:"amount"`
	Fee           duitkuAmount `json:"fee"`
	TotalPayment  duitkuAmount `json:"total_payment"`
	PaymentMethod string       `json:"payment_method"`
	PaymentNumber string       `json:"payment_number"`
	ExpiredAt     string       `json:"expired_at"`
}

type pakasirTransactionDetailResponse struct {
	Transaction pakasirTransaction `json:"transaction"`
}

type pakasirTransaction struct {
	Project       string       `json:"project"`
	OrderID       string       `json:"order_id"`
	Amount        duitkuAmount `json:"amount"`
	Status        string       `json:"status"`
	PaymentMethod string       `json:"payment_method"`
	CompletedAt   string       `json:"completed_at"`
}

func NewPakasirClient(cfg *config.Config) PaymentGatewayClient {
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

func (c *pakasirHTTPClient) CreateTransaction(ctx context.Context, input GatewayCreateTransactionInput) (*GatewayCreateResult, []byte, error) {
	if err := c.validateConfig(); err != nil {
		return nil, nil, err
	}

	method := NormalizePaymentGatewayMethodForProvider(paymentGatewayProviderPakasir, input.PaymentMethod)
	if method == "" {
		method = defaultPakasirPaymentMethod
	}
	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return nil, nil, errors.New("order_id wajib diisi")
	}
	if input.Amount <= 0 {
		return nil, nil, errors.New("amount harus lebih dari 0")
	}

	payload := pakasirCreateRequest{
		Project: c.project,
		OrderID: orderID,
		Amount:  input.Amount,
		APIKey:  c.apiKey,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}

	endpoint := c.baseURL + "/api/transactioncreate/" + url.PathEscape(method)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "premiumhub-api/1.0")

	respBody, err := c.do(req)
	if err != nil {
		return nil, nil, err
	}

	var parsed pakasirCreateResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, respBody, fmt.Errorf("response pakasir transactioncreate tidak valid")
	}

	payment := parsed.Payment
	if strings.TrimSpace(payment.OrderID) == "" {
		payment.OrderID = orderID
	}
	if strings.TrimSpace(payment.PaymentMethod) == "" {
		payment.PaymentMethod = method
	}

	amountOut := int64(payment.Amount)
	if amountOut <= 0 {
		amountOut = input.Amount
	}
	feeOut := int64(payment.Fee)
	totalOut := int64(payment.TotalPayment)
	if totalOut <= 0 {
		totalOut = amountOut + feeOut
	}
	if totalOut <= 0 {
		totalOut = input.Amount
	}

	expiredAt := parsePakasirTime(payment.ExpiredAt)
	if expiredAt.IsZero() {
		expiryMinutes := input.ExpiryPeriodMinutes
		if expiryMinutes <= 0 {
			expiryMinutes = 15
		}
		expiredAt = time.Now().UTC().Add(time.Duration(expiryMinutes) * time.Minute)
	}

	paymentMethod := NormalizePaymentGatewayMethodForProvider(paymentGatewayProviderPakasir, payment.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = method
	}

	return &GatewayCreateResult{
		OrderID:       strings.TrimSpace(payment.OrderID),
		Reference:     strings.TrimSpace(payment.OrderID),
		PaymentMethod: paymentMethod,
		PaymentNumber: strings.TrimSpace(payment.PaymentNumber),
		PaymentURL:    c.paymentURL(orderID, input.Amount, paymentMethod),
		Amount:        amountOut,
		Fee:           feeOut,
		TotalPayment:  totalOut,
		ExpiredAt:     expiredAt,
	}, respBody, nil
}

func (c *pakasirHTTPClient) TransactionDetail(ctx context.Context, merchantOrderID string, amount int64) (*GatewayDetailResult, []byte, error) {
	if err := c.validateConfig(); err != nil {
		return nil, nil, err
	}
	orderID := strings.TrimSpace(merchantOrderID)
	if orderID == "" {
		return nil, nil, errors.New("order_id wajib diisi")
	}
	if amount <= 0 {
		return nil, nil, errors.New("amount harus lebih dari 0")
	}

	values := url.Values{}
	values.Set("project", c.project)
	values.Set("amount", strconv.FormatInt(amount, 10))
	values.Set("order_id", orderID)
	values.Set("api_key", c.apiKey)
	endpoint := c.baseURL + "/api/transactiondetail?" + values.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "premiumhub-api/1.0")

	respBody, err := c.do(req)
	if err != nil {
		return nil, nil, err
	}

	var parsed pakasirTransactionDetailResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, respBody, fmt.Errorf("response pakasir transactiondetail tidak valid")
	}

	tx := parsed.Transaction
	orderOut := strings.TrimSpace(tx.OrderID)
	if orderOut == "" {
		orderOut = orderID
	}
	amountOut := int64(tx.Amount)
	if amountOut <= 0 {
		amountOut = amount
	}
	var completedAt *time.Time
	if parsedAt := parsePakasirTime(tx.CompletedAt); !parsedAt.IsZero() {
		completedAt = &parsedAt
	}

	return &GatewayDetailResult{
		OrderID:       orderOut,
		Reference:     orderOut,
		Amount:        amountOut,
		Status:        NormalizePaymentGatewayStatus(tx.Status),
		PaymentMethod: NormalizePaymentGatewayMethodForProvider(paymentGatewayProviderPakasir, tx.PaymentMethod),
		CompletedAt:   completedAt,
	}, respBody, nil
}

func (c *pakasirHTTPClient) ListPaymentMethods(ctx context.Context, amount int64) ([]GatewayPaymentMethod, []byte, error) {
	if err := c.validateConfig(); err != nil {
		return nil, nil, err
	}
	select {
	case <-ctx.Done():
		return nil, nil, ctx.Err()
	default:
	}

	methods := []GatewayPaymentMethod{
		{Method: "qris", Name: "QRIS"},
		{Method: "maybank_va", Name: "Maybank VA"},
		{Method: "bni_va", Name: "BNI VA"},
		{Method: "permata_va", Name: "Permata VA"},
		{Method: "cimb_niaga_va", Name: "CIMB Niaga VA"},
		{Method: "atm_bersama_va", Name: "ATM Bersama VA"},
		{Method: "artha_graha_va", Name: "Artha Graha VA"},
		{Method: "bri_va", Name: "BRI VA"},
		{Method: "bnc_va", Name: "BNC VA"},
		{Method: "sampoerna_va", Name: "Sampoerna VA"},
		{Method: "paypal", Name: "PayPal"},
	}
	raw, _ := json.Marshal(map[string]any{
		"provider": "pakasir",
		"methods":  methods,
	})
	return methods, raw, nil
}

func (c *pakasirHTTPClient) paymentURL(orderID string, amount int64, method string) string {
	values := url.Values{}
	values.Set("order_id", strings.TrimSpace(orderID))
	if strings.EqualFold(strings.TrimSpace(method), defaultPakasirPaymentMethod) {
		values.Set("qris_only", "1")
	}
	return c.baseURL + "/pay/" + url.PathEscape(c.project) + "/" + strconv.FormatInt(amount, 10) + "?" + values.Encode()
}

func parsePakasirTime(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}
	}
	if parsed, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return parsed.UTC()
	}
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed.UTC()
	}
	return time.Time{}
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
