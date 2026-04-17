package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedOrderRepo struct {
	db *gorm.DB
}

func NewSosmedOrderRepo(db *gorm.DB) *SosmedOrderRepo {
	return &SosmedOrderRepo{db: db}
}

func (r *SosmedOrderRepo) Create(order *model.SosmedOrder) error {
	return r.db.Create(order).Error
}

func (r *SosmedOrderRepo) Update(order *model.SosmedOrder) error {
	return r.db.Save(order).Error
}

func (r *SosmedOrderRepo) FindByID(id uuid.UUID) (*model.SosmedOrder, error) {
	var order model.SosmedOrder
	err := r.db.Preload("User").Preload("Service").First(&order, "id = ?", id).Error
	return &order, err
}

func (r *SosmedOrderRepo) FindByGatewayOrderID(gatewayOrderID string) (*model.SosmedOrder, error) {
	var order model.SosmedOrder
	err := r.db.Where("gateway_order_id = ?", gatewayOrderID).First(&order).Error
	return &order, err
}

func (r *SosmedOrderRepo) FindByUserID(userID uuid.UUID, page, limit int) ([]model.SosmedOrder, int64, error) {
	var orders []model.SosmedOrder
	var total int64

	q := r.db.Model(&model.SosmedOrder{}).Where("user_id = ?", userID)
	q.Count(&total)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	err := q.Preload("Service").
		Offset((page - 1) * limit).
		Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *SosmedOrderRepo) AdminList(status string, page, limit int) ([]model.SosmedOrder, int64, error) {
	var orders []model.SosmedOrder
	var total int64

	q := r.db.Model(&model.SosmedOrder{})
	if status != "" {
		q = q.Where("order_status = ?", status)
	}
	q.Count(&total)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	err := q.Preload("User").Preload("Service").
		Offset((page - 1) * limit).
		Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *SosmedOrderRepo) CreateEvent(event *model.SosmedOrderEvent) error {
	return r.db.Create(event).Error
}

func (r *SosmedOrderRepo) ListEventsByOrder(orderID uuid.UUID) ([]model.SosmedOrderEvent, error) {
	var events []model.SosmedOrderEvent
	err := r.db.Model(&model.SosmedOrderEvent{}).
		Where("order_id = ?", orderID).
		Order("created_at ASC").
		Find(&events).Error
	return events, err
}
