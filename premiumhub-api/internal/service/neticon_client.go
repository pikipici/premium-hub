package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/config"
)

type NeticonClient interface {
	RequestDeposit(ctx context.Context, amount int64) (*NeticonDepositResult, []byte, error)
	CheckStatus(ctx context.Context, trxID string) (*NeticonStatusResult, []byte, error)
}

type neticonHTTPClient struct {
	endpoint string
	apiKey   string
	userID   string
	client   *http.Client
}

type neticonRequest struct {
	Action string `json:"action"`
	APIKey string `json:"api_key"`
	UserID string `json:"user_id"`
	Amount int64  `json:"amount,omitempty"`
	TrxID  string `json:"trx_id,omitempty"`
}

type NeticonDepositResult struct {
	Result  bool   `json:"result"`
	TrxID   string `json:"trx_id"`
	Amount  int64  `json:"amount"`
	Message string `json:"message"`
}

type NeticonStatusResult struct {
	Result  bool   `json:"result"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

func NewNeticonClient(cfg *config.Config) NeticonClient {
	timeoutSec, err := strconv.Atoi(cfg.NeticonHTTPTimeoutSec)
	if err != nil || timeoutSec <= 0 {
		timeoutSec = 10
	}

	endpoint := strings.TrimSpace(cfg.NeticonBaseURL)
	if endpoint == "" {
		endpoint = "https://qris.neticonpay.my.id/qris.php"
	}

	return &neticonHTTPClient{
		endpoint: endpoint,
		apiKey:   strings.TrimSpace(cfg.NeticonAPIKey),
		userID:   strings.TrimSpace(cfg.NeticonUserID),
		client: &http.Client{
			Timeout: time.Duration(timeoutSec) * time.Second,
		},
	}
}

func (c *neticonHTTPClient) RequestDeposit(ctx context.Context, amount int64) (*NeticonDepositResult, []byte, error) {
	if c.apiKey == "" || c.userID == "" {
		return nil, nil, fmt.Errorf("konfigurasi neticon belum lengkap")
	}

	payload := neticonRequest{
		Action: "request_deposit",
		APIKey: c.apiKey,
		UserID: c.userID,
		Amount: amount,
	}

	body, err := c.postJSON(ctx, payload)
	if err != nil {
		return nil, nil, err
	}

	var res NeticonDepositResult
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, body, fmt.Errorf("response neticon tidak valid")
	}
	if !res.Result {
		if strings.TrimSpace(res.Message) == "" {
			res.Message = "request deposit ditolak"
		}
		return nil, body, errors.New(res.Message)
	}
	if strings.TrimSpace(res.TrxID) == "" {
		return nil, body, fmt.Errorf("trx_id dari neticon kosong")
	}
	if res.Amount <= 0 {
		res.Amount = amount
	}

	return &res, body, nil
}

func (c *neticonHTTPClient) CheckStatus(ctx context.Context, trxID string) (*NeticonStatusResult, []byte, error) {
	if c.apiKey == "" || c.userID == "" {
		return nil, nil, fmt.Errorf("konfigurasi neticon belum lengkap")
	}

	payload := neticonRequest{
		Action: "check_status",
		APIKey: c.apiKey,
		UserID: c.userID,
		TrxID:  trxID,
	}

	body, err := c.postJSON(ctx, payload)
	if err != nil {
		return nil, nil, err
	}

	var res NeticonStatusResult
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, body, fmt.Errorf("response status neticon tidak valid")
	}
	if !res.Result {
		if strings.TrimSpace(res.Message) == "" {
			res.Message = "check status ditolak"
		}
		return nil, body, errors.New(res.Message)
	}
	res.Status = strings.ToLower(strings.TrimSpace(res.Status))
	if res.Status == "" {
		res.Status = "pending"
	}

	return &res, body, nil
}

func (c *neticonHTTPClient) postJSON(ctx context.Context, payload interface{}) ([]byte, error) {
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi neticon: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca response neticon")
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("neticon error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return body, nil
}
