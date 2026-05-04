package service

import (
	"context"
	"strings"
	"testing"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
)

type staticJAPCatalogProvider struct {
	items []JAPServiceItem
	err   error
}

func (p staticJAPCatalogProvider) GetServices(context.Context) ([]JAPServiceItem, error) {
	return p.items, p.err
}

func seedSosmedCategory(t *testing.T, repo *repository.ProductCategoryRepo, code, label string, sortOrder int) {
	t.Helper()

	svc := NewProductCategoryService(repo)
	_, err := svc.Create(CreateProductCategoryInput{
		Scope:     model.ProductCategoryScopeSosmed,
		Code:      code,
		Label:     label,
		SortOrder: intPtr(sortOrder),
		IsActive:  boolPtr(true),
	})
	if err != nil && !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("seed sosmed category %s: %v", code, err)
	}
}

func TestSosmedService_CreateAndValidation(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo)

	created, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode:  "followers",
		Code:          "IG Followers",
		Title:         "IG Followers Indonesia Aktif",
		Summary:       "Boost social proof dengan delivery bertahap.",
		PlatformLabel: "Instagram",
		BadgeText:     "Best Seller",
		Theme:         "blue",
		MinOrder:      "100",
		StartTime:     "5-15 menit",
		Refill:        "30 hari",
		ETA:           "2-12 jam",
		PriceStart:    "Rp 28.000",
		PricePer1K:    "≈ Rp 28 / 1K",
		TrustBadges:   []string{"No Password", "Refill 30 Hari", "No Password"},
		SortOrder:     intPtr(10),
		IsActive:      boolPtr(true),
	})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	if created.Code != "ig-followers" {
		t.Fatalf("expected normalized code ig-followers, got %s", created.Code)
	}
	if created.Theme != "blue" {
		t.Fatalf("expected theme blue, got %s", created.Theme)
	}
	if len(created.TrustBadges) != 2 {
		t.Fatalf("expected deduplicated trust badges, got %d", len(created.TrustBadges))
	}

	if _, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "followers",
		Code:         "ig-followers",
		Title:        "Duplicate",
	}); err == nil || !strings.Contains(err.Error(), "sudah dipakai") {
		t.Fatalf("expected duplicate code error, got: %v", err)
	}

	if _, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "unknown",
		Code:         "invalid-category",
		Title:        "Invalid Category",
	}); err == nil || !strings.Contains(err.Error(), "kategori") {
		t.Fatalf("expected category validation error, got: %v", err)
	}
}

func TestSosmedService_UpdateAndDelete(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)
	seedSosmedCategory(t, categoryRepo, "likes", "Likes", 20)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo)

	created, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "followers",
		Code:         "ig-followers",
		Title:        "IG Followers Indonesia Aktif",
		Theme:        "blue",
		SortOrder:    intPtr(10),
	})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	nextCode := "new-code"
	if _, err := svc.Update(created.ID, UpdateSosmedServiceInput{Code: &nextCode}); err == nil || !strings.Contains(err.Error(), "tidak bisa diubah") {
		t.Fatalf("expected immutable code error, got: %v", err)
	}

	nextCategory := "likes"
	nextTitle := "IG Likes Premium"
	nextTheme := "pink"
	nextTrustBadges := []string{"No Password", "High Retention"}
	nextSort := 25
	updated, err := svc.Update(created.ID, UpdateSosmedServiceInput{
		CategoryCode: &nextCategory,
		Title:        &nextTitle,
		Theme:        &nextTheme,
		TrustBadges:  &nextTrustBadges,
		SortOrder:    &nextSort,
	})
	if err != nil {
		t.Fatalf("update sosmed service: %v", err)
	}
	if updated.CategoryCode != "likes" {
		t.Fatalf("expected category likes, got %s", updated.CategoryCode)
	}
	if updated.Theme != "pink" {
		t.Fatalf("expected theme pink, got %s", updated.Theme)
	}
	if updated.SortOrder != 25 {
		t.Fatalf("expected sort order 25, got %d", updated.SortOrder)
	}

	if err := svc.Delete(created.ID); err != nil {
		t.Fatalf("delete sosmed service: %v", err)
	}

	stored, err := repo.FindByID(created.ID)
	if err != nil {
		t.Fatalf("find sosmed service: %v", err)
	}
	if stored.IsActive {
		t.Fatalf("expected sosmed service to be inactive after delete")
	}
}

func TestSosmedService_RepriceResellerToIDR_FixedMode(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo).SetResellerFXConfig(SosmedResellerFXConfig{
		Mode:      "fixed",
		FixedRate: 17000,
	})

	item, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "followers",
		Code:         "jap-tt-views-auto30d-10164",
		Title:        "TikTok Views",
		Summary:      "Harga reseller USD 0.0563/1K",
		PriceStart:   "Reseller USD 0.0563/1K",
		PricePer1K:   "Reseller USD 0.0563 per 1K • JAP#10164",
		IsActive:     boolPtr(false),
	})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	fixedRate := 18000.0
	res, err := svc.RepriceResellerToIDR(context.Background(), RepriceSosmedResellerInput{
		Mode:            "fixed",
		FixedRate:       &fixedRate,
		IncludeInactive: boolPtr(true),
	})
	if err != nil {
		t.Fatalf("reprice reseller: %v", err)
	}

	if res.Mode != "fixed" {
		t.Fatalf("expected mode fixed, got %s", res.Mode)
	}
	if res.Updated != 1 {
		t.Fatalf("expected updated=1, got %d", res.Updated)
	}

	stored, err := repo.FindByID(item.ID)
	if err != nil {
		t.Fatalf("find sosmed service: %v", err)
	}
	if stored.PriceStart != "Reseller Rp 1.013/1K" {
		t.Fatalf("unexpected price_start: %s", stored.PriceStart)
	}
	if !strings.Contains(stored.PricePer1K, "USD 0.0563") {
		t.Fatalf("expected USD marker in price_per_1k, got %s", stored.PricePer1K)
	}
}

func TestSosmedService_RepriceResellerToIDR_DryRun(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo).SetResellerFXConfig(SosmedResellerFXConfig{
		Mode:      "fixed",
		FixedRate: 17000,
	})

	item, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "followers",
		Code:         "jap-test-9999",
		Title:        "Test Service",
		Summary:      "Harga reseller USD 1.25/1K",
		PriceStart:   "Reseller USD 1.25/1K",
		PricePer1K:   "Reseller USD 1.25 per 1K",
	})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	res, err := svc.RepriceResellerToIDR(context.Background(), RepriceSosmedResellerInput{DryRun: true})
	if err != nil {
		t.Fatalf("reprice reseller dry run: %v", err)
	}
	if !res.DryRun {
		t.Fatalf("expected dry run true")
	}
	if res.Updated != 1 {
		t.Fatalf("expected dry run counted update=1, got %d", res.Updated)
	}

	stored, err := repo.FindByID(item.ID)
	if err != nil {
		t.Fatalf("find sosmed service: %v", err)
	}
	if stored.PriceStart != "Reseller USD 1.25/1K" {
		t.Fatalf("dry run should not mutate price_start, got %s", stored.PriceStart)
	}
}

func TestSosmedService_RepriceResellerToIDR_FormatsProviderCopy(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "likes", "Likes", 20)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo).SetResellerFXConfig(SosmedResellerFXConfig{
		Mode:      "fixed",
		FixedRate: 17000,
	})

	rawTitle := "TikTok Likes HQ 30D (JAP #10173)"
	item, err := svc.Create(CreateSosmedServiceInput{
		CategoryCode: "likes",
		Code:         "jap-tt-likes-hq-30d-10173",
		Title:        rawTitle,
		Summary:      "Import dari JustAnotherPanel. Harga reseller USD 0.0825/1K.",
		Refill:       "Auto-Refill 30 Days",
		ETA:          "Up to 100K/D",
		PriceStart:   "Reseller USD 0.0825/1K",
		PricePer1K:   "Reseller USD 0.0825 per 1K • JAP#10173",
		IsActive:     boolPtr(false),
	})
	if err != nil {
		t.Fatalf("create sosmed service: %v", err)
	}

	res, err := svc.RepriceResellerToIDR(context.Background(), RepriceSosmedResellerInput{})
	if err != nil {
		t.Fatalf("reprice reseller: %v", err)
	}
	if res.Updated != 1 {
		t.Fatalf("expected updated=1, got %d", res.Updated)
	}

	stored, err := repo.FindByID(item.ID)
	if err != nil {
		t.Fatalf("find sosmed service: %v", err)
	}
	if stored.ProviderTitle != rawTitle {
		t.Fatalf("expected provider_title %q, got %q", rawTitle, stored.ProviderTitle)
	}
	if stored.Title != "TikTok Likes Kualitas Tinggi (30 Hari)" {
		t.Fatalf("unexpected formatted title: %s", stored.Title)
	}
	if stored.Refill != "Otomatis 30 Hari" {
		t.Fatalf("unexpected formatted refill: %s", stored.Refill)
	}
	if stored.ETA != "Hingga 100 rb/hari" {
		t.Fatalf("unexpected formatted eta: %s", stored.ETA)
	}
}

func TestSosmedService_FormatterHelpers(t *testing.T) {
	titleCases := []struct {
		name     string
		raw      string
		expected string
	}{
		{
			name:     "hq_and_duration",
			raw:      "TikTok Followers HQ 60D (JAP #9197)",
			expected: "TikTok Followers Kualitas Tinggi (60 Hari)",
		},
		{
			name:     "mixed_reactions",
			raw:      "Telegram Reactions Mixed 30D",
			expected: "Telegram Reaksi Campuran (30 Hari)",
		},
		{
			name:     "auto_duration",
			raw:      "TikTok Views Auto30D",
			expected: "TikTok Views Refill Otomatis 30 Hari",
		},
	}

	for _, tc := range titleCases {
		t.Run(tc.name, func(t *testing.T) {
			actual := formatSosmedDisplayTitle(tc.raw)
			if actual != tc.expected {
				t.Fatalf("format title: expected %q, got %q", tc.expected, actual)
			}
		})
	}

	if got := formatSosmedRefillValue("Non Drop"); got != "Stabil (Non Drop)" {
		t.Fatalf("format refill non-drop: expected %q, got %q", "Stabil (Non Drop)", got)
	}
	if got := formatSosmedRefillValue("365D"); got != "365 Hari" {
		t.Fatalf("format refill day duration: expected %q, got %q", "365 Hari", got)
	}
	if got := formatSosmedRefillValue("No"); got != "Tidak Ada" {
		t.Fatalf("format refill no: expected %q, got %q", "Tidak Ada", got)
	}

	if got := formatSosmedETAValue("15K/Hr"); got != "15 rb/jam" {
		t.Fatalf("format eta hourly: expected %q, got %q", "15 rb/jam", got)
	}
	if got := formatSosmedETAValue("Up to 5M/D"); got != "Hingga 5 jt/hari" {
		t.Fatalf("format eta up-to daily: expected %q, got %q", "Hingga 5 jt/hari", got)
	}
}

func TestSosmedService_ImportSelectedFromJAP_CreatesDrafts(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo).
		SetResellerFXConfig(SosmedResellerFXConfig{
			Mode:      "fixed",
			FixedRate: 17000,
		}).
		SetJAPCatalogProvider(staticJAPCatalogProvider{
			items: []JAPServiceItem{
				{
					Service:  "6331",
					Name:     "Instagram Followers [Refill: 30D] [Max: 50K] [Start Time: 2 Hours] [Speed: 30K/Day]💧♻️",
					Type:     "Default",
					Category: "Instagram Followers [Guaranteed]",
					Rate:     "0.375",
					Min:      "10",
					Max:      "1000000",
					Dripfeed: true,
					Refill:   true,
					Cancel:   false,
				},
				{
					Service:  "8695",
					Name:     "Twitter Followers [Refill: No] [Max: 10K] [Start Time: 0-3 Hrs] [Speed: 5K/D] 💧",
					Type:     "Default",
					Category: "X - Twitter Followers",
					Rate:     "0.50",
					Min:      "10",
					Max:      "1000000",
					Dripfeed: true,
					Refill:   false,
					Cancel:   false,
				},
			},
		})

	res, err := svc.ImportSelectedFromJAP(context.Background(), ImportSelectedJAPServicesInput{
		ServiceIDs: []int64{6331, 8695},
	})
	if err != nil {
		t.Fatalf("import selected JAP: %v", err)
	}
	if res.Created != 2 || res.Updated != 0 || res.Skipped != 0 {
		t.Fatalf("unexpected import result: %+v", res)
	}

	insta, err := repo.FindByProvider("jap", "6331")
	if err != nil {
		t.Fatalf("find instagram draft: %v", err)
	}
	if insta.Code != "jap-6331" {
		t.Fatalf("unexpected instagram code: %s", insta.Code)
	}
	if insta.Title != "Instagram Followers Refill 30 Hari" {
		t.Fatalf("unexpected instagram title: %s", insta.Title)
	}
	if insta.PlatformLabel != "Instagram" {
		t.Fatalf("unexpected instagram platform: %s", insta.PlatformLabel)
	}
	if insta.Refill != "30 Hari" {
		t.Fatalf("unexpected instagram refill: %s", insta.Refill)
	}
	if insta.StartTime != "2 Jam" {
		t.Fatalf("unexpected instagram start time: %s", insta.StartTime)
	}
	if insta.ETA != "30 rb/hari" {
		t.Fatalf("unexpected instagram eta: %s", insta.ETA)
	}
	if insta.CheckoutPrice != 0 || insta.IsActive {
		t.Fatalf("instagram draft should stay inactive with zero checkout price")
	}
	if !strings.Contains(insta.PricePer1K, "USD 0.375") {
		t.Fatalf("expected instagram price_per_1k to keep USD marker, got %s", insta.PricePer1K)
	}

	twitter, err := repo.FindByProvider("jap", "8695")
	if err != nil {
		t.Fatalf("find twitter draft: %v", err)
	}
	if twitter.Code != "jap-8695" {
		t.Fatalf("unexpected twitter code: %s", twitter.Code)
	}
	if twitter.Title != "Twitter Followers" {
		t.Fatalf("unexpected twitter title: %s", twitter.Title)
	}
	if twitter.PlatformLabel != "X / Twitter" {
		t.Fatalf("unexpected twitter platform: %s", twitter.PlatformLabel)
	}
	if twitter.Refill != "Tidak Ada" {
		t.Fatalf("unexpected twitter refill: %s", twitter.Refill)
	}
	if twitter.ProviderRate != "0.5" {
		t.Fatalf("unexpected twitter provider rate: %s", twitter.ProviderRate)
	}
	if twitter.IsActive {
		t.Fatalf("twitter draft should stay inactive after import")
	}
}

func TestSosmedService_PreviewSelectedFromJAP_AuditsOrderRequirements(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo).
		SetResellerFXConfig(SosmedResellerFXConfig{
			Mode:      "fixed",
			FixedRate: 17000,
		}).
		SetJAPCatalogProvider(staticJAPCatalogProvider{
			items: []JAPServiceItem{
				{
					Service:  "6331",
					Name:     "Instagram Followers [Refill: 30D] [Max: 50K] [Start Time: 2 Hours] [Speed: 30K/Day]",
					Type:     "Default",
					Category: "Instagram Followers [Guaranteed]",
					Rate:     "0.375",
					Min:      "10",
					Max:      "1000000",
					Refill:   true,
				},
				{
					Service:  "7777",
					Name:     "Instagram Comments Custom",
					Type:     "Custom Comments",
					Category: "Instagram Comments",
					Rate:     "1.25",
					Min:      "10",
					Max:      "1000",
					Refill:   false,
				},
			},
		})

	preview, err := svc.PreviewSelectedFromJAP(context.Background(), ImportSelectedJAPServicesInput{
		ServiceIDs: []int64{6331, 7777, 9999},
	})
	if err != nil {
		t.Fatalf("preview selected JAP: %v", err)
	}
	if preview.Requested != 3 || preview.Matched != 2 || len(preview.NotFound) != 1 || preview.NotFound[0] != "9999" {
		t.Fatalf("unexpected preview counts: %+v", preview)
	}

	var defaultRow, commentsRow PreviewSelectedJAPServiceRow
	for _, item := range preview.Items {
		switch item.ServiceID {
		case "6331":
			defaultRow = item
		case "7777":
			commentsRow = item
		}
	}

	if !defaultRow.SupportedForInitialOrder || defaultRow.FulfillmentMode != "simple_quantity" {
		t.Fatalf("expected default service to support initial order, got %+v", defaultRow)
	}
	if strings.Join(defaultRow.RequiredOrderFields, ",") != "service,link,quantity" {
		t.Fatalf("unexpected default required fields: %v", defaultRow.RequiredOrderFields)
	}
	if commentsRow.SupportedForInitialOrder || commentsRow.FulfillmentMode != "custom_comments" {
		t.Fatalf("expected custom comments service to require manual review, got %+v", commentsRow)
	}
	if !strings.Contains(strings.Join(commentsRow.Warnings, " "), "comments") {
		t.Fatalf("expected custom comments warning, got %v", commentsRow.Warnings)
	}
}

func TestSosmedService_SyncAllJAPMetadata_BackfillsLegacyPrices(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "views", "Views", 30)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo).
		SetResellerFXConfig(SosmedResellerFXConfig{Mode: "fixed", FixedRate: 17000}).
		SetJAPCatalogProvider(staticJAPCatalogProvider{items: []JAPServiceItem{
			{
				Service:  "1486",
				Name:     "TikTok Views [Refill: No] [Max: 1M] [Start Time: 0-1 Hr] [Speed: 100K/Day]",
				Type:     "Default",
				Category: "TikTok Views",
				Rate:     "0.25",
				Min:      "100",
				Max:      "1000000",
			},
		}})

	item := &model.SosmedService{
		CategoryCode:      "views",
		Code:              "jap-tiktok-views-1486",
		Title:             "TikTok Views Legacy",
		ProviderCode:      "jap",
		ProviderServiceID: "1486",
		CheckoutPrice:     15000,
		IsActive:          true,
	}
	if err := repo.Create(item); err != nil {
		t.Fatalf("create legacy service: %v", err)
	}

	updated, err := svc.SyncAllJAPMetadata(context.Background())
	if err != nil {
		t.Fatalf("sync JAP metadata: %v", err)
	}
	if updated != 1 {
		t.Fatalf("expected updated=1, got %d", updated)
	}

	stored, err := repo.FindByID(item.ID)
	if err != nil {
		t.Fatalf("find legacy service: %v", err)
	}
	if stored.ProviderRate != "0.25" || stored.ProviderCurrency != "USD" {
		t.Fatalf("expected provider rate/currency backfilled, got %s/%s", stored.ProviderRate, stored.ProviderCurrency)
	}
	if stored.PriceStart != "Reseller Rp 4.250/1K" {
		t.Fatalf("unexpected price_start: %s", stored.PriceStart)
	}
	if stored.PricePer1K != "Reseller Rp 4.250 per 1K • USD 0.25 • JAP#1486" {
		t.Fatalf("unexpected price_per_1k: %s", stored.PricePer1K)
	}
	if stored.CheckoutPrice != 15000 {
		t.Fatalf("checkout price should stay manual, got %d", stored.CheckoutPrice)
	}
}

func TestSosmedService_RepriceResellerToIDR_FallsBackToProviderRate(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "views", "Views", 30)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo).SetResellerFXConfig(SosmedResellerFXConfig{
		Mode:      "fixed",
		FixedRate: 17000,
	})

	item := &model.SosmedService{
		CategoryCode:      "views",
		Code:              "legacy-tiktok-views-1486",
		Title:             "Legacy TikTok Views",
		ProviderCode:      "jap",
		ProviderServiceID: "1486",
		ProviderRate:      "0.25",
		ProviderCurrency:  "USD",
		IsActive:          true,
	}
	if err := repo.Create(item); err != nil {
		t.Fatalf("create provider-rate fallback service: %v", err)
	}

	fixedRate := 18000.0
	res, err := svc.RepriceResellerToIDR(context.Background(), RepriceSosmedResellerInput{
		FixedRate:       &fixedRate,
		IncludeInactive: boolPtr(true),
	})
	if err != nil {
		t.Fatalf("reprice provider-rate fallback: %v", err)
	}
	if res.Eligible != 1 || res.Updated != 1 {
		t.Fatalf("expected eligible/update 1, got %+v", res)
	}

	stored, err := repo.FindByID(item.ID)
	if err != nil {
		t.Fatalf("find provider-rate fallback service: %v", err)
	}
	if stored.PriceStart != "Reseller Rp 4.500/1K" {
		t.Fatalf("unexpected fallback price_start: %s", stored.PriceStart)
	}
	if stored.PricePer1K != "Reseller Rp 4.500 per 1K • USD 0.25 • JAP#1486" {
		t.Fatalf("unexpected fallback price_per_1k: %s", stored.PricePer1K)
	}
}

func TestSosmedService_RepriceResellerToIDR_MatchesProviderCode(t *testing.T) {
	db := setupCoreDB(t)
	if err := db.AutoMigrate(&model.ProductCategory{}, &model.SosmedService{}); err != nil {
		t.Fatalf("migrate sosmed models: %v", err)
	}

	categoryRepo := repository.NewProductCategoryRepo(db)
	seedSosmedCategory(t, categoryRepo, "followers", "Followers", 10)

	repo := repository.NewSosmedServiceRepo(db)
	svc := NewSosmedServiceService(repo, categoryRepo).SetResellerFXConfig(SosmedResellerFXConfig{
		Mode:      "fixed",
		FixedRate: 17000,
	})

	item := &model.SosmedService{
		CategoryCode:      "followers",
		Code:              "jap-6331",
		Title:             "Instagram Followers Refill 30 Hari",
		ProviderCode:      "jap",
		ProviderServiceID: "6331",
		ProviderTitle:     "Instagram Followers [Refill: 30D]",
		ProviderRate:      "0.375",
		ProviderCurrency:  "USD",
		PriceStart:        "Reseller Rp 6.375/1K",
		PricePer1K:        "Reseller Rp 6.375 per 1K • USD 0.375 • JAP#6331",
		IsActive:          false,
	}
	if err := repo.Create(item); err != nil {
		t.Fatalf("create provider-coded sosmed service: %v", err)
	}

	fixedRate := 18000.0
	res, err := svc.RepriceResellerToIDR(context.Background(), RepriceSosmedResellerInput{
		FixedRate:       &fixedRate,
		IncludeInactive: boolPtr(true),
		ProviderCode:    "jap",
	})
	if err != nil {
		t.Fatalf("reprice provider-coded service: %v", err)
	}
	if res.Eligible != 1 || res.Updated != 1 {
		t.Fatalf("expected eligible/update 1, got %+v", res)
	}

	stored, err := repo.FindByID(item.ID)
	if err != nil {
		t.Fatalf("find provider-coded service: %v", err)
	}
	if stored.PriceStart != "Reseller Rp 6.750/1K" {
		t.Fatalf("unexpected provider-coded price_start: %s", stored.PriceStart)
	}
	if !strings.Contains(stored.PricePer1K, "JAP#6331") {
		t.Fatalf("expected provider service id marker, got %s", stored.PricePer1K)
	}
}
