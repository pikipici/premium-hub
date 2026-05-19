package repository

import (
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailStrikeRepo records sell-side rejections that count toward the
// 3-strike 30-day auto-ban.
type GmailStrikeRepo struct {
	db *gorm.DB
}

func NewGmailStrikeRepo(db *gorm.DB) *GmailStrikeRepo {
	return &GmailStrikeRepo{db: db}
}

func (r *GmailStrikeRepo) Create(s *model.GmailStrike) error {
	return r.db.Create(s).Error
}

// CreateTx variant on a caller-supplied transaction — the reject flow
// writes the strike row in the same tx as the gmail status update.
func (r *GmailStrikeRepo) CreateTx(tx *gorm.DB, s *model.GmailStrike) error {
	return tx.Create(s).Error
}

// CountActiveByUser counts strikes since `since` for ban-decision.
// Caller passes now-30d (or a smaller window once ban policy
// stabilizes).
func (r *GmailStrikeRepo) CountActiveByUser(userID uuid.UUID, since time.Time) (int64, error) {
	var n int64
	err := r.db.Model(&model.GmailStrike{}).
		Where("user_id = ? AND created_at >= ?", userID, since).
		Count(&n).Error
	return n, err
}

// CountActiveByUserTx variant that participates in caller's tx — reject
// flow uses this to read-and-decide-and-write atomically.
func (r *GmailStrikeRepo) CountActiveByUserTx(tx *gorm.DB, userID uuid.UUID, since time.Time) (int64, error) {
	var n int64
	err := tx.Model(&model.GmailStrike{}).
		Where("user_id = ? AND created_at >= ?", userID, since).
		Count(&n).Error
	return n, err
}

// ListByUser returns the user's full strike history (newest first).
// Used in admin "kenapa user ini banned" view + user-facing strike
// counter.
func (r *GmailStrikeRepo) ListByUser(userID uuid.UUID) ([]model.GmailStrike, error) {
	var out []model.GmailStrike
	err := r.db.Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&out).Error
	return out, err
}
