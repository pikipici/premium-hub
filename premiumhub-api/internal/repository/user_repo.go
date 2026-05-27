package repository

import (
	"strings"

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

func (r *UserRepo) FindOrCreateGuest(email, phone string) (*model.User, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	var user model.User
	err := r.db.Where("email = ?", normalizedEmail).First(&user).Error
	if err == nil {
		return &user, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	name := normalizedEmail
	if at := strings.Index(name, "@"); at > 0 {
		name = name[:at]
	}
	user = model.User{
		Name:     name,
		Email:    normalizedEmail,
		Phone:    strings.TrimSpace(phone),
		Password: uuid.NewString(),
		Role:     "guest",
		IsActive: true,
	}
	if err := r.db.Create(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepo) FindByID(id uuid.UUID) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, "id = ?", id).Error
	return &user, err
}

func (r *UserRepo) FindByGoogleSub(sub string) (*model.User, error) {
	var user model.User
	err := r.db.Where("google_sub = ?", sub).First(&user).Error
	return &user, err
}

func (r *UserRepo) Update(user *model.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepo) List(page, limit int, search, status string) ([]model.User, int64, error) {
	var users []model.User
	var total int64

	query := r.db.Model(&model.User{})

	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active":
		query = query.Where("is_active = ?", true)
	case "inactive", "blocked":
		query = query.Where("is_active = ?", false)
	}

	if keyword := strings.TrimSpace(search); keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		query = query.Where(
			"LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(COALESCE(phone, '')) LIKE ?",
			like,
			like,
			like,
		)
	}

	query.Count(&total)
	err := query.
		Order("created_at DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&users).Error

	return users, total, err
}
