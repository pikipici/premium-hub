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

---

## Konfigurasi 5SIM (detail, production-oriented)

Section ini ngejelasin variabel 5SIM secara detail supaya tim ops/dev nggak salah paham waktu set harga wallet.

### 1) Variabel wajib & default

| Variable | Wajib | Default kode | Keterangan |
|---|---|---|---|
| `FIVESIM_API_KEY` | Ya (untuk endpoint user: buy/check/finish/cancel/ban/sms) | `""` | API key dari akun 5sim. **Jangan pernah commit ke git**. |
| `FIVESIM_BASE_URL` | Tidak (tapi sebaiknya explicit) | `https://5sim.net/v1` | Base URL API 5sim. |
| `FIVESIM_HTTP_TIMEOUT_SEC` | Tidak | `15` | Timeout request dari backend kita ke 5sim (detik). |
| `FIVESIM_WALLET_PRICE_MULTIPLIER` | Ya untuk wallet IDR yang benar | `1` | Angka pengali harga USD provider menjadi debit wallet internal (biasanya IDR). |
| `FIVESIM_WALLET_MIN_DEBIT` | Tidak (tapi direkomendasikan set) | `1` | Batas minimal debit per transaksi setelah kalkulasi multiplier. |

### 2) Rumus debit wallet (inti bisnis)

Backend memakai rumus:

```text
debit_wallet = max( ceil(provider_price_usd * FIVESIM_WALLET_PRICE_MULTIPLIER), FIVESIM_WALLET_MIN_DEBIT )
```

Penjelasan:
- `provider_price_usd` datang dari response 5sim (contoh: `0.35`).
- Hasil dikali multiplier, lalu `ceil` (dibulatkan ke atas).
- Setelah itu dipagar minimal oleh `FIVESIM_WALLET_MIN_DEBIT`.

### 3) Arti penting `FIVESIM_WALLET_PRICE_MULTIPLIER`

`FIVESIM_WALLET_PRICE_MULTIPLIER` **bukan** saklar on/off (`1/0`).
Ini angka pengali harga, alias “$1 dianggap berapa unit wallet”.

Contoh bila wallet unit = IDR:
- `multiplier = 18500` → kira-kira artinya `$1 ≈ Rp18.500` (plus ruang margin tergantung biaya real USD).
- `multiplier = 1` → praktis tidak mengonversi ke IDR, biasanya bikin harga user tidak masuk akal.

### 4) Contoh hitung (multiplier = `18500`, min debit = `1`)

- Harga provider `$0.07` → `ceil(0.07 × 18500)` = `1295` → debit wallet `Rp1.295`
- Harga provider `$0.35` → `ceil(0.35 × 18500)` = `6475` → debit wallet `Rp6.475`
- Harga provider `$1.20` → `ceil(1.20 × 18500)` = `22200` → debit wallet `Rp22.200`

### 5) Baseline nilai yang direkomendasikan (runtime sekarang)

```env
FIVESIM_BASE_URL=https://5sim.net/v1
FIVESIM_HTTP_TIMEOUT_SEC=15
FIVESIM_WALLET_PRICE_MULTIPLIER=18500
FIVESIM_WALLET_MIN_DEBIT=1
# FIVESIM_API_KEY=<isi dari dashboard 5sim, jangan commit>
```

### 6) Dampak bisnis saat tuning

- Naikkan `FIVESIM_WALLET_PRICE_MULTIPLIER` → margin per transaksi cenderung naik, tapi risiko conversion turun kalau harga jadi kemahalan.
- Turunkan `FIVESIM_WALLET_PRICE_MULTIPLIER` → harga lebih kompetitif, margin menipis.
- Naikkan `FIVESIM_WALLET_MIN_DEBIT` → order sangat murah tetap kena floor (bisa bantu nutup biaya overhead), tapi hati-hati fairness.

### 7) Security & operasional (WAJIB)

- `FIVESIM_API_KEY` backend-only, jangan expose ke frontend/client.
- Kalau API key pernah terkirim ke channel publik/grup/chat, **anggap bocor dan rotate segera**.
- Setelah ubah env, restart service API agar config baru kebaca.

---

## Convert API (Phase 5 baseline)

Implementasi convert sudah dipisah total dari modul lain (route + tabel + service):

### User routes
- `GET /api/v1/convert/track/:token` (public tracking)
- `GET /api/v1/convert/proofs/:proofId/view` (public proxy viewer untuk bukti R2)
- `POST /api/v1/convert/guest/orders` (public guest checkout)
- `POST /api/v1/convert/track/:token/proofs` (public guest proof upload)
- `POST /api/v1/convert/orders`
- `GET /api/v1/convert/orders`
- `GET /api/v1/convert/orders/:id`
- `POST /api/v1/convert/orders/:id/proofs`

### Admin routes
- `GET /api/v1/admin/convert/orders`
- `GET /api/v1/admin/convert/orders/:id`
- `PATCH /api/v1/admin/convert/orders/:id/status`
- `POST /api/v1/admin/convert/orders/expire-pending`
- `GET /api/v1/admin/convert/pricing`
- `PUT /api/v1/admin/convert/pricing`
- `GET /api/v1/admin/convert/limits`
- `PUT /api/v1/admin/convert/limits`

### Safety guards (Phase 4)
- In-memory rate limit endpoint sensitif:
  - `CONVERT_TRACK_RATE_LIMIT_MAX` / `CONVERT_TRACK_RATE_LIMIT_WINDOW`
  - `CONVERT_CREATE_RATE_LIMIT_MAX` / `CONVERT_CREATE_RATE_LIMIT_WINDOW`
  - `CONVERT_PROOF_RATE_LIMIT_MAX` / `CONVERT_PROOF_RATE_LIMIT_WINDOW`
  - `CONVERT_ADMIN_STATUS_RATE_LIMIT_MAX` / `CONVERT_ADMIN_STATUS_RATE_LIMIT_WINDOW`
- Upload bukti divalidasi ketat:
  - file upload: whitelist MIME + max 10MB
  - URL bukti: wajib `http/https` valid
- Storage bukti convert mendukung 2 mode:
  - `CONVERT_PROOF_STORAGE_MODE=local` → simpan ke disk lokal (`CONVERT_PROOF_LOCAL_DIR`)
  - `CONVERT_PROOF_STORAGE_MODE=r2` → upload ke Cloudflare R2 (`CONVERT_PROOF_R2_*`)
- Auto-expire pending order via worker:
  - `CONVERT_EXPIRY_WORKER_ENABLED=true|false`
  - `CONVERT_EXPIRY_WORKER_INTERVAL=1m`
  - `CONVERT_EXPIRY_WORKER_BATCH_LIMIT=200`

Detail kontrak & lifecycle lihat:
- `docs/api/convert-contract.md`

QA + go-live checklist phase 5:
- `../docs/convert-phase5-qa-go-live.md`
