package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID uuid.UUID `json:"user_id"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

func Generate(id uuid.UUID, role, secret string, exp time.Duration) (string, error) {
	c := &Claims{
		UserID: id,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(exp)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString([]byte(secret))
}

func Validate(tok, secret string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(tok, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("bad method")
		}
		return []byte(secret), nil
	})
	if err != nil || !t.Valid {
		return nil, errors.New("invalid token")
	}
	c, ok := t.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid claims")
	}
	return c, nil
}
