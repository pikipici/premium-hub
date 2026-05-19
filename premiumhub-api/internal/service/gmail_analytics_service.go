package service

import (
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"gorm.io/gorm"
)

// GmailAnalyticsService aggregates marketplace performance metrics for
// the admin dashboard. Pure read-only — no mutations.
type GmailAnalyticsService struct {
	db *gorm.DB
}

func NewGmailAnalyticsService(db *gorm.DB) *GmailAnalyticsService {
	return &GmailAnalyticsService{db: db}
}

// WeekStats represents one week's marketplace activity bucket.
type WeekStats struct {
	WeekStart    time.Time `json:"week_start"`
	InventoryIn  int64     `json:"inventory_in"`  // gmail verified that week (sell-side)
	InventoryOut int64     `json:"inventory_out"` // gmail sold that week (buy-side)
	Revenue      int64     `json:"revenue"`       // sum sold_price (gross from buyers)
	Cost         int64     `json:"cost"`          // sum buy_price (paid out to sellers)
	Margin       int64     `json:"margin"`        // revenue - cost
}

// AggregateStats summarizes weekly buckets.
type AggregateStats struct {
	Weeks        int   `json:"weeks"`
	InventoryIn  int64 `json:"inventory_in"`
	InventoryOut int64 `json:"inventory_out"`
	Revenue      int64 `json:"revenue"`
	Cost         int64 `json:"cost"`
	Margin       int64 `json:"margin"`
}

// GmailWeeklyAnalytics is the full overview returned to admin FE.
type GmailWeeklyAnalytics struct {
	Weeks  []WeekStats    `json:"weeks"`
	Totals AggregateStats `json:"totals"`
}

// GetWeeklyOverview returns N weeks of buckets, ending at week-of(now).
// Default 8 weeks. Each bucket is Monday 00:00 → next Monday 00:00 UTC.
func (s *GmailAnalyticsService) GetWeeklyOverview(weeks int) (*GmailWeeklyAnalytics, error) {
	if weeks <= 0 || weeks > 52 {
		weeks = 8
	}
	now := time.Now().UTC()
	thisWeekStart := startOfWeek(now)
	earliest := thisWeekStart.AddDate(0, 0, -7*(weeks-1))

	out := &GmailWeeklyAnalytics{
		Weeks:  make([]WeekStats, 0, weeks),
		Totals: AggregateStats{Weeks: weeks},
	}

	for i := 0; i < weeks; i++ {
		weekStart := earliest.AddDate(0, 0, 7*i)
		weekEnd := weekStart.AddDate(0, 0, 7)

		var ws WeekStats
		ws.WeekStart = weekStart

		// InventoryIn = gmail verified in [weekStart, weekEnd) — verified_at column.
		if err := s.db.Model(&model.GmailAccount{}).
			Where("verified_at >= ? AND verified_at < ? AND status IN ?", weekStart, weekEnd,
				[]string{model.GmailStatusVerified, model.GmailStatusSold}).
			Count(&ws.InventoryIn).Error; err != nil {
			return nil, err
		}

		// InventoryOut + Revenue + Cost = gmail sold in window — sold_at + sold_price + buy_price.
		row := struct {
			Cnt     int64
			Revenue int64
			Cost    int64
		}{}
		if err := s.db.Model(&model.GmailAccount{}).
			Where("sold_at >= ? AND sold_at < ?", weekStart, weekEnd).
			Select("COUNT(*) AS cnt, COALESCE(SUM(sold_price),0) AS revenue, COALESCE(SUM(buy_price),0) AS cost").
			Scan(&row).Error; err != nil {
			return nil, err
		}
		ws.InventoryOut = row.Cnt
		ws.Revenue = row.Revenue
		ws.Cost = row.Cost
		ws.Margin = ws.Revenue - ws.Cost

		out.Weeks = append(out.Weeks, ws)
		out.Totals.InventoryIn += ws.InventoryIn
		out.Totals.InventoryOut += ws.InventoryOut
		out.Totals.Revenue += ws.Revenue
		out.Totals.Cost += ws.Cost
		out.Totals.Margin += ws.Margin
	}

	return out, nil
}

// startOfWeek returns the Monday 00:00 UTC of the week containing t.
func startOfWeek(t time.Time) time.Time {
	t = t.UTC()
	wd := int(t.Weekday())
	if wd == 0 {
		wd = 7 // Sunday → 7 (so Monday=1, Sunday=7)
	}
	dayOffset := wd - 1 // Monday=0, Sunday=6
	monday := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -dayOffset)
	return monday
}

// Compile-time guard so linter knows we may extend with repo deps later.
var _ = repository.NewGmailAccountRepo
