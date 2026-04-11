# Order Payment API Contract (Pakasir)

Tanggal update: 2026-04-10 (UTC)

Kontrak ini untuk flow pembayaran order produk premium menggunakan Pakasir.

## Endpoint

### 1) Buat order

`POST /api/v1/orders`

Body minimal:

```json
{
  "price_id": "<uuid>",
  "payment_method": "pakasir"
}
```

Order akan dibuat status `pending`.

### 2) Buat invoice pembayaran order

`POST /api/v1/payment/create`

Body:

```json
{
  "order_id": "<uuid>",
  "payment_method": "qris"
}
```

`payment_method` Pakasir yang didukung backend:
- `qris`
- `bri_va`
- `bni_va`
- `permata_va`

Response `200`:

```json
{
  "success": true,
  "message": "Transaksi dibuat",
  "data": {
    "order_id": "<uuid>",
    "provider": "pakasir",
    "payment_method": "qris",
    "payment_number": "000201...",
    "gateway_order_id": "ORD-...",
    "amount": 45000,
    "total_payment": 48000,
    "expires_at": "2026-04-10T16:20:00Z"
  }
}
```

### 3) Cek status order

`GET /api/v1/payment/status/:orderId`

### 4) Webhook order dari Pakasir

`POST /api/v1/payment/webhook`

Body expected:

```json
{
  "order_id": "ORD-...",
  "project": "premiumhub",
  "status": "COMPLETED",
  "amount": 45000,
  "payment_method": "qris",
  "completed_at": "2026-04-10T16:05:00Z"
}
```

Behavior:
- endpoint webhook dipakai bersama flow order + wallet
- routing internal ditentukan dari `order_id` (prefix `ORD-` untuk order, `WLT-` untuk wallet)
- webhook validasi project
- backend verify ulang ke Pakasir `transactiondetail`
- jika valid `COMPLETED` + amount cocok:
  - `payment_status = paid`
  - order aktif + assign stock
- idempotent untuk webhook duplikat

## Notes

- Endpoint simulasi payment legacy sudah dihapus.
- `gateway_order_id` dan `payment_payload` dipakai sebagai field internal order untuk referensi invoice provider.
