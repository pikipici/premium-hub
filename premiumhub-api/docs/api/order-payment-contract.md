# Order Payment API Contract (Duitku + Wallet)

Tanggal update: 2026-04-18 (UTC)

Kontrak ini untuk flow pembayaran order produk premium.

## Endpoint

### 1) Buat order

`POST /api/v1/orders`

Body minimal:

```json
{
  "price_id": "<uuid>",
  "payment_method": "duitku"
}
```

`payment_method` opsional:
- `duitku` (default)
- `wallet`

Order awal dibuat status `pending`.

### 2) Buat transaksi pembayaran order

`POST /api/v1/payment/create`

Body:

```json
{
  "order_id": "<uuid>",
  "payment_method": "SP"
}
```

#### A. Flow Duitku

`payment_method` Duitku utama yang dipakai UI:
- `SP` = QRIS
- `BR` = BRI VA
- `I1` = BNI VA
- `BT` = Permata VA

Backend masih menerima alias legacy seperti `qris`, `bri_va`, `bni_va`, dan `permata_va`, lalu dinormalisasi ke kode Duitku.

Response `200` (contoh):

```json
{
  "success": true,
  "message": "Transaksi dibuat",
  "data": {
    "order_id": "<uuid>",
    "provider": "duitku",
    "payment_method": "SP",
    "payment_number": "000201...",
    "payment_url": "https://passport.duitku.com/...",
    "gateway_reference": "DUT-...",
    "gateway_order_id": "ORD-...",
    "amount": 45000,
    "total_payment": 48000,
    "expires_at": "2026-04-10T16:20:00Z"
  }
}
```

#### B. Flow Wallet Checkout

Untuk wallet checkout, kirim:

```json
{
  "order_id": "<uuid>",
  "payment_method": "wallet"
}
```

Behavior wallet checkout:
- backend lock order + user + stok dalam transaksi DB,
- saldo wallet dipotong (`wallet_ledgers` category `product_purchase`),
- order langsung di-set `paid/active`,
- stok langsung di-assign,
- idempotent untuk retry request yang sama.

Response `200` (contoh):

```json
{
  "success": true,
  "message": "Transaksi dibuat",
  "data": {
    "order_id": "<uuid>",
    "provider": "wallet",
    "payment_method": "wallet",
    "gateway_order_id": "order_wallet:<order_id>:charge",
    "amount": 45000,
    "payment_status": "paid",
    "order_status": "active",
    "wallet_balance_before": 100000,
    "wallet_balance_after": 55000
  }
}
```

### 3) Cek status order

`GET /api/v1/payment/status/:orderId`

### 4) Webhook order dari Duitku

`POST /api/v1/payment/webhook`

Body expected dari Duitku (`application/x-www-form-urlencoded`):

```text
merchantCode=D123
merchantOrderId=ORD-...
amount=45000
paymentCode=SP
resultCode=00
reference=DUT-...
signature=<md5 merchantCode+amount+merchantOrderId+apiKey>
```

Behavior:
- endpoint webhook dipakai bersama flow order + wallet topup,
- routing internal ditentukan dari `order_id` (prefix `ORD-` untuk order, `WLT-` untuk wallet topup),
- webhook validasi merchant code + signature,
- backend verify ulang ke Duitku `transactionStatus`,
- jika valid `00` + amount cocok:
  - `payment_status = paid`,
  - order aktif + assign stock,
- idempotent untuk webhook duplikat.

## Notes

- Endpoint simulasi payment legacy sudah dihapus.
- Field `gateway_order_id` dan `payment_payload` dipakai sebagai field internal order untuk referensi invoice provider.
