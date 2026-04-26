package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"premiumhub-api/config"
)

type JAPService struct {
	cfg    *config.Config
	client JAPClient
}

func NewJAPService(cfg *config.Config, client JAPClient) *JAPService {
	if client == nil {
		client = NewJAPClient(cfg)
	}

	return &JAPService{
		cfg:    cfg,
		client: client,
	}
}

func (s *JAPService) GetBalance(ctx context.Context) (*JAPBalanceResponse, error) {
	if err := s.ensureConfigured(); err != nil {
		return nil, err
	}

	res, err := s.client.GetBalance(ctx)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *JAPService) GetServices(ctx context.Context) ([]JAPServiceItem, error) {
	if err := s.ensureConfigured(); err != nil {
		return nil, err
	}

	res, err := s.client.GetServices(ctx)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *JAPService) AddOrder(ctx context.Context, input JAPAddOrderInput) (*JAPAddOrderResponse, error) {
	if err := s.ensureConfigured(); err != nil {
		return nil, err
	}

	input.ServiceID = strings.TrimSpace(input.ServiceID)
	input.Link = strings.TrimSpace(input.Link)
	if input.ServiceID == "" {
		return nil, errors.New("service JAP wajib diisi")
	}
	if input.Link == "" {
		return nil, errors.New("target link JAP wajib diisi")
	}
	if input.Quantity <= 0 {
		return nil, errors.New("quantity JAP tidak valid")
	}

	res, err := s.client.AddOrder(ctx, input)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *JAPService) GetOrderStatus(ctx context.Context, orderID string) (*JAPOrderStatusResponse, error) {
	if err := s.ensureConfigured(); err != nil {
		return nil, err
	}

	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return nil, errors.New("provider order id JAP wajib diisi")
	}

	res, err := s.client.GetOrderStatus(ctx, orderID)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *JAPService) RequestRefill(ctx context.Context, orderID string) error {
	if err := s.ensureConfigured(); err != nil {
		return err
	}

	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return errors.New("provider order id JAP wajib diisi untuk refill")
	}

	if err := s.client.RequestRefill(ctx, orderID); err != nil {
		return s.normalizeProviderErr(err)
	}
	return nil
}

func (s *JAPService) ensureConfigured() error {
	if s == nil || s.cfg == nil {
		return errors.New("konfigurasi JAP belum siap")
	}
	if strings.TrimSpace(s.cfg.JAPAPIKey) == "" {
		return errors.New("konfigurasi JAP_API_KEY belum diisi")
	}
	if strings.TrimSpace(s.cfg.JAPAPIURL) == "" {
		return errors.New("konfigurasi JAP_API_URL belum diisi")
	}
	return nil
}

func (s *JAPService) normalizeProviderErr(err error) error {
	if err == nil {
		return nil
	}

	var apiErr *JAPAPIError
	if errors.As(err, &apiErr) {
		msg := strings.TrimSpace(apiErr.Message)
		if msg == "" {
			msg = "request ke JAP gagal"
		}

		lowerMsg := strings.ToLower(msg)
		switch {
		case strings.Contains(lowerMsg, "api key"):
			return errors.New("autentikasi JAP gagal, cek API key")
		case apiErr.StatusCode == http.StatusUnauthorized || apiErr.StatusCode == http.StatusForbidden:
			return errors.New("autentikasi JAP gagal, cek API key")
		case apiErr.StatusCode == http.StatusTooManyRequests:
			return errors.New("limit request JAP tercapai, coba lagi sebentar")
		case apiErr.StatusCode >= 500:
			return errors.New("JAP sedang bermasalah, coba lagi")
		default:
			return errors.New(msg)
		}
	}

	return fmt.Errorf("request ke JAP gagal: %w", err)
}
