package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrderRepo struct {
	db *gorm.DB
}

func NewOrderRepo(db *gorm.DB) *OrderRepo {
	return &OrderRepo{db: db}
}

func (r *OrderRepo) Create(o *model.Order) error {
	return r.db.Create(o).Error
}

func (r *OrderRepo) FindByID(id uuid.UUID) (*model.Order, error) {
	var o model.Order
	err := r.db.Preload("User").Preload("Stock").Preload("Price").First(&o, "id = ?", id).Error
	return &o, err
}

func (r *OrderRepo) FindByUserID(userID uuid.UUID, page, limit int) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64
	q := r.db.Model(&model.Order{}).Where("user_id = ?", userID)
	q.Count(&total)
	err := q.Preload("Price").Preload("Stock").
		Offset((page-1)*limit).Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *OrderRepo) Update(o *model.Order) error {
	return r.db.Save(o).Error
}

func (r *OrderRepo) AdminList(status string, page, limit int) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64
	q := r.db.Model(&model.Order{})
	if status != "" {
		q = q.Where("order_status = ?", status)
	}
	q.Count(&total)
	err := q.Preload("User").Preload("Price").Preload("Stock").
		Offset((page-1)*limit).Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *OrderRepo) CountByStatus(status string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Order{}).Where("order_status = ?", status).Count(&count).Error
	return count, err
}

func (r *OrderRepo) TotalRevenue() (int64, error) {
	var total int64
	err := r.db.Model(&model.Order{}).Where("payment_status = ?", "paid").
		Select("COALESCE(SUM(total_price), 0)").Scan(&total).Error
	return total, err
}

func (r *OrderRepo) FindByMidtransID(midtransID string) (*model.Order, error) {
	var o model.Order
	err := r.db.Where("midtrans_id = ?", midtransID).First(&o).Error
	return &o, err
}
