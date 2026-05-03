package service

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var sosmedBundlePackageKeyPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,98}$`)
var sosmedBundleVariantKeyPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,98}$`)

type SosmedBundleAdminService struct {
	bundleRepo  *repository.SosmedBundleRepo
	serviceRepo *repository.SosmedServiceRepo
}

type CreateSosmedBundlePackageInput struct {
	Key           string `json:"key" binding:"required"`
	Title         string `json:"title" binding:"required"`
	Subtitle      string `json:"subtitle"`
	Description   string `json:"description"`
	Platform      string `json:"platform" binding:"required"`
	Badge         string `json:"badge"`
	IsHighlighted *bool  `json:"is_highlighted"`
	IsActive      *bool  `json:"is_active"`
	SortOrder     *int   `json:"sort_order"`
}

type UpdateSosmedBundlePackageInput struct {
	Title         *string `json:"title"`
	Subtitle      *string `json:"subtitle"`
	Description   *string `json:"description"`
	Platform      *string `json:"platform"`
	Badge         *string `json:"badge"`
	IsHighlighted *bool   `json:"is_highlighted"`
	IsActive      *bool   `json:"is_active"`
	SortOrder     *int    `json:"sort_order"`
}

type CreateSosmedBundleVariantInput struct {
	Key             string `json:"key" binding:"required"`
	Name            string `json:"name" binding:"required"`
	Description     string `json:"description"`
	PriceMode       string `json:"price_mode"`
	FixedPrice      int64  `json:"fixed_price"`
	DiscountPercent int    `json:"discount_percent"`
	DiscountAmount  int64  `json:"discount_amount"`
	IsActive        *bool  `json:"is_active"`
	SortOrder       *int   `json:"sort_order"`
}

type UpdateSosmedBundleVariantInput struct {
	Name            *string `json:"name"`
	Description     *string `json:"description"`
	PriceMode       *string `json:"price_mode"`
	FixedPrice      *int64  `json:"fixed_price"`
	DiscountPercent *int    `json:"discount_percent"`
	DiscountAmount  *int64  `json:"discount_amount"`
	IsActive        *bool   `json:"is_active"`
	SortOrder       *int    `json:"sort_order"`
}

type CreateSosmedBundleItemInput struct {
	SosmedServiceID uuid.UUID `json:"sosmed_service_id" binding:"required"`
	Label           string    `json:"label"`
	QuantityUnits   int64     `json:"quantity_units" binding:"required"`
	TargetStrategy  string    `json:"target_strategy"`
	IsActive        *bool     `json:"is_active"`
	SortOrder       *int      `json:"sort_order"`
}

type UpdateSosmedBundleItemInput struct {
	SosmedServiceID *uuid.UUID `json:"sosmed_service_id"`
	Label           *string    `json:"label"`
	QuantityUnits   *int64     `json:"quantity_units"`
	TargetStrategy  *string    `json:"target_strategy"`
	IsActive        *bool      `json:"is_active"`
	SortOrder       *int       `json:"sort_order"`
}

func NewSosmedBundleAdminService(bundleRepo *repository.SosmedBundleRepo, serviceRepo *repository.SosmedServiceRepo) *SosmedBundleAdminService {
	return &SosmedBundleAdminService{bundleRepo: bundleRepo, serviceRepo: serviceRepo}
}

func (s *SosmedBundleAdminService) ListPackages(ctx context.Context, includeInactive bool) ([]model.SosmedBundlePackage, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	bundles, err := s.bundleRepo.ListAdminBundles(ctx, includeInactive)
	if err != nil {
		return nil, errors.New("gagal memuat paket bundle sosmed")
	}
	return bundles, nil
}

func (s *SosmedBundleAdminService) GetPackage(ctx context.Context, id uuid.UUID, includeInactive bool) (*model.SosmedBundlePackage, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	pkg, err := s.bundleRepo.GetAdminBundleByID(ctx, id, includeInactive)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("paket bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat paket bundle sosmed")
	}
	return pkg, nil
}

func (s *SosmedBundleAdminService) CreatePackage(ctx context.Context, input CreateSosmedBundlePackageInput) (*model.SosmedBundlePackage, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}

	key := strings.TrimSpace(input.Key)
	if key == "" {
		return nil, errors.New("key paket wajib diisi")
	}
	if err := validateSosmedBundlePackageKey(key); err != nil {
		return nil, err
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("judul paket wajib diisi")
	}
	platform := strings.TrimSpace(input.Platform)
	if platform == "" {
		return nil, errors.New("platform paket wajib diisi")
	}

	if _, err := s.bundleRepo.FindBundleByKeyIncludingInactive(ctx, key); err == nil {
		return nil, errors.New("key paket sudah dipakai")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek duplikasi key paket")
	}

	isHighlighted := false
	if input.IsHighlighted != nil {
		isHighlighted = *input.IsHighlighted
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	sortOrder := 100
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}

	pkg := &model.SosmedBundlePackage{
		Key:           key,
		Title:         title,
		Subtitle:      strings.TrimSpace(input.Subtitle),
		Description:   strings.TrimSpace(input.Description),
		Platform:      platform,
		Badge:         strings.TrimSpace(input.Badge),
		IsHighlighted: isHighlighted,
		IsActive:      isActive,
		SortOrder:     sortOrder,
	}
	if err := s.bundleRepo.CreateBundlePackage(ctx, pkg); err != nil {
		return nil, errors.New("gagal membuat paket bundle sosmed")
	}
	return pkg, nil
}

func (s *SosmedBundleAdminService) UpdatePackage(ctx context.Context, id uuid.UUID, input UpdateSosmedBundlePackageInput) (*model.SosmedBundlePackage, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	pkg, err := s.bundleRepo.GetAdminBundleByID(ctx, id, true)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("paket bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat paket bundle sosmed")
	}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return nil, errors.New("judul paket wajib diisi")
		}
		pkg.Title = title
	}
	if input.Subtitle != nil {
		pkg.Subtitle = strings.TrimSpace(*input.Subtitle)
	}
	if input.Description != nil {
		pkg.Description = strings.TrimSpace(*input.Description)
	}
	if input.Platform != nil {
		platform := strings.TrimSpace(*input.Platform)
		if platform == "" {
			return nil, errors.New("platform paket wajib diisi")
		}
		pkg.Platform = platform
	}
	if input.Badge != nil {
		pkg.Badge = strings.TrimSpace(*input.Badge)
	}
	if input.IsHighlighted != nil {
		pkg.IsHighlighted = *input.IsHighlighted
	}
	if input.IsActive != nil {
		pkg.IsActive = *input.IsActive
	}
	if input.SortOrder != nil {
		pkg.SortOrder = *input.SortOrder
	}

	if err := s.bundleRepo.UpdateBundlePackage(ctx, pkg); err != nil {
		return nil, errors.New("gagal memperbarui paket bundle sosmed")
	}
	return pkg, nil
}

func (s *SosmedBundleAdminService) DeactivatePackage(ctx context.Context, id uuid.UUID) error {
	if err := s.ensureReady(); err != nil {
		return err
	}
	pkg, err := s.bundleRepo.GetAdminBundleByID(ctx, id, true)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("paket bundle sosmed tidak ditemukan")
		}
		return errors.New("gagal memuat paket bundle sosmed")
	}
	if !pkg.IsActive {
		return nil
	}
	pkg.IsActive = false
	if err := s.bundleRepo.UpdateBundlePackage(ctx, pkg); err != nil {
		return errors.New("gagal menonaktifkan paket bundle sosmed")
	}
	return nil
}

func (s *SosmedBundleAdminService) DeletePackage(ctx context.Context, id uuid.UUID) error {
	return s.DeactivatePackage(ctx, id)
}

func (s *SosmedBundleAdminService) ListVariants(ctx context.Context, packageID uuid.UUID, includeInactive bool) ([]model.SosmedBundleVariant, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	pkg, err := s.bundleRepo.GetAdminBundleByID(ctx, packageID, includeInactive)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("paket bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat variant bundle sosmed")
	}
	variants := make([]model.SosmedBundleVariant, 0, len(pkg.Variants))
	for _, variant := range pkg.Variants {
		if includeInactive || variant.IsActive {
			variants = append(variants, variant)
		}
	}
	return variants, nil
}

func (s *SosmedBundleAdminService) GetVariant(ctx context.Context, id uuid.UUID, includeInactive bool) (*model.SosmedBundleVariant, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	variant, err := s.getVariantByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("variant bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat variant bundle sosmed")
	}
	if !includeInactive && (!variant.IsActive || !variant.Package.IsActive) {
		return nil, errors.New("variant bundle sosmed tidak ditemukan")
	}
	return variant, nil
}

func (s *SosmedBundleAdminService) CreateVariant(ctx context.Context, packageID uuid.UUID, input CreateSosmedBundleVariantInput) (*model.SosmedBundleVariant, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	pkg, err := s.bundleRepo.GetAdminBundleByID(ctx, packageID, true)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("paket bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat paket bundle sosmed")
	}

	key := strings.TrimSpace(input.Key)
	if key == "" {
		return nil, errors.New("key variant wajib diisi")
	}
	if err := validateSosmedBundleVariantKey(key); err != nil {
		return nil, err
	}
	if sosmedBundleVariantKeyExists(pkg.Variants, key) {
		return nil, errors.New("key variant sudah dipakai")
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("nama variant wajib diisi")
	}
	priceMode, err := normalizeSosmedBundleVariantPriceMode(input.PriceMode)
	if err != nil {
		return nil, err
	}
	if err := validateSosmedBundleVariantPricing(priceMode, input.FixedPrice, input.DiscountPercent, input.DiscountAmount); err != nil {
		return nil, err
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	sortOrder := 100
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	variant := &model.SosmedBundleVariant{
		BundlePackageID: packageID,
		Key:             key,
		Name:            name,
		Description:     strings.TrimSpace(input.Description),
		PriceMode:       priceMode,
		FixedPrice:      input.FixedPrice,
		DiscountPercent: input.DiscountPercent,
		DiscountAmount:  input.DiscountAmount,
		IsActive:        isActive,
		SortOrder:       sortOrder,
	}
	if err := s.bundleRepo.CreateBundleVariant(ctx, variant); err != nil {
		return nil, errors.New("gagal membuat variant bundle sosmed")
	}
	return variant, nil
}

func (s *SosmedBundleAdminService) UpdateVariant(ctx context.Context, id uuid.UUID, input UpdateSosmedBundleVariantInput) (*model.SosmedBundleVariant, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	variant, err := s.getVariantByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("variant bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat variant bundle sosmed")
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, errors.New("nama variant wajib diisi")
		}
		variant.Name = name
	}
	if input.Description != nil {
		variant.Description = strings.TrimSpace(*input.Description)
	}
	if input.PriceMode != nil {
		priceMode, err := normalizeSosmedBundleVariantPriceMode(*input.PriceMode)
		if err != nil {
			return nil, err
		}
		variant.PriceMode = priceMode
	}
	if input.FixedPrice != nil {
		variant.FixedPrice = *input.FixedPrice
	}
	if input.DiscountPercent != nil {
		variant.DiscountPercent = *input.DiscountPercent
	}
	if input.DiscountAmount != nil {
		variant.DiscountAmount = *input.DiscountAmount
	}
	if input.IsActive != nil {
		variant.IsActive = *input.IsActive
	}
	if input.SortOrder != nil {
		variant.SortOrder = *input.SortOrder
	}
	if err := validateSosmedBundleVariantPricing(variant.PriceMode, variant.FixedPrice, variant.DiscountPercent, variant.DiscountAmount); err != nil {
		return nil, err
	}
	if err := s.bundleRepo.UpdateBundleVariant(ctx, variant); err != nil {
		return nil, errors.New("gagal memperbarui variant bundle sosmed")
	}
	return variant, nil
}

func (s *SosmedBundleAdminService) DeactivateVariant(ctx context.Context, id uuid.UUID) error {
	if err := s.ensureReady(); err != nil {
		return err
	}
	variant, err := s.getVariantByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("variant bundle sosmed tidak ditemukan")
		}
		return errors.New("gagal memuat variant bundle sosmed")
	}
	if !variant.IsActive {
		return nil
	}
	variant.IsActive = false
	if err := s.bundleRepo.UpdateBundleVariant(ctx, variant); err != nil {
		return errors.New("gagal menonaktifkan variant bundle sosmed")
	}
	return nil
}

func (s *SosmedBundleAdminService) DeleteVariant(ctx context.Context, id uuid.UUID) error {
	return s.DeactivateVariant(ctx, id)
}

func (s *SosmedBundleAdminService) ListItems(ctx context.Context, variantID uuid.UUID, includeInactive bool) ([]model.SosmedBundleItem, error) {
	if err := s.ensureItemReady(); err != nil {
		return nil, err
	}
	variant, err := s.getVariantByID(ctx, variantID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("variant bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat item bundle sosmed")
	}
	if !includeInactive && (!variant.IsActive || !variant.Package.IsActive) {
		return nil, errors.New("variant bundle sosmed tidak ditemukan")
	}
	items := make([]model.SosmedBundleItem, 0, len(variant.Items))
	for _, item := range variant.Items {
		if includeInactive || item.IsActive {
			items = append(items, item)
		}
	}
	return items, nil
}

func (s *SosmedBundleAdminService) GetItem(ctx context.Context, id uuid.UUID, includeInactive bool) (*model.SosmedBundleItem, error) {
	if err := s.ensureItemReady(); err != nil {
		return nil, err
	}
	item, err := s.getItemByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("item bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat item bundle sosmed")
	}
	if !includeInactive && (!item.IsActive || !item.Variant.IsActive || !item.Variant.Package.IsActive) {
		return nil, errors.New("item bundle sosmed tidak ditemukan")
	}
	return item, nil
}

func (s *SosmedBundleAdminService) CreateItem(ctx context.Context, variantID uuid.UUID, input CreateSosmedBundleItemInput) (*model.SosmedBundleItem, error) {
	if err := s.ensureItemReady(); err != nil {
		return nil, err
	}
	if _, err := s.getVariantByID(ctx, variantID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("variant bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat variant bundle sosmed")
	}
	service, err := s.loadActiveSosmedService(input.SosmedServiceID)
	if err != nil {
		return nil, err
	}
	if err := validateSosmedBundleItemQuantity(service, input.QuantityUnits); err != nil {
		return nil, err
	}
	targetStrategy, err := normalizeSosmedBundleItemTargetStrategy(input.TargetStrategy)
	if err != nil {
		return nil, err
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	sortOrder := 100
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	item := &model.SosmedBundleItem{
		BundleVariantID: variantID,
		SosmedServiceID: service.ID,
		Label:           strings.TrimSpace(input.Label),
		QuantityUnits:   input.QuantityUnits,
		TargetStrategy:  targetStrategy,
		IsActive:        isActive,
		SortOrder:       sortOrder,
	}
	if err := s.bundleRepo.CreateBundleItem(ctx, item); err != nil {
		return nil, errors.New("gagal membuat item bundle sosmed")
	}
	item.Service = *service
	return item, nil
}

func (s *SosmedBundleAdminService) UpdateItem(ctx context.Context, id uuid.UUID, input UpdateSosmedBundleItemInput) (*model.SosmedBundleItem, error) {
	if err := s.ensureItemReady(); err != nil {
		return nil, err
	}
	item, err := s.getItemByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("item bundle sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat item bundle sosmed")
	}
	service := &item.Service
	if input.SosmedServiceID != nil {
		if *input.SosmedServiceID != item.SosmedServiceID {
			service, err = s.loadActiveSosmedService(*input.SosmedServiceID)
			if err != nil {
				return nil, err
			}
			item.SosmedServiceID = service.ID
		} else if service.ID == uuid.Nil {
			service, err = s.loadSosmedService(*input.SosmedServiceID)
			if err != nil {
				return nil, err
			}
		}
	} else if service.ID == uuid.Nil {
		service, err = s.loadSosmedService(item.SosmedServiceID)
		if err != nil {
			return nil, err
		}
	}
	if input.Label != nil {
		item.Label = strings.TrimSpace(*input.Label)
	}
	if input.QuantityUnits != nil {
		item.QuantityUnits = *input.QuantityUnits
	}
	if input.TargetStrategy != nil {
		targetStrategy, err := normalizeSosmedBundleItemTargetStrategy(*input.TargetStrategy)
		if err != nil {
			return nil, err
		}
		item.TargetStrategy = targetStrategy
	}
	if strings.TrimSpace(item.TargetStrategy) == "" {
		item.TargetStrategy = "same_target"
	}
	if input.IsActive != nil {
		item.IsActive = *input.IsActive
	}
	if input.SortOrder != nil {
		item.SortOrder = *input.SortOrder
	}
	if err := validateSosmedBundleItemQuantity(service, item.QuantityUnits); err != nil {
		return nil, err
	}
	item.SosmedServiceID = service.ID
	item.Service = *service
	if err := s.bundleRepo.UpdateBundleItem(ctx, item); err != nil {
		return nil, errors.New("gagal memperbarui item bundle sosmed")
	}
	return item, nil
}

func (s *SosmedBundleAdminService) DeactivateItem(ctx context.Context, id uuid.UUID) error {
	if err := s.ensureItemReady(); err != nil {
		return err
	}
	item, err := s.getItemByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("item bundle sosmed tidak ditemukan")
		}
		return errors.New("gagal memuat item bundle sosmed")
	}
	if !item.IsActive {
		return nil
	}
	item.IsActive = false
	if err := s.bundleRepo.UpdateBundleItem(ctx, item); err != nil {
		return errors.New("gagal menonaktifkan item bundle sosmed")
	}
	return nil
}

func (s *SosmedBundleAdminService) DeleteItem(ctx context.Context, id uuid.UUID) error {
	return s.DeactivateItem(ctx, id)
}

func (s *SosmedBundleAdminService) getVariantByID(ctx context.Context, id uuid.UUID) (*model.SosmedBundleVariant, error) {
	var variant model.SosmedBundleVariant
	err := s.bundleRepo.DB().WithContext(ctx).
		Preload("Package").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC, created_at ASC")
		}).
		Preload("Items.Service").
		First(&variant, "id = ?", id).Error
	return &variant, err
}

func (s *SosmedBundleAdminService) getItemByID(ctx context.Context, id uuid.UUID) (*model.SosmedBundleItem, error) {
	var item model.SosmedBundleItem
	err := s.bundleRepo.DB().WithContext(ctx).
		Preload("Variant").
		Preload("Variant.Package").
		Preload("Service").
		First(&item, "id = ?", id).Error
	return &item, err
}

func (s *SosmedBundleAdminService) ensureReady() error {
	if s == nil || s.bundleRepo == nil {
		return errors.New("layanan admin bundle sosmed belum siap")
	}
	return nil
}

func (s *SosmedBundleAdminService) ensureItemReady() error {
	if err := s.ensureReady(); err != nil {
		return err
	}
	if s.serviceRepo == nil {
		return errors.New("layanan admin bundle sosmed belum siap")
	}
	return nil
}

func (s *SosmedBundleAdminService) loadSosmedService(id uuid.UUID) (*model.SosmedService, error) {
	if id == uuid.Nil {
		return nil, errors.New("layanan sosmed wajib dipilih")
	}
	service, err := s.serviceRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("layanan sosmed tidak ditemukan")
		}
		return nil, errors.New("gagal memuat layanan sosmed")
	}
	return service, nil
}

func (s *SosmedBundleAdminService) loadActiveSosmedService(id uuid.UUID) (*model.SosmedService, error) {
	service, err := s.loadSosmedService(id)
	if err != nil {
		return nil, err
	}
	if !service.IsActive {
		return nil, errors.New("layanan sosmed sedang nonaktif")
	}
	return service, nil
}

func validateSosmedBundlePackageKey(value string) error {
	if !sosmedBundlePackageKeyPattern.MatchString(value) {
		return errors.New("key paket tidak valid (pakai huruf kecil, angka, -, _)")
	}
	return nil
}

func validateSosmedBundleVariantKey(value string) error {
	if !sosmedBundleVariantKeyPattern.MatchString(value) {
		return errors.New("key variant tidak valid (pakai huruf kecil, angka, -, _)")
	}
	return nil
}

func sosmedBundleVariantKeyExists(variants []model.SosmedBundleVariant, key string) bool {
	key = strings.TrimSpace(key)
	for _, variant := range variants {
		if strings.TrimSpace(variant.Key) == key {
			return true
		}
	}
	return false
}

func normalizeSosmedBundleVariantPriceMode(value string) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(value))
	if mode == "" {
		return SosmedBundlePriceModeComputed, nil
	}
	switch mode {
	case SosmedBundlePriceModeComputed, SosmedBundlePriceModeFixed, SosmedBundlePriceModeComputedWithDiscount:
		return mode, nil
	default:
		return "", errors.New("mode harga variant tidak valid")
	}
}

func validateSosmedBundleVariantPricing(priceMode string, fixedPrice int64, discountPercent int, discountAmount int64) error {
	mode, err := normalizeSosmedBundleVariantPriceMode(priceMode)
	if err != nil {
		return err
	}
	if mode == SosmedBundlePriceModeFixed && fixedPrice <= 0 {
		return errors.New("harga fixed variant wajib lebih dari 0")
	}
	if fixedPrice < 0 {
		return errors.New("harga fixed variant tidak boleh negatif")
	}
	if discountPercent < 0 || discountPercent > 100 {
		return errors.New("diskon persen variant harus 0 sampai 100")
	}
	if discountAmount < 0 {
		return errors.New("diskon nominal variant tidak boleh negatif")
	}
	return nil
}

func normalizeSosmedBundleItemTargetStrategy(value string) (string, error) {
	strategy := strings.ToLower(strings.TrimSpace(value))
	if strategy == "" {
		return "same_target", nil
	}
	if strategy != "same_target" {
		return "", errors.New("target strategy item tidak valid")
	}
	return strategy, nil
}

func validateSosmedBundleItemQuantity(service *model.SosmedService, quantityUnits int64) error {
	if quantityUnits <= 0 {
		return errors.New("quantity item wajib lebih dari 0")
	}
	if service == nil {
		return errors.New("layanan sosmed wajib dipilih")
	}
	serviceTitle := strings.TrimSpace(service.Title)
	if serviceTitle == "" {
		serviceTitle = strings.TrimSpace(service.Code)
	}
	if serviceTitle == "" {
		serviceTitle = "layanan sosmed"
	}
	return validateSosmedBundleQuantity(serviceTitle, quantityUnits, service.MinOrder)
}
