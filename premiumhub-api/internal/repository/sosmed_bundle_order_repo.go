package repository

import (
	"context"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedBundleOrderRepo struct {
	db *gorm.DB
}

func NewSosmedBundleOrderRepo(db *gorm.DB) *SosmedBundleOrderRepo {
	return &SosmedBundleOrderRepo{db: db}
}

func (r *SosmedBundleOrderRepo) DB() *gorm.DB {
	return r.db
}

func (r *SosmedBundleOrderRepo) CreateBundleOrderWithItems(ctx context.Context, order *model.SosmedBundleOrder, items []model.SosmedBundleOrderItem) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(order).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].BundleOrderID = order.ID
		}
		if len(items) == 0 {
			return nil
		}
		return tx.Create(&items).Error
	})
}

func (r *SosmedBundleOrderRepo) ListBundleOrdersByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]model.SosmedBundleOrder, int64, error) {
	var orders []model.SosmedBundleOrder
	var total int64

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	q := r.db.WithContext(ctx).Model(&model.SosmedBundleOrder{}).Where("user_id = ?", userID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.
		Preload("Package").
		Preload("Variant").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Preload("Items.Service").
		Offset((page - 1) * limit).
		Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *SosmedBundleOrderRepo) GetBundleOrderByNumberForUser(ctx context.Context, userID uuid.UUID, orderNumber string) (*model.SosmedBundleOrder, error) {
	var order model.SosmedBundleOrder
	err := r.withBundleOrderPreloads(r.db.WithContext(ctx)).
		Where("user_id = ? AND order_number = ?", userID, orderNumber).
		First(&order).Error
	return &order, err
}

func (r *SosmedBundleOrderRepo) GetBundleOrderByIdempotencyKeyForUser(ctx context.Context, userID uuid.UUID, key string) (*model.SosmedBundleOrder, error) {
	var order model.SosmedBundleOrder
	err := r.withBundleOrderPreloads(r.db.WithContext(ctx)).
		Where("user_id = ? AND idempotency_key = ?", userID, key).
		First(&order).Error
	return &order, err
}

func (r *SosmedBundleOrderRepo) AdminListBundleOrders(ctx context.Context, status string, page, limit int) ([]model.SosmedBundleOrder, int64, error) {
	var orders []model.SosmedBundleOrder
	var total int64
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	q := r.db.WithContext(ctx).Model(&model.SosmedBundleOrder{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := r.withBundleOrderPreloads(q).
		Offset((page - 1) * limit).
		Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *SosmedBundleOrderRepo) AdminGetBundleOrderByNumber(ctx context.Context, orderNumber string) (*model.SosmedBundleOrder, error) {
	var order model.SosmedBundleOrder
	err := r.withBundleOrderPreloads(r.db.WithContext(ctx)).
		Where("order_number = ?", orderNumber).
		First(&order).Error
	return &order, err
}

func (r *SosmedBundleOrderRepo) withBundleOrderPreloads(db *gorm.DB) *gorm.DB {
	return db.
		Preload("User").
		Preload("Package").
		Preload("Variant").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Preload("Items.Service")
}
