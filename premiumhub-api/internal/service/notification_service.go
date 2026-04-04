package service

import (
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

type NotificationService struct {
	notifRepo *repository.NotificationRepo
}

func NewNotificationService(notifRepo *repository.NotificationRepo) *NotificationService {
	return &NotificationService{notifRepo: notifRepo}
}

func (s *NotificationService) List(userID uuid.UUID, page, limit int) ([]model.Notification, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	return s.notifRepo.FindByUserID(userID, page, limit)
}

func (s *NotificationService) MarkRead(id, userID uuid.UUID) error {
	return s.notifRepo.MarkRead(id, userID)
}

func (s *NotificationService) CountUnread(userID uuid.UUID) (int64, error) {
	return s.notifRepo.CountUnread(userID)
}
