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

type FiveSimClient interface {
	GetProfile(ctx context.Context) (map[string]any, error)
	GetCountries(ctx context.Context) (map[string]any, error)
	GetProducts(ctx context.Context, country, operator string) (map[string]any, error)
	GetPrices(ctx context.Context, country, product string) (map[string]any, error)

	BuyActivation(ctx context.Context, country, operator, product string, opts FiveSimBuyActivationOptions) (*FiveSimOrderPayload, error)
	BuyHosting(ctx context.Context, country, operator, product string) (*FiveSimOrderPayload, error)
	ReuseNumber(ctx context.Context, product, number string) (*FiveSimOrderPayload, error)

	CheckOrder(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error)
	FinishOrder(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error)
	CancelOrder(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error)
	BanOrder(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error)
	GetSMSInbox(ctx context.Context, providerOrderID int64) (map[string]any, error)

	GetProviderOrderHistory(ctx context.Context, category string, limit, offset int, order string, reverse bool) (map[string]any, error)
}

type FiveSimBuyActivationOptions struct {
	Forwarding *bool
	Number     string
	Reuse      bool
	Voice      bool
	Ref        string
	MaxPrice   *float64
}

type FiveSimSMS struct {
	ID        int64  `json:"id,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
	Date      string `json:"date,omitempty"`
	Sender    string `json:"sender,omitempty"`
	Text      string `json:"text,omitempty"`
	Code      string `json:"code,omitempty"`
	IsWave    bool   `json:"is_wave,omitempty"`
	WaveUUID  string `json:"wave_uuid,omitempty"`
}

type FiveSimOrderPayload struct {
	ID               int64        `json:"id"`
	Phone            string       `json:"phone"`
	Operator         string       `json:"operator"`
	Product          string       `json:"product"`
	Price            float64      `json:"price"`
	Status           string       `json:"status"`
	Expires          string       `json:"expires"`
	SMS              []FiveSimSMS `json:"sms"`
	CreatedAt        string       `json:"created_at"`
	Forwarding       bool         `json:"forwarding"`
	ForwardingNumber string       `json:"forwarding_number"`
	Country          string       `json:"country"`
}

type FiveSimAPIError struct {
	StatusCode int
	Message    string
	Retryable  bool
}

func (e *FiveSimAPIError) Error() string {
	return e.Message
}

type fiveSimHTTPClient struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewFiveSimClient(cfg *config.Config) FiveSimClient {
	timeoutSec, err := strconv.Atoi(strings.TrimSpace(cfg.FiveSimHTTPTimeoutSec))
	if err != nil || timeoutSec <= 0 {
		timeoutSec = 15
	}

	baseURL := strings.TrimSpace(cfg.FiveSimBaseURL)
	if baseURL == "" {
		baseURL = "https://5sim.net/v1"
	}

	return &fiveSimHTTPClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  strings.TrimSpace(cfg.FiveSimAPIKey),
		client: &http.Client{
			Timeout: time.Duration(timeoutSec) * time.Second,
		},
	}
}

func (c *fiveSimHTTPClient) GetProfile(ctx context.Context) (map[string]any, error) {
	raw, err := c.request(ctx, http.MethodGet, "/user/profile", nil, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeToMap(raw)
}

func (c *fiveSimHTTPClient) GetCountries(ctx context.Context) (map[string]any, error) {
	raw, err := c.request(ctx, http.MethodGet, "/guest/countries", nil, nil, false)
	if err != nil {
		return nil, err
	}
	return decodeToMap(raw)
}

func (c *fiveSimHTTPClient) GetProducts(ctx context.Context, country, operator string) (map[string]any, error) {
	country = cleanOrDefault(country, "any")
	operator = cleanOrDefault(operator, "any")
	path := fmt.Sprintf("/guest/products/%s/%s", url.PathEscape(country), url.PathEscape(operator))

	raw, err := c.request(ctx, http.MethodGet, path, nil, nil, false)
	if err != nil {
		return nil, err
	}
	return decodeToMap(raw)
}

func (c *fiveSimHTTPClient) GetPrices(ctx context.Context, country, product string) (map[string]any, error) {
	q := url.Values{}
	if v := strings.TrimSpace(country); v != "" {
		q.Set("country", v)
	}
	if v := strings.TrimSpace(product); v != "" {
		q.Set("product", v)
	}

	raw, err := c.request(ctx, http.MethodGet, "/guest/prices", q, nil, false)
	if err != nil {
		return nil, err
	}
	return decodeToMap(raw)
}

func (c *fiveSimHTTPClient) BuyActivation(ctx context.Context, country, operator, product string, opts FiveSimBuyActivationOptions) (*FiveSimOrderPayload, error) {
	country = cleanOrDefault(country, "any")
	operator = cleanOrDefault(operator, "any")
	product = strings.TrimSpace(product)
	path := fmt.Sprintf("/user/buy/activation/%s/%s/%s", url.PathEscape(country), url.PathEscape(operator), url.PathEscape(product))

	q := url.Values{}
	if opts.Forwarding != nil {
		q.Set("forwarding", strconv.FormatBool(*opts.Forwarding))
	}
	if v := strings.TrimSpace(opts.Number); v != "" {
		q.Set("number", v)
	}
	if opts.Reuse {
		q.Set("reuse", "1")
	}
	if opts.Voice {
		q.Set("voice", "1")
	}
	if v := strings.TrimSpace(opts.Ref); v != "" {
		q.Set("ref", v)
	}
	if opts.MaxPrice != nil && *opts.MaxPrice > 0 {
		q.Set("maxPrice", strconv.FormatFloat(*opts.MaxPrice, 'f', -1, 64))
	}

	raw, err := c.request(ctx, http.MethodGet, path, q, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeOrderPayload(raw)
}

func (c *fiveSimHTTPClient) BuyHosting(ctx context.Context, country, operator, product string) (*FiveSimOrderPayload, error) {
	country = cleanOrDefault(country, "any")
	operator = cleanOrDefault(operator, "any")
	product = strings.TrimSpace(product)
	path := fmt.Sprintf("/user/buy/hosting/%s/%s/%s", url.PathEscape(country), url.PathEscape(operator), url.PathEscape(product))

	raw, err := c.request(ctx, http.MethodGet, path, nil, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeOrderPayload(raw)
}

func (c *fiveSimHTTPClient) ReuseNumber(ctx context.Context, product, number string) (*FiveSimOrderPayload, error) {
	product = strings.TrimSpace(product)
	number = strings.TrimSpace(number)
	path := fmt.Sprintf("/user/reuse/%s/%s", url.PathEscape(product), url.PathEscape(number))

	raw, err := c.request(ctx, http.MethodGet, path, nil, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeOrderPayload(raw)
}

func (c *fiveSimHTTPClient) CheckOrder(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error) {
	path := fmt.Sprintf("/user/check/%d", providerOrderID)
	raw, err := c.request(ctx, http.MethodGet, path, nil, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeOrderPayload(raw)
}

func (c *fiveSimHTTPClient) FinishOrder(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error) {
	path := fmt.Sprintf("/user/finish/%d", providerOrderID)
	raw, err := c.request(ctx, http.MethodGet, path, nil, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeOrderPayload(raw)
}

func (c *fiveSimHTTPClient) CancelOrder(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error) {
	path := fmt.Sprintf("/user/cancel/%d", providerOrderID)
	raw, err := c.request(ctx, http.MethodGet, path, nil, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeOrderPayload(raw)
}

func (c *fiveSimHTTPClient) BanOrder(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error) {
	path := fmt.Sprintf("/user/ban/%d", providerOrderID)
	raw, err := c.request(ctx, http.MethodGet, path, nil, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeOrderPayload(raw)
}

func (c *fiveSimHTTPClient) GetSMSInbox(ctx context.Context, providerOrderID int64) (map[string]any, error) {
	path := fmt.Sprintf("/user/sms/inbox/%d", providerOrderID)
	raw, err := c.request(ctx, http.MethodGet, path, nil, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeToMap(raw)
}

func (c *fiveSimHTTPClient) GetProviderOrderHistory(ctx context.Context, category string, limit, offset int, order string, reverse bool) (map[string]any, error) {
	q := url.Values{}
	q.Set("category", cleanOrDefault(category, "activation"))
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	if offset > 0 {
		q.Set("offset", strconv.Itoa(offset))
	}
	if strings.TrimSpace(order) != "" {
		q.Set("order", strings.TrimSpace(order))
	}
	q.Set("reverse", strconv.FormatBool(reverse))

	raw, err := c.request(ctx, http.MethodGet, "/user/orders", q, nil, true)
	if err != nil {
		return nil, err
	}
	return decodeToMap(raw)
}

func (c *fiveSimHTTPClient) request(ctx context.Context, method, path string, query url.Values, body any, auth bool) ([]byte, error) {
	if auth && strings.TrimSpace(c.apiKey) == "" {
		return nil, &FiveSimAPIError{StatusCode: http.StatusInternalServerError, Message: "konfigurasi FIVESIM_API_KEY belum diisi"}
	}

	endpoint := c.baseURL + "/" + strings.TrimPrefix(path, "/")
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}

	var bodyReader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("gagal encode payload 5sim")
		}
		bodyReader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request 5sim")
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if auth {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, &FiveSimAPIError{StatusCode: http.StatusBadGateway, Message: "gagal menghubungi 5sim", Retryable: true}
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, &FiveSimAPIError{StatusCode: http.StatusBadGateway, Message: "gagal membaca response 5sim", Retryable: true}
	}

	if resp.StatusCode >= 400 {
		msg := extractProviderMessage(raw)
		if msg == "" {
			msg = fmt.Sprintf("5sim error %d", resp.StatusCode)
		}
		return nil, &FiveSimAPIError{StatusCode: resp.StatusCode, Message: msg, Retryable: resp.StatusCode == 429 || resp.StatusCode == 503}
	}

	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return nil, &FiveSimAPIError{StatusCode: http.StatusBadGateway, Message: "response 5sim kosong", Retryable: true}
	}

	if !looksLikeJSON(trimmed) {
		return nil, &FiveSimAPIError{StatusCode: resp.StatusCode, Message: trimmed, Retryable: strings.Contains(strings.ToLower(trimmed), "server offline") || strings.Contains(strings.ToLower(trimmed), "no free phones")}
	}

	return raw, nil
}

func decodeToMap(raw []byte) (map[string]any, error) {
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, &FiveSimAPIError{StatusCode: http.StatusBadGateway, Message: "response 5sim tidak valid", Retryable: true}
	}
	return out, nil
}

func decodeOrderPayload(raw []byte) (*FiveSimOrderPayload, error) {
	var out FiveSimOrderPayload
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, &FiveSimAPIError{StatusCode: http.StatusBadGateway, Message: "response order 5sim tidak valid", Retryable: true}
	}

	if out.ID <= 0 {
		msg := extractProviderMessage(raw)
		if msg == "" {
			msg = "response order 5sim tidak valid"
		}
		return nil, &FiveSimAPIError{StatusCode: http.StatusBadGateway, Message: msg}
	}

	if out.SMS == nil {
		out.SMS = []FiveSimSMS{}
	}
	return &out, nil
}

func extractProviderMessage(raw []byte) string {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return ""
	}

	if !looksLikeJSON(trimmed) {
		return trimmed
	}

	var m map[string]any
	if err := json.Unmarshal(raw, &m); err == nil {
		for _, k := range []string{"message", "error", "msg", "detail", "text"} {
			if v, ok := m[k]; ok {
				if s := strings.TrimSpace(fmt.Sprint(v)); s != "" {
					return s
				}
			}
		}
	}

	return ""
}

func looksLikeJSON(s string) bool {
	return strings.HasPrefix(s, "{") || strings.HasPrefix(s, "[")
}

func cleanOrDefault(v, fallback string) string {
	t := strings.TrimSpace(v)
	if t == "" {
		return fallback
	}
	return t
}
