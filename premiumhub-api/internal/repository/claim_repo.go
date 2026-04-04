package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ClaimRepo struct {
	db *gorm.DB
}

func NewClaimRepo(db *gorm.DB) *ClaimRepo {
	return &ClaimRepo{db: db}
}

func (r *ClaimRepo) Create(c *model.Claim) error {
	return r.db.Create(c).Error
}

func (r *ClaimRepo) FindByID(id uuid.UUID) (*model.Claim, error) {
	var c model.Claim
	err := r.db.Preload("User").Preload("Order").First(&c, "id = ?", id).Error
	return &c, err
}

func (r *ClaimRepo) FindByUserID(userID uuid.UUID, page, limit int) ([]model.Claim, int64, error) {
	var claims []model.Claim
	var total int64
	q := r.db.Model(&model.Claim{}).Where("user_id = ?", userID)
	q.Count(&total)
	err := q.Preload("Order").
		Offset((page - 1) * limit).Limit(limit).
		Order("created_at DESC").
		Find(&claims).Error
	return claims, total, err
}

func (r *ClaimRepo) Update(c *model.Claim) error {
	return r.db.Save(c).Error
}

func (r *ClaimRepo) AdminList(status string, page, limit int) ([]model.Claim, int64, error) {
	var claims []model.Claim
	var total int64
	q := r.db.Model(&model.Claim{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Count(&total)
	err := q.Preload("User").Preload("Order").
		Offset((page - 1) * limit).Limit(limit).
		Order("created_at DESC").
		Find(&claims).Error
	return claims, total, err
}

func (r *ClaimRepo) CountPending() (int64, error) {
	var count int64
	err := r.db.Model(&model.Claim{}).Where("status = ?", "pending").Count(&count).Error
	return count, err
}
