# PremiumHub API — Go Backend

## Quick Start

```bash
cp .env.example .env
# isi value di .env

go mod tidy
go run ./cmd
```

Server akan auto-migrate tabel saat start.

## Auth Endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/google`
- `POST /api/v1/auth/logout`

## Catatan env penting

- `JWT_SECRET` minimal 32 karakter
- `GOOGLE_CLIENT_ID` wajib jika mau aktifkan Google login/signup
- `COOKIE_SAMESITE=none` mewajibkan `COOKIE_SECURE=true`
- `AUTH_RATE_LIMIT_MAX` + `AUTH_RATE_LIMIT_WINDOW` mengatur throttle endpoint auth
