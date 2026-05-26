package repository

import (
	"errors"
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WalletWithdrawalRepo is data access for wallet_withdrawals + paired
// ledger entries. Lives next to WalletRepo on purpose — most call
// sites need both (lock user, debit earn, write hold ledger, persist
// withdrawal in one transaction).
type WalletWithdrawalRepo struct {
	db *gorm.DB
}

func NewWalletWithdrawalRepo(db *gorm.DB) *WalletWithdrawalRepo {
	return &WalletWithdrawalRepo{db: db}
}

// DB exposes the underlying *gorm.DB for service layers that want to
// run a multi-statement transaction across both repos.
func (r *WalletWithdrawalRepo) DB() *gorm.DB {
	return r.db
}

// Transaction runs fn inside a single DB transaction.
func (r *WalletWithdrawalRepo) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

// Create inserts a new withdrawal row. Caller is responsible for
// running this inside a transaction with paired user-balance update +
// ledger entry — see WalletWithdrawalService.CreateRequest.
func (r *WalletWithdrawalRepo) Create(w *model.WalletWithdrawal) error {
	return r.db.Create(w).Error
}

// CreateTx variant that runs on a caller-supplied transaction.
func (r *WalletWithdrawalRepo) CreateTx(tx *gorm.DB, w *model.WalletWithdrawal) error {
	return tx.Create(w).Error
}

// SaveTx persists field updates inside a transaction.
func (r *WalletWithdrawalRepo) SaveTx(tx *gorm.DB, w *model.WalletWithdrawal) error {
	return tx.Save(w).Error
}

// GetByID fetches a single withdrawal by id, regardless of user.
// Used by admin handlers.
func (r *WalletWithdrawalRepo) GetByID(id uuid.UUID) (*model.WalletWithdrawal, error) {
	var w model.WalletWithdrawal
	if err := r.db.First(&w, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

// GetByIDForUser fetches a single withdrawal but only if it belongs to
// the user — handler uses this for ownership-scoped lookups.
func (r *WalletWithdrawalRepo) GetByIDForUser(id, userID uuid.UUID) (*model.WalletWithdrawal, error) {
	var w model.WalletWithdrawal
	if err := r.db.First(&w, "id = ? AND user_id = ?", id, userID).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

// LockByIDTx returns the withdrawal row with FOR UPDATE inside the tx.
// Use before any state transition (approve/reject/cancel/mark-paid).
func (r *WalletWithdrawalRepo) LockByIDTx(tx *gorm.DB, id uuid.UUID) (*model.WalletWithdrawal, error) {
	var w model.WalletWithdrawal
	if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&w, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

// ListByUser returns the user's withdrawals paginated, newest first.
func (r *WalletWithdrawalRepo) ListByUser(userID uuid.UUID, page, limit int) ([]model.WalletWithdrawal, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var rows []model.WalletWithdrawal
	var total int64
	q := r.db.Model(&model.WalletWithdrawal{}).Where("user_id = ?", userID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := q.Order("created_at DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// AdminListFilters are the optional filters supported by the admin
// listing endpoint. Empty fields = no filter.
type AdminListFilters struct {
	Status string
	UserID *uuid.UUID
}

// ListAdmin returns withdrawals for the admin queue, paginated. When
// filters.Status is empty, returns every status (admin can pick).
func (r *WalletWithdrawalRepo) ListAdmin(filters AdminListFilters, page, limit int) ([]model.WalletWithdrawal, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	q := r.db.Model(&model.WalletWithdrawal{})
	if filters.Status != "" {
		q = q.Where("status = ?", filters.Status)
	}
	if filters.UserID != nil {
		q = q.Where("user_id = ?", *filters.UserID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []model.WalletWithdrawal
	if err := q.Order("created_at DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// CountTodayByUser returns the count and gross-amount sum of the user's
// withdrawals submitted since `since` that still count toward the daily
// limit. Cancelled / rejected requests are excluded — refunding them
// must give the user back their daily quota.
//
// `since` is typically the local-time start-of-day in Asia/Jakarta —
// the service layer is responsible for computing that correctly.
func (r *WalletWithdrawalRepo) CountTodayByUser(userID uuid.UUID, since time.Time) (count int64, totalAmount int64, err error) {
	return r.CountTodayByUserTx(r.db, userID, since)
}

func (r *WalletWithdrawalRepo) CountTodayByUserTx(tx *gorm.DB, userID uuid.UUID, since time.Time) (count int64, totalAmount int64, err error) {
	q := tx.Model(&model.WalletWithdrawal{}).
		Where("user_id = ? AND created_at >= ?", userID, since).
		Where("status NOT IN (?)", []string{
			model.WithdrawalStatusCancelled,
			model.WithdrawalStatusRejected,
		})

	if err := q.Count(&count).Error; err != nil {
		return 0, 0, err
	}

	type sumRow struct {
		Total int64
	}
	var s sumRow
	if err := q.Select("COALESCE(SUM(amount), 0) AS total").Scan(&s).Error; err != nil {
		return 0, 0, err
	}
	return count, s.Total, nil
}

// ErrWithdrawalNotFound is returned by GetByID/GetByIDForUser when
// gorm.ErrRecordNotFound bubbles up — service layer translates it to a
// 404 response.
var ErrWithdrawalNotFound = errors.New("withdrawal not found")
