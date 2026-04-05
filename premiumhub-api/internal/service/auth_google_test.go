package service

import (
	"context"
	"strings"
	"testing"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/hash"

	"github.com/google/uuid"
)

type mockGoogleVerifier struct {
	profile *GoogleProfile
	err     error
}

func (m *mockGoogleVerifier) Verify(_ context.Context, _ string) (*GoogleProfile, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.profile, nil
}

func TestAuthService_LoginWithGoogle(t *testing.T) {
	t.Run("reject when google not configured", func(t *testing.T) {
		db := setupCoreDB(t)
		svc := NewAuthService(repository.NewUserRepo(db), &config.Config{JWTSecret: "jwt-secret-test-32-chars-minimum!!!"})
		svc.SetGoogleVerifier(&mockGoogleVerifier{profile: &GoogleProfile{Subject: "sub-1", Email: "user@example.com", EmailVerified: true}})

		_, err := svc.LoginWithGoogle(context.Background(), GoogleLoginInput{IDToken: "token"})
		if err == nil || !strings.Contains(err.Error(), "dikonfigurasi") {
			t.Fatalf("expected google config error, got: %v", err)
		}
	})

	t.Run("reject invalid token and unverified email", func(t *testing.T) {
		db := setupCoreDB(t)
		svc := NewAuthService(repository.NewUserRepo(db), &config.Config{JWTSecret: "jwt-secret-test-32-chars-minimum!!!", GoogleClientID: "gid"})

		svc.SetGoogleVerifier(&mockGoogleVerifier{err: context.DeadlineExceeded})
		if _, err := svc.LoginWithGoogle(context.Background(), GoogleLoginInput{IDToken: "token"}); err == nil || !strings.Contains(err.Error(), "token Google") {
			t.Fatalf("expected invalid token error, got: %v", err)
		}

		svc.SetGoogleVerifier(&mockGoogleVerifier{profile: &GoogleProfile{Subject: "sub-2", Email: "user@example.com", EmailVerified: false}})
		if _, err := svc.LoginWithGoogle(context.Background(), GoogleLoginInput{IDToken: "token"}); err == nil || !strings.Contains(err.Error(), "terverifikasi") {
			t.Fatalf("expected email verified error, got: %v", err)
		}
	})

	t.Run("create new user from google", func(t *testing.T) {
		db := setupCoreDB(t)
		userRepo := repository.NewUserRepo(db)
		svc := NewAuthService(userRepo, &config.Config{JWTSecret: "jwt-secret-test-32-chars-minimum!!!", GoogleClientID: "gid"})
		svc.SetGoogleVerifier(&mockGoogleVerifier{profile: &GoogleProfile{
			Subject:       "sub-create",
			Email:         "NewUser@Example.com",
			EmailVerified: true,
			Name:          "New User",
		}})

		res, err := svc.LoginWithGoogle(context.Background(), GoogleLoginInput{IDToken: "token"})
		if err != nil {
			t.Fatalf("login with google should create user, got: %v", err)
		}
		if res.User.Email != "newuser@example.com" {
			t.Fatalf("email should be normalized, got: %s", res.User.Email)
		}
		if res.Token == "" {
			t.Fatalf("token should not be empty")
		}

		created, err := userRepo.FindByGoogleSub("sub-create")
		if err != nil {
			t.Fatalf("find by google sub: %v", err)
		}
		if created.ID == uuid.Nil {
			t.Fatalf("created user should have id")
		}
		if created.Password == "" || hash.Check("", created.Password) {
			t.Fatalf("created user should have hashed bootstrap password")
		}
	})

	t.Run("link existing local user by email", func(t *testing.T) {
		db := setupCoreDB(t)
		userRepo := repository.NewUserRepo(db)
		svc := NewAuthService(userRepo, &config.Config{JWTSecret: "jwt-secret-test-32-chars-minimum!!!", GoogleClientID: "gid"})
		svc.SetGoogleVerifier(&mockGoogleVerifier{profile: &GoogleProfile{
			Subject:       "sub-link",
			Email:         "local@example.com",
			EmailVerified: true,
			Name:          "Linked Local",
		}})

		pw, err := hash.Password("secret123")
		if err != nil {
			t.Fatalf("hash local password: %v", err)
		}
		local := &model.User{
			Name:     "Local User",
			Email:    "local@example.com",
			Password: pw,
			Role:     "user",
			IsActive: true,
		}
		if err := userRepo.Create(local); err != nil {
			t.Fatalf("create local user: %v", err)
		}

		res, err := svc.LoginWithGoogle(context.Background(), GoogleLoginInput{IDToken: "token"})
		if err != nil {
			t.Fatalf("google login should link local user, got: %v", err)
		}
		if res.User.ID != local.ID {
			t.Fatalf("expected linked user id=%s got=%s", local.ID, res.User.ID)
		}

		linked, err := userRepo.FindByID(local.ID)
		if err != nil {
			t.Fatalf("find linked user: %v", err)
		}
		if linked.GoogleSub == nil || *linked.GoogleSub != "sub-link" {
			t.Fatalf("google sub should be linked")
		}
	})

	t.Run("reject blocked or mismatched linked user", func(t *testing.T) {
		db := setupCoreDB(t)
		userRepo := repository.NewUserRepo(db)
		svc := NewAuthService(userRepo, &config.Config{JWTSecret: "jwt-secret-test-32-chars-minimum!!!", GoogleClientID: "gid"})

		pw, err := hash.Password("secret123")
		if err != nil {
			t.Fatalf("hash password: %v", err)
		}
		sub := "real-sub"
		blocked := &model.User{
			Name:      "Blocked",
			Email:     "blocked@example.com",
			Password:  pw,
			GoogleSub: &sub,
			Role:      "user",
			IsActive:  true,
		}
		if err := userRepo.Create(blocked); err != nil {
			t.Fatalf("create blocked user: %v", err)
		}
		if err := db.Model(&model.User{}).Where("id = ?", blocked.ID).Update("is_active", false).Error; err != nil {
			t.Fatalf("set blocked user inactive: %v", err)
		}

		svc.SetGoogleVerifier(&mockGoogleVerifier{profile: &GoogleProfile{
			Subject:       "real-sub",
			Email:         "blocked@example.com",
			EmailVerified: true,
			Name:          "Blocked",
		}})
		if _, err := svc.LoginWithGoogle(context.Background(), GoogleLoginInput{IDToken: "token"}); err == nil || !strings.Contains(err.Error(), "diblokir") {
			t.Fatalf("expected blocked error, got: %v", err)
		}

		activeSub := "sub-a"
		active := &model.User{
			Name:      "Mismatch",
			Email:     "mismatch@example.com",
			Password:  pw,
			GoogleSub: &activeSub,
			Role:      "user",
			IsActive:  true,
		}
		if err := userRepo.Create(active); err != nil {
			t.Fatalf("create active user: %v", err)
		}

		svc.SetGoogleVerifier(&mockGoogleVerifier{profile: &GoogleProfile{
			Subject:       "sub-b",
			Email:         "mismatch@example.com",
			EmailVerified: true,
			Name:          "Mismatch",
		}})
		if _, err := svc.LoginWithGoogle(context.Background(), GoogleLoginInput{IDToken: "token"}); err == nil || !strings.Contains(err.Error(), "tidak cocok") {
			t.Fatalf("expected mismatch error, got: %v", err)
		}
	})
}
