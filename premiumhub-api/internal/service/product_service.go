package service

import (
	"context"
	"errors"
	"mime/multipart"
	"strconv"
	"strings"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/storage"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductService struct {
	productRepo        *repository.ProductRepo
	stockRepo          *repository.StockRepo
	productAssets      *storage.ProductAssetStorage
	accountTypeRepo    *repository.AccountTypeRepo
	accountTypeSvc     *AccountTypeService
	productCategorySvc *ProductCategoryService
}

func NewProductService(productRepo *repository.ProductRepo, stockRepo *repository.StockRepo, productAssets ...*storage.ProductAssetStorage) *ProductService {
	var assets *storage.ProductAssetStorage
	if len(productAssets) > 0 {
		assets = productAssets[0]
	}
	return &ProductService{productRepo: productRepo, stockRepo: stockRepo, productAssets: assets}
}

func (s *ProductService) SetAccountTypeRepo(repo *repository.AccountTypeRepo) *ProductService {
	s.accountTypeRepo = repo
	if repo != nil {
		s.accountTypeSvc = NewAccountTypeService(repo)
	}
	return s
}

func (s *ProductService) SetProductCategoryRepo(repo *repository.ProductCategoryRepo) *ProductService {
	if repo != nil {
		s.productCategorySvc = NewProductCategoryService(repo)
	}
	return s
}

func (s *ProductService) attachAvailableStock(products []model.Product) error {
	if len(products) == 0 {
		return nil
	}

	ids := make([]uuid.UUID, 0, len(products))
	for _, product := range products {
		ids = append(ids, product.ID)
	}

	counts, err := s.stockRepo.CountAvailableByProductIDs(ids)
	if err != nil {
		return err
	}

	for index := range products {
		products[index].AvailableStock = counts[products[index].ID]
	}

	return nil
}

func (s *ProductService) attachPriceAvailableStock(product *model.Product) error {
	if product == nil || len(product.Prices) == 0 {
		return nil
	}

	rows, err := s.stockRepo.CountAvailableByProductAndDurations(product.ID)
	if err != nil {
		return err
	}

	exact := make(map[string]map[int]int64)
	fallback := make(map[string]int64)

	for _, row := range rows {
		accountType := normalizeAccountType(row.AccountType)
		if accountType == "" {
			continue
		}

		if row.DurationMonth <= 0 {
			fallback[accountType] += row.Total
			continue
		}

		if _, ok := exact[accountType]; !ok {
			exact[accountType] = make(map[int]int64)
		}
		exact[accountType][row.DurationMonth] += row.Total
	}

	for index := range product.Prices {
		accountType := normalizeAccountType(product.Prices[index].AccountType)
		duration := product.Prices[index].Duration

		stock := int64(0)
		if byDuration, ok := exact[accountType]; ok {
			stock = byDuration[duration]
		}
		if stock <= 0 {
			stock = fallback[accountType]
		}

		product.Prices[index].AvailableStock = stock
	}

	return nil
}

func (s *ProductService) List(category string, page, limit int) ([]model.Product, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 12
	}

	products, total, err := s.productRepo.List(category, page, limit)
	if err != nil {
		return nil, 0, err
	}

	if err := s.attachAvailableStock(products); err != nil {
		return nil, 0, err
	}

	return products, total, nil
}

func (s *ProductService) GetBySlug(slug string) (*model.Product, error) {
	product, err := s.productRepo.FindBySlug(slug)
	if err != nil {
		return nil, err
	}

	counts, err := s.stockRepo.CountAvailableByProductIDs([]uuid.UUID{product.ID})
	if err != nil {
		return nil, err
	}
	product.AvailableStock = counts[product.ID]

	if err := s.attachPriceAvailableStock(product); err != nil {
		return nil, err
	}

	return product, nil
}

type CreateProductInput struct {
	Name               string                    `json:"name" binding:"required"`
	Slug               string                    `json:"slug"`
	Category           string                    `json:"category" binding:"required"`
	Description        string                    `json:"description"`
	Tagline            string                    `json:"tagline"`
	Icon               string                    `json:"icon"`
	IconImageURL       string                    `json:"icon_image_url"`
	Color              string                    `json:"color"`
	HeroBgURL          string                    `json:"hero_bg_url"`
	BadgePopularText   string                    `json:"badge_popular_text"`
	BadgeGuaranteeText string                    `json:"badge_guarantee_text"`
	SoldText           string                    `json:"sold_text"`
	SharedNote         string                    `json:"shared_note"`
	PrivateNote        string                    `json:"private_note"`
	FeatureItems       []string                  `json:"feature_items"`
	SpecItems          []model.ProductSpecItem   `json:"spec_items"`
	TrustItems         []string                  `json:"trust_items"`
	TrustBadges        []model.ProductTrustBadge `json:"trust_badges"`
	FAQItems           []model.ProductFAQItem    `json:"faq_items"`
	PriceOriginalText  string                    `json:"price_original_text"`
	PricePerDayText    string                    `json:"price_per_day_text"`
	DiscountBadgeText  string                    `json:"discount_badge_text"`
	ShowWhatsAppButton *bool                     `json:"show_whatsapp_button"`
	WhatsAppNumber     string                    `json:"whatsapp_number"`
	WhatsAppButtonText string                    `json:"whatsapp_button_text"`
	SeoDescription     string                    `json:"seo_description"`
	SortPriority       *int                      `json:"sort_priority"`
	IsPopular          bool                      `json:"is_popular"`
	IsActive           *bool                     `json:"is_active"`
}

func (s *ProductService) Create(input CreateProductInput) (*model.Product, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("nama produk wajib diisi")
	}

	category := strings.TrimSpace(input.Category)
	if category == "" {
		return nil, errors.New("kategori produk wajib diisi")
	}
	if s.productCategorySvc != nil {
		normalizedCategory, err := s.productCategorySvc.ValidateActiveCode(model.ProductCategoryScopePremApps, category)
		if err != nil {
			return nil, err
		}
		category = normalizedCategory
	}

	slug := sanitizeSlug(input.Slug, name)
	if slug == "" {
		return nil, errors.New("slug produk tidak valid")
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	showWhatsAppButton := true
	if input.ShowWhatsAppButton != nil {
		showWhatsAppButton = *input.ShowWhatsAppButton
	}

	sortPriority := 0
	if input.SortPriority != nil {
		sortPriority = *input.SortPriority
	}

	trustBadges := sanitizeTrustBadges(input.TrustBadges)
	trustItems := sanitizeStringList(input.TrustItems)
	if len(trustItems) == 0 {
		trustItems = deriveTrustItemsFromBadges(trustBadges)
	}

	product := &model.Product{
		Name:               name,
		Slug:               slug,
		Category:           category,
		Description:        strings.TrimSpace(input.Description),
		Tagline:            strings.TrimSpace(input.Tagline),
		Icon:               strings.TrimSpace(input.Icon),
		IconImageURL:       strings.TrimSpace(input.IconImageURL),
		Color:              strings.TrimSpace(input.Color),
		HeroBgURL:          strings.TrimSpace(input.HeroBgURL),
		BadgePopularText:   strings.TrimSpace(input.BadgePopularText),
		BadgeGuaranteeText: strings.TrimSpace(input.BadgeGuaranteeText),
		SoldText:           strings.TrimSpace(input.SoldText),
		SharedNote:         strings.TrimSpace(input.SharedNote),
		PrivateNote:        strings.TrimSpace(input.PrivateNote),
		FeatureItems:       sanitizeStringListWithLimit(input.FeatureItems, 12),
		SpecItems:          sanitizeSpecItems(input.SpecItems),
		TrustItems:         trustItems,
		TrustBadges:        trustBadges,
		FAQItems:           sanitizeFAQItems(input.FAQItems),
		PriceOriginalText:  strings.TrimSpace(input.PriceOriginalText),
		PricePerDayText:    strings.TrimSpace(input.PricePerDayText),
		DiscountBadgeText:  strings.TrimSpace(input.DiscountBadgeText),
		ShowWhatsAppButton: showWhatsAppButton,
		WhatsAppNumber:     sanitizeWhatsAppNumber(input.WhatsAppNumber),
		WhatsAppButtonText: defaultString(strings.TrimSpace(input.WhatsAppButtonText), "Tanya via WhatsApp"),
		SeoDescription:     strings.TrimSpace(input.SeoDescription),
		SortPriority:       sortPriority,
		IsPopular:          input.IsPopular,
		IsActive:           isActive,
	}
	if err := s.productRepo.Create(product); err != nil {
		return nil, errors.New("gagal membuat produk")
	}
	return product, nil
}

type UpdateProductInput struct {
	Name               *string                    `json:"name"`
	Slug               *string                    `json:"slug"`
	Category           *string                    `json:"category"`
	Description        *string                    `json:"description"`
	Tagline            *string                    `json:"tagline"`
	Icon               *string                    `json:"icon"`
	IconImageURL       *string                    `json:"icon_image_url"`
	Color              *string                    `json:"color"`
	HeroBgURL          *string                    `json:"hero_bg_url"`
	BadgePopularText   *string                    `json:"badge_popular_text"`
	BadgeGuaranteeText *string                    `json:"badge_guarantee_text"`
	SoldText           *string                    `json:"sold_text"`
	SharedNote         *string                    `json:"shared_note"`
	PrivateNote        *string                    `json:"private_note"`
	FeatureItems       *[]string                  `json:"feature_items"`
	SpecItems          *[]model.ProductSpecItem   `json:"spec_items"`
	TrustItems         *[]string                  `json:"trust_items"`
	TrustBadges        *[]model.ProductTrustBadge `json:"trust_badges"`
	FAQItems           *[]model.ProductFAQItem    `json:"faq_items"`
	PriceOriginalText  *string                    `json:"price_original_text"`
	PricePerDayText    *string                    `json:"price_per_day_text"`
	DiscountBadgeText  *string                    `json:"discount_badge_text"`
	ShowWhatsAppButton *bool                      `json:"show_whatsapp_button"`
	WhatsAppNumber     *string                    `json:"whatsapp_number"`
	WhatsAppButtonText *string                    `json:"whatsapp_button_text"`
	SeoDescription     *string                    `json:"seo_description"`
	SortPriority       *int                       `json:"sort_priority"`
	IsPopular          *bool                      `json:"is_popular"`
	IsActive           *bool                      `json:"is_active"`
}

func (s *ProductService) Update(id uuid.UUID, input UpdateProductInput) (*model.Product, error) {
	product, err := s.productRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, errors.New("nama produk wajib diisi")
		}
		product.Name = name
	}

	if input.Slug != nil {
		slug := sanitizeSlug(*input.Slug, product.Name)
		if slug == "" {
			return nil, errors.New("slug produk tidak valid")
		}
		product.Slug = slug
	}

	if input.Category != nil {
		category := strings.TrimSpace(*input.Category)
		if category == "" {
			return nil, errors.New("kategori produk wajib diisi")
		}
		if s.productCategorySvc != nil {
			normalizedCategory, err := s.productCategorySvc.ValidateActiveCode(model.ProductCategoryScopePremApps, category)
			if err != nil {
				return nil, err
			}
			category = normalizedCategory
		}
		product.Category = category
	}

	if input.Description != nil {
		product.Description = strings.TrimSpace(*input.Description)
	}
	if input.Tagline != nil {
		product.Tagline = strings.TrimSpace(*input.Tagline)
	}
	if input.Icon != nil {
		product.Icon = strings.TrimSpace(*input.Icon)
	}
	if input.IconImageURL != nil {
		product.IconImageURL = strings.TrimSpace(*input.IconImageURL)
	}
	if input.Color != nil {
		product.Color = strings.TrimSpace(*input.Color)
	}
	if input.HeroBgURL != nil {
		product.HeroBgURL = strings.TrimSpace(*input.HeroBgURL)
	}
	if input.BadgePopularText != nil {
		product.BadgePopularText = strings.TrimSpace(*input.BadgePopularText)
	}
	if input.BadgeGuaranteeText != nil {
		product.BadgeGuaranteeText = strings.TrimSpace(*input.BadgeGuaranteeText)
	}
	if input.SoldText != nil {
		product.SoldText = strings.TrimSpace(*input.SoldText)
	}
	if input.SharedNote != nil {
		product.SharedNote = strings.TrimSpace(*input.SharedNote)
	}
	if input.PrivateNote != nil {
		product.PrivateNote = strings.TrimSpace(*input.PrivateNote)
	}
	if input.FeatureItems != nil {
		product.FeatureItems = sanitizeStringListWithLimit(*input.FeatureItems, 12)
	}
	if input.SpecItems != nil {
		product.SpecItems = sanitizeSpecItems(*input.SpecItems)
	}
	if input.TrustBadges != nil {
		product.TrustBadges = sanitizeTrustBadges(*input.TrustBadges)
		if input.TrustItems == nil {
			product.TrustItems = deriveTrustItemsFromBadges(product.TrustBadges)
		}
	}
	if input.TrustItems != nil {
		product.TrustItems = sanitizeStringList(*input.TrustItems)
	}
	if input.FAQItems != nil {
		product.FAQItems = sanitizeFAQItems(*input.FAQItems)
	}
	if input.PriceOriginalText != nil {
		product.PriceOriginalText = strings.TrimSpace(*input.PriceOriginalText)
	}
	if input.PricePerDayText != nil {
		product.PricePerDayText = strings.TrimSpace(*input.PricePerDayText)
	}
	if input.DiscountBadgeText != nil {
		product.DiscountBadgeText = strings.TrimSpace(*input.DiscountBadgeText)
	}
	if input.ShowWhatsAppButton != nil {
		product.ShowWhatsAppButton = *input.ShowWhatsAppButton
	}
	if input.WhatsAppNumber != nil {
		product.WhatsAppNumber = sanitizeWhatsAppNumber(*input.WhatsAppNumber)
	}
	if input.WhatsAppButtonText != nil {
		product.WhatsAppButtonText = defaultString(strings.TrimSpace(*input.WhatsAppButtonText), "Tanya via WhatsApp")
	}
	if input.SeoDescription != nil {
		product.SeoDescription = strings.TrimSpace(*input.SeoDescription)
	}
	if input.SortPriority != nil {
		product.SortPriority = *input.SortPriority
	}
	if input.IsPopular != nil {
		product.IsPopular = *input.IsPopular
	}
	if input.IsActive != nil {
		product.IsActive = *input.IsActive
	}
	if err := s.productRepo.Update(product); err != nil {
		return nil, err
	}
	return product, nil
}

type CreateProductPriceInput struct {
	Duration    int    `json:"duration" binding:"required,min=1"`
	AccountType string `json:"account_type" binding:"required"`
	Label       string `json:"label"`
	SavingsText string `json:"savings_text"`
	Price       int64  `json:"price" binding:"required,min=1"`
	IsActive    *bool  `json:"is_active"`
}

type UpdateProductPriceInput struct {
	Duration    *int    `json:"duration"`
	AccountType *string `json:"account_type"`
	Label       *string `json:"label"`
	SavingsText *string `json:"savings_text"`
	Price       *int64  `json:"price"`
	IsActive    *bool   `json:"is_active"`
}

func (s *ProductService) validateCatalogAccountType(raw string) (string, error) {
	accountType := normalizeAccountType(raw)
	if accountType == "" {
		return "", errors.New("account_type wajib diisi")
	}

	if s.accountTypeSvc == nil {
		return accountType, nil
	}

	validated, err := s.accountTypeSvc.ValidateActiveCode(accountType)
	if err != nil {
		return "", err
	}

	return validated, nil
}

func (s *ProductService) CreatePrice(productID uuid.UUID, input CreateProductPriceInput) (*model.ProductPrice, error) {
	if _, err := s.productRepo.FindByID(productID); err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	accountType, err := s.validateCatalogAccountType(input.AccountType)
	if err != nil {
		return nil, err
	}
	if input.Duration < 1 {
		return nil, errors.New("durasi harus lebih dari 0")
	}
	if input.Price < 1 {
		return nil, errors.New("harga harus lebih dari 0")
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	label := normalizePriceLabel(input.Label, input.Duration)
	savingsText := strings.TrimSpace(input.SavingsText)

	existing, err := s.productRepo.FindPriceBySignature(productID, input.Duration, accountType)
	if err == nil {
		existing.Label = label
		existing.SavingsText = savingsText
		existing.Price = input.Price
		existing.IsActive = isActive
		if err := s.productRepo.UpdatePrice(existing); err != nil {
			return nil, errors.New("gagal memperbarui harga produk")
		}
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal memeriksa duplikasi harga produk")
	}

	price := &model.ProductPrice{
		ProductID:   productID,
		Duration:    input.Duration,
		AccountType: accountType,
		Label:       label,
		SavingsText: savingsText,
		Price:       input.Price,
		IsActive:    isActive,
	}
	if err := s.productRepo.CreatePrice(price); err != nil {
		return nil, errors.New("gagal membuat harga produk")
	}
	return price, nil
}

func (s *ProductService) UpdatePrice(productID, priceID uuid.UUID, input UpdateProductPriceInput) (*model.ProductPrice, error) {
	if _, err := s.productRepo.FindByID(productID); err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	price, err := s.productRepo.FindPriceByID(priceID)
	if err != nil {
		return nil, errors.New("harga produk tidak ditemukan")
	}
	if price.ProductID != productID {
		return nil, errors.New("harga produk tidak cocok dengan produk")
	}

	nextDuration := price.Duration
	nextAccountType := price.AccountType

	if input.Duration != nil {
		if *input.Duration < 1 {
			return nil, errors.New("durasi harus lebih dari 0")
		}
		nextDuration = *input.Duration
	}
	if input.AccountType != nil {
		validated, err := s.validateCatalogAccountType(*input.AccountType)
		if err != nil {
			return nil, err
		}
		nextAccountType = validated
	}
	if input.Price != nil && *input.Price < 1 {
		return nil, errors.New("harga harus lebih dari 0")
	}

	if nextDuration != price.Duration || nextAccountType != price.AccountType {
		duplicate, err := s.productRepo.FindPriceBySignature(productID, nextDuration, nextAccountType)
		if err == nil && duplicate.ID != priceID {
			return nil, errors.New("kombinasi durasi dan tipe akun sudah ada")
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("gagal memeriksa duplikasi harga produk")
		}
	}

	price.Duration = nextDuration
	price.AccountType = nextAccountType
	if input.Label != nil {
		price.Label = normalizePriceLabel(*input.Label, nextDuration)
	}
	if input.SavingsText != nil {
		price.SavingsText = strings.TrimSpace(*input.SavingsText)
	}
	if strings.TrimSpace(price.Label) == "" {
		price.Label = normalizePriceLabel("", nextDuration)
	}
	if input.Price != nil {
		price.Price = *input.Price
	}
	if input.IsActive != nil {
		price.IsActive = *input.IsActive
	}

	if err := s.productRepo.UpdatePrice(price); err != nil {
		return nil, errors.New("gagal memperbarui harga produk")
	}
	return price, nil
}

func (s *ProductService) UploadAsset(productID uuid.UUID, kind string, file *multipart.FileHeader) (string, error) {
	if s.productAssets == nil {
		return "", errors.New("storage asset produk belum dikonfigurasi")
	}

	product, err := s.productRepo.FindByID(productID)
	if err != nil {
		return "", errors.New("produk tidak ditemukan")
	}

	assetURL, err := s.productAssets.Store(context.Background(), productID.String(), kind, file)
	if err != nil {
		return "", err
	}

	switch strings.ToLower(strings.TrimSpace(kind)) {
	case "icon":
		product.IconImageURL = assetURL
	case "hero":
		product.HeroBgURL = assetURL
	default:
		return "", errors.New("kind asset tidak valid")
	}

	if err := s.productRepo.Update(product); err != nil {
		return "", errors.New("gagal menyimpan asset produk")
	}

	return assetURL, nil
}

func (s *ProductService) DeletePrice(productID, priceID uuid.UUID) error {
	price, err := s.productRepo.FindPriceByID(priceID)
	if err != nil {
		return errors.New("harga produk tidak ditemukan")
	}
	if price.ProductID != productID {
		return errors.New("harga produk tidak cocok dengan produk")
	}

	if !price.IsActive {
		return nil
	}

	price.IsActive = false
	if err := s.productRepo.UpdatePrice(price); err != nil {
		return errors.New("gagal menonaktifkan harga produk")
	}
	return nil
}

func (s *ProductService) Delete(id uuid.UUID) error {
	return s.productRepo.Delete(id)
}

func (s *ProductService) DeletePermanent(id uuid.UUID) error {
	if _, err := s.productRepo.FindByID(id); err != nil {
		return errors.New("produk tidak ditemukan")
	}

	orderCount, err := s.productRepo.CountOrdersByProduct(id)
	if err != nil {
		return errors.New("gagal memeriksa riwayat order produk")
	}
	if orderCount > 0 {
		return errors.New("produk tidak bisa dihapus permanen karena sudah punya riwayat order")
	}

	if err := s.productRepo.DeletePermanent(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("produk tidak ditemukan")
		}
		return errors.New("gagal menghapus permanen produk")
	}

	return nil
}

func (s *ProductService) AdminList(page, limit int) ([]model.Product, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	return s.productRepo.AdminList(page, limit)
}

func (s *ProductService) GetStockCount(productID uuid.UUID, accountType string) (int64, error) {
	return s.stockRepo.CountByProduct(productID, accountType)
}

func sanitizeStringList(values []string) []string {
	return sanitizeStringListWithLimit(values, 10)
}

func sanitizeStringListWithLimit(values []string, max int) []string {
	if max < 1 {
		max = 1
	}

	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
		if len(result) >= max {
			break
		}
	}
	return result
}

func sanitizeSpecItems(items []model.ProductSpecItem) []model.ProductSpecItem {
	result := make([]model.ProductSpecItem, 0, len(items))
	for _, item := range items {
		label := strings.TrimSpace(item.Label)
		value := strings.TrimSpace(item.Value)
		if label == "" || value == "" {
			continue
		}
		result = append(result, model.ProductSpecItem{Label: label, Value: value})
		if len(result) >= 16 {
			break
		}
	}
	return result
}

func sanitizeTrustBadges(items []model.ProductTrustBadge) []model.ProductTrustBadge {
	result := make([]model.ProductTrustBadge, 0, len(items))
	for _, item := range items {
		text := strings.TrimSpace(item.Text)
		if text == "" {
			continue
		}
		icon := strings.TrimSpace(item.Icon)
		if icon == "" {
			icon = "✨"
		}
		result = append(result, model.ProductTrustBadge{Icon: icon, Text: text})
		if len(result) >= 10 {
			break
		}
	}
	return result
}

func deriveTrustItemsFromBadges(items []model.ProductTrustBadge) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		text := strings.TrimSpace(item.Text)
		if text == "" {
			continue
		}
		result = append(result, text)
		if len(result) >= 10 {
			break
		}
	}
	return result
}

func sanitizeFAQItems(items []model.ProductFAQItem) []model.ProductFAQItem {
	result := make([]model.ProductFAQItem, 0, len(items))
	for _, item := range items {
		question := strings.TrimSpace(item.Question)
		answer := strings.TrimSpace(item.Answer)
		if question == "" && answer == "" {
			continue
		}
		if question == "" || answer == "" {
			continue
		}
		result = append(result, model.ProductFAQItem{Question: question, Answer: answer})
		if len(result) >= 10 {
			break
		}
	}
	return result
}

func sanitizeWhatsAppNumber(raw string) string {
	normalized := strings.TrimSpace(raw)
	if normalized == "" {
		return ""
	}

	builder := strings.Builder{}
	for _, r := range normalized {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}
	result := builder.String()
	if len(result) > 20 {
		result = result[:20]
	}
	return result
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func normalizePriceLabel(label string, duration int) string {
	trimmed := strings.TrimSpace(label)
	if trimmed != "" {
		return trimmed
	}
	if duration < 1 {
		duration = 1
	}
	return strings.TrimSpace(strconv.Itoa(duration) + " Bulan")
}

func normalizeAccountType(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func sanitizeSlug(value, fallback string) string {
	slug := generateSlug(strings.TrimSpace(value))
	if slug != "" {
		return slug
	}
	return generateSlug(strings.TrimSpace(fallback))
}

func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "-")
	slug = strings.ReplaceAll(slug, "+", "plus")
	// Remove non-alphanumeric except hyphens
	var result []byte
	for _, c := range []byte(slug) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' {
			result = append(result, c)
		}
	}
	return string(result)
}
