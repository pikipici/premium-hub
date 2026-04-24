package repository

import (
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthSessionRepo struct {
	db *gorm.DB
}

func NewAuthSessionRepo(db *gorm.DB) *AuthSessionRepo {
	return &AuthSessionRepo{db: db}
}

func (r *AuthSessionRepo) Create(session *model.AuthSession) error {
	return r.db.Create(session).Error
}

func (r *AuthSessionRepo) FindActiveByTokenHash(tokenHash string, now time.Time) (*model.AuthSession, error) {
	var session model.AuthSession
	err := r.db.
		Where("token_hash = ? AND revoked_at IS NULL AND expires_at > ?", tokenHash, now).
		First(&session).Error
	return &session, err
}

func (r *AuthSessionRepo) Rotate(sessionID uuid.UUID, tokenHash, userAgent, ipAddress string, expiresAt, seenAt time.Time) error {
	return r.db.Model(&model.AuthSession{}).
		Where("id = ?", sessionID).
		Updates(map[string]interface{}{
			"token_hash":   tokenHash,
			"user_agent":   userAgent,
			"ip_address":   ipAddress,
			"expires_at":   expiresAt,
			"last_seen_at": seenAt,
			"revoked_at":   nil,
		}).Error
}

func (r *AuthSessionRepo) Touch(sessionID uuid.UUID, seenAt time.Time) error {
	return r.db.Model(&model.AuthSession{}).
		Where("id = ?", sessionID).
		Update("last_seen_at", seenAt).Error
}

func (r *AuthSessionRepo) RevokeByID(sessionID uuid.UUID, revokedAt time.Time) error {
	return r.db.Model(&model.AuthSession{}).
		Where("id = ? AND revoked_at IS NULL", sessionID).
		Updates(map[string]interface{}{
			"revoked_at": revokedAt,
		}).Error
}

func (r *AuthSessionRepo) RevokeByTokenHash(tokenHash string, revokedAt time.Time) error {
	return r.db.Model(&model.AuthSession{}).
		Where("token_hash = ? AND revoked_at IS NULL", tokenHash).
		Updates(map[string]interface{}{
			"revoked_at": revokedAt,
		}).Error
}
