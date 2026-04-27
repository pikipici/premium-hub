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

type duitkuHTTPClient struct {
	baseURL      string
	merchantCode string
	apiKey       string
	client       *http.Client
}

type duitkuInquiryRequest struct {
	MerchantCode     string             `json:"merchantCode"`
	PaymentAmount    int64              `json:"paymentAmount"`
	PaymentMethod    string             `json:"paymentMethod"`
	MerchantOrderID  string             `json:"merchantOrderId"`
	ProductDetails   string             `json:"productDetails"`
	AdditionalParam  string             `json:"additionalParam"`
	MerchantUserInfo string             `json:"merchantUserInfo"`
	CustomerVAName   string             `json:"customerVaName"`
	Email            string             `json:"email"`
	PhoneNumber      string             `json:"phoneNumber,omitempty"`
	ItemDetails      []duitkuItemDetail `json:"itemDetails,omitempty"`
	CallbackURL      string             `json:"callbackUrl"`
	ReturnURL        string             `json:"returnUrl"`
	Signature        string             `json:"signature"`
	ExpiryPeriod     int                `json:"expiryPeriod,omitempty"`
}

type duitkuItemDetail struct {
	Name     string `json:"name"`
	Price    int64  `json:"price"`
	Quantity int64  `json:"quantity"`
}

type duitkuInquiryResponse struct {
	MerchantCode  string       `json:"merchantCode"`
	Reference     string       `json:"reference"`
	PaymentURL    string       `json:"paymentUrl"`
	VANumber      string       `json:"vaNumber"`
	QRString      string       `json:"qrString"`
	AppURL        string       `json:"appUrl"`
	AppURLLegacy  string       `json:"AppUrl"`
	Amount        duitkuAmount `json:"amount"`
	StatusCode    duitkuString `json:"statusCode"`
	StatusMessage duitkuString `json:"statusMessage"`
}

type duitkuStatusRequest struct {
	MerchantCode    string `json:"merchantCode"`
	MerchantOrderID string `json:"merchantOrderId"`
	Signature       string `json:"signature"`
}

type duitkuStatusResponse struct {
	MerchantOrderID string       `json:"merchantOrderId"`
	Reference       string       `json:"reference"`
	Amount          duitkuAmount `json:"amount"`
	Fee             duitkuAmount `json:"fee"`
	StatusCode      duitkuString `json:"statusCode"`
	StatusMessage   duitkuString `json:"statusMessage"`
}

type duitkuPaymentMethodRequest struct {
	MerchantCode string `json:"merchantcode"`
	Amount       int64  `json:"amount"`
	Datetime     string `json:"datetime"`
	Signature    string `json:"signature"`
}

type duitkuPaymentMethodResponse struct {
	PaymentFee      []duitkuPaymentFee `json:"paymentFee"`
	ResponseCode    string             `json:"responseCode"`
	ResponseMessage string             `json:"responseMessage"`
}

type duitkuPaymentFee struct {
	PaymentMethod string `json:"paymentMethod"`
	PaymentName   string `json:"paymentName"`
	PaymentImage  string `json:"paymentImage"`
	TotalFee      string `json:"totalFee"`
}

type duitkuAmount int64

func (a *duitkuAmount) UnmarshalJSON(raw []byte) error {
	text := strings.TrimSpace(string(raw))
	if text == "" || text == "null" {
		*a = 0
		return nil
	}
	text = strings.Trim(text, `"`)
	if text == "" {
		*a = 0
		return nil
	}
	if strings.Contains(text, ".") {
		text = strings.SplitN(text, ".", 2)[0]
	}
	n, err := strconv.ParseInt(text, 10, 64)
	if err != nil {
		return err
	}
	*a = duitkuAmount(n)
	return nil
}

type duitkuString string

func (s *duitkuString) UnmarshalJSON(raw []byte) error {
	text := strings.TrimSpace(string(raw))
	if text == "" || text == "null" {
		*s = ""
		return nil
	}

	var parsed string
	if err := json.Unmarshal(raw, &parsed); err == nil {
		*s = duitkuString(strings.TrimSpace(parsed))
		return nil
	}

	*s = duitkuString(strings.Trim(text, `"`))
	return nil
}

func (s duitkuString) String() string {
	return string(s)
}

func NewDuitkuClient(cfg *config.Config) PaymentGatewayClient {
	timeoutSec := 12
	baseURL := "https://passport.duitku.com"
	merchantCode := ""
	apiKey := ""

	if cfg != nil {
		if n, err := strconv.Atoi(strings.TrimSpace(cfg.DuitkuHTTPTimeoutSec)); err == nil && n > 0 {
			timeoutSec = n
		}
		if v := strings.TrimSpace(cfg.DuitkuBaseURL); v != "" {
			baseURL = strings.TrimRight(v, "/")
		}
		merchantCode = strings.TrimSpace(cfg.DuitkuMerchantCode)
		apiKey = strings.TrimSpace(cfg.DuitkuAPIKey)
	}

	return &duitkuHTTPClient{
		baseURL:      baseURL,
		merchantCode: merchantCode,
		apiKey:       apiKey,
		client: &http.Client{
			Timeout: time.Duration(timeoutSec) * time.Second,
		},
	}
}

func (c *duitkuHTTPClient) CreateTransaction(ctx context.Context, input GatewayCreateTransactionInput) (*GatewayCreateResult, []byte, error) {
	if err := c.validateConfig(); err != nil {
		return nil, nil, err
	}

	method := NormalizePaymentGatewayMethod(input.PaymentMethod)
	if method == "" {
		method = defaultDuitkuPaymentMethod
	}
	orderID := strings.TrimSpace(input.OrderID)
	if orderID == "" {
		return nil, nil, errors.New("merchantOrderId wajib diisi")
	}
	if len(orderID) > 50 {
		return nil, nil, errors.New("merchantOrderId maksimal 50 karakter")
	}
	if input.Amount <= 0 {
		return nil, nil, errors.New("amount harus lebih dari 0")
	}
	if strings.TrimSpace(input.Email) == "" {
		return nil, nil, errors.New("email pelanggan wajib diisi")
	}
	if strings.TrimSpace(input.CallbackURL) == "" {
		return nil, nil, errors.New("callbackUrl wajib diisi")
	}
	if strings.TrimSpace(input.ReturnURL) == "" {
		return nil, nil, errors.New("returnUrl wajib diisi")
	}

	productDetails := strings.TrimSpace(input.ProductDetails)
	if productDetails == "" {
		productDetails = "Pembayaran DigiMarket"
	}
	if len(productDetails) > 255 {
		productDetails = productDetails[:255]
	}

	expiryMinutes := input.ExpiryPeriodMinutes
	if expiryMinutes <= 0 {
		expiryMinutes = 15
	}

	payload := duitkuInquiryRequest{
		MerchantCode:    c.merchantCode,
		PaymentAmount:   input.Amount,
		PaymentMethod:   method,
		MerchantOrderID: orderID,
		ProductDetails:  productDetails,
		CustomerVAName:  gatewayCustomerName(input.CustomerName),
		Email:           strings.TrimSpace(input.Email),
		PhoneNumber:     strings.TrimSpace(input.PhoneNumber),
		ItemDetails: []duitkuItemDetail{{
			Name:     productDetails,
			Price:    input.Amount,
			Quantity: 1,
		}},
		CallbackURL:  strings.TrimSpace(input.CallbackURL),
		ReturnURL:    strings.TrimSpace(input.ReturnURL),
		Signature:    BuildDuitkuInquirySignature(c.merchantCode, orderID, input.Amount, c.apiKey),
		ExpiryPeriod: expiryMinutes,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/webapi/api/merchant/v2/inquiry", bytes.NewReader(body))
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

	var parsed duitkuInquiryResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, respBody, fmt.Errorf("response duitku inquiry tidak valid")
	}
	statusCode := strings.TrimSpace(parsed.StatusCode.String())
	if statusCode != "" && !isDuitkuInquirySuccess(statusCode) {
		message := strings.TrimSpace(parsed.StatusMessage.String())
		if message == "" {
			message = statusCode
		}
		return nil, respBody, fmt.Errorf("duitku inquiry gagal: %s", message)
	}
	if strings.TrimSpace(parsed.Reference) == "" {
		return nil, respBody, fmt.Errorf("duitku inquiry mengembalikan reference kosong")
	}

	paymentNumber := strings.TrimSpace(parsed.QRString)
	if paymentNumber == "" {
		paymentNumber = strings.TrimSpace(parsed.VANumber)
	}
	if paymentNumber == "" {
		paymentNumber = strings.TrimSpace(parsed.AppURL)
	}
	if paymentNumber == "" {
		paymentNumber = strings.TrimSpace(parsed.AppURLLegacy)
	}
	if paymentNumber == "" {
		paymentNumber = strings.TrimSpace(parsed.PaymentURL)
	}

	amountOut := int64(parsed.Amount)
	if amountOut <= 0 {
		amountOut = input.Amount
	}
	appURL := strings.TrimSpace(parsed.AppURL)
	if appURL == "" {
		appURL = strings.TrimSpace(parsed.AppURLLegacy)
	}

	return &GatewayCreateResult{
		OrderID:       orderID,
		Reference:     strings.TrimSpace(parsed.Reference),
		PaymentMethod: method,
		PaymentNumber: paymentNumber,
		PaymentURL:    strings.TrimSpace(parsed.PaymentURL),
		AppURL:        appURL,
		Amount:        amountOut,
		TotalPayment:  amountOut,
		ExpiredAt:     time.Now().UTC().Add(time.Duration(expiryMinutes) * time.Minute),
	}, respBody, nil
}

func (c *duitkuHTTPClient) TransactionDetail(ctx context.Context, merchantOrderID string, amount int64) (*GatewayDetailResult, []byte, error) {
	if err := c.validateConfig(); err != nil {
		return nil, nil, err
	}
	merchantOrderID = strings.TrimSpace(merchantOrderID)
	if merchantOrderID == "" {
		return nil, nil, errors.New("merchantOrderId wajib diisi")
	}

	payload := duitkuStatusRequest{
		MerchantCode:    c.merchantCode,
		MerchantOrderID: merchantOrderID,
		Signature:       BuildDuitkuStatusSignature(c.merchantCode, merchantOrderID, c.apiKey),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/webapi/api/merchant/transactionStatus", bytes.NewReader(body))
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

	var parsed duitkuStatusResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, respBody, fmt.Errorf("response duitku transactionStatus tidak valid")
	}
	orderOut := strings.TrimSpace(parsed.MerchantOrderID)
	if orderOut == "" {
		orderOut = merchantOrderID
	}
	amountOut := int64(parsed.Amount)
	if amountOut <= 0 {
		amountOut = amount
	}

	return &GatewayDetailResult{
		OrderID:   orderOut,
		Reference: strings.TrimSpace(parsed.Reference),
		Amount:    amountOut,
		Status:    NormalizePaymentGatewayStatus(parsed.StatusCode.String()),
	}, respBody, nil
}

func isDuitkuInquirySuccess(statusCode string) bool {
	switch NormalizePaymentGatewayStatus(statusCode) {
	case "COMPLETED":
		return true
	default:
		return false
	}
}

func (c *duitkuHTTPClient) ListPaymentMethods(ctx context.Context, amount int64) ([]GatewayPaymentMethod, []byte, error) {
	if err := c.validateConfig(); err != nil {
		return nil, nil, err
	}
	if amount <= 0 {
		amount = 10000
	}

	datetime := time.Now().Format("2006-01-02 15:04:05")
	payload := duitkuPaymentMethodRequest{
		MerchantCode: c.merchantCode,
		Amount:       amount,
		Datetime:     datetime,
		Signature:    BuildDuitkuPaymentMethodSignature(c.merchantCode, amount, datetime, c.apiKey),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/webapi/api/merchant/paymentmethod/getpaymentmethod", bytes.NewReader(body))
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

	var parsed duitkuPaymentMethodResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, respBody, fmt.Errorf("response duitku getpaymentmethod tidak valid")
	}

	methods := make([]GatewayPaymentMethod, 0, len(parsed.PaymentFee))
	for _, row := range parsed.PaymentFee {
		method := NormalizePaymentGatewayMethod(row.PaymentMethod)
		if method == "" {
			continue
		}
		methods = append(methods, GatewayPaymentMethod{
			Method: method,
			Name:   strings.TrimSpace(row.PaymentName),
			Image:  strings.TrimSpace(row.PaymentImage),
			Fee:    strings.TrimSpace(row.TotalFee),
		})
	}
	return methods, respBody, nil
}

func (c *duitkuHTTPClient) validateConfig() error {
	if strings.TrimSpace(c.merchantCode) == "" || strings.TrimSpace(c.apiKey) == "" {
		return errors.New("konfigurasi duitku belum lengkap")
	}
	if strings.TrimSpace(c.baseURL) == "" {
		return errors.New("DUITKU_BASE_URL belum diisi")
	}
	return nil
}

func (c *duitkuHTTPClient) do(req *http.Request) ([]byte, error) {
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi duitku: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca response duitku")
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("duitku error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return body, nil
}
