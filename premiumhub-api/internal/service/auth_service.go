package service

import (
	"errors"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/hash"
	"premiumhub-api/pkg/jwt"

	"github.com/google/uuid"
)

type AuthService struct {
	userRepo *repository.UserRepo
	cfg      *config.Config
}

func NewAuthService(userRepo *repository.UserRepo, cfg *config.Config) *AuthService {
	return &AuthService{userRepo: userRepo, cfg: cfg}
}

type RegisterInput struct {
	Name     string `json:"name" binding:"required,min=2"`
	Email    string `json:"email" binding:"required,email"`
	Phone    string `json:"phone"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	User  *model.User `json:"user"`
	Token string      `json:"token"`
}

func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
	existing, _ := s.userRepo.FindByEmail(input.Email)
	if existing.ID != uuid.Nil {
		return nil, errors.New("email sudah terdaftar")
	}

	hashed, err := hash.Password(input.Password)
	if err != nil {
		return nil, errors.New("gagal hash password")
	}

	user := &model.User{
		Name:     input.Name,
		Email:    input.Email,
		Phone:    input.Phone,
		Password: hashed,
		Role:     "user",
		IsActive: true,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, errors.New("gagal membuat akun")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{User: user, Token: token}, nil
}

func (s *AuthService) Login(input LoginInput) (*AuthResponse, error) {
	user, err := s.userRepo.FindByEmail(input.Email)
	if err != nil {
		return nil, errors.New("email atau password salah")
	}

	if !user.IsActive {
		return nil, errors.New("akun diblokir")
	}

	if !hash.Check(input.Password, user.Password) {
		return nil, errors.New("email atau password salah")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{User: user, Token: token}, nil
}

func (s *AuthService) GetProfile(userID uuid.UUID) (*model.User, error) {
	return s.userRepo.FindByID(userID)
}

type UpdateProfileInput struct {
	Name  string `json:"name" binding:"required,min=2"`
	Phone string `json:"phone"`
}

func (s *AuthService) UpdateProfile(userID uuid.UUID, input UpdateProfileInput) (*model.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, errors.New("user tidak ditemukan")
	}
	user.Name = input.Name
	user.Phone = input.Phone
	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}

type ChangePasswordInput struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

func (s *AuthService) ChangePassword(userID uuid.UUID, input ChangePasswordInput) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("user tidak ditemukan")
	}
	if !hash.Check(input.OldPassword, user.Password) {
		return errors.New("password lama salah")
	}
	hashed, err := hash.Password(input.NewPassword)
	if err != nil {
		return errors.New("gagal hash password")
	}
	user.Password = hashed
	return s.userRepo.Update(user)
}

func (s *AuthService) generateToken(user *model.User) (string, error) {
	if s.cfg == nil {
		return "", errors.New("config auth tidak valid")
	}
	if strings.TrimSpace(s.cfg.JWTSecret) == "" {
		return "", errors.New("JWT secret belum diisi")
	}

	dur, _ := time.ParseDuration(s.cfg.JWTExpiry)
	if dur == 0 {
		dur = 24 * time.Hour
	}
	return jwt.Generate(user.ID, user.Role, s.cfg.JWTSecret, dur)
}
