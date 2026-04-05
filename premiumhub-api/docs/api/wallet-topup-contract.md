# Wallet Topup API Contract (Wiring Freeze)

Tanggal freeze: 2026-04-05 (UTC)

Dokumen ini jadi kontrak backend untuk integrasi UI wallet topup.
Perubahan breaking setelah ini harus lewat versioning endpoint.

## Auth

Semua endpoint wallet butuh auth user (`Bearer token` atau cookie `access_token`).

## Status Topup (internal)

- `pending` → invoice masih menunggu pembayaran
- `success` → pembayaran tervalidasi dan saldo wallet sudah dikredit
- `failed` → pembayaran ditolak/dibatalkan
- `expired` → invoice kadaluarsa dari provider

## Endpoint User

### 1) Cek saldo wallet

`GET /api/v1/wallet/balance`

Response `200`:

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "balance": 125000
  }
}
```

---

### 2) Buat invoice topup (idempotent)

`POST /api/v1/wallet/topups`

Header opsional:
- `Idempotency-Key: <string>`

Body:

```json
{
  "amount": 50000,
  "idempotency_key": "topup-20260405-001"
}
```

Aturan:
- minimal `amount` = `1000`
- jika `idempotency_key` sama untuk user yang sama, backend mengembalikan invoice lama (tidak buat invoice baru)

Response `201`:

```json
{
  "success": true,
  "message": "Invoice topup dibuat",
  "data": {
    "id": "uuid",
    "provider": "neticon",
    "provider_trx_id": "H2H1710001234",
    "requested_amount": 50000,
    "unique_code": 321,
    "payable_amount": 50321,
    "status": "pending",
    "provider_status": "pending",
    "idempotency_key": "topup-20260405-001",
    "expires_at": "2026-04-05T00:20:00Z",
    "is_overdue": false,
    "last_checked_at": null,
    "settled_at": null,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

### 3) List topup

`GET /api/v1/wallet/topups?page=1&limit=20`

Response `200` + `meta` pagination.

---

### 4) Detail topup

`GET /api/v1/wallet/topups/:id`

Response `200`:
- struktur `data` sama seperti create topup.

---

### 5) Sinkron status topup ke provider

`POST /api/v1/wallet/topups/:id/check`

Fungsi:
- backend cek status terbaru ke Neticon
- jika `success`, saldo wallet dikredit **sekali saja** (idempotent settlement)

Response `200`:
- struktur `data` sama seperti detail topup.

---

### 6) Riwayat ledger wallet

`GET /api/v1/wallet/ledger?page=1&limit=20`

Response `200` + `meta` pagination.

Data item:

```json
{
  "id": "uuid",
  "type": "credit",
  "category": "topup",
  "amount": 50321,
  "balance_before": 10000,
  "balance_after": 60321,
  "reference": "wallet_topup:<topup_id>",
  "description": "Topup wallet via Neticon (H2H1710001234)",
  "created_at": "..."
}
```

## Endpoint Admin

### 1) Recheck topup tertentu

`POST /api/v1/admin/wallet/topups/:id/recheck`

### 2) Reconcile batch pending topup

`POST /api/v1/admin/wallet/topups/reconcile?limit=200`

`limit` range: `1..1000`

## Error Contract

Format error standar:

```json
{
  "success": false,
  "message": "<error_message>",
  "data": null
}
```

Contoh message penting:
- `minimal topup Rp 1.000`
- `nominal topup terlalu besar`
- `topup tidak ditemukan`
- `akun diblokir`
- `gagal cek status topup: ...`

## Catatan Implementasi

- Settlement topup dilakukan dalam DB transaction + row lock (anti double-credit).
- Ledger wallet memakai `reference` unik, jadi credit tidak bisa masuk dua kali untuk topup yang sama.
- `is_overdue=true` artinya sudah lewat `expires_at` tapi status internal masih `pending`.
