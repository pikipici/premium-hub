package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const sosmedJAPProviderCode = "jap"

var (
	sosmedJAPRefillPattern    = regexp.MustCompile(`(?i)\[Refill:\s*([^\]]+)\]`)
	sosmedJAPStartTimePattern = regexp.MustCompile(`(?i)\[Start Time:\s*([^\]]+)\]`)
	sosmedJAPSpeedPattern     = regexp.MustCompile(`(?i)\[Speed:\s*([^\]]+)\]`)
	sosmedJAPMaxPattern       = regexp.MustCompile(`(?i)\[Max:\s*([^\]]+)\]`)
)

type ImportSelectedJAPServicesInput struct {
	ServiceIDs []int64 `json:"service_ids"`
}

type PreviewSelectedJAPServicesResult struct {
	Mode       string                         `json:"mode"`
	RateSource string                         `json:"rate_source"`
	RateUsed   float64                        `json:"rate_used"`
	Warning    string                         `json:"warning,omitempty"`
	Requested  int                            `json:"requested"`
	Matched    int                            `json:"matched"`
	NotFound   []string                       `json:"not_found"`
	Items      []PreviewSelectedJAPServiceRow `json:"items"`
}

type PreviewSelectedJAPServiceRow struct {
	ServiceID                string   `json:"service_id"`
	ProviderName             string   `json:"provider_name"`
	ProviderCategory         string   `json:"provider_category"`
	ProviderType             string   `json:"provider_type"`
	ProviderRate             string   `json:"provider_rate"`
	ProviderCurrency         string   `json:"provider_currency"`
	Min                      string   `json:"min"`
	Max                      string   `json:"max"`
	RefillSupported          bool     `json:"refill_supported"`
	CancelSupported          bool     `json:"cancel_supported"`
	DripfeedSupported        bool     `json:"dripfeed_supported"`
	LocalCode                string   `json:"local_code"`
	LocalTitle               string   `json:"local_title"`
	LocalCategoryCode        string   `json:"local_category_code"`
	PlatformLabel            string   `json:"platform_label"`
	PriceStart               string   `json:"price_start"`
	PricePer1K               string   `json:"price_per_1k"`
	StartTime                string   `json:"start_time"`
	ETA                      string   `json:"eta"`
	Refill                   string   `json:"refill"`
	FulfillmentMode          string   `json:"fulfillment_mode"`
	RequiredOrderFields      []string `json:"required_order_fields"`
	OptionalOrderFields      []string `json:"optional_order_fields"`
	SupportedForInitialOrder bool     `json:"supported_for_initial_order"`
	ExistingID               string   `json:"existing_id,omitempty"`
	ExistingCode             string   `json:"existing_code,omitempty"`
	ExistingActive           bool     `json:"existing_active,omitempty"`
	Warnings                 []string `json:"warnings"`
}

type ImportSelectedJAPServicesResult struct {
	Mode       string                `json:"mode"`
	RateSource string                `json:"rate_source"`
	RateUsed   float64               `json:"rate_used"`
	Warning    string                `json:"warning,omitempty"`
	Requested  int                   `json:"requested"`
	Created    int                   `json:"created"`
	Updated    int                   `json:"updated"`
	Skipped    int                   `json:"skipped"`
	NotFound   []string              `json:"not_found"`
	Items      []model.SosmedService `json:"items"`
}

func (s *SosmedServiceService) PreviewSelectedFromJAP(ctx context.Context, input ImportSelectedJAPServicesInput) (*PreviewSelectedJAPServicesResult, error) {
	if s.japCatalogProvider == nil {
		return nil, errors.New("provider katalog JAP belum terhubung")
	}

	serviceIDs, err := normalizeSelectedJAPServiceIDs(input.ServiceIDs)
	if err != nil {
		return nil, err
	}

	items, err := s.repo.List(true)
	if err != nil {
		return nil, errors.New("gagal memuat master layanan sosmed")
	}

	modeUsed, rateUsed, rateSource, warning, err := s.resolveResellerFXRate(ctx, "", nil)
	if err != nil {
		return nil, err
	}

	providerServices, err := s.japCatalogProvider.GetServices(ctx)
	if err != nil {
		return nil, err
	}

	byID := make(map[string]JAPServiceItem, len(providerServices))
	for _, item := range providerServices {
		id := strings.TrimSpace(string(item.Service))
		if id == "" {
			continue
		}
		byID[id] = item
	}

	result := &PreviewSelectedJAPServicesResult{
		Mode:       modeUsed,
		RateSource: rateSource,
		RateUsed:   rateUsed,
		Warning:    warning,
		Requested:  len(serviceIDs),
		NotFound:   []string{},
		Items:      []PreviewSelectedJAPServiceRow{},
	}

	nextSort := nextSosmedServiceSortOrder(items)
	for _, serviceID := range serviceIDs {
		providerItem, ok := byID[serviceID]
		if !ok {
			result.NotFound = append(result.NotFound, serviceID)
			continue
		}

		row, err := s.buildJAPPreviewRow(providerItem, nextSort, rateUsed)
		if err != nil {
			return nil, err
		}

		if existing, lookupErr := s.repo.FindByProvider(sosmedJAPProviderCode, serviceID); lookupErr == nil && existing != nil && existing.ID != uuid.Nil {
			row.ExistingID = existing.ID.String()
			row.ExistingCode = existing.Code
			row.ExistingActive = existing.IsActive
		} else if !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			return nil, errors.New("gagal mengecek layanan JAP yang sudah ada")
		}

		result.Matched++
		result.Items = append(result.Items, row)
		nextSort += 10
	}

	sort.Slice(result.Items, func(left, right int) bool {
		return result.Items[left].ServiceID < result.Items[right].ServiceID
	})

	return result, nil
}

func (s *SosmedServiceService) ImportSelectedFromJAP(ctx context.Context, input ImportSelectedJAPServicesInput) (*ImportSelectedJAPServicesResult, error) {
	if s.japCatalogProvider == nil {
		return nil, errors.New("provider katalog JAP belum terhubung")
	}

	serviceIDs, err := normalizeSelectedJAPServiceIDs(input.ServiceIDs)
	if err != nil {
		return nil, err
	}

	items, err := s.repo.List(true)
	if err != nil {
		return nil, errors.New("gagal memuat master layanan sosmed")
	}

	modeUsed, rateUsed, rateSource, warning, err := s.resolveResellerFXRate(ctx, "", nil)
	if err != nil {
		return nil, err
	}

	providerServices, err := s.japCatalogProvider.GetServices(ctx)
	if err != nil {
		return nil, err
	}

	byID := make(map[string]JAPServiceItem, len(providerServices))
	for _, item := range providerServices {
		id := strings.TrimSpace(string(item.Service))
		if id == "" {
			continue
		}
		byID[id] = item
	}

	result := &ImportSelectedJAPServicesResult{
		Mode:       modeUsed,
		RateSource: rateSource,
		RateUsed:   rateUsed,
		Warning:    warning,
		Requested:  len(serviceIDs),
		NotFound:   []string{},
		Items:      []model.SosmedService{},
	}

	nextSort := nextSosmedServiceSortOrder(items)
	for _, serviceID := range serviceIDs {
		providerItem, ok := byID[serviceID]
		if !ok {
			result.NotFound = append(result.NotFound, serviceID)
			result.Skipped++
			continue
		}

		draft, err := s.buildJAPDraftService(providerItem, nextSort, rateUsed)
		if err != nil {
			return nil, err
		}

		existing, lookupErr := s.repo.FindByProvider(sosmedJAPProviderCode, serviceID)
		if lookupErr != nil && !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			return nil, errors.New("gagal mengecek layanan JAP yang sudah ada")
		}
		if errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			existing, lookupErr = s.repo.FindByCode(draft.Code)
			if lookupErr != nil && !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
				return nil, errors.New("gagal mengecek kode layanan JAP")
			}
		}

		if existing != nil && existing.ID != uuid.Nil {
			mergeImportedJAPDraft(existing, draft)
			if err := s.repo.Update(existing); err != nil {
				return nil, errors.New("gagal memperbarui draft layanan JAP")
			}
			result.Updated++
			result.Items = append(result.Items, *existing)
			continue
		}

		shouldStayInactive := !draft.IsActive
		if err := s.repo.Create(draft); err != nil {
			return nil, errors.New("gagal membuat draft layanan JAP")
		}
		if shouldStayInactive && draft.IsActive {
			// GORM default:true can hydrate zero bool to true on create; imported JAP rows must stay drafts.
			draft.IsActive = false
			if err := s.repo.Update(draft); err != nil {
				return nil, errors.New("gagal menonaktifkan draft layanan JAP")
			}
		}
		result.Created++
		result.Items = append(result.Items, *draft)
		nextSort += 10
	}

	sort.Slice(result.Items, func(left, right int) bool {
		return result.Items[left].SortOrder < result.Items[right].SortOrder
	})

	return result, nil
}

func (s *SosmedServiceService) buildJAPPreviewRow(item JAPServiceItem, sortOrder int, rateUsed float64) (PreviewSelectedJAPServiceRow, error) {
	draft, err := s.buildJAPDraftService(item, sortOrder, rateUsed)
	if err != nil {
		return PreviewSelectedJAPServiceRow{}, err
	}

	requiredFields, optionalFields, fulfillmentMode, supportedForInitialOrder, warnings := analyzeJAPOrderRequirements(item.Type)
	if !item.Refill {
		warnings = append(warnings, "Supplier tidak support refill.")
	}

	serviceID := strings.TrimSpace(string(item.Service))
	return PreviewSelectedJAPServiceRow{
		ServiceID:                serviceID,
		ProviderName:             strings.TrimSpace(item.Name),
		ProviderCategory:         strings.TrimSpace(item.Category),
		ProviderType:             strings.TrimSpace(item.Type),
		ProviderRate:             draft.ProviderRate,
		ProviderCurrency:         draft.ProviderCurrency,
		Min:                      strings.TrimSpace(item.Min),
		Max:                      strings.TrimSpace(item.Max),
		RefillSupported:          item.Refill,
		CancelSupported:          item.Cancel,
		DripfeedSupported:        item.Dripfeed,
		LocalCode:                draft.Code,
		LocalTitle:               draft.Title,
		LocalCategoryCode:        draft.CategoryCode,
		PlatformLabel:            draft.PlatformLabel,
		PriceStart:               draft.PriceStart,
		PricePer1K:               draft.PricePer1K,
		StartTime:                draft.StartTime,
		ETA:                      draft.ETA,
		Refill:                   draft.Refill,
		FulfillmentMode:          fulfillmentMode,
		RequiredOrderFields:      requiredFields,
		OptionalOrderFields:      optionalFields,
		SupportedForInitialOrder: supportedForInitialOrder,
		Warnings:                 warnings,
	}, nil
}

func analyzeJAPOrderRequirements(providerType string) (requiredFields []string, optionalFields []string, fulfillmentMode string, supportedForInitialOrder bool, warnings []string) {
	normalized := strings.ToLower(strings.TrimSpace(providerType))
	switch normalized {
	case "", "default":
		return []string{"service", "link", "quantity"}, []string{"runs", "interval"}, "simple_quantity", true, []string{}
	case "package":
		return []string{"service", "link"}, []string{}, "package", false, []string{"Tipe Package belum masuk jalur order otomatis awal."}
	case "custom comments":
		return []string{"service", "link", "comments"}, []string{}, "custom_comments", false, []string{"Butuh input comments khusus dari user sebelum bisa order otomatis."}
	case "custom comments package":
		return []string{"service", "link", "comments"}, []string{}, "custom_comments_package", false, []string{"Butuh input comments khusus dari user sebelum bisa order otomatis."}
	case "mentions with hashtags":
		return []string{"service", "link", "quantity", "usernames", "hashtags"}, []string{}, "mentions_with_hashtags", false, []string{"Butuh usernames dan hashtags sebelum bisa order otomatis."}
	case "mentions custom list":
		return []string{"service", "link", "usernames"}, []string{}, "mentions_custom_list", false, []string{"Butuh list username sebelum bisa order otomatis."}
	case "mentions hashtag":
		return []string{"service", "link", "quantity", "hashtag"}, []string{}, "mentions_hashtag", false, []string{"Butuh hashtag sumber sebelum bisa order otomatis."}
	case "mentions user followers":
		return []string{"service", "link", "quantity", "username"}, []string{}, "mentions_user_followers", false, []string{"Butuh username sumber sebelum bisa order otomatis."}
	case "mentions media likers":
		return []string{"service", "link", "quantity", "media"}, []string{}, "mentions_media_likers", false, []string{"Butuh media URL sumber sebelum bisa order otomatis."}
	case "subscriptions":
		return []string{"service", "username", "min", "max", "delay"}, []string{"posts", "old_posts", "expiry"}, "subscription", false, []string{"Tipe subscription butuh form dan lifecycle khusus."}
	case "web traffic":
		return []string{"service", "link", "quantity", "country", "device", "type_of_traffic"}, []string{"runs", "interval", "google_keyword", "referring_url"}, "web_traffic", false, []string{"Tipe web traffic butuh field campaign khusus."}
	case "comment likes":
		return []string{"service", "link", "quantity", "username"}, []string{}, "comment_likes", false, []string{"Butuh username pemilik komentar sebelum bisa order otomatis."}
	case "poll":
		return []string{"service", "link", "quantity", "answer_number"}, []string{}, "poll", false, []string{"Butuh nomor jawaban poll sebelum bisa order otomatis."}
	case "comment replies":
		return []string{"service", "link", "username", "comments"}, []string{}, "comment_replies", false, []string{"Butuh username dan replies sebelum bisa order otomatis."}
	case "invites from groups":
		return []string{"service", "link", "quantity", "groups"}, []string{}, "group_invites", false, []string{"Butuh list group sebelum bisa order otomatis."}
	default:
		return []string{"service"}, []string{}, "unknown", false, []string{"Tipe JAP belum dikenali, review manual dulu sebelum diaktifkan."}
	}
}

func normalizeSelectedJAPServiceIDs(items []int64) ([]string, error) {
	if len(items) == 0 {
		return nil, errors.New("service_ids wajib diisi")
	}

	normalized := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		if item <= 0 {
			return nil, errors.New("service_ids harus berisi angka positif")
		}
		text := strconv.FormatInt(item, 10)
		if _, exists := seen[text]; exists {
			continue
		}
		seen[text] = struct{}{}
		normalized = append(normalized, text)
	}

	if len(normalized) == 0 {
		return nil, errors.New("service_ids wajib diisi")
	}
	return normalized, nil
}

func nextSosmedServiceSortOrder(items []model.SosmedService) int {
	maxSort := 100
	for _, item := range items {
		if item.SortOrder > maxSort {
			maxSort = item.SortOrder
		}
	}

	next := ((maxSort / 10) + 1) * 10
	if next <= maxSort {
		next = maxSort + 10
	}
	return next
}

func (s *SosmedServiceService) buildJAPDraftService(item JAPServiceItem, sortOrder int, rateUsed float64) (*model.SosmedService, error) {
	serviceID := strings.TrimSpace(string(item.Service))
	if serviceID == "" {
		return nil, errors.New("service JAP tidak punya ID")
	}

	categoryCode := detectJAPLocalCategoryCode(item)
	if categoryCode == "" {
		return nil, fmt.Errorf("kategori lokal belum dikenali untuk service JAP #%s", serviceID)
	}

	platformLabel := detectJAPPlatformLabel(item)
	refillValue := extractJAPBracketValue(item.Name, sosmedJAPRefillPattern)
	startTimeValue := formatSosmedStartTimeValue(extractJAPBracketValue(item.Name, sosmedJAPStartTimePattern))
	etaValue := formatSosmedETAValue(extractJAPBracketValue(item.Name, sosmedJAPSpeedPattern))
	maxValue := extractJAPBracketValue(item.Name, sosmedJAPMaxPattern)
	refillLabel := formatSosmedRefillValue(refillValue)
	title := buildJAPDisplayTitle(baseJAPServiceName(item.Name), refillLabel)
	badgeText := buildJAPBadgeText(refillLabel, item.Cancel)
	trustBadges := buildJAPTrustBadges(refillLabel, startTimeValue, item.Cancel)

	rateUSD, err := strconv.ParseFloat(strings.TrimSpace(item.Rate), 64)
	if err != nil || rateUSD <= 0 {
		return nil, fmt.Errorf("rate JAP #%s tidak valid", serviceID)
	}

	idrPer1K := int64(math.Round(rateUSD * rateUsed))
	if idrPer1K < 0 {
		idrPer1K = 0
	}
	idrText := formatIDRThousands(idrPer1K)
	usdText := normalizeUSDText(rateUSD)

	code := buildJAPLocalCode(serviceID)
	summary := buildJAPSummary(platformLabel, categoryCode, refillLabel, maxValue)
	theme := detectJAPTheme(platformLabel)

	return &model.SosmedService{
		CategoryCode:              categoryCode,
		Code:                      code,
		Title:                     title,
		ProviderCode:              sosmedJAPProviderCode,
		ProviderServiceID:         serviceID,
		ProviderTitle:             strings.TrimSpace(item.Name),
		ProviderCategory:          strings.TrimSpace(item.Category),
		ProviderType:              strings.TrimSpace(item.Type),
		ProviderRate:              usdText,
		ProviderCurrency:          "USD",
		ProviderRefillSupported:   item.Refill,
		ProviderCancelSupported:   item.Cancel,
		ProviderDripfeedSupported: item.Dripfeed,
		Summary:                   summary,
		PlatformLabel:             platformLabel,
		BadgeText:                 badgeText,
		Theme:                     theme,
		MinOrder:                  strings.TrimSpace(item.Min),
		StartTime:                 startTimeValue,
		Refill:                    refillLabel,
		ETA:                       etaValue,
		PriceStart:                fmt.Sprintf("Reseller Rp %s/1K", idrText),
		PricePer1K:                fmt.Sprintf("Reseller Rp %s per 1K • USD %s • JAP#%s", idrText, usdText, serviceID),
		CheckoutPrice:             0,
		TrustBadges:               trustBadges,
		SortOrder:                 sortOrder,
		IsActive:                  false,
	}, nil
}

func mergeImportedJAPDraft(existing *model.SosmedService, draft *model.SosmedService) {
	if existing == nil || draft == nil {
		return
	}

	preserveUserFacing := existing.CheckoutPrice > 0

	existing.ProviderCode = draft.ProviderCode
	existing.ProviderServiceID = draft.ProviderServiceID
	existing.ProviderTitle = draft.ProviderTitle
	existing.ProviderCategory = draft.ProviderCategory
	existing.ProviderType = draft.ProviderType
	existing.ProviderRate = draft.ProviderRate
	existing.ProviderCurrency = draft.ProviderCurrency
	existing.ProviderRefillSupported = draft.ProviderRefillSupported
	existing.ProviderCancelSupported = draft.ProviderCancelSupported
	existing.ProviderDripfeedSupported = draft.ProviderDripfeedSupported
	existing.PriceStart = draft.PriceStart
	existing.PricePer1K = draft.PricePer1K
	existing.MinOrder = draft.MinOrder
	existing.StartTime = draft.StartTime
	existing.Refill = draft.Refill
	existing.ETA = draft.ETA

	if strings.TrimSpace(existing.CategoryCode) == "" {
		existing.CategoryCode = draft.CategoryCode
	}
	if strings.TrimSpace(existing.PlatformLabel) == "" {
		existing.PlatformLabel = draft.PlatformLabel
	}
	if existing.SortOrder == 0 {
		existing.SortOrder = draft.SortOrder
	}

	if preserveUserFacing {
		return
	}

	existing.Code = draft.Code
	existing.Title = draft.Title
	existing.Summary = draft.Summary
	existing.PlatformLabel = draft.PlatformLabel
	existing.BadgeText = draft.BadgeText
	existing.Theme = draft.Theme
	existing.TrustBadges = draft.TrustBadges
	existing.IsActive = draft.IsActive
}

func baseJAPServiceName(raw string) string {
	base := strings.TrimSpace(raw)
	if idx := strings.Index(base, "["); idx >= 0 {
		base = strings.TrimSpace(base[:idx])
	}
	base = strings.Join(strings.Fields(base), " ")
	return base
}

func buildJAPDisplayTitle(baseName, refillLabel string) string {
	baseName = strings.TrimSpace(baseName)
	if baseName == "" {
		return "Layanan JAP"
	}

	switch refillLabel {
	case "", "-", "Tidak Ada":
		return baseName
	default:
		if strings.HasPrefix(strings.ToLower(refillLabel), "otomatis") {
			return strings.TrimSpace(baseName + " Refill " + refillLabel)
		}
		return strings.TrimSpace(baseName + " Refill " + refillLabel)
	}
}

func buildJAPBadgeText(refillLabel string, cancelSupported bool) string {
	switch refillLabel {
	case "", "-":
		if cancelSupported {
			return "Bisa Cancel"
		}
		return "Draft JAP"
	case "Tidak Ada":
		if cancelSupported {
			return "Tanpa Refill"
		}
		return "Tanpa Refill"
	default:
		return strings.TrimSpace("Refill " + refillLabel)
	}
}

func buildJAPTrustBadges(refillLabel, startTimeValue string, cancelSupported bool) []string {
	badges := []string{"No Password"}

	switch refillLabel {
	case "", "-":
	case "Tidak Ada":
		badges = append(badges, "Tanpa Refill")
	default:
		badges = append(badges, "Refill "+refillLabel)
	}

	if startTimeValue != "" && startTimeValue != "-" {
		badges = append(badges, "Mulai "+startTimeValue)
	}
	if cancelSupported {
		badges = append(badges, "Bisa Cancel")
	}

	return sanitizeSosmedTrustBadges(badges)
}

func buildJAPSummary(platformLabel, categoryCode, refillLabel, maxValue string) string {
	action := "boost sosial media"
	switch categoryCode {
	case "followers":
		action = "penambahan followers"
	case "likes":
		action = "boost like dan social proof"
	case "views":
		action = "dorong views dan exposure konten"
	case "comments":
		action = "komentar untuk engagement"
	case "shares":
		action = "share dan save untuk distribusi konten"
	}

	parts := []string{
		fmt.Sprintf("Draft impor dari JAP untuk %s di %s.", action, platformLabel),
	}

	switch refillLabel {
	case "", "-":
	case "Tidak Ada":
		parts = append(parts, "Supplier belum support refill.")
	default:
		parts = append(parts, "Supplier support refill "+strings.ToLower(refillLabel)+".")
	}

	if strings.TrimSpace(maxValue) != "" {
		parts = append(parts, "Batas maksimal supplier "+strings.TrimSpace(maxValue)+".")
	}

	parts = append(parts, "Review pricing dulu sebelum diaktifkan ke katalog publik.")
	return strings.Join(parts, " ")
}

func extractJAPBracketValue(raw string, pattern *regexp.Regexp) string {
	if pattern == nil {
		return ""
	}
	match := pattern.FindStringSubmatch(raw)
	if len(match) < 2 {
		return ""
	}
	return strings.TrimSpace(match[1])
}

func detectJAPPlatformLabel(item JAPServiceItem) string {
	haystack := strings.ToLower(strings.TrimSpace(item.Category + " " + item.Name))
	switch {
	case strings.Contains(haystack, "instagram"):
		return "Instagram"
	case strings.Contains(haystack, "tiktok"):
		return "TikTok"
	case strings.Contains(haystack, "youtube"):
		return "YouTube"
	case strings.Contains(haystack, "telegram"):
		return "Telegram"
	case strings.Contains(haystack, "facebook"):
		return "Facebook"
	case strings.Contains(haystack, "twitter"), strings.Contains(haystack, "x - twitter"):
		return "X / Twitter"
	case strings.Contains(haystack, "spotify"):
		return "Spotify"
	default:
		return "Social Media"
	}
}

func detectJAPPlatformCodeSlug(platformLabel string) string {
	switch strings.ToLower(strings.TrimSpace(platformLabel)) {
	case "instagram":
		return "instagram"
	case "tiktok":
		return "tiktok"
	case "youtube":
		return "youtube"
	case "telegram":
		return "telegram"
	case "facebook":
		return "facebook"
	case "x / twitter":
		return "twitter"
	case "spotify":
		return "spotify"
	default:
		return "social"
	}
}

func detectJAPLocalCategoryCode(item JAPServiceItem) string {
	haystack := strings.ToLower(strings.TrimSpace(item.Category + " " + item.Name))
	switch {
	case strings.Contains(haystack, "comment"), strings.Contains(haystack, "reply"):
		return "comments"
	case strings.Contains(haystack, "follower"), strings.Contains(haystack, "member"), strings.Contains(haystack, "friend"), strings.Contains(haystack, "subscriber"):
		return "followers"
	case strings.Contains(haystack, "like"), strings.Contains(haystack, "reaction"), strings.Contains(haystack, "heart"):
		return "likes"
	case strings.Contains(haystack, "share"), strings.Contains(haystack, "save"), strings.Contains(haystack, "bookmark"), strings.Contains(haystack, "retweet"), strings.Contains(haystack, "download"), strings.Contains(haystack, "repost"):
		return "shares"
	case strings.Contains(haystack, "view"), strings.Contains(haystack, "watchtime"), strings.Contains(haystack, "listener"), strings.Contains(haystack, "play"), strings.Contains(haystack, "reach"), strings.Contains(haystack, "impression"), strings.Contains(haystack, "visit"):
		return "views"
	default:
		return ""
	}
}

func detectJAPTheme(platformLabel string) string {
	switch strings.ToLower(strings.TrimSpace(platformLabel)) {
	case "instagram":
		return "pink"
	case "tiktok":
		return "mint"
	case "youtube":
		return "orange"
	case "telegram":
		return "blue"
	case "facebook":
		return "blue"
	case "x / twitter":
		return "gray"
	default:
		return "blue"
	}
}

func buildJAPLocalCode(serviceID string) string {
	return normalizeSosmedServiceCode("jap-" + strings.TrimSpace(serviceID))
}

func formatSosmedStartTimeValue(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	value = strings.ReplaceAll(value, "Hrs", "Jam")
	value = strings.ReplaceAll(value, "hrs", "jam")
	value = strings.ReplaceAll(value, "Hr", "Jam")
	value = strings.ReplaceAll(value, "hr", "jam")
	value = strings.ReplaceAll(value, "Hours", "Jam")
	value = strings.ReplaceAll(value, "hours", "jam")
	value = strings.ReplaceAll(value, "Hour", "Jam")
	value = strings.ReplaceAll(value, "hour", "jam")
	value = strings.ReplaceAll(value, "Days", "Hari")
	value = strings.ReplaceAll(value, "days", "hari")
	value = strings.ReplaceAll(value, "Day", "Hari")
	value = strings.ReplaceAll(value, "day", "hari")
	value = strings.Join(strings.Fields(value), " ")
	return strings.TrimSpace(value)
}

func (s *SosmedServiceService) SyncAllJAPMetadata(ctx context.Context) (int, error) {
	if s.japCatalogProvider == nil {
		return 0, errors.New("provider katalog JAP belum terhubung")
	}

	providerServices, err := s.japCatalogProvider.GetServices(ctx)
	if err != nil {
		return 0, err
	}

	byID := make(map[string]JAPServiceItem, len(providerServices))
	for _, item := range providerServices {
		id := strings.TrimSpace(string(item.Service))
		if id == "" {
			continue
		}
		byID[id] = item
	}

	items, err := s.repo.List(true)
	if err != nil {
		return 0, err
	}

	_, rateUsed, _, _, err := s.resolveResellerFXRate(ctx, "", nil)
	if err != nil {
		return 0, err
	}

	updated := 0
	for idx := range items {
		item := &items[idx]

		providerID := extractSosmedProviderServiceID(*item)
		if providerID == "" {
			continue
		}

		providerItem, ok := byID[providerID]
		if !ok {
			continue
		}

		rateUSD, err := strconv.ParseFloat(strings.TrimSpace(providerItem.Rate), 64)
		if err != nil || rateUSD <= 0 {
			continue
		}
		usdText := normalizeUSDText(rateUSD)

		changed := false

		if item.ProviderCode == "" {
			item.ProviderCode = sosmedJAPProviderCode
			changed = true
		}
		if item.ProviderServiceID != providerID {
			item.ProviderServiceID = providerID
			changed = true
		}

		if item.ProviderRate != usdText {
			item.ProviderRate = usdText
			changed = true
		}
		if item.ProviderCurrency != "USD" {
			item.ProviderCurrency = "USD"
			changed = true
		}
		if item.ProviderCategory != strings.TrimSpace(providerItem.Category) {
			item.ProviderCategory = strings.TrimSpace(providerItem.Category)
			changed = true
		}
		if item.ProviderType != strings.TrimSpace(providerItem.Type) {
			item.ProviderType = strings.TrimSpace(providerItem.Type)
			changed = true
		}
		if item.ProviderTitle != strings.TrimSpace(providerItem.Name) {
			item.ProviderTitle = strings.TrimSpace(providerItem.Name)
			changed = true
		}

		priceStart, pricePer1K := formatSosmedResellerPriceFields(rateUSD, rateUsed, providerID)
		if item.PriceStart != priceStart {
			item.PriceStart = priceStart
			changed = true
		}
		if item.PricePer1K != pricePer1K {
			item.PricePer1K = pricePer1K
			changed = true
		}

		if changed {
			if err := s.repo.Update(item); err == nil {
				updated++
			}
		}
	}

	return updated, nil
}
