package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductCategoryRepo struct {
	db *gorm.DB
}

func NewProductCategoryRepo(db *gorm.DB) *ProductCategoryRepo {
	return &ProductCategoryRepo{db: db}
}

func (r *ProductCategoryRepo) List(scope string, includeInactive bool) ([]model.ProductCategory, error) {
	var items []model.ProductCategory
	q := r.db.Model(&model.ProductCategory{})
	if scope != "" {
		q = q.Where("scope = ?", scope)
	}
	if !includeInactive {
		q = q.Where("is_active = ?", true)
	}

	err := q.Order("scope ASC").Order("sort_order ASC").Order("code ASC").Find(&items).Error
	return items, err
}

func (r *ProductCategoryRepo) FindByID(id uuid.UUID) (*model.ProductCategory, error) {
	var item model.ProductCategory
	err := r.db.First(&item, "id = ?", id).Error
	return &item, err
}

func (r *ProductCategoryRepo) FindByScopeAndCode(scope, code string) (*model.ProductCategory, error) {
	var item model.ProductCategory
	err := r.db.Where("scope = ? AND code = ?", scope, code).First(&item).Error
	return &item, err
}

func (r *ProductCategoryRepo) Create(item *model.ProductCategory) error {
	return r.db.Create(item).Error
}

func (r *ProductCategoryRepo) Update(item *model.ProductCategory) error {
	return r.db.Save(item).Error
}

func (r *ProductCategoryRepo) CountProductsByCategory(categoryCode string) (int64, error) {
	var total int64
	err := r.db.Model(&model.Product{}).
		Where("category = ?", categoryCode).
		Count(&total).Error
	return total, err
}
