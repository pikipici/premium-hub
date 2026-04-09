package repository

import (
	"strings"
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ConvertOrderFilter struct {
	AssetType string
	Status    string
	Query     string
}

type ConvertRepo struct {
	db *gorm.DB
}

func NewConvertRepo(db *gorm.DB) *ConvertRepo {
	return &ConvertRepo{db: db}
}

func (r *ConvertRepo) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

func (r *ConvertRepo) CountPricingRules() (int64, error) {
	var total int64
	err := r.db.Model(&model.ConvertPricingRule{}).Count(&total).Error
	return total, err
}

func (r *ConvertRepo) CountLimitRules() (int64, error) {
	var total int64
	err := r.db.Model(&model.ConvertLimitRule{}).Count(&total).Error
	return total, err
}

func (r *ConvertRepo) CreatePricingRule(rule *model.ConvertPricingRule) error {
	return r.db.Create(rule).Error
}

func (r *ConvertRepo) CreateLimitRule(rule *model.ConvertLimitRule) error {
	return r.db.Create(rule).Error
}

func (r *ConvertRepo) ListPricingRules() ([]model.ConvertPricingRule, error) {
	var rows []model.ConvertPricingRule
	err := r.db.Order("asset_type ASC").Find(&rows).Error
	return rows, err
}

func (r *ConvertRepo) ListLimitRules() ([]model.ConvertLimitRule, error) {
	var rows []model.ConvertLimitRule
	err := r.db.Order("asset_type ASC").Find(&rows).Error
	return rows, err
}

func (r *ConvertRepo) FindPricingRuleByAsset(assetType string) (*model.ConvertPricingRule, error) {
	var row model.ConvertPricingRule
	err := r.db.Where("asset_type = ?", assetType).First(&row).Error
	return &row, err
}

func (r *ConvertRepo) FindLimitRuleByAsset(assetType string) (*model.ConvertLimitRule, error) {
	var row model.ConvertLimitRule
	err := r.db.Where("asset_type = ?", assetType).First(&row).Error
	return &row, err
}

func (r *ConvertRepo) SavePricingRule(rule *model.ConvertPricingRule) error {
	return r.db.Save(rule).Error
}

func (r *ConvertRepo) SaveLimitRule(rule *model.ConvertLimitRule) error {
	return r.db.Save(rule).Error
}

func (r *ConvertRepo) FindOrderByID(orderID uuid.UUID) (*model.ConvertOrder, error) {
	var row model.ConvertOrder
	err := r.db.Where("id = ?", orderID).First(&row).Error
	return &row, err
}

func (r *ConvertRepo) FindOrderByIDAndUser(orderID, userID uuid.UUID) (*model.ConvertOrder, error) {
	var row model.ConvertOrder
	err := r.db.Where("id = ? AND user_id = ?", orderID, userID).First(&row).Error
	return &row, err
}

func (r *ConvertRepo) FindOrderByIdempotencyKey(userID uuid.UUID, key string) (*model.ConvertOrder, error) {
	var row model.ConvertOrder
	err := r.db.Where("user_id = ? AND idempotency_key = ?", userID, key).Order("created_at DESC").First(&row).Error
	return &row, err
}

func (r *ConvertRepo) CreateOrderTx(tx *gorm.DB, row *model.ConvertOrder) error {
	return tx.Create(row).Error
}

func (r *ConvertRepo) SaveOrderTx(tx *gorm.DB, row *model.ConvertOrder) error {
	return tx.Save(row).Error
}

func (r *ConvertRepo) SaveOrder(row *model.ConvertOrder) error {
	return r.db.Save(row).Error
}

func (r *ConvertRepo) ListExpiredOrders(statuses []string, now time.Time, limit int) ([]model.ConvertOrder, error) {
	var rows []model.ConvertOrder

	q := r.db.Model(&model.ConvertOrder{}).
		Where("expires_at IS NOT NULL AND expires_at <= ?", now).
		Order("expires_at ASC")
	if len(statuses) > 0 {
		q = q.Where("status IN ?", statuses)
	}
	if limit > 0 {
		q = q.Limit(limit)
	}

	err := q.Find(&rows).Error
	return rows, err
}

func (r *ConvertRepo) LockOrderByIDTx(tx *gorm.DB, orderID uuid.UUID) (*model.ConvertOrder, error) {
	var row model.ConvertOrder
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", orderID).First(&row).Error
	return &row, err
}

func (r *ConvertRepo) CreateEventTx(tx *gorm.DB, row *model.ConvertOrderEvent) error {
	return tx.Create(row).Error
}

func (r *ConvertRepo) ListEventsByOrder(orderID uuid.UUID, limit int) ([]model.ConvertOrderEvent, error) {
	var rows []model.ConvertOrderEvent
	q := r.db.Where("order_id = ?", orderID).Order("created_at ASC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.Find(&rows).Error
	return rows, err
}

func (r *ConvertRepo) CreateProofTx(tx *gorm.DB, row *model.ConvertProof) error {
	return tx.Create(row).Error
}

func (r *ConvertRepo) ListProofsByOrder(orderID uuid.UUID) ([]model.ConvertProof, error) {
	var rows []model.ConvertProof
	err := r.db.Where("order_id = ?", orderID).Order("created_at DESC").Find(&rows).Error
	return rows, err
}

func (r *ConvertRepo) CreateTrackingTokenTx(tx *gorm.DB, row *model.ConvertTrackingToken) error {
	return tx.Create(row).Error
}

func (r *ConvertRepo) DeactivateTrackingTokenByOrderIDTx(tx *gorm.DB, orderID uuid.UUID) error {
	return tx.Model(&model.ConvertTrackingToken{}).
		Where("order_id = ? AND is_active = ?", orderID, true).
		Update("is_active", false).Error
}

func (r *ConvertRepo) FindTrackingToken(token string) (*model.ConvertTrackingToken, error) {
	var row model.ConvertTrackingToken
	err := r.db.Preload("Order").Where("token = ? AND is_active = ?", token, true).First(&row).Error
	return &row, err
}

func (r *ConvertRepo) FindTrackingTokenByOrderID(orderID uuid.UUID) (*model.ConvertTrackingToken, error) {
	var row model.ConvertTrackingToken
	err := r.db.Where("order_id = ? AND is_active = ?", orderID, true).First(&row).Error
	return &row, err
}

func (r *ConvertRepo) ListOrdersByUser(userID uuid.UUID, page, limit int, filter ConvertOrderFilter) ([]model.ConvertOrder, int64, error) {
	var rows []model.ConvertOrder
	var total int64

	q := r.db.Model(&model.ConvertOrder{}).Where("user_id = ?", userID)
	q = applyConvertOrderFilter(q, filter)

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := q.Order("created_at DESC").Offset((page - 1) * limit).Limit(limit).Find(&rows).Error
	return rows, total, err
}

func (r *ConvertRepo) ListOrdersAdmin(page, limit int, filter ConvertOrderFilter) ([]model.ConvertOrder, int64, error) {
	var rows []model.ConvertOrder
	var total int64

	q := r.db.Model(&model.ConvertOrder{}).Preload("User")
	q = applyConvertOrderFilter(q, filter)

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := q.Order("created_at DESC").Offset((page - 1) * limit).Limit(limit).Find(&rows).Error
	return rows, total, err
}

func (r *ConvertRepo) SumUserDailySourceAmount(userID uuid.UUID, assetType string, start, end time.Time, includeStatuses []string) (int64, error) {
	var total int64

	q := r.db.Model(&model.ConvertOrder{}).
		Where("user_id = ?", userID).
		Where("asset_type = ?", assetType).
		Where("created_at >= ? AND created_at < ?", start, end)

	if len(includeStatuses) > 0 {
		q = q.Where("status IN ?", includeStatuses)
	}

	err := q.Select("COALESCE(SUM(source_amount), 0)").Scan(&total).Error
	return total, err
}

func applyConvertOrderFilter(q *gorm.DB, filter ConvertOrderFilter) *gorm.DB {
	if filter.AssetType != "" {
		q = q.Where("asset_type = ?", filter.AssetType)
	}
	if filter.Status != "" {
		q = q.Where("status = ?", filter.Status)
	}

	search := strings.ToLower(strings.TrimSpace(filter.Query))
	if search != "" {
		like := "%" + search + "%"
		q = q.Where(
			"LOWER(CAST(id AS TEXT)) LIKE ? OR LOWER(source_channel) LIKE ? OR LOWER(source_account) LIKE ? OR LOWER(destination_bank) LIKE ? OR LOWER(destination_account_number) LIKE ? OR LOWER(destination_account_name) LIKE ?",
			like, like, like, like, like, like,
		)
	}

	return q
}
