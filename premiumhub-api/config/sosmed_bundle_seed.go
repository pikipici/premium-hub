package config

import (
	"errors"
	"log"
	"strings"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const sosmedBundleSeedPriceModeComputed = "computed"

type defaultSosmedBundlePackageSeed struct {
	Key           string
	Title         string
	Subtitle      string
	Description   string
	Platform      string
	Badge         string
	IsHighlighted bool
	SortOrder     int
	Variants      []defaultSosmedBundleVariantSeed
}

type defaultSosmedBundleVariantSeed struct {
	Key         string
	Name        string
	Description string
	SortOrder   int
	Items       []defaultSosmedBundleItemSeed
}

type defaultSosmedBundleItemSeed struct {
	ServiceCode    string
	Label          string
	QuantityUnits  int64
	TargetStrategy string
	SortOrder      int
}

func ensureDefaultSosmedBundlePackages(db *gorm.DB) error {
	if db == nil {
		return errors.New("db wajib diisi")
	}

	for _, packageSeed := range defaultSosmedBundlePackageSeeds() {
		if err := upsertDefaultSosmedBundlePackage(db, packageSeed); err != nil {
			return err
		}
	}
	return nil
}

func upsertDefaultSosmedBundlePackage(db *gorm.DB, seed defaultSosmedBundlePackageSeed) error {
	pkg, err := findOrCreateDefaultSosmedBundlePackage(db, seed)
	if err != nil {
		return err
	}

	for _, variantSeed := range seed.Variants {
		if err := upsertDefaultSosmedBundleVariant(db, pkg, variantSeed); err != nil {
			return err
		}
	}
	return nil
}

func findOrCreateDefaultSosmedBundlePackage(db *gorm.DB, seed defaultSosmedBundlePackageSeed) (*model.SosmedBundlePackage, error) {
	key := strings.TrimSpace(seed.Key)
	var existing model.SosmedBundlePackage
	err := db.Where("key = ?", key).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		pkg := model.SosmedBundlePackage{
			Key:           key,
			Title:         strings.TrimSpace(seed.Title),
			Subtitle:      strings.TrimSpace(seed.Subtitle),
			Description:   strings.TrimSpace(seed.Description),
			Platform:      strings.TrimSpace(seed.Platform),
			Badge:         strings.TrimSpace(seed.Badge),
			IsHighlighted: seed.IsHighlighted,
			IsActive:      true,
			SortOrder:     seed.SortOrder,
		}
		if createErr := db.Create(&pkg).Error; createErr != nil {
			return nil, createErr
		}
		return &pkg, nil
	}
	if err != nil {
		return nil, err
	}
	return &existing, nil
}

func upsertDefaultSosmedBundleVariant(db *gorm.DB, pkg *model.SosmedBundlePackage, seed defaultSosmedBundleVariantSeed) error {
	services, missing, err := loadDefaultSosmedBundleServices(db, seed.Items)
	if err != nil {
		return err
	}
	isActive := len(missing) == 0
	if !isActive {
		log.Printf("skip active sosmed bundle variant %s/%s: missing active services %s", pkg.Key, seed.Key, strings.Join(missing, ", "))
	}

	variant, created, err := findOrCreateDefaultSosmedBundleVariant(db, pkg.ID, seed, isActive)
	if err != nil {
		return err
	}
	if !isActive {
		return nil
	}
	if !created {
		shouldBackfill, err := shouldBackfillDefaultSosmedBundleVariant(db, variant, seed)
		if err != nil {
			return err
		}
		if !shouldBackfill {
			return nil
		}
		return db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(variant).Update("is_active", true).Error; err != nil {
				return err
			}
			return createDefaultSosmedBundleItems(tx, variant.ID, seed.Items, services)
		})
	}

	return createDefaultSosmedBundleItems(db, variant.ID, seed.Items, services)
}

func shouldBackfillDefaultSosmedBundleVariant(db *gorm.DB, variant *model.SosmedBundleVariant, seed defaultSosmedBundleVariantSeed) (bool, error) {
	if variant == nil || variant.IsActive {
		return false, nil
	}
	var itemCount int64
	if err := db.Model(&model.SosmedBundleItem{}).Where("bundle_variant_id = ?", variant.ID).Count(&itemCount).Error; err != nil {
		return false, err
	}
	if itemCount != 0 {
		return false, nil
	}
	return strings.TrimSpace(variant.Key) == strings.TrimSpace(seed.Key) &&
		strings.TrimSpace(variant.Name) == strings.TrimSpace(seed.Name) &&
		strings.TrimSpace(variant.Description) == strings.TrimSpace(seed.Description) &&
		strings.TrimSpace(variant.PriceMode) == sosmedBundleSeedPriceModeComputed &&
		variant.FixedPrice == 0 &&
		variant.DiscountPercent == 0 &&
		variant.DiscountAmount == 0 &&
		variant.SortOrder == seed.SortOrder, nil
}

func createDefaultSosmedBundleItems(db *gorm.DB, variantID uuid.UUID, itemSeeds []defaultSosmedBundleItemSeed, services map[string]model.SosmedService) error {
	for _, itemSeed := range itemSeeds {
		service := services[strings.TrimSpace(itemSeed.ServiceCode)]
		item := model.SosmedBundleItem{
			BundleVariantID: variantID,
			SosmedServiceID: service.ID,
			Label:           strings.TrimSpace(itemSeed.Label),
			QuantityUnits:   itemSeed.QuantityUnits,
			TargetStrategy:  normalizeDefaultSosmedBundleTargetStrategy(itemSeed.TargetStrategy),
			SortOrder:       itemSeed.SortOrder,
			IsActive:        true,
		}
		if err := db.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func findOrCreateDefaultSosmedBundleVariant(db *gorm.DB, packageID uuid.UUID, seed defaultSosmedBundleVariantSeed, isActive bool) (*model.SosmedBundleVariant, bool, error) {
	var existing model.SosmedBundleVariant
	err := db.Where("bundle_package_id = ? AND key = ?", packageID, strings.TrimSpace(seed.Key)).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		variant := model.SosmedBundleVariant{
			BundlePackageID: packageID,
			Key:             strings.TrimSpace(seed.Key),
			Name:            strings.TrimSpace(seed.Name),
			Description:     strings.TrimSpace(seed.Description),
			PriceMode:       sosmedBundleSeedPriceModeComputed,
			FixedPrice:      0,
			DiscountPercent: 0,
			DiscountAmount:  0,
			IsActive:        isActive,
			SortOrder:       seed.SortOrder,
		}
		if createErr := db.Create(&variant).Error; createErr != nil {
			return nil, false, createErr
		}
		if updateErr := db.Model(&variant).Update("is_active", isActive).Error; updateErr != nil {
			return nil, false, updateErr
		}
		return &variant, true, nil
	}
	if err != nil {
		return nil, false, err
	}
	return &existing, false, nil
}

func loadDefaultSosmedBundleServices(db *gorm.DB, items []defaultSosmedBundleItemSeed) (map[string]model.SosmedService, []string, error) {
	services := make(map[string]model.SosmedService, len(items))
	missing := []string{}
	for _, item := range items {
		code := strings.TrimSpace(item.ServiceCode)
		var service model.SosmedService
		err := db.Where("code = ? AND is_active = ?", code, true).First(&service).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			missing = append(missing, code)
			continue
		}
		if err != nil {
			return nil, nil, err
		}
		services[code] = service
	}
	return services, missing, nil
}

func normalizeDefaultSosmedBundleTargetStrategy(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "same_target"
	}
	return value
}

func defaultSosmedBundleSeedServiceCodes() []string {
	seen := map[string]bool{}
	codes := []string{}
	for _, pkg := range defaultSosmedBundlePackageSeeds() {
		for _, variant := range pkg.Variants {
			for _, item := range variant.Items {
				code := strings.TrimSpace(item.ServiceCode)
				if code == "" || seen[code] {
					continue
				}
				seen[code] = true
				codes = append(codes, code)
			}
		}
	}
	return codes
}

func defaultSosmedBundlePackageSeeds() []defaultSosmedBundlePackageSeed {
	return []defaultSosmedBundlePackageSeed{
		{
			Key:           "umkm-starter",
			Title:         "UMKM Starter",
			Subtitle:      "Instagram growth bundle",
			Description:   "Meningkatkan social proof supaya toko terlihat lebih terpercaya di mata calon pembeli.",
			Platform:      "instagram",
			Badge:         "Paket Launching",
			IsHighlighted: true,
			SortOrder:     10,
			Variants: []defaultSosmedBundleVariantSeed{
				bundleVariantSeed("starter", "Starter (Entry Level)", 10, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-2989", "500 IG Followers", 500, 10),
					bundleItemSeed("jap-8216", "1.000 IG Likes", 1000, 20),
					bundleItemSeed("jap-9333", "5.000 IG Story Views", 5000, 30),
				}),
				bundleVariantSeed("growth", "Growth (Mid Level)", 20, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-2989", "2.000 IG Followers", 2000, 10),
					bundleItemSeed("jap-8216", "5.000 IG Likes", 5000, 20),
					bundleItemSeed("jap-9333", "20.000 IG Story Views", 20000, 30),
				}),
				bundleVariantSeed("pro", "Pro (High Level)", 30, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-2989", "5.000 IG Followers", 5000, 10),
					bundleItemSeed("jap-8216", "10.000 IG Likes", 10000, 20),
					bundleItemSeed("jap-9333", "50.000 IG Story Views", 50000, 30),
				}),
			},
		},
		{
			Key:         "tiktok-booster",
			Title:       "TikTok Booster",
			Subtitle:    "FYP starter bundle",
			Description: "Mendapatkan engagement awal agar konten masuk For You Page (FYP).",
			Platform:    "tiktok",
			Badge:       "Trending",
			SortOrder:   20,
			Variants: []defaultSosmedBundleVariantSeed{
				bundleVariantSeed("viral-basic", "Viral Basic", 10, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-10173", "1.000 Likes", 1000, 10),
					bundleItemSeed("jap-10161", "10.000 Views (ID)", 10000, 20),
					bundleItemSeed("jap-8777", "500 Followers", 500, 30),
				}),
				bundleVariantSeed("viral-pro", "Viral Pro", 20, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-10173", "5.000 Likes", 5000, 10),
					bundleItemSeed("jap-10161", "50.000 Views (ID)", 50000, 20),
					bundleItemSeed("jap-8777", "2.000 Followers", 2000, 30),
				}),
				bundleVariantSeed("tiktok-shop-booster", "TikTok Shop Booster", 30, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-10173", "10.000 Likes", 10000, 10),
					bundleItemSeed("jap-10161", "100.000 Views (ID)", 100000, 20),
					bundleItemSeed("jap-8777", "5.000 Followers", 5000, 30),
				}),
			},
		},
		{
			Key:         "content-creator",
			Title:       "Content Creator",
			Subtitle:    "YouTube channel growth bundle",
			Description: "Bantu lewatin fase awal monetisasi dan tingkatkan kredibilitas channel.",
			Platform:    "youtube",
			Badge:       "Monetisasi",
			SortOrder:   30,
			Variants: []defaultSosmedBundleVariantSeed{
				bundleVariantSeed("monetisasi-assist", "Monetisasi Assist", 10, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-5971", "5.000 Views", 5000, 10),
					bundleItemSeed("jap-9318", "200 Likes", 200, 20),
					bundleItemSeed("jap-4395", "500 Subscribers", 500, 30),
				}),
				bundleVariantSeed("channel-growth", "Channel Growth", 20, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-5971", "20.000 Views", 20000, 10),
					bundleItemSeed("jap-9318", "1.000 Likes", 1000, 20),
					bundleItemSeed("jap-4395", "1.000 Subscribers", 1000, 30),
				}),
				bundleVariantSeed("full-boost", "Full Boost", 30, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-5971", "50.000 Views", 50000, 10),
					bundleItemSeed("jap-9318", "5.000 Likes", 5000, 20),
					bundleItemSeed("jap-4395", "2.000 Subscribers", 2000, 30),
				}),
			},
		},
		{
			Key:         "toko-online-pro",
			Title:       "Toko Online Pro",
			Subtitle:    "Instagram + Shopee bundle",
			Description: "Kombinasi layanan IG + Shopee buat toko yang aktif di dua platform sekaligus.",
			Platform:    "mixed",
			Badge:       "All in One",
			SortOrder:   40,
			Variants: []defaultSosmedBundleVariantSeed{
				bundleVariantSeed("toko-baru", "Toko Baru", 10, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-2989", "500 IG Followers", 500, 10),
					bundleItemSeed("jap-9575", "1.000 Auto Likes", 1000, 20),
					bundleItemSeed("jap-9214", "100 Shopee Boost", 100, 30),
				}),
				bundleVariantSeed("toko-aktif", "Toko Aktif", 20, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-2989", "2.000 IG Followers", 2000, 10),
					bundleItemSeed("jap-9575", "5.000 Auto Likes", 5000, 20),
					bundleItemSeed("jap-9214", "500 Shopee Boost", 500, 30),
				}),
				bundleVariantSeed("toko-dominan", "Toko Dominan", 30, []defaultSosmedBundleItemSeed{
					bundleItemSeed("jap-2989", "5.000 IG Followers", 5000, 10),
					bundleItemSeed("jap-9575", "10.000 Auto Likes", 10000, 20),
					bundleItemSeed("jap-9214", "1.000 Shopee Boost", 1000, 30),
				}),
			},
		},
	}
}

func bundleVariantSeed(key string, name string, sortOrder int, items []defaultSosmedBundleItemSeed) defaultSosmedBundleVariantSeed {
	return defaultSosmedBundleVariantSeed{
		Key:         key,
		Name:        name,
		Description: name,
		SortOrder:   sortOrder,
		Items:       items,
	}
}

func bundleItemSeed(serviceCode string, label string, quantityUnits int64, sortOrder int) defaultSosmedBundleItemSeed {
	return defaultSosmedBundleItemSeed{
		ServiceCode:    serviceCode,
		Label:          label,
		QuantityUnits:  quantityUnits,
		TargetStrategy: "same_target",
		SortOrder:      sortOrder,
	}
}
