package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FiveSimService struct {
	userRepo  *repository.UserRepo
	orderRepo *repository.FiveSimOrderRepo
	client    FiveSimClient
}

type FiveSimBuyActivationInput struct {
	Country    string   `json:"country" binding:"required"`
	Operator   string   `json:"operator"`
	Product    string   `json:"product" binding:"required"`
	Forwarding *bool    `json:"forwarding"`
	Number     string   `json:"number"`
	Reuse      bool     `json:"reuse"`
	Voice      bool     `json:"voice"`
	Ref        string   `json:"ref"`
	MaxPrice   *float64 `json:"max_price"`
}

type FiveSimBuyHostingInput struct {
	Country  string `json:"country" binding:"required"`
	Operator string `json:"operator"`
	Product  string `json:"product" binding:"required"`
}

type FiveSimReuseInput struct {
	Product string `json:"product" binding:"required"`
	Number  string `json:"number" binding:"required"`
}

type FiveSimProviderHistoryInput struct {
	Category string
	Limit    int
	Offset   int
	Order    string
	Reverse  bool
}

func NewFiveSimService(cfg *config.Config, userRepo *repository.UserRepo, orderRepo *repository.FiveSimOrderRepo, client FiveSimClient) *FiveSimService {
	if client == nil {
		client = NewFiveSimClient(cfg)
	}
	return &FiveSimService{
		userRepo:  userRepo,
		orderRepo: orderRepo,
		client:    client,
	}
}

func (s *FiveSimService) GetCatalogCountries(ctx context.Context, userID uuid.UUID) (map[string]any, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, err
	}
	res, err := s.client.GetCountries(ctx)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) GetCatalogProducts(ctx context.Context, userID uuid.UUID, country, operator string) (map[string]any, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, err
	}
	res, err := s.client.GetProducts(ctx, country, operator)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) GetCatalogPrices(ctx context.Context, userID uuid.UUID, country, product string) (map[string]any, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, err
	}
	res, err := s.client.GetPrices(ctx, country, product)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) BuyActivation(ctx context.Context, userID uuid.UUID, input FiveSimBuyActivationInput) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, nil, err
	}

	if strings.TrimSpace(input.Product) == "" {
		return nil, nil, errors.New("product wajib diisi")
	}
	if input.MaxPrice != nil && *input.MaxPrice <= 0 {
		return nil, nil, errors.New("max_price harus lebih dari 0")
	}

	providerOrder, err := s.client.BuyActivation(ctx, input.Country, input.Operator, input.Product, FiveSimBuyActivationOptions{
		Forwarding: input.Forwarding,
		Number:     input.Number,
		Reuse:      input.Reuse,
		Voice:      input.Voice,
		Ref:        input.Ref,
		MaxPrice:   input.MaxPrice,
	})
	if err != nil {
		return nil, nil, s.normalizeProviderErr(err)
	}

	localOrder, err := s.upsertOwnedOrder(userID, "activation", providerOrder)
	if err != nil {
		return nil, nil, err
	}
	return localOrder, providerOrder, nil
}

func (s *FiveSimService) BuyHosting(ctx context.Context, userID uuid.UUID, input FiveSimBuyHostingInput) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, nil, err
	}

	if strings.TrimSpace(input.Product) == "" {
		return nil, nil, errors.New("product wajib diisi")
	}

	providerOrder, err := s.client.BuyHosting(ctx, input.Country, input.Operator, input.Product)
	if err != nil {
		return nil, nil, s.normalizeProviderErr(err)
	}

	localOrder, err := s.upsertOwnedOrder(userID, "hosting", providerOrder)
	if err != nil {
		return nil, nil, err
	}
	return localOrder, providerOrder, nil
}

func (s *FiveSimService) ReuseNumber(ctx context.Context, userID uuid.UUID, input FiveSimReuseInput) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, nil, err
	}

	if strings.TrimSpace(input.Product) == "" {
		return nil, nil, errors.New("product wajib diisi")
	}
	if strings.TrimSpace(input.Number) == "" {
		return nil, nil, errors.New("number wajib diisi")
	}

	providerOrder, err := s.client.ReuseNumber(ctx, input.Product, input.Number)
	if err != nil {
		return nil, nil, s.normalizeProviderErr(err)
	}

	localOrder, err := s.upsertOwnedOrder(userID, "reuse", providerOrder)
	if err != nil {
		return nil, nil, err
	}
	return localOrder, providerOrder, nil
}

func (s *FiveSimService) CheckOrder(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	return s.runOrderAction(ctx, userID, providerOrderID, "check", s.client.CheckOrder)
}

func (s *FiveSimService) FinishOrder(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	return s.runOrderAction(ctx, userID, providerOrderID, "finish", s.client.FinishOrder)
}

func (s *FiveSimService) CancelOrder(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	return s.runOrderAction(ctx, userID, providerOrderID, "cancel", s.client.CancelOrder)
}

func (s *FiveSimService) BanOrder(ctx context.Context, userID uuid.UUID, providerOrderID int64) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	return s.runOrderAction(ctx, userID, providerOrderID, "ban", s.client.BanOrder)
}

func (s *FiveSimService) GetSMSInbox(ctx context.Context, userID uuid.UUID, providerOrderID int64) (map[string]any, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, err
	}

	localOrder, err := s.orderRepo.FindByProviderOrderIDAndUser(providerOrderID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order 5sim tidak ditemukan")
		}
		return nil, errors.New("gagal memuat order 5sim")
	}

	inbox, err := s.client.GetSMSInbox(ctx, providerOrderID)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}

	now := time.Now()
	localOrder.LastSyncedAt = &now
	_ = s.orderRepo.Update(localOrder)

	return inbox, nil
}

func (s *FiveSimService) ListLocalOrders(userID uuid.UUID, page, limit int) ([]model.FiveSimOrder, int64, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	rows, total, err := s.orderRepo.ListByUser(userID, page, limit)
	if err != nil {
		return nil, 0, errors.New("gagal memuat daftar order 5sim")
	}
	return rows, total, nil
}

func (s *FiveSimService) GetProviderProfile(ctx context.Context) (map[string]any, error) {
	res, err := s.client.GetProfile(ctx)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) GetProviderOrderHistory(ctx context.Context, input FiveSimProviderHistoryInput) (map[string]any, error) {
	if input.Limit <= 0 {
		input.Limit = 20
	}
	if input.Limit > 100 {
		input.Limit = 100
	}
	if input.Offset < 0 {
		input.Offset = 0
	}
	if strings.TrimSpace(input.Order) == "" {
		input.Order = "id"
	}
	if strings.TrimSpace(input.Category) == "" {
		input.Category = "activation"
	}

	res, err := s.client.GetProviderOrderHistory(ctx, input.Category, input.Limit, input.Offset, input.Order, input.Reverse)
	if err != nil {
		return nil, s.normalizeProviderErr(err)
	}
	return res, nil
}

func (s *FiveSimService) runOrderAction(
	ctx context.Context,
	userID uuid.UUID,
	providerOrderID int64,
	action string,
	providerFn func(ctx context.Context, providerOrderID int64) (*FiveSimOrderPayload, error),
) (*model.FiveSimOrder, *FiveSimOrderPayload, error) {
	if err := s.ensureUserActive(userID); err != nil {
		return nil, nil, err
	}
	if providerOrderID <= 0 {
		return nil, nil, errors.New("provider_order_id tidak valid")
	}

	localOrder, err := s.orderRepo.FindByProviderOrderIDAndUser(providerOrderID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("order 5sim tidak ditemukan")
		}
		return nil, nil, errors.New("gagal memuat order 5sim")
	}

	providerOrder, err := providerFn(ctx, providerOrderID)
	if err != nil {
		return nil, nil, s.normalizeProviderErr(err)
	}

	if err := s.applySnapshot(localOrder, providerOrder, "", action); err != nil {
		return nil, nil, err
	}

	return localOrder, providerOrder, nil
}

func (s *FiveSimService) upsertOwnedOrder(userID uuid.UUID, orderType string, providerOrder *FiveSimOrderPayload) (*model.FiveSimOrder, error) {
	if providerOrder == nil || providerOrder.ID <= 0 {
		return nil, errors.New("response order 5sim tidak valid")
	}

	row, err := s.orderRepo.FindByProviderOrderID(providerOrder.ID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("gagal memuat order 5sim")
		}
		row = &model.FiveSimOrder{
			UserID:          userID,
			ProviderOrderID: providerOrder.ID,
			OrderType:       orderType,
		}
		if err := s.applySnapshot(row, providerOrder, orderType, "create"); err != nil {
			return nil, err
		}
		if err := s.orderRepo.Create(row); err != nil {
			return nil, errors.New("gagal menyimpan order 5sim")
		}
		return row, nil
	}

	if row.UserID != userID {
		return nil, errors.New("order 5sim milik user lain")
	}
	if err := s.applySnapshot(row, providerOrder, orderType, "sync"); err != nil {
		return nil, err
	}
	if err := s.orderRepo.Update(row); err != nil {
		return nil, errors.New("gagal update order 5sim")
	}
	return row, nil
}

func (s *FiveSimService) applySnapshot(row *model.FiveSimOrder, providerOrder *FiveSimOrderPayload, fallbackType, _ string) error {
	if row == nil || providerOrder == nil {
		return errors.New("snapshot order tidak valid")
	}

	if row.ProviderOrderID == 0 {
		row.ProviderOrderID = providerOrder.ID
	}
	if row.OrderType == "" {
		row.OrderType = strings.TrimSpace(fallbackType)
	}
	if row.OrderType == "" {
		row.OrderType = "activation"
	}

	if v := strings.TrimSpace(providerOrder.Phone); v != "" {
		row.Phone = v
	}
	if v := strings.TrimSpace(providerOrder.Country); v != "" {
		row.Country = v
	}
	if v := strings.TrimSpace(providerOrder.Operator); v != "" {
		row.Operator = v
	}
	if v := strings.TrimSpace(providerOrder.Product); v != "" {
		row.Product = v
	}
	if providerOrder.Price > 0 {
		row.ProviderPrice = providerOrder.Price
	}

	status := strings.ToUpper(strings.TrimSpace(providerOrder.Status))
	if status != "" {
		row.ProviderStatus = status
	}

	raw, err := json.Marshal(providerOrder)
	if err != nil {
		return errors.New("gagal serialisasi snapshot order")
	}
	row.RawPayload = string(raw)
	now := time.Now()
	row.LastSyncedAt = &now

	return nil
}

func (s *FiveSimService) ensureUserActive(userID uuid.UUID) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("user tidak ditemukan")
	}
	if !user.IsActive {
		return errors.New("akun diblokir")
	}
	return nil
}

func (s *FiveSimService) normalizeProviderErr(err error) error {
	if err == nil {
		return nil
	}

	var apiErr *FiveSimAPIError
	if errors.As(err, &apiErr) {
		msg := strings.TrimSpace(apiErr.Message)
		if msg == "" {
			msg = "request ke 5sim gagal"
		}

		switch apiErr.StatusCode {
		case 401, 403:
			return errors.New("autentikasi 5sim gagal, cek API key")
		case 404:
			return errors.New("resource 5sim tidak ditemukan")
		case 429:
			return errors.New("limit request 5sim tercapai, coba lagi sebentar")
		case 503:
			return errors.New("5sim sedang sibuk/offline, coba lagi")
		default:
			if apiErr.StatusCode >= 500 {
				return errors.New("5sim sedang bermasalah, coba lagi")
			}
			if strings.EqualFold(msg, "server offline") {
				return errors.New("server 5sim offline, coba lagi")
			}
			return errors.New(msg)
		}
	}

	return fmt.Errorf("request 5sim gagal: %w", err)
}
