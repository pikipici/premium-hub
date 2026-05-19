package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailOrderRepo handles CRUD + auth-scoped queries for the
// buy-side gmail order table.
type GmailOrderRepo struct {
	db *gorm.DB
}

func NewGmailOrderRepo(db *gorm.DB) *GmailOrderRepo {
	return &GmailOrderRepo{db: db}
}

func (r *GmailOrderRepo) DB() *gorm.DB { return r.db }

func (r *GmailOrderRepo) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

// CreateTx inserts a row inside the caller's transaction.
func (r *GmailOrderRepo) CreateTx(tx *gorm.DB, o *model.GmailOrder) error {
	return tx.Create(o).Error
}

// SaveTx persists changes inside caller's transaction (used by future
// warranty-refund flow in Round 3).
func (r *GmailOrderRepo) SaveTx(tx *gorm.DB, o *model.GmailOrder) error {
	return tx.Save(o).Error
}

// GetByID returns a row regardless of owner — admin-side use.
func (r *GmailOrderRepo) GetByID(id uuid.UUID) (*model.GmailOrder, error) {
	var o model.GmailOrder
	if err := r.db.First(&o, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &o, nil
}

// GetByIDForUser is the auth-scoped lookup — only returns the row if
// it belongs to userID. Used by buyer endpoints.
func (r *GmailOrderRepo) GetByIDForUser(id, userID uuid.UUID) (*model.GmailOrder, error) {
	var o model.GmailOrder
	if err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&o).Error; err != nil {
		return nil, err
	}
	return &o, nil
}

// GetByIDForUserWithItems hydrates the gmail rows attached to the
// order (joined via SoldOrderID) so the response can decrypt + show
// credentials per item.
func (r *GmailOrderRepo) GetByIDForUserWithItems(id, userID uuid.UUID) (*model.GmailOrder, error) {
	var o model.GmailOrder
	err := r.db.
		Preload("Items").
		Where("id = ? AND user_id = ?", id, userID).
		First(&o).Error
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// ListByUser returns paginated buyer history (newest first).
func (r *GmailOrderRepo) ListByUser(userID uuid.UUID, page, limit int) ([]model.GmailOrder, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	var rows []model.GmailOrder
	var total int64
	q := r.db.Model(&model.GmailOrder{}).Where("user_id = ?", userID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := q.Order("created_at desc").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}
