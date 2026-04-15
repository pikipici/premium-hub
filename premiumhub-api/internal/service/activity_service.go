package service

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

var fivesimOrderReferencePattern = regexp.MustCompile(`(?i)^fivesim_order:(\d+):(charge|refund)$`)

type ActivityService struct {
	activityRepo *repository.ActivityRepo
}

type UserActivityItem struct {
	ID          string    `json:"id"`
	Source      string    `json:"source"`
	SourceLabel string    `json:"source_label"`
	Kind        string    `json:"kind"`
	Title       string    `json:"title"`
	Subtitle    string    `json:"subtitle"`
	Icon        string    `json:"icon"`
	Amount      int64     `json:"amount"`
	Direction   string    `json:"direction"`
	Status      string    `json:"status"`
	OccurredAt  time.Time `json:"occurred_at"`
}

func NewActivityService(activityRepo *repository.ActivityRepo) *ActivityService {
	return &ActivityService{activityRepo: activityRepo}
}

func (s *ActivityService) ListByUser(userID uuid.UUID, page, limit int) ([]UserActivityItem, int64, error) {
	if s.activityRepo == nil {
		return nil, 0, errors.New("konfigurasi activity belum siap")
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 20 {
		limit = 20
	}

	rows, total, err := s.activityRepo.ListByUser(userID, page, limit)
	if err != nil {
		return nil, 0, errors.New("gagal memuat riwayat aktivitas")
	}

	items := make([]UserActivityItem, 0, len(rows))
	for i := range rows {
		row := rows[i]

		item := UserActivityItem{
			ID:          fmt.Sprintf("%s:%s", normalizeActivitySource(row.Source), strings.TrimSpace(row.SourceID)),
			Source:      normalizeActivitySource(row.Source),
			SourceLabel: activitySourceLabel(row.Source),
			Kind:        activityKind(row),
			Title:       strings.TrimSpace(row.Title),
			Subtitle:    buildActivitySubtitle(row),
			Icon:        normalizeActivityIcon(row.Icon),
			Amount:      normalizeActivityAmount(row.Amount),
			Direction:   normalizeActivityDirection(row.Direction),
			Status:      normalizeActivityStatus(row),
			OccurredAt:  row.OccurredAt,
		}

		if item.ID == fmt.Sprintf("%s:", item.Source) {
			item.ID = fmt.Sprintf("%s:%d", item.Source, item.OccurredAt.UnixNano())
		}
		if item.Title == "" {
			item.Title = "Aktivitas"
		}

		items = append(items, item)
	}

	return items, total, nil
}

func normalizeActivitySource(source string) string {
	switch strings.ToLower(strings.TrimSpace(source)) {
	case "premium_apps":
		return "premium_apps"
	case "nokos":
		return "nokos"
	default:
		return "other"
	}
}

func activitySourceLabel(source string) string {
	switch normalizeActivitySource(source) {
	case "premium_apps":
		return "Premium Apps"
	case "nokos":
		return "Nokos"
	default:
		return "Lainnya"
	}
}

func activityKind(row repository.UserActivityRow) string {
	source := normalizeActivitySource(row.Source)
	if source == "premium_apps" {
		return "premium_order"
	}
	if source == "nokos" {
		if strings.EqualFold(strings.TrimSpace(row.Status), "refund") {
			return "nokos_refund"
		}
		return "nokos_purchase"
	}
	return "other"
}

func normalizeActivityIcon(raw string) string {
	icon := strings.TrimSpace(raw)
	if icon != "" {
		return icon
	}
	return "📦"
}

func normalizeActivityAmount(amount int64) int64 {
	if amount < 0 {
		return -amount
	}
	return amount
}

func normalizeActivityDirection(direction string) string {
	switch strings.ToLower(strings.TrimSpace(direction)) {
	case "credit":
		return "credit"
	default:
		return "debit"
	}
}

func normalizeActivityStatus(row repository.UserActivityRow) string {
	source := normalizeActivitySource(row.Source)
	status := strings.ToLower(strings.TrimSpace(row.Status))
	if source == "premium_apps" {
		if status == "" {
			return "pending"
		}
		return status
	}
	if source == "nokos" {
		if status == "refund" {
			return "refund"
		}
		return "purchase"
	}
	if status == "" {
		return "unknown"
	}
	return status
}

func buildActivitySubtitle(row repository.UserActivityRow) string {
	source := normalizeActivitySource(row.Source)
	if source == "premium_apps" {
		duration := ""
		if row.DurationMonth > 0 {
			duration = fmt.Sprintf("%d bulan", row.DurationMonth)
		}

		accountType := strings.TrimSpace(row.AccountType)
		switch {
		case duration != "" && accountType != "":
			return fmt.Sprintf("%s • %s", duration, accountType)
		case duration != "":
			return duration
		case accountType != "":
			return accountType
		default:
			return "Order premium"
		}
	}

	if source == "nokos" {
		if orderID, action, ok := parseFiveSimOrderRef(row.Reference); ok {
			if action == "refund" {
				return fmt.Sprintf("Refund #%s", orderID)
			}
			return fmt.Sprintf("Pembelian #%s", orderID)
		}

		if strings.EqualFold(strings.TrimSpace(row.Status), "refund") {
			return "Mutasi refund wallet"
		}
		return "Mutasi pembelian wallet"
	}

	return ""
}

func parseFiveSimOrderRef(reference string) (orderID string, action string, ok bool) {
	trimmed := strings.TrimSpace(reference)
	if trimmed == "" {
		return "", "", false
	}

	matches := fivesimOrderReferencePattern.FindStringSubmatch(trimmed)
	if len(matches) != 3 {
		return "", "", false
	}

	actionNormalized := strings.ToLower(strings.TrimSpace(matches[2]))
	if actionNormalized != "charge" && actionNormalized != "refund" {
		return "", "", false
	}

	if actionNormalized == "charge" {
		actionNormalized = "purchase"
	}

	return matches[1], actionNormalized, true
}
