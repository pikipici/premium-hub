package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/hash"
	"premiumhub-api/pkg/jwt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthService struct {
	userRepo       *repository.UserRepo
	cfg            *config.Config
	googleVerifier GoogleVerifier
}

func NewAuthService(userRepo *repository.UserRepo, cfg *config.Config) *AuthService {
	svc := &AuthService{userRepo: userRepo, cfg: cfg}
	if cfg != nil {
		svc.googleVerifier = NewGoogleVerifier(cfg.GoogleClientID)
	}
	return svc
}

func (s *AuthService) SetGoogleVerifier(verifier GoogleVerifier) {
	s.googleVerifier = verifier
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

type GoogleLoginInput struct {
	IDToken string `json:"id_token" binding:"required"`
}

type AuthResponse struct {
	User  *model.User `json:"user"`
	Token string      `json:"token"`
}

func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
	email := normalizeEmail(input.Email)
	if email == "" {
		return nil, errors.New("email tidak valid")
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("nama wajib diisi")
	}

	existing, err := s.userRepo.FindByEmail(email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek email")
	}
	if existing.ID != uuid.Nil {
		return nil, errors.New("email sudah terdaftar")
	}

	hashed, err := hash.Password(input.Password)
	if err != nil {
		return nil, errors.New("gagal hash password")
	}

	user := &model.User{
		Name:     name,
		Email:    email,
		Phone:    strings.TrimSpace(input.Phone),
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
	email := normalizeEmail(input.Email)
	if email == "" {
		return nil, errors.New("email atau password salah")
	}

	user, err := s.userRepo.FindByEmail(email)
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

func (s *AuthService) LoginWithGoogle(ctx context.Context, input GoogleLoginInput) (*AuthResponse, error) {
	if s.cfg == nil {
		return nil, errors.New("config auth tidak valid")
	}
	if strings.TrimSpace(s.cfg.GoogleClientID) == "" {
		return nil, errors.New("Google login belum dikonfigurasi")
	}
	if strings.TrimSpace(input.IDToken) == "" {
		return nil, errors.New("id_token wajib diisi")
	}
	if s.googleVerifier == nil {
		return nil, errors.New("Google verifier tidak tersedia")
	}

	profile, err := s.googleVerifier.Verify(ctx, strings.TrimSpace(input.IDToken))
	if err != nil {
		return nil, errors.New("token Google tidak valid")
	}

	email := normalizeEmail(profile.Email)
	if email == "" {
		return nil, errors.New("email Google tidak tersedia")
	}
	if !profile.EmailVerified {
		return nil, errors.New("email Google belum terverifikasi")
	}
	if strings.TrimSpace(profile.Subject) == "" {
		return nil, errors.New("subject Google tidak valid")
	}

	user, err := s.resolveOrCreateGoogleUser(profile, email)
	if err != nil {
		return nil, err
	}

	if !user.IsActive {
		return nil, errors.New("akun diblokir")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{User: user, Token: token}, nil
}

func (s *AuthService) resolveOrCreateGoogleUser(profile *GoogleProfile, normalizedEmail string) (*model.User, error) {
	userBySub, err := s.userRepo.FindByGoogleSub(profile.Subject)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek akun Google")
	}
	if userBySub.ID != uuid.Nil {
		return userBySub, nil
	}

	userByEmail, err := s.userRepo.FindByEmail(normalizedEmail)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("gagal cek akun email")
	}

	if userByEmail.ID != uuid.Nil {
		if userByEmail.GoogleSub != nil {
			existingSub := strings.TrimSpace(*userByEmail.GoogleSub)
			if existingSub != "" && existingSub != profile.Subject {
				return nil, errors.New("akun Google tidak cocok dengan akun terdaftar")
			}
		}

		if userByEmail.GoogleSub == nil || strings.TrimSpace(*userByEmail.GoogleSub) == "" {
			sub := profile.Subject
			userByEmail.GoogleSub = &sub
			if err := s.userRepo.Update(userByEmail); err != nil {
				return nil, errors.New("gagal sinkron akun Google")
			}
		}
		return userByEmail, nil
	}

	bootstrapPassword := uuid.NewString() + "-google-bootstrap"
	hashed, err := hash.Password(bootstrapPassword)
	if err != nil {
		return nil, errors.New("gagal menyiapkan akun Google")
	}

	sub := profile.Subject
	user := &model.User{
		Name:      fallbackGoogleName(profile.Name, normalizedEmail),
		Email:     normalizedEmail,
		Password:  hashed,
		GoogleSub: &sub,
		Role:      "user",
		IsActive:  true,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, errors.New("gagal membuat akun dari Google")
	}

	return user, nil
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
	user.Name = strings.TrimSpace(input.Name)
	user.Phone = strings.TrimSpace(input.Phone)
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

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func fallbackGoogleName(name, email string) string {
	if trimmed := strings.TrimSpace(name); trimmed != "" {
		return trimmed
	}
	prefix := strings.Split(strings.TrimSpace(email), "@")
	if len(prefix) > 0 && prefix[0] != "" {
		return prefix[0]
	}
	return "Google User"
}
