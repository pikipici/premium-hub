package service

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

const (
	MaintenanceTargetGlobal = "global"
	MaintenanceTargetPrefix = "prefix"
	MaintenanceTargetExact  = "exact"
)

const (
	defaultMaintenanceTitle   = "Halaman Sedang Maintenance"
	defaultMaintenanceMessage = "Sistem lagi maintenance sebentar. Coba lagi beberapa saat ya."
)

type MaintenanceService struct {
	repo *repository.MaintenanceRuleRepo
}

func NewMaintenanceService(repo *repository.MaintenanceRuleRepo) *MaintenanceService {
	return &MaintenanceService{repo: repo}
}

type CreateMaintenanceRuleInput struct {
	Name             string     `json:"name" binding:"required"`
	TargetType       string     `json:"target_type" binding:"required"`
	TargetPath       string     `json:"target_path"`
	Title            string     `json:"title"`
	Message          string     `json:"message"`
	IsActive         *bool      `json:"is_active"`
	AllowAdminBypass *bool      `json:"allow_admin_bypass"`
	StartsAt         *time.Time `json:"starts_at"`
	EndsAt           *time.Time `json:"ends_at"`
}

type UpdateMaintenanceRuleInput struct {
	Name             *string    `json:"name"`
	TargetType       *string    `json:"target_type"`
	TargetPath       *string    `json:"target_path"`
	Title            *string    `json:"title"`
	Message          *string    `json:"message"`
	IsActive         *bool      `json:"is_active"`
	AllowAdminBypass *bool      `json:"allow_admin_bypass"`
	StartsAt         *time.Time `json:"starts_at"`
	EndsAt           *time.Time `json:"ends_at"`
	ClearStartsAt    bool       `json:"clear_starts_at"`
	ClearEndsAt      bool       `json:"clear_ends_at"`
}

type MaintenanceEvaluation struct {
	Active  bool                   `json:"active"`
	Title   string                 `json:"title"`
	Message string                 `json:"message"`
	Rule    *model.MaintenanceRule `json:"rule,omitempty"`
}

func normalizeMaintenancePath(path string) string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return "/"
	}

	if !strings.HasPrefix(trimmed, "/") {
		trimmed = "/" + trimmed
	}

	if idx := strings.Index(trimmed, "?"); idx >= 0 {
		trimmed = trimmed[:idx]
	}
	if idx := strings.Index(trimmed, "#"); idx >= 0 {
		trimmed = trimmed[:idx]
	}

	for strings.Contains(trimmed, "//") {
		trimmed = strings.ReplaceAll(trimmed, "//", "/")
	}

	if len(trimmed) > 1 {
		trimmed = strings.TrimSuffix(trimmed, "/")
	}

	if trimmed == "" {
		return "/"
	}

	return trimmed
}

func normalizeMaintenanceTargetType(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func validateMaintenanceWindow(startsAt, endsAt *time.Time) error {
	if startsAt != nil && endsAt != nil && !endsAt.After(*startsAt) {
		return errors.New("ends_at harus lebih besar dari starts_at")
	}
	return nil
}

func sanitizeMaintenanceTarget(targetType, targetPath string) (string, string, error) {
	normalizedType := normalizeMaintenanceTargetType(targetType)
	if normalizedType == "" {
		normalizedType = MaintenanceTargetExact
	}

	switch normalizedType {
	case MaintenanceTargetGlobal:
		return normalizedType, "/", nil
	case MaintenanceTargetPrefix, MaintenanceTargetExact:
		normalizedPath := normalizeMaintenancePath(targetPath)
		if normalizedPath == "" || normalizedPath == "/" {
			if normalizedType == MaintenanceTargetExact {
				return "", "", errors.New("target_path untuk exact wajib spesifik, tidak bisa root")
			}
		}
		return normalizedType, normalizedPath, nil
	default:
		return "", "", fmt.Errorf("target_type tidak valid: %s", normalizedType)
	}
}

func matchPrefix(path, prefix string) bool {
	if prefix == "/" {
		return true
	}
	if path == prefix {
		return true
	}
	return strings.HasPrefix(path, prefix+"/")
}

func (s *MaintenanceService) List(includeInactive bool) ([]model.MaintenanceRule, error) {
	return s.repo.List(includeInactive)
}

func (s *MaintenanceService) Create(input CreateMaintenanceRuleInput) (*model.MaintenanceRule, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("nama rule wajib diisi")
	}

	targetType, targetPath, err := sanitizeMaintenanceTarget(input.TargetType, input.TargetPath)
	if err != nil {
		return nil, err
	}

	if err := validateMaintenanceWindow(input.StartsAt, input.EndsAt); err != nil {
		return nil, err
	}

	isActive := false
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	allowAdminBypass := true
	if input.AllowAdminBypass != nil {
		allowAdminBypass = *input.AllowAdminBypass
	}

	rule := &model.MaintenanceRule{
		Name:             name,
		TargetType:       targetType,
		TargetPath:       targetPath,
		Title:            strings.TrimSpace(input.Title),
		Message:          strings.TrimSpace(input.Message),
		IsActive:         isActive,
		AllowAdminBypass: allowAdminBypass,
		StartsAt:         input.StartsAt,
		EndsAt:           input.EndsAt,
	}

	if err := s.repo.Create(rule); err != nil {
		return nil, errors.New("gagal membuat rule maintenance")
	}

	return rule, nil
}

func (s *MaintenanceService) Update(id uuid.UUID, input UpdateMaintenanceRuleInput) (*model.MaintenanceRule, error) {
	rule, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("rule maintenance tidak ditemukan")
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, errors.New("nama rule wajib diisi")
		}
		rule.Name = name
	}

	nextType := rule.TargetType
	if input.TargetType != nil {
		nextType = *input.TargetType
	}
	nextPath := rule.TargetPath
	if input.TargetPath != nil {
		nextPath = *input.TargetPath
	}

	targetType, targetPath, err := sanitizeMaintenanceTarget(nextType, nextPath)
	if err != nil {
		return nil, err
	}
	rule.TargetType = targetType
	rule.TargetPath = targetPath

	if input.Title != nil {
		rule.Title = strings.TrimSpace(*input.Title)
	}
	if input.Message != nil {
		rule.Message = strings.TrimSpace(*input.Message)
	}
	if input.IsActive != nil {
		rule.IsActive = *input.IsActive
	}
	if input.AllowAdminBypass != nil {
		rule.AllowAdminBypass = *input.AllowAdminBypass
	}

	if input.ClearStartsAt {
		rule.StartsAt = nil
	} else if input.StartsAt != nil {
		rule.StartsAt = input.StartsAt
	}

	if input.ClearEndsAt {
		rule.EndsAt = nil
	} else if input.EndsAt != nil {
		rule.EndsAt = input.EndsAt
	}

	if err := validateMaintenanceWindow(rule.StartsAt, rule.EndsAt); err != nil {
		return nil, err
	}

	if err := s.repo.Update(rule); err != nil {
		return nil, errors.New("gagal memperbarui rule maintenance")
	}

	return rule, nil
}

func (s *MaintenanceService) Delete(id uuid.UUID) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return errors.New("rule maintenance tidak ditemukan")
	}

	if err := s.repo.Delete(id); err != nil {
		return errors.New("gagal menghapus rule maintenance")
	}

	return nil
}

func (s *MaintenanceService) Evaluate(path string, isAdmin bool) (*MaintenanceEvaluation, error) {
	normalizedPath := normalizeMaintenancePath(path)
	at := time.Now().UTC()

	rules, err := s.repo.ActiveAt(at)
	if err != nil {
		return nil, errors.New("gagal evaluasi maintenance")
	}

	type matchedRule struct {
		rule  model.MaintenanceRule
		score int
	}

	matches := make([]matchedRule, 0)
	for _, rule := range rules {
		matched := false
		score := 0

		switch rule.TargetType {
		case MaintenanceTargetGlobal:
			matched = true
			score = 10
		case MaintenanceTargetExact:
			if normalizedPath == normalizeMaintenancePath(rule.TargetPath) {
				matched = true
				score = 400
			}
		case MaintenanceTargetPrefix:
			if matchPrefix(normalizedPath, normalizeMaintenancePath(rule.TargetPath)) {
				matched = true
				score = 200 + len(rule.TargetPath)
			}
		}

		if !matched {
			continue
		}
		if isAdmin && rule.AllowAdminBypass {
			continue
		}

		matches = append(matches, matchedRule{rule: rule, score: score})
	}

	if len(matches) == 0 {
		return &MaintenanceEvaluation{Active: false}, nil
	}

	sort.Slice(matches, func(i, j int) bool {
		if matches[i].score == matches[j].score {
			return matches[i].rule.CreatedAt.After(matches[j].rule.CreatedAt)
		}
		return matches[i].score > matches[j].score
	})

	selected := matches[0].rule
	title := strings.TrimSpace(selected.Title)
	if title == "" {
		title = defaultMaintenanceTitle
	}

	message := strings.TrimSpace(selected.Message)
	if message == "" {
		message = defaultMaintenanceMessage
	}

	return &MaintenanceEvaluation{
		Active:  true,
		Title:   title,
		Message: message,
		Rule:    &selected,
	}, nil
}
