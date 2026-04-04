package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockRepo struct {
	db *gorm.DB
}

func NewStockRepo(db *gorm.DB) *StockRepo {
	return &StockRepo{db: db}
}

func (r *StockRepo) Create(s *model.Stock) error {
	return r.db.Create(s).Error
}

func (r *StockRepo) CreateBulk(stocks []model.Stock) error {
	return r.db.Create(&stocks).Error
}

func (r *StockRepo) FindAvailable(productID uuid.UUID, accountType string) (*model.Stock, error) {
	var s model.Stock
	err := r.db.Where("product_id = ? AND account_type = ? AND status = ?", productID, accountType, "available").
		First(&s).Error
	return &s, err
}

func (r *StockRepo) FindByID(id uuid.UUID) (*model.Stock, error) {
	var s model.Stock
	err := r.db.Preload("Product").First(&s, "id = ?", id).Error
	return &s, err
}

func (r *StockRepo) Update(s *model.Stock) error {
	return r.db.Save(s).Error
}

func (r *StockRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.Stock{}, "id = ?", id).Error
}

func (r *StockRepo) List(productID *uuid.UUID, status string, page, limit int) ([]model.Stock, int64, error) {
	var stocks []model.Stock
	var total int64
	q := r.db.Model(&model.Stock{})
	if productID != nil {
		q = q.Where("product_id = ?", *productID)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Count(&total)
	err := q.Preload("Product").
		Offset((page - 1) * limit).Limit(limit).
		Order("created_at DESC").
		Find(&stocks).Error
	return stocks, total, err
}

func (r *StockRepo) CountByProduct(productID uuid.UUID, accountType string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Stock{}).
		Where("product_id = ? AND account_type = ? AND status = ?", productID, accountType, "available").
		Count(&count).Error
	return count, err
}
