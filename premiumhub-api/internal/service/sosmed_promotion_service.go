package service

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	SosmedPromotionTargetService       = "service"
	SosmedPromotionTargetBundleVariant = "bundle_variant"
	SosmedPromotionDiscountPercent     = "percent"
	SosmedPromotionDiscountAmount      = "amount"
)

type SosmedPromotionService struct {
	repo *repository.SosmedPromotionRepo
}

type SosmedPromotionInput struct {
	Name            string `json:"name" binding:"required"`
	TargetType      string `json:"target_type" binding:"required"`
	ServiceID       string `json:"service_id"`
	BundleVariantID string `json:"bundle_variant_id"`
	DiscountType    string `json:"discount_type" binding:"required"`
	DiscountValue   int64  `json:"discount_value" binding:"required"`
	StartsAt        string `json:"starts_at" binding:"required"`
	EndsAt          string `json:"ends_at" binding:"required"`
	IsActive        *bool  `json:"is_active"`
}

type SosmedPromotionPrice struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	DiscountType   string    `json:"discount_type"`
	DiscountValue  int64     `json:"discount_value"`
	OriginalPrice  int64     `json:"original_price"`
	DiscountAmount int64     `json:"discount_amount"`
	FinalPrice     int64     `json:"final_price"`
	StartsAt       time.Time `json:"starts_at"`
	EndsAt         time.Time `json:"ends_at"`
}

func NewSosmedPromotionService(repo *repository.SosmedPromotionRepo) *SosmedPromotionService {
	return &SosmedPromotionService{repo: repo}
}

func CalculateSosmedPromotionPrice(basePrice int64, promo *model.SosmedPromotion) *SosmedPromotionPrice {
	if promo == nil || basePrice <= 0 {
		return nil
	}
	discount := int64(0)
	switch strings.ToLower(strings.TrimSpace(promo.DiscountType)) {
	case SosmedPromotionDiscountPercent:
		if promo.DiscountValue <= 0 {
			return nil
		}
		if promo.DiscountValue > 100 {
			promo.DiscountValue = 100
		}
		discount = int64(math.Floor(float64(basePrice) * float64(promo.DiscountValue) / 100))
	case SosmedPromotionDiscountAmount:
		discount = promo.DiscountValue
	default:
		return nil
	}
	if discount <= 0 {
		return nil
	}
	if discount > basePrice {
		discount = basePrice
	}
	return &SosmedPromotionPrice{
		ID:             promo.ID,
		Name:           promo.Name,
		DiscountType:   promo.DiscountType,
		DiscountValue:  promo.DiscountValue,
		OriginalPrice:  basePrice,
		DiscountAmount: discount,
		FinalPrice:     basePrice - discount,
		StartsAt:       promo.StartsAt,
		EndsAt:         promo.EndsAt,
	}
}

func (s *SosmedPromotionService) List(ctx context.Context) ([]model.SosmedPromotion, error) {
	return s.repo.List(ctx)
}

func (s *SosmedPromotionService) Create(ctx context.Context, input SosmedPromotionInput) (*model.SosmedPromotion, error) {
	item, err := buildSosmedPromotionFromInput(input, nil)
	if err != nil {
		return nil, err
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return nil, errors.New("gagal membuat promo sosmed")
	}
	return s.repo.FindByID(ctx, item.ID)
}

func (s *SosmedPromotionService) Update(ctx context.Context, id uuid.UUID, input SosmedPromotionInput) (*model.SosmedPromotion, error) {
	item, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("promo sosmed tidak ditemukan")
	}
	updated, err := buildSosmedPromotionFromInput(input, item)
	if err != nil {
		return nil, err
	}
	if err := s.repo.Save(ctx, updated); err != nil {
		return nil, errors.New("gagal update promo sosmed")
	}
	return s.repo.FindByID(ctx, id)
}

func (s *SosmedPromotionService) SetActive(ctx context.Context, id uuid.UUID, active bool) (*model.SosmedPromotion, error) {
	item, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("promo sosmed tidak ditemukan")
	}
	item.IsActive = active
	if err := s.repo.Save(ctx, item); err != nil {
		return nil, errors.New("gagal update status promo sosmed")
	}
	return s.repo.FindByID(ctx, id)
}

func (s *SosmedPromotionService) ActiveServicePrice(ctx context.Context, serviceID uuid.UUID, basePrice int64, at time.Time) (*SosmedPromotionPrice, error) {
	promo, err := s.repo.ActiveForService(ctx, serviceID, at)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return CalculateSosmedPromotionPrice(basePrice, promo), nil
}

func (s *SosmedPromotionService) ActiveBundleVariantPrice(ctx context.Context, variantID uuid.UUID, basePrice int64, at time.Time) (*SosmedPromotionPrice, error) {
	promo, err := s.repo.ActiveForBundleVariant(ctx, variantID, at)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return CalculateSosmedPromotionPrice(basePrice, promo), nil
}

func buildSosmedPromotionFromInput(input SosmedPromotionInput, existing *model.SosmedPromotion) (*model.SosmedPromotion, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("nama promo wajib diisi")
	}
	targetType := strings.ToLower(strings.TrimSpace(input.TargetType))
	discountType := strings.ToLower(strings.TrimSpace(input.DiscountType))
	if discountType != SosmedPromotionDiscountPercent && discountType != SosmedPromotionDiscountAmount {
		return nil, errors.New("tipe diskon tidak valid")
	}
	if input.DiscountValue <= 0 {
		return nil, errors.New("nilai diskon wajib lebih dari 0")
	}
	if discountType == SosmedPromotionDiscountPercent && input.DiscountValue > 100 {
		return nil, errors.New("diskon persen maksimal 100")
	}
	startsAt, err := time.Parse(time.RFC3339, strings.TrimSpace(input.StartsAt))
	if err != nil {
		return nil, errors.New("waktu mulai promo tidak valid")
	}
	endsAt, err := time.Parse(time.RFC3339, strings.TrimSpace(input.EndsAt))
	if err != nil {
		return nil, errors.New("waktu akhir promo tidak valid")
	}
	if !endsAt.After(startsAt) {
		return nil, errors.New("waktu akhir promo harus setelah waktu mulai")
	}
	item := existing
	if item == nil {
		item = &model.SosmedPromotion{}
	}
	item.Name = name
	item.TargetType = targetType
	item.DiscountType = discountType
	item.DiscountValue = input.DiscountValue
	item.StartsAt = startsAt
	item.EndsAt = endsAt
	if input.IsActive != nil {
		item.IsActive = *input.IsActive
	} else if existing == nil {
		item.IsActive = true
	}
	item.ServiceID = nil
	item.BundleVariantID = nil
	switch targetType {
	case SosmedPromotionTargetService:
		id, err := uuid.Parse(strings.TrimSpace(input.ServiceID))
		if err != nil {
			return nil, errors.New("service_id promo tidak valid")
		}
		item.ServiceID = &id
	case SosmedPromotionTargetBundleVariant:
		id, err := uuid.Parse(strings.TrimSpace(input.BundleVariantID))
		if err != nil {
			return nil, errors.New("bundle_variant_id promo tidak valid")
		}
		item.BundleVariantID = &id
	default:
		return nil, errors.New("target promo tidak valid")
	}
	return item, nil
}
