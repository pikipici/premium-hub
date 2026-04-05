package service

import (
	"context"
	"errors"
	"strings"

	"google.golang.org/api/idtoken"
)

type GoogleProfile struct {
	Subject       string
	Email         string
	EmailVerified bool
	Name          string
}

type GoogleVerifier interface {
	Verify(ctx context.Context, idToken string) (*GoogleProfile, error)
}

type googleVerifier struct {
	clientID string
}

func NewGoogleVerifier(clientID string) GoogleVerifier {
	return &googleVerifier{clientID: strings.TrimSpace(clientID)}
}

func (g *googleVerifier) Verify(ctx context.Context, idToken string) (*GoogleProfile, error) {
	if strings.TrimSpace(g.clientID) == "" {
		return nil, errors.New("GOOGLE_CLIENT_ID belum diisi")
	}

	payload, err := idtoken.Validate(ctx, idToken, g.clientID)
	if err != nil {
		return nil, errors.New("token Google tidak valid")
	}

	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	subject, _ := payload.Claims["sub"].(string)
	if subject == "" {
		subject = strings.TrimSpace(payload.Subject)
	}

	emailVerified := false
	switch v := payload.Claims["email_verified"].(type) {
	case bool:
		emailVerified = v
	case string:
		emailVerified = strings.EqualFold(v, "true")
	}

	return &GoogleProfile{
		Subject:       strings.TrimSpace(subject),
		Email:         strings.TrimSpace(email),
		EmailVerified: emailVerified,
		Name:          strings.TrimSpace(name),
	}, nil
}
