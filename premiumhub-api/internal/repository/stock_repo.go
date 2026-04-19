package repository

import (
	"errors"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockRepo struct {
	db *gorm.DB
}

type ProductStockDurationCount struct {
	AccountType   string
	DurationMonth int
	Total         int64
}

const stockUsableCredentialCondition = "(password LIKE ? OR (password NOT LIKE ? AND password NOT LIKE ? AND password NOT LIKE ?))"

func applyUsableCredentialScope(db *gorm.DB) *gorm.DB {
	return db.Where(stockUsableCredentialCondition, "enc:v1:%", "$2a$%", "$2b$%", "$2y$%")
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

func (r *StockRepo) FindAvailable(productID uuid.UUID, accountType string, durationMonth int) (*model.Stock, error) {
	var s model.Stock

	if durationMonth > 0 {
		err := applyUsableCredentialScope(r.db).
			Where("product_id = ? AND account_type = ? AND status = ? AND duration_month = ?", productID, accountType, "available", durationMonth).
			Order("created_at ASC").
			First(&s).Error
		if err == nil {
			return &s, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	err := applyUsableCredentialScope(r.db).
		Where("product_id = ? AND account_type = ? AND status = ? AND (duration_month = 0 OR duration_month IS NULL)", productID, accountType, "available").
		Order("created_at ASC").
		First(&s).Error
	if err == nil {
		return &s, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if durationMonth <= 0 {
		return nil, err
	}

	// Fallback terakhir untuk data lama yang mungkin belum punya duration mapping rapi.
	err = applyUsableCredentialScope(r.db).
		Where("product_id = ? AND account_type = ? AND status = ?", productID, accountType, "available").
		Order("created_at ASC").
		First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
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
	err := applyUsableCredentialScope(r.db.Model(&model.Stock{})).
		Where("product_id = ? AND account_type = ? AND status = ?", productID, accountType, "available").
		Count(&count).Error
	return count, err
}

func (r *StockRepo) CountAvailableByProductIDs(productIDs []uuid.UUID) (map[uuid.UUID]int64, error) {
	counts := make(map[uuid.UUID]int64)
	if len(productIDs) == 0 {
		return counts, nil
	}

	type row struct {
		ProductID uuid.UUID
		Total     int64
	}

	var rows []row
	err := applyUsableCredentialScope(r.db.Model(&model.Stock{})).
		Select("product_id, COUNT(*) as total").
		Where("status = ? AND product_id IN ?", "available", productIDs).
		Group("product_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, item := range rows {
		counts[item.ProductID] = item.Total
	}

	return counts, nil
}

func (r *StockRepo) CountAvailableByProductAndDurations(productID uuid.UUID) ([]ProductStockDurationCount, error) {
	rows := make([]ProductStockDurationCount, 0)
	err := applyUsableCredentialScope(r.db.Model(&model.Stock{})).
		Select("account_type, duration_month, COUNT(*) as total").
		Where("status = ? AND product_id = ?", "available", productID).
		Group("account_type, duration_month").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}
