package repository

import (
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// GmailAccountRepo handles all CRUD + lifecycle queries for the
// gmail_accounts table. Most state transitions need to be driven from
// service.GmailService inside a wallet_repo transaction (so the seller
// payout ledger row commits atomically with the verify), so this repo
// exposes Tx variants for the methods that participate.
type GmailAccountRepo struct {
	db *gorm.DB
}

func NewGmailAccountRepo(db *gorm.DB) *GmailAccountRepo {
	return &GmailAccountRepo{db: db}
}

func (r *GmailAccountRepo) DB() *gorm.DB { return r.db }

func (r *GmailAccountRepo) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

// Create inserts a new gmail account row.
func (r *GmailAccountRepo) Create(g *model.GmailAccount) error {
	return r.db.Create(g).Error
}

// CreateTx variant on a caller-supplied transaction.
func (r *GmailAccountRepo) CreateTx(tx *gorm.DB, g *model.GmailAccount) error {
	return tx.Create(g).Error
}

// SaveTx persists field updates inside a transaction.
func (r *GmailAccountRepo) SaveTx(tx *gorm.DB, g *model.GmailAccount) error {
	return tx.Save(g).Error
}

// LockByIDTx returns the row with FOR UPDATE inside the tx. Use before
// any state transition (verify, reject, sell, dispose).
func (r *GmailAccountRepo) LockByIDTx(tx *gorm.DB, id uuid.UUID) (*model.GmailAccount, error) {
	var g model.GmailAccount
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&g, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

// GetByID fetches a single account by ID.
func (r *GmailAccountRepo) GetByID(id uuid.UUID) (*model.GmailAccount, error) {
	var g model.GmailAccount
	if err := r.db.First(&g, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

// GetByIDForUser scopes the lookup to a specific user — used in
// user-side handlers (GetMine).
func (r *GmailAccountRepo) GetByIDForUser(id, userID uuid.UUID) (*model.GmailAccount, error) {
	var g model.GmailAccount
	if err := r.db.First(&g, "id = ? AND created_by_user_id = ?", id, userID).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

// GetByEmail is used during slot generation to enforce platform-wide
// email uniqueness before persisting.
func (r *GmailAccountRepo) GetByEmail(email string) (*model.GmailAccount, error) {
	var g model.GmailAccount
	if err := r.db.First(&g, "email = ?", email).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

// CountPendingByUser counts active sell-side slots for a user (both
// pending_create and pending_verify). Used to enforce the 3-simultaneous
// slot cap.
func (r *GmailAccountRepo) CountPendingByUser(userID uuid.UUID) (int64, error) {
	var n int64
	err := r.db.Model(&model.GmailAccount{}).
		Where("created_by_user_id = ? AND status IN ?",
			userID,
			[]string{model.GmailStatusPendingCreate, model.GmailStatusPendingVerify}).
		Count(&n).Error
	return n, err
}

// CountPendingByUserTx is the tx variant — used by RequestSlot to
// avoid the TOCTOU race where two parallel calls both see the same
// pre-insert count.
func (r *GmailAccountRepo) CountPendingByUserTx(tx *gorm.DB, userID uuid.UUID) (int64, error) {
	var n int64
	err := tx.Model(&model.GmailAccount{}).
		Where("created_by_user_id = ? AND status IN ?",
			userID,
			[]string{model.GmailStatusPendingCreate, model.GmailStatusPendingVerify}).
		Count(&n).Error
	return n, err
}

// ListPendingVerify returns admin queue. Oldest-first (FIFO admin
// review).
func (r *GmailAccountRepo) ListPendingVerify(page, limit int) ([]model.GmailAccount, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 25
	}
	var total int64
	if err := r.db.Model(&model.GmailAccount{}).
		Where("status = ?", model.GmailStatusPendingVerify).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []model.GmailAccount
	err := r.db.Where("status = ?", model.GmailStatusPendingVerify).
		Order("submitted_at asc").
		Limit(limit).Offset((page - 1) * limit).
		Find(&out).Error
	return out, total, err
}

// ListVerified returns the inventory ready-to-sell. Oldest-first so
// FIFO claim is straightforward.
func (r *GmailAccountRepo) ListVerified(page, limit int) ([]model.GmailAccount, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 25
	}
	var total int64
	if err := r.db.Model(&model.GmailAccount{}).
		Where("status = ?", model.GmailStatusVerified).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []model.GmailAccount
	err := r.db.Where("status = ?", model.GmailStatusVerified).
		Order("verified_at asc").
		Limit(limit).Offset((page - 1) * limit).
		Find(&out).Error
	return out, total, err
}

// CountVerified is used by buy-side stock check + low-inventory alert.
func (r *GmailAccountRepo) CountVerified() (int64, error) {
	var n int64
	err := r.db.Model(&model.GmailAccount{}).
		Where("status = ?", model.GmailStatusVerified).
		Count(&n).Error
	return n, err
}

// LockOldestVerifiedForOrderTx claims N oldest-verified accounts under
// a row-level lock so concurrent buyers don't fight for the same
// inventory. SKIP LOCKED ensures buyer A doesn't block buyer B if A's
// transaction is still open.
func (r *GmailAccountRepo) LockOldestVerifiedForOrderTx(tx *gorm.DB, n int) ([]model.GmailAccount, error) {
	var out []model.GmailAccount
	err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
		Where("status = ?", model.GmailStatusVerified).
		Order("verified_at asc").
		Limit(n).
		Find(&out).Error
	return out, err
}

// ListSlotsExpiring returns rows where the slot has gone past its 6h
// window without a submit. Used by the expiry worker.
func (r *GmailAccountRepo) ListSlotsExpiring(now time.Time, limit int) ([]model.GmailAccount, error) {
	if limit < 1 {
		limit = 100
	}
	var out []model.GmailAccount
	err := r.db.Where("status = ? AND slot_expires_at IS NOT NULL AND slot_expires_at < ?",
		model.GmailStatusPendingCreate, now).
		Limit(limit).
		Find(&out).Error
	return out, err
}

// ListMyContributions returns the user's sell-side history with optional
// status filter.
func (r *GmailAccountRepo) ListMyContributions(userID uuid.UUID, status string, page, limit int) ([]model.GmailAccount, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 25
	}
	q := r.db.Model(&model.GmailAccount{}).
		Where("created_by_user_id = ?", userID)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []model.GmailAccount
	err := q.Order("created_at desc").
		Limit(limit).Offset((page - 1) * limit).
		Find(&out).Error
	return out, total, err
}
