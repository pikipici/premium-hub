package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/config"
)

type JAPClient interface {
	GetBalance(ctx context.Context) (*JAPBalanceResponse, error)
	GetServices(ctx context.Context) ([]JAPServiceItem, error)
	AddOrder(ctx context.Context, input JAPAddOrderInput) (*JAPAddOrderResponse, error)
}

type JAPBalanceResponse struct {
	Balance  string `json:"balance"`
	Currency string `json:"currency"`
}

type JAPServiceID string

func (id *JAPServiceID) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		*id = ""
		return nil
	}

	if trimmed[0] == '"' {
		var value string
		if err := json.Unmarshal(trimmed, &value); err != nil {
			return err
		}
		*id = JAPServiceID(strings.TrimSpace(value))
		return nil
	}

	*id = JAPServiceID(string(trimmed))
	return nil
}

type JAPServiceItem struct {
	Service  JAPServiceID `json:"service"`
	Name     string       `json:"name"`
	Type     string       `json:"type"`
	Category string       `json:"category"`
	Rate     string       `json:"rate"`
	Min      string       `json:"min"`
	Max      string       `json:"max"`
	Dripfeed bool         `json:"dripfeed"`
	Refill   bool         `json:"refill"`
	Cancel   bool         `json:"cancel"`
}

type JAPAddOrderInput struct {
	ServiceID string
	Link      string
	Quantity  int64
}

type JAPAddOrderResponse struct {
	Order JAPServiceID `json:"order"`
}

type JAPAPIError struct {
	StatusCode int
	Message    string
	Retryable  bool
}

func (e *JAPAPIError) Error() string {
	return e.Message
}

type japHTTPClient struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewJAPClient(cfg *config.Config) JAPClient {
	timeoutSec := 15
	baseURL := "https://justanotherpanel.com/api/v2"
	apiKey := ""

	if cfg != nil {
		if parsed, err := strconv.Atoi(strings.TrimSpace(cfg.JAPHTTPTimeoutSec)); err == nil && parsed > 0 {
			timeoutSec = parsed
		}
		if value := strings.TrimSpace(cfg.JAPAPIURL); value != "" {
			baseURL = strings.TrimRight(value, "/")
		}
		apiKey = strings.TrimSpace(cfg.JAPAPIKey)
	}

	return &japHTTPClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		client: &http.Client{
			Timeout: time.Duration(timeoutSec) * time.Second,
		},
	}
}

func (c *japHTTPClient) GetBalance(ctx context.Context) (*JAPBalanceResponse, error) {
	raw, err := c.request(ctx, "balance", nil)
	if err != nil {
		return nil, err
	}

	var out JAPBalanceResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: "response balance JAP tidak valid", Retryable: true}
	}
	if strings.TrimSpace(out.Balance) == "" && strings.TrimSpace(out.Currency) == "" {
		if msg := extractJAPProviderMessage(raw); msg != "" {
			return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: msg}
		}
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: "response balance JAP kosong", Retryable: true}
	}

	return &out, nil
}

func (c *japHTTPClient) GetServices(ctx context.Context) ([]JAPServiceItem, error) {
	raw, err := c.request(ctx, "services", nil)
	if err != nil {
		return nil, err
	}

	var out []JAPServiceItem
	if err := json.Unmarshal(raw, &out); err != nil {
		if msg := extractJAPProviderMessage(raw); msg != "" {
			return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: msg}
		}
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: "response services JAP tidak valid", Retryable: true}
	}

	return out, nil
}

func (c *japHTTPClient) AddOrder(ctx context.Context, input JAPAddOrderInput) (*JAPAddOrderResponse, error) {
	extra := url.Values{}
	extra.Set("service", strings.TrimSpace(input.ServiceID))
	extra.Set("link", strings.TrimSpace(input.Link))
	extra.Set("quantity", strconv.FormatInt(input.Quantity, 10))

	raw, err := c.request(ctx, "add", extra)
	if err != nil {
		return nil, err
	}

	var out JAPAddOrderResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		if msg := extractJAPProviderMessage(raw); msg != "" {
			return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: msg}
		}
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: "response add order JAP tidak valid", Retryable: true}
	}
	if strings.TrimSpace(string(out.Order)) == "" {
		if msg := extractJAPProviderMessage(raw); msg != "" {
			return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: msg}
		}
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: "response add order JAP tidak berisi order id", Retryable: true}
	}

	return &out, nil
}

func (c *japHTTPClient) request(ctx context.Context, action string, extra url.Values) ([]byte, error) {
	if strings.TrimSpace(c.baseURL) == "" {
		return nil, &JAPAPIError{StatusCode: http.StatusInternalServerError, Message: "konfigurasi JAP_API_URL belum diisi"}
	}
	if strings.TrimSpace(c.apiKey) == "" {
		return nil, &JAPAPIError{StatusCode: http.StatusInternalServerError, Message: "konfigurasi JAP_API_KEY belum diisi"}
	}

	form := url.Values{}
	form.Set("key", c.apiKey)
	form.Set("action", strings.TrimSpace(action))
	for key, values := range extra {
		for _, value := range values {
			form.Add(key, value)
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request JAP")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "premiumhub-api/1.0")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: "gagal menghubungi JAP", Retryable: true}
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: "gagal membaca response JAP", Retryable: true}
	}

	trimmed := strings.TrimSpace(string(raw))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := extractJAPProviderMessage(raw)
		if msg == "" {
			msg = fmt.Sprintf("JAP error %d", resp.StatusCode)
		}
		return nil, &JAPAPIError{StatusCode: resp.StatusCode, Message: msg, Retryable: resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500}
	}
	if trimmed == "" {
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: "response JAP kosong", Retryable: true}
	}
	if !looksLikeJSON(trimmed) {
		return nil, &JAPAPIError{StatusCode: http.StatusBadGateway, Message: trimmed, Retryable: true}
	}

	return raw, nil
}

func extractJAPProviderMessage(raw []byte) string {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return ""
	}
	if !looksLikeJSON(trimmed) {
		return trimmed
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ""
	}

	for _, key := range []string{"error", "message", "msg", "detail"} {
		if value, ok := payload[key]; ok {
			if text := strings.TrimSpace(fmt.Sprint(value)); text != "" && text != "<nil>" {
				return text
			}
		}
	}

	return ""
}
