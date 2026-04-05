package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FiveSimOrderRepo struct {
	db *gorm.DB
}

func NewFiveSimOrderRepo(db *gorm.DB) *FiveSimOrderRepo {
	return &FiveSimOrderRepo{db: db}
}

func (r *FiveSimOrderRepo) Create(order *model.FiveSimOrder) error {
	return r.db.Create(order).Error
}

func (r *FiveSimOrderRepo) Update(order *model.FiveSimOrder) error {
	return r.db.Save(order).Error
}

func (r *FiveSimOrderRepo) FindByProviderOrderID(providerOrderID int64) (*model.FiveSimOrder, error) {
	var row model.FiveSimOrder
	err := r.db.Where("provider_order_id = ?", providerOrderID).First(&row).Error
	return &row, err
}

func (r *FiveSimOrderRepo) FindByProviderOrderIDAndUser(providerOrderID int64, userID uuid.UUID) (*model.FiveSimOrder, error) {
	var row model.FiveSimOrder
	err := r.db.Where("provider_order_id = ? AND user_id = ?", providerOrderID, userID).First(&row).Error
	return &row, err
}

func (r *FiveSimOrderRepo) ListByUser(userID uuid.UUID, page, limit int) ([]model.FiveSimOrder, int64, error) {
	var rows []model.FiveSimOrder
	var total int64

	q := r.db.Model(&model.FiveSimOrder{}).Where("user_id = ?", userID)
	q.Count(&total)
	err := q.Offset((page - 1) * limit).Limit(limit).Order("created_at DESC").Find(&rows).Error
	return rows, total, err
}
