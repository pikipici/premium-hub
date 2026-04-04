package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NotificationRepo struct {
	db *gorm.DB
}

func NewNotificationRepo(db *gorm.DB) *NotificationRepo {
	return &NotificationRepo{db: db}
}

func (r *NotificationRepo) Create(n *model.Notification) error {
	return r.db.Create(n).Error
}

func (r *NotificationRepo) FindByUserID(userID uuid.UUID, page, limit int) ([]model.Notification, int64, error) {
	var notifs []model.Notification
	var total int64
	q := r.db.Model(&model.Notification{}).Where("user_id = ?", userID)
	q.Count(&total)
	err := q.Offset((page - 1) * limit).Limit(limit).
		Order("created_at DESC").
		Find(&notifs).Error
	return notifs, total, err
}

func (r *NotificationRepo) MarkRead(id, userID uuid.UUID) error {
	return r.db.Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (r *NotificationRepo) CountUnread(userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error
	return count, err
}
