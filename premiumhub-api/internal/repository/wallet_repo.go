package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WalletRepo struct {
	db *gorm.DB
}

func NewWalletRepo(db *gorm.DB) *WalletRepo {
	return &WalletRepo{db: db}
}

func (r *WalletRepo) CreateTopup(topup *model.WalletTopup) error {
	return r.db.Create(topup).Error
}

func (r *WalletRepo) UpdateTopup(topup *model.WalletTopup) error {
	return r.db.Save(topup).Error
}

func (r *WalletRepo) FindTopupByIDAndUser(topupID, userID uuid.UUID) (*model.WalletTopup, error) {
	var topup model.WalletTopup
	err := r.db.Where("id = ? AND user_id = ?", topupID, userID).First(&topup).Error
	return &topup, err
}

func (r *WalletRepo) FindTopupByID(topupID uuid.UUID) (*model.WalletTopup, error) {
	var topup model.WalletTopup
	err := r.db.Where("id = ?", topupID).First(&topup).Error
	return &topup, err
}

func (r *WalletRepo) FindTopupByIdempotencyKey(userID uuid.UUID, key string) (*model.WalletTopup, error) {
	var topup model.WalletTopup
	err := r.db.Where("user_id = ? AND idempotency_key = ?", userID, key).
		Order("created_at DESC").
		First(&topup).Error
	return &topup, err
}

func (r *WalletRepo) ListTopupByUser(userID uuid.UUID, page, limit int) ([]model.WalletTopup, int64, error) {
	var topups []model.WalletTopup
	var total int64
	q := r.db.Model(&model.WalletTopup{}).Where("user_id = ?", userID)
	q.Count(&total)
	err := q.Offset((page - 1) * limit).Limit(limit).Order("created_at DESC").Find(&topups).Error
	return topups, total, err
}

func (r *WalletRepo) ListPendingTopups(limit int) ([]model.WalletTopup, error) {
	var topups []model.WalletTopup
	q := r.db.Where("status = ?", "pending").Order("created_at ASC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.Find(&topups).Error
	return topups, err
}

func (r *WalletRepo) ListLedgerByUser(userID uuid.UUID, page, limit int) ([]model.WalletLedger, int64, error) {
	var rows []model.WalletLedger
	var total int64
	q := r.db.Model(&model.WalletLedger{}).Where("user_id = ?", userID)
	q.Count(&total)
	err := q.Offset((page - 1) * limit).Limit(limit).Order("created_at DESC").Find(&rows).Error
	return rows, total, err
}

func (r *WalletRepo) FindLedgerByReferenceTx(tx *gorm.DB, reference string) (*model.WalletLedger, error) {
	var row model.WalletLedger
	err := tx.Where("reference = ?", reference).First(&row).Error
	return &row, err
}

func (r *WalletRepo) CreateLedgerTx(tx *gorm.DB, row *model.WalletLedger) error {
	return tx.Create(row).Error
}

func (r *WalletRepo) LockTopupByIDTx(tx *gorm.DB, topupID uuid.UUID) (*model.WalletTopup, error) {
	var topup model.WalletTopup
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", topupID).First(&topup).Error
	return &topup, err
}

func (r *WalletRepo) SaveTopupTx(tx *gorm.DB, topup *model.WalletTopup) error {
	return tx.Save(topup).Error
}

func (r *WalletRepo) LockUserByIDTx(tx *gorm.DB, userID uuid.UUID) (*model.User, error) {
	var user model.User
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", userID).First(&user).Error
	return &user, err
}

func (r *WalletRepo) SaveUserTx(tx *gorm.DB, user *model.User) error {
	return tx.Save(user).Error
}

func (r *WalletRepo) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}
