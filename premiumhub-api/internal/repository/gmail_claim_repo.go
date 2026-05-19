package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailClaimRepo handles warranty claim row CRUD. Auth-scoped queries
// always filter by buyer_id.
type GmailClaimRepo struct {
	db *gorm.DB
}

func NewGmailClaimRepo(db *gorm.DB) *GmailClaimRepo {
	return &GmailClaimRepo{db: db}
}

func (r *GmailClaimRepo) DB() *gorm.DB { return r.db }

// CreateTx inserts within a caller transaction.
func (r *GmailClaimRepo) CreateTx(tx *gorm.DB, c *model.GmailClaim) error {
	return tx.Create(c).Error
}

// ExistsForGmail checks if a row already exists for the gmail
// account. Used to prevent double-claim.
func (r *GmailClaimRepo) ExistsForGmail(gmailAccountID uuid.UUID) (bool, error) {
	var n int64
	err := r.db.Model(&model.GmailClaim{}).
		Where("gmail_account_id = ?", gmailAccountID).
		Count(&n).Error
	return n > 0, err
}

// ExistsForGmailTx is the in-transaction variant — used during the
// resolve flow to keep the existence check race-free.
func (r *GmailClaimRepo) ExistsForGmailTx(tx *gorm.DB, gmailAccountID uuid.UUID) (bool, error) {
	var n int64
	err := tx.Model(&model.GmailClaim{}).
		Where("gmail_account_id = ?", gmailAccountID).
		Count(&n).Error
	return n > 0, err
}

// ListByOrder returns all claims for one buyer's gmail order.
func (r *GmailClaimRepo) ListByOrder(buyerID, orderID uuid.UUID) ([]model.GmailClaim, error) {
	var rows []model.GmailClaim
	err := r.db.
		Where("buyer_id = ? AND gmail_order_id = ?", buyerID, orderID).
		Order("created_at desc").
		Find(&rows).Error
	return rows, err
}
