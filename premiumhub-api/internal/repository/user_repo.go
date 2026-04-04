package repository

import (
	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepo) FindByEmail(email string) (*model.User, error) {
	var user model.User
	err := r.db.Where("email = ?", email).First(&user).Error
	return &user, err
}

func (r *UserRepo) FindByID(id uuid.UUID) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, "id = ?", id).Error
	return &user, err
}

func (r *UserRepo) Update(user *model.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepo) List(page, limit int) ([]model.User, int64, error) {
	var users []model.User
	var total int64
	r.db.Model(&model.User{}).Count(&total)
	err := r.db.Offset((page - 1) * limit).Limit(limit).Order("created_at DESC").Find(&users).Error
	return users, total, err
}
