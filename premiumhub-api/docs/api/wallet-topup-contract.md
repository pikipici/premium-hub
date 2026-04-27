# Wallet Topup API Contract (Duitku)

Tanggal update: 2026-04-10 (UTC)

Dokumen ini jadi kontrak backend untuk integrasi wallet topup berbasis **Duitku**.

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

### 2) Buat invoice topup (idempotent)

`POST /api/v1/wallet/topups`

Header opsional:
- `Idempotency-Key: <string>`

Body:

```json
{
  "amount": 50000,
  "payment_method": "SP",
  "idempotency_key": "topup-20260410-001"
}
```

Aturan:
- minimal `amount` = `10000`
- jika `idempotency_key` sama untuk user yang sama, backend mengembalikan invoice lama (tidak buat invoice baru)
- `payment_method` yang didukung backend saat ini:
  - `SP` = QRIS
  - `BR` = BRI VA
  - `I1` = BNI VA
  - `BT` = Permata VA

Response `201`:

```json
{
  "success": true,
  "message": "Invoice topup dibuat",
  "data": {
    "id": "uuid",
    "provider": "duitku",
    "gateway_ref": "WLT-ABC123...",
    "payment_method": "SP",
    "payment_number": "000201...",
    "requested_amount": 50000,
    "payable_amount": 53000,
    "status": "pending",
    "provider_status": "pending",
    "idempotency_key": "topup-20260410-001",
    "expires_at": "2026-04-10T16:20:00Z",
    "is_overdue": false,
    "last_checked_at": null,
    "settled_at": null,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

> Catatan: saldo wallet yang dikredit saat sukses = `requested_amount` (bukan `payable_amount`).

### 3) List topup

`GET /api/v1/wallet/topups?page=1&limit=20`

### 4) Detail topup

`GET /api/v1/wallet/topups/:id`

### 5) Sinkron status topup ke provider

`POST /api/v1/wallet/topups/:id/check`

Fungsi:
- backend cek status terbaru ke Duitku (`transactionStatus`)
- jika `success`, saldo wallet dikredit **sekali saja** (idempotent settlement)

### 6) Riwayat ledger wallet

`GET /api/v1/wallet/ledger?page=1&limit=20`

Contoh item ledger topup:

```json
{
  "id": "uuid",
  "type": "credit",
  "category": "topup",
  "amount": 50000,
  "balance_before": 10000,
  "balance_after": 60000,
  "reference": "wallet_topup:<topup_id>",
  "description": "Topup wallet via Duitku (WLT-ABC123...)",
  "created_at": "..."
}
```

## Endpoint Webhook Provider

### Webhook topup Duitku (shared endpoint)

`POST /api/v1/payment/webhook`

Body expected dari Duitku (`application/x-www-form-urlencoded`):

```text
merchantCode=D123
merchantOrderId=WLT-ABC123...
amount=50000
paymentCode=SP
resultCode=00
reference=DUT-...
signature=<md5 merchantCode+amount+merchantOrderId+apiKey>
```

Behavior:
- endpoint webhook dipakai bersama flow order + wallet
- routing internal ditentukan dari `order_id` (prefix `WLT-` untuk wallet)
- webhook divalidasi merchant code + signature + status
- backend tetap verify ulang via `transactionStatus`
- settlement tetap idempotent

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
- `minimal topup Rp 10.000`
- `nominal topup terlalu besar`
- `topup tidak ditemukan`
- `akun diblokir`
- `gagal cek status topup: ...`
