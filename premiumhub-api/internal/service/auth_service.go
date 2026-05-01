package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
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
	sessionRepo    *repository.AuthSessionRepo
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

func (s *AuthService) SetSessionRepo(sessionRepo *repository.AuthSessionRepo) *AuthService {
	s.sessionRepo = sessionRepo
	return s
}

type RegisterInput struct {
	Name           string `json:"name" binding:"required,min=2"`
	Email          string `json:"email" binding:"required,email"`
	Phone          string `json:"phone"`
	Password       string `json:"password" binding:"required,min=6"`
	TurnstileToken string `json:"turnstile_token"`
}

type LoginInput struct {
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required"`
	TurnstileToken string `json:"turnstile_token"`
}

type GoogleLoginInput struct {
	IDToken string `json:"id_token" binding:"required"`
}

type AuthResponse struct {
	User  *model.User `json:"user"`
	Token string      `json:"token"`
}

type SessionMeta struct {
	UserAgent string
	IPAddress string
}

type SessionBundle struct {
	User         *model.User
	AccessToken  string
	RefreshToken string
	AccessTTL    time.Duration
	RefreshTTL   time.Duration
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

	token, _, err := s.generateAccessToken(user)
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

	token, _, err := s.generateAccessToken(user)
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

	token, _, err := s.generateAccessToken(user)
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

func (s *AuthService) AccessTokenTTL() time.Duration {
	if s == nil || s.cfg == nil {
		return 24 * time.Hour
	}

	dur, err := time.ParseDuration(strings.TrimSpace(s.cfg.JWTExpiry))
	if err != nil || dur <= 0 {
		return 24 * time.Hour
	}

	return dur
}

func (s *AuthService) RefreshTokenTTL() time.Duration {
	if s == nil || s.cfg == nil {
		return 30 * 24 * time.Hour
	}

	dur, err := time.ParseDuration(strings.TrimSpace(s.cfg.RefreshTokenExpiry))
	if err != nil || dur <= 0 {
		return 30 * 24 * time.Hour
	}

	return dur
}

func (s *AuthService) CreateRefreshSession(user *model.User, meta SessionMeta) (string, time.Duration, error) {
	if s.sessionRepo == nil {
		return "", 0, errors.New("config session tidak valid")
	}
	if user == nil || user.ID == uuid.Nil {
		return "", 0, errors.New("user sesi tidak valid")
	}

	refreshToken, tokenHash, err := generateSessionToken()
	if err != nil {
		return "", 0, errors.New("gagal membuat refresh token")
	}

	now := time.Now()
	ttl := s.RefreshTokenTTL()
	session := &model.AuthSession{
		UserID:     user.ID,
		TokenHash:  tokenHash,
		UserAgent:  strings.TrimSpace(meta.UserAgent),
		IPAddress:  strings.TrimSpace(meta.IPAddress),
		LastSeenAt: &now,
		ExpiresAt:  now.Add(ttl),
	}

	if err := s.sessionRepo.Create(session); err != nil {
		return "", 0, errors.New("gagal menyimpan sesi login")
	}

	return refreshToken, ttl, nil
}

func (s *AuthService) RestoreSession(accessToken, refreshToken string, meta SessionMeta) (*SessionBundle, error) {
	if strings.TrimSpace(accessToken) != "" {
		user, err := s.getUserFromAccessToken(accessToken)
		if err == nil {
			bundle := &SessionBundle{User: user}
			if err := s.ensureRefreshSession(user, strings.TrimSpace(refreshToken), meta, bundle); err != nil {
				return nil, err
			}
			return bundle, nil
		}
	}

	if strings.TrimSpace(refreshToken) == "" {
		return nil, errors.New("sesi login tidak valid")
	}

	if s.sessionRepo == nil {
		return nil, errors.New("config session tidak valid")
	}

	now := time.Now()
	session, err := s.sessionRepo.FindActiveByTokenHash(hashSessionToken(strings.TrimSpace(refreshToken)), now)
	if err != nil {
		return nil, errors.New("sesi login tidak valid")
	}

	user, err := s.userRepo.FindByID(session.UserID)
	if err != nil || user.ID == uuid.Nil || !user.IsActive {
		_ = s.sessionRepo.RevokeByID(session.ID, now)
		return nil, errors.New("sesi login tidak valid")
	}

	access, accessTTL, err := s.generateAccessToken(user)
	if err != nil {
		return nil, err
	}

	newRefreshToken, newHash, err := generateSessionToken()
	if err != nil {
		return nil, errors.New("gagal membuat refresh token")
	}

	refreshTTL := s.RefreshTokenTTL()
	if err := s.sessionRepo.Rotate(
		session.ID,
		newHash,
		strings.TrimSpace(meta.UserAgent),
		strings.TrimSpace(meta.IPAddress),
		now.Add(refreshTTL),
		now,
	); err != nil {
		return nil, errors.New("gagal memperbarui sesi login")
	}

	return &SessionBundle{
		User:         user,
		AccessToken:  access,
		RefreshToken: newRefreshToken,
		AccessTTL:    accessTTL,
		RefreshTTL:   refreshTTL,
	}, nil
}

func (s *AuthService) RevokeSession(refreshToken string) error {
	if s.sessionRepo == nil {
		return nil
	}
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return nil
	}
	return s.sessionRepo.RevokeByTokenHash(hashSessionToken(refreshToken), time.Now())
}

func (s *AuthService) ensureRefreshSession(user *model.User, refreshToken string, meta SessionMeta, bundle *SessionBundle) error {
	if s.sessionRepo == nil || user == nil || bundle == nil {
		return nil
	}

	refreshToken = strings.TrimSpace(refreshToken)
	now := time.Now()
	if refreshToken != "" {
		session, err := s.sessionRepo.FindActiveByTokenHash(hashSessionToken(refreshToken), now)
		if err == nil && session.UserID == user.ID {
			_ = s.sessionRepo.Touch(session.ID, now)
			return nil
		}
	}

	newRefreshToken, refreshTTL, err := s.CreateRefreshSession(user, meta)
	if err != nil {
		return err
	}

	bundle.RefreshToken = newRefreshToken
	bundle.RefreshTTL = refreshTTL
	return nil
}

func (s *AuthService) getUserFromAccessToken(token string) (*model.User, error) {
	if s.cfg == nil {
		return nil, errors.New("config auth tidak valid")
	}

	claims, err := jwt.Validate(strings.TrimSpace(token), s.cfg.JWTSecret)
	if err != nil {
		return nil, errors.New("token akses tidak valid")
	}

	user, err := s.userRepo.FindByID(claims.UserID)
	if err != nil || user.ID == uuid.Nil {
		return nil, errors.New("user sesi tidak ditemukan")
	}
	if !user.IsActive {
		return nil, errors.New("akun diblokir")
	}

	return user, nil
}

func (s *AuthService) generateAccessToken(user *model.User) (string, time.Duration, error) {
	if s.cfg == nil {
		return "", 0, errors.New("config auth tidak valid")
	}
	if strings.TrimSpace(s.cfg.JWTSecret) == "" {
		return "", 0, errors.New("JWT secret belum diisi")
	}

	dur := s.AccessTokenTTL()
	token, err := jwt.Generate(user.ID, user.Role, s.cfg.JWTSecret, dur)
	if err != nil {
		return "", 0, err
	}

	return token, dur, nil
}

func generateSessionToken() (string, string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}

	token := base64.RawURLEncoding.EncodeToString(buf)
	return token, hashSessionToken(token), nil
}

func hashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
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
