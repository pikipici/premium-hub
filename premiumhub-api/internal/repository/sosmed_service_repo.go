package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedServiceRepo struct {
	db *gorm.DB
}

func NewSosmedServiceRepo(db *gorm.DB) *SosmedServiceRepo {
	return &SosmedServiceRepo{db: db}
}

func (r *SosmedServiceRepo) List(includeInactive bool) ([]model.SosmedService, error) {
	var items []model.SosmedService
	q := r.db.Model(&model.SosmedService{})
	if !includeInactive {
		q = q.Where("is_active = ?", true)
	}

	err := q.Order("sort_order ASC").Order("code ASC").Find(&items).Error
	return items, err
}

func (r *SosmedServiceRepo) FindByID(id uuid.UUID) (*model.SosmedService, error) {
	var item model.SosmedService
	err := r.db.First(&item, "id = ?", id).Error
	return &item, err
}

func (r *SosmedServiceRepo) FindByCode(code string) (*model.SosmedService, error) {
	var item model.SosmedService
	err := r.db.Where("code = ?", code).First(&item).Error
	return &item, err
}

func (r *SosmedServiceRepo) FindByProvider(providerCode, providerServiceID string) (*model.SosmedService, error) {
	var item model.SosmedService
	err := r.db.
		Where("provider_code = ? AND provider_service_id = ?", providerCode, providerServiceID).
		First(&item).Error
	return &item, err
}

func (r *SosmedServiceRepo) Create(item *model.SosmedService) error {
	return r.db.Create(item).Error
}

func (r *SosmedServiceRepo) Update(item *model.SosmedService) error {
	return r.db.Save(item).Error
}
