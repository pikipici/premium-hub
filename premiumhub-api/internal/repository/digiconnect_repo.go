package repository

import (
	"strings"
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DigiConnectRepo struct {
	db *gorm.DB
}

type DigiConnectAdminRequestFilter struct {
	UserID            uuid.UUID
	Status            string
	BillingDecision   string
	PublicErrorCode   string
	InternalErrorCode string
	ServiceAlias      string
	Page              int
	Limit             int
}

func NewDigiConnectRepo(db *gorm.DB) *DigiConnectRepo {
	return &DigiConnectRepo{db: db}
}

func (r *DigiConnectRepo) DB() *gorm.DB {
	return r.db
}

func (r *DigiConnectRepo) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

func (r *DigiConnectRepo) CreateAPIKey(key *model.DigiConnectAPIKey) error {
	return r.db.Create(key).Error
}

func (r *DigiConnectRepo) SaveAPIKey(key *model.DigiConnectAPIKey) error {
	return r.db.Save(key).Error
}

func (r *DigiConnectRepo) FindAPIKeyByID(id uuid.UUID) (*model.DigiConnectAPIKey, error) {
	var key model.DigiConnectAPIKey
	err := r.db.Preload("User").First(&key, "id = ?", id).Error
	return &key, err
}

func (r *DigiConnectRepo) FindAPIKeyByHash(keyHash string) (*model.DigiConnectAPIKey, error) {
	var key model.DigiConnectAPIKey
	err := r.db.Preload("User").Where("key_hash = ?", strings.TrimSpace(keyHash)).First(&key).Error
	return &key, err
}

func (r *DigiConnectRepo) ListAPIKeysByUser(userID uuid.UUID) ([]model.DigiConnectAPIKey, error) {
	var keys []model.DigiConnectAPIKey
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&keys).Error
	return keys, err
}

func (r *DigiConnectRepo) FindAPIKeyByIDForUser(id, userID uuid.UUID) (*model.DigiConnectAPIKey, error) {
	var key model.DigiConnectAPIKey
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&key).Error
	return &key, err
}

func (r *DigiConnectRepo) LockAPIKeyByIDTx(tx *gorm.DB, id uuid.UUID) (*model.DigiConnectAPIKey, error) {
	var key model.DigiConnectAPIKey
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&key, "id = ?", id).Error
	return &key, err
}

func (r *DigiConnectRepo) CreateEntitlement(entitlement *model.DigiConnectEntitlement) error {
	return r.db.Create(entitlement).Error
}

func (r *DigiConnectRepo) SaveEntitlement(entitlement *model.DigiConnectEntitlement) error {
	return r.db.Save(entitlement).Error
}

func (r *DigiConnectRepo) FindActiveEntitlementByUser(userID uuid.UUID, now time.Time) (*model.DigiConnectEntitlement, error) {
	var entitlement model.DigiConnectEntitlement
	err := r.db.Where("user_id = ? AND status = ?", userID, "active").
		Where("expires_at IS NULL OR expires_at > ?", now).
		Order("(expires_at IS NULL) ASC, expires_at DESC, created_at DESC").
		First(&entitlement).Error
	return &entitlement, err
}

func (r *DigiConnectRepo) ListEntitlementsByUser(userID uuid.UUID) ([]model.DigiConnectEntitlement, error) {
	var rows []model.DigiConnectEntitlement
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&rows).Error
	return rows, err
}

func (r *DigiConnectRepo) CountActiveEntitlementsByPlan(planCode string, now time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&model.DigiConnectEntitlement{}).
		Where("plan_code = ? AND status = ?", strings.TrimSpace(planCode), "active").
		Where("expires_at IS NULL OR expires_at > ?", now).
		Count(&count).Error
	return count, err
}

func (r *DigiConnectRepo) AdminListEntitlements(userID uuid.UUID, page, limit int) ([]model.DigiConnectEntitlement, int64, error) {
	var rows []model.DigiConnectEntitlement
	var total int64
	q := r.db.Model(&model.DigiConnectEntitlement{})
	if userID != uuid.Nil {
		q = q.Where("user_id = ?", userID)
	}
	q.Count(&total)
	page, limit = normalizePageLimit(page, limit, 50)
	err := q.Preload("User").Offset((page - 1) * limit).Limit(limit).Order("created_at DESC").Find(&rows).Error
	return rows, total, err
}

func (r *DigiConnectRepo) CreateRequest(request *model.DigiConnectRequest) error {
	return r.db.Create(request).Error
}

func (r *DigiConnectRepo) SaveRequest(request *model.DigiConnectRequest) error {
	return r.db.Save(request).Error
}

func (r *DigiConnectRepo) FindRequestByRequestID(requestID string) (*model.DigiConnectRequest, error) {
	var request model.DigiConnectRequest
	err := r.db.Preload("User").Preload("APIKey").Where("request_id = ?", strings.TrimSpace(requestID)).First(&request).Error
	return &request, err
}

func (r *DigiConnectRepo) FindRequestByUserAndIdempotencyKey(userID uuid.UUID, key string) (*model.DigiConnectRequest, error) {
	var request model.DigiConnectRequest
	err := r.db.Where("user_id = ? AND idempotency_key = ?", userID, strings.TrimSpace(key)).First(&request).Error
	return &request, err
}

func (r *DigiConnectRepo) ListRequestsByUser(userID uuid.UUID, page, limit int) ([]model.DigiConnectRequest, int64, error) {
	var rows []model.DigiConnectRequest
	var total int64
	q := r.db.Model(&model.DigiConnectRequest{}).Where("user_id = ?", userID)
	q.Count(&total)
	page, limit = normalizePageLimit(page, limit, 20)
	err := q.Offset((page - 1) * limit).Limit(limit).Order("created_at DESC").Find(&rows).Error
	return rows, total, err
}

func (r *DigiConnectRepo) ListRequestsByUserAndPlan(userID uuid.UUID, planCode string, limit int) ([]model.DigiConnectRequest, error) {
	var rows []model.DigiConnectRequest
	_, limit = normalizePageLimit(1, limit, 8)
	err := r.db.Where("user_id = ? AND plan_code = ?", userID, strings.TrimSpace(planCode)).
		Limit(limit).
		Order("created_at DESC").
		Find(&rows).Error
	return rows, err
}

func (r *DigiConnectRepo) RequestPlanStatsByUser(userID uuid.UUID, since time.Time) (map[string]DigiConnectPlanStatsRow, error) {
	type row struct {
		PlanCode       string
		TotalRequests  int64
		CompletedCount int64
		ChargedAmount  int64
		AvgLatencyMS   float64
		LastRequestAt  *time.Time
	}
	var rows []row
	q := r.db.Model(&model.DigiConnectRequest{}).
		Select(`plan_code,
			COUNT(*) AS total_requests,
			COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_count,
			COALESCE(SUM(CASE WHEN billing_status = 'charged' THEN amount ELSE 0 END), 0) AS charged_amount,
			COALESCE(AVG(CASE WHEN router_latency_ms > 0 THEN router_latency_ms ELSE NULL END), 0) AS avg_latency_ms,
			MAX(created_at) AS last_request_at`).
		Where("user_id = ?", userID).
		Where("plan_code <> ''").
		Group("plan_code")
	if !since.IsZero() {
		q = q.Where("created_at >= ?", since)
	}
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	stats := make(map[string]DigiConnectPlanStatsRow, len(rows))
	for _, row := range rows {
		stats[row.PlanCode] = DigiConnectPlanStatsRow{
			TotalRequests:  row.TotalRequests,
			CompletedCount: row.CompletedCount,
			ChargedAmount:  row.ChargedAmount,
			AvgLatencyMS:   row.AvgLatencyMS,
			LastRequestAt:  row.LastRequestAt,
		}
	}
	return stats, nil
}

type DigiConnectPlanStatsRow struct {
	TotalRequests  int64
	CompletedCount int64
	ChargedAmount  int64
	AvgLatencyMS   float64
	LastRequestAt  *time.Time
}

func (r *DigiConnectRepo) AdminListRequests(filter DigiConnectAdminRequestFilter) ([]model.DigiConnectRequest, int64, error) {
	var rows []model.DigiConnectRequest
	var total int64
	q := r.db.Model(&model.DigiConnectRequest{})
	if filter.UserID != uuid.Nil {
		q = q.Where("user_id = ?", filter.UserID)
	}
	if strings.TrimSpace(filter.Status) != "" {
		q = q.Where("status = ?", strings.TrimSpace(filter.Status))
	}
	if strings.TrimSpace(filter.BillingDecision) != "" {
		q = q.Where("billing_decision = ?", strings.TrimSpace(filter.BillingDecision))
	}
	if strings.TrimSpace(filter.PublicErrorCode) != "" {
		q = q.Where("public_error_code = ?", strings.TrimSpace(filter.PublicErrorCode))
	}
	if strings.TrimSpace(filter.InternalErrorCode) != "" {
		q = q.Where("internal_error_code = ?", strings.TrimSpace(filter.InternalErrorCode))
	}
	if strings.TrimSpace(filter.ServiceAlias) != "" {
		q = q.Where("service_alias = ?", strings.TrimSpace(filter.ServiceAlias))
	}
	q.Count(&total)
	page, limit := normalizePageLimit(filter.Page, filter.Limit, 50)
	err := q.Preload("User").Preload("APIKey").Offset((page - 1) * limit).Limit(limit).Order("created_at DESC").Find(&rows).Error
	return rows, total, err
}

func (r *DigiConnectRepo) IncrementUsageCounter(counter *model.DigiConnectUsageCounter) error {
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "api_key_id"}, {Name: "scope"}, {Name: "window"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"count":      gorm.Expr("digiconnect_usage_counters.count + 1"),
			"updated_at": time.Now(),
		}),
	}).Create(counter).Error
}

func (r *DigiConnectRepo) GetUsageCounter(userID uuid.UUID, apiKeyID *uuid.UUID, scope, window string) (*model.DigiConnectUsageCounter, error) {
	var counter model.DigiConnectUsageCounter
	q := r.db.Where("user_id = ? AND scope = ? AND window = ?", userID, strings.TrimSpace(scope), strings.TrimSpace(window))
	if apiKeyID != nil {
		q = q.Where("api_key_id = ?", *apiKeyID)
	} else {
		q = q.Where("api_key_id IS NULL")
	}
	err := q.First(&counter).Error
	return &counter, err
}

func (r *DigiConnectRepo) RequestStatusCounts(since time.Time) (map[string]int64, error) {
	type row struct {
		Status string
		Count  int64
	}
	var rows []row
	q := r.db.Model(&model.DigiConnectRequest{}).Select("status, count(*) as count").Group("status")
	if !since.IsZero() {
		q = q.Where("created_at >= ?", since)
	}
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[string]int64, len(rows))
	for _, row := range rows {
		counts[row.Status] = row.Count
	}
	return counts, nil
}

func (r *DigiConnectRepo) RequestBillingSum(since time.Time) (int64, int64, error) {
	var count int64
	var sum int64
	q := r.db.Model(&model.DigiConnectRequest{}).Where("billing_status = ?", "charged")
	if !since.IsZero() {
		q = q.Where("created_at >= ?", since)
	}
	if err := q.Count(&count).Select("COALESCE(SUM(amount), 0)").Scan(&sum).Error; err != nil {
		return 0, 0, err
	}
	return count, sum, nil
}

func normalizePageLimit(page, limit, fallbackLimit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = fallbackLimit
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit
}
