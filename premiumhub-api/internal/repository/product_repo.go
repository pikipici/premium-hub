package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductRepo struct {
	db *gorm.DB
}

func NewProductRepo(db *gorm.DB) *ProductRepo {
	return &ProductRepo{db: db}
}

func (r *ProductRepo) Create(p *model.Product) error {
	return r.db.Create(p).Error
}

func (r *ProductRepo) FindBySlug(slug string) (*model.Product, error) {
	var p model.Product
	err := r.db.Preload("Prices", "is_active = ?", true).Where("slug = ? AND is_active = ?", slug, true).First(&p).Error
	return &p, err
}

func (r *ProductRepo) FindByID(id uuid.UUID) (*model.Product, error) {
	var p model.Product
	err := r.db.Preload("Prices").First(&p, "id = ?", id).Error
	return &p, err
}

func (r *ProductRepo) List(category string, page, limit int) ([]model.Product, int64, error) {
	var products []model.Product
	var total int64
	q := r.db.Model(&model.Product{}).Where("is_active = ?", true)
	if category != "" {
		q = q.Where("category = ?", category)
	}
	q.Count(&total)
	err := q.Preload("Prices", "is_active = ?", true).
		Offset((page - 1) * limit).Limit(limit).
		Order("sort_priority DESC, is_popular DESC, created_at DESC").
		Find(&products).Error
	return products, total, err
}

func (r *ProductRepo) Update(p *model.Product) error {
	return r.db.Save(p).Error
}

func (r *ProductRepo) Delete(id uuid.UUID) error {
	return r.db.Model(&model.Product{}).Where("id = ?", id).Update("is_active", false).Error
}

func (r *ProductRepo) CountOrdersByProduct(id uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&model.Order{}).
		Joins("JOIN product_prices ON product_prices.id = orders.price_id").
		Where("product_prices.product_id = ?", id).
		Count(&count).Error
	return count, err
}

func (r *ProductRepo) DeletePermanent(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("product_id = ?", id).Delete(&model.Stock{}).Error; err != nil {
			return err
		}
		if err := tx.Where("product_id = ?", id).Delete(&model.ProductPrice{}).Error; err != nil {
			return err
		}

		result := tx.Delete(&model.Product{}, "id = ?", id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *ProductRepo) AdminList(page, limit int) ([]model.Product, int64, error) {
	var products []model.Product
	var total int64
	r.db.Model(&model.Product{}).Count(&total)
	err := r.db.Preload("Prices").
		Offset((page - 1) * limit).Limit(limit).
		Order("sort_priority DESC, created_at DESC").
		Find(&products).Error
	return products, total, err
}

func (r *ProductRepo) FindPriceByID(id uuid.UUID) (*model.ProductPrice, error) {
	var price model.ProductPrice
	err := r.db.First(&price, "id = ?", id).Error
	return &price, err
}

func (r *ProductRepo) FindPriceBySignature(productID uuid.UUID, duration int, accountType string) (*model.ProductPrice, error) {
	var price model.ProductPrice
	err := r.db.Where("product_id = ? AND duration = ? AND account_type = ?", productID, duration, accountType).First(&price).Error
	return &price, err
}

func (r *ProductRepo) CreatePrice(price *model.ProductPrice) error {
	return r.db.Create(price).Error
}

func (r *ProductRepo) UpdatePrice(price *model.ProductPrice) error {
	return r.db.Save(price).Error
}
