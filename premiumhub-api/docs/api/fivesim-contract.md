# FiveSim API Contract

## Base Path

`/api/v1/5sim`

Semua endpoint butuh auth user (`Bearer token`).

## Rate Limit Buy Endpoints

Untuk endpoint pembelian (`POST /orders/activation`, `POST /orders/hosting`, `POST /orders/reuse`) diterapkan user-based rate limit.

Konfigurasi:

- `FIVESIM_BUY_RATE_LIMIT_MAX` (default: `8`)
- `FIVESIM_BUY_RATE_LIMIT_WINDOW` (default: `1m`)

Jika limit terlampaui, API mengembalikan error:

- `"Terlalu banyak request pembelian 5sim. Coba lagi sebentar."`

## Idempotency (Mandatory)

Semua endpoint buy **wajib** kirim `idempotency_key`.

Aturan:

1. `idempotency_key` wajib diisi, max 80 karakter.
2. Key yang sama + payload yang sama + status sukses → API balikin order yang sama (provider tidak dipanggil ulang).
3. Key yang sama + payload beda → ditolak (`idempotency_key sudah dipakai untuk request berbeda`).
4. Key yang sama saat request sebelumnya masih proses → ditolak (`request pembelian 5sim sedang diproses, coba lagi sebentar`).

## Endpoints

### 1) Buy Activation

`POST /api/v1/5sim/orders/activation`

Request:

```json
{
  "country": "england",
  "operator": "any",
  "product": "telegram",
  "forwarding": false,
  "number": "",
  "reuse": false,
  "voice": false,
  "ref": "",
  "max_price": 0.45,
  "idempotency_key": "fivesim-activation-20260413-001"
}
```

### 2) Buy Hosting

`POST /api/v1/5sim/orders/hosting`

Request:

```json
{
  "country": "england",
  "operator": "any",
  "product": "telegram",
  "idempotency_key": "fivesim-hosting-20260413-001"
}
```

### 3) Reuse Number

`POST /api/v1/5sim/orders/reuse`

Request:

```json
{
  "product": "telegram",
  "number": "+447000001111",
  "idempotency_key": "fivesim-reuse-20260413-001"
}
```

## Standard Success Response (Buy)

```json
{
  "success": true,
  "message": "Nomor 5sim berhasil dibeli",
  "data": {
    "local_order": {
      "id": "uuid",
      "provider_order_id": 991122,
      "order_type": "activation",
      "provider_status": "PENDING"
    },
    "provider_order": {
      "id": 991122,
      "status": "PENDING",
      "country": "england",
      "operator": "vodafone",
      "product": "telegram"
    }
  }
}
```

## Standard Error Copy

- `"idempotency_key wajib diisi"`
- `"idempotency_key maksimal 80 karakter"`
- `"idempotency_key sudah dipakai untuk request berbeda"`
- `"request pembelian 5sim sedang diproses, coba lagi sebentar"`
