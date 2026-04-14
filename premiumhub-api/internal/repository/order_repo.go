package repository

import (
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrderRepo struct {
	db *gorm.DB
}

type UserOrderStats struct {
	UserID       uuid.UUID  `json:"user_id"`
	TotalOrders  int64      `json:"total_orders"`
	PaidOrders   int64      `json:"paid_orders"`
	TotalSpent   int64      `json:"total_spent"`
	ActiveOrders int64      `json:"active_orders"`
	LastOrderAt  *time.Time `json:"last_order_at"`
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
		Offset((page - 1) * limit).Limit(limit).
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
		Offset((page - 1) * limit).Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *OrderRepo) StatsByUserIDs(userIDs []uuid.UUID) (map[uuid.UUID]UserOrderStats, error) {
	statsMap := make(map[uuid.UUID]UserOrderStats)
	if len(userIDs) == 0 {
		return statsMap, nil
	}

	var rows []UserOrderStats
	err := r.db.Model(&model.Order{}).
		Select(`
			user_id,
			COUNT(*) AS total_orders,
			COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_orders,
			COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_price ELSE 0 END), 0) AS total_spent,
			COALESCE(SUM(CASE WHEN order_status = 'active' THEN 1 ELSE 0 END), 0) AS active_orders,
			MAX(created_at) AS last_order_at
		`).
		Where("user_id IN ?", userIDs).
		Group("user_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		statsMap[row.UserID] = row
	}

	return statsMap, nil
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

func (r *OrderRepo) FindByGatewayOrderID(gatewayOrderID string) (*model.Order, error) {
	var o model.Order
	err := r.db.Where("gateway_order_id = ?", gatewayOrderID).First(&o).Error
	return &o, err
}
