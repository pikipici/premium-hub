# Convert API Contract v1 (Phase 0 Freeze)

Tanggal freeze: 2026-04-09 (UTC)
Owner: PremiumHub team
Scope: Modul **Convert** (Pulsa / PayPal / Crypto) dengan proses manual operasional.

Dokumen ini adalah **source of truth** untuk wiring FE/BE di phase implementasi awal.
Perubahan yang breaking setelah freeze ini wajib lewat versioning (`/api/v2/...`) atau RFC perubahan kontrak.

---

## 0) Tujuan & Batasan

### Tujuan
- FE dan BE punya kontrak tunggal untuk modul convert.
- Menghindari perubahan liar yang merusak flow sistem lain.
- Menjamin order convert bisa dipersist, ditrack, dan diaudit.

### Batasan Phase 0
- Fokus ke kontrak + boundary.
- Tidak mengubah behavior modul existing (`wallet`, `orders`, `5sim/nokos`) pada phase ini.
- Operasional convert tetap manual (belum auto payout engine).

---

## 1) Isolation Guardrails (WAJIB)

Untuk mencegah gangguan ke sistem lain, semua implementasi convert wajib patuh:

1. **Route namespace terpisah total**
   - User: `/api/v1/convert/*`
   - Admin: `/api/v1/admin/convert/*`

2. **Storage terpisah total**
   - Tabel convert harus pakai prefix `convert_`.
   - Dilarang menumpang tabel `orders`, `wallet_*`, `fivesim_*`.

3. **Service layer terpisah**
   - Buat service/repository/handler convert sendiri.
   - Dilarang coupling langsung ke flow pembelian produk premium apps.

4. **No destructive migration**
   - Hanya boleh additive migration untuk phase convert.
   - Dilarang rename/drop kolom dari modul lain.

5. **Error envelope tetap standar global**
   - `{ success, message, data, meta? }`

6. **Role & ownership strict**
   - User hanya bisa akses order miliknya.
   - Admin endpoint wajib role `admin`.

---

## 2) Status Lifecycle Convert

Status order convert internal yang dipakai:

- `draft` (opsional internal pre-create)
- `pending_transfer`
- `waiting_review`
- `approved`
- `processing`
- `success`
- `failed`
- `expired`
- `canceled`

### Transition rule
- `pending_transfer -> waiting_review | expired | canceled`
- `waiting_review -> approved | failed | canceled`
- `approved -> processing | failed`
- `processing -> success | failed`
- `success/failed/expired/canceled` = terminal state

Setiap perubahan status wajib tercatat ke audit events.

---

## 3) Formula Manual Convert (Freeze v1)

Semua nominal disimpan sebagai integer IDR (`int64`).

Input parameter per order:
- `source_amount` (nominal aset masuk dalam IDR-equivalent input UI)
- `rate` (decimal, contoh `0.85`)
- `admin_fee`
- `risk_fee`
- `transfer_fee`
- `guest_surcharge` (0 jika member)
- `ppn_rate` (default `0.11`)

### Perhitungan
1. `converted_amount = round(source_amount * rate)`
2. `ppn_amount = round(admin_fee * ppn_rate)`
3. `total_fee = admin_fee + risk_fee + transfer_fee + guest_surcharge + ppn_amount`
4. `receive_amount = max(converted_amount - total_fee, 0)`

### Catatan penting
- Rounding: **round half up** (setara `Math.round` untuk angka positif).
- Nilai final yang dipakai saat create order adalah **snapshot** (immutable), tidak ikut berubah kalau pricing rule berubah belakangan.

---

## 4) User API Contract

## 4.1 Create order convert
`POST /api/v1/convert/orders`

Body:
```json
{
  "asset_type": "pulsa",
  "source_amount": 100000,
  "source_channel": "Telkomsel",
  "source_account": "081234567890",
  "destination_bank": "BCA",
  "destination_account_number": "1234567890",
  "destination_account_name": "BUDI SANTOSO",
  "is_guest": false,
  "notes": "optional",
  "idempotency_key": "cvt-20260409-001"
}
```

Response `201`:
```json
{
  "success": true,
  "message": "Order convert berhasil dibuat",
  "data": {
    "id": "uuid",
    "tracking_token": "cvt_xxxxx",
    "status": "pending_transfer",
    "asset_type": "pulsa",
    "source_amount": 100000,
    "converted_amount": 85000,
    "total_fee": 13000,
    "receive_amount": 72000,
    "pricing_snapshot": {
      "rate": 0.85,
      "admin_fee": 2500,
      "risk_fee": 0,
      "transfer_fee": 6500,
      "guest_surcharge": 3000,
      "ppn_rate": 0.11,
      "ppn_amount": 275
    },
    "expires_at": "2026-04-09T03:05:00Z",
    "created_at": "2026-04-09T02:05:00Z"
  }
}
```

## 4.2 Create guest order convert (tanpa login)
`POST /api/v1/convert/guest/orders`

Body mengikuti create order biasa, namun server akan force `is_guest=true`.

Catatan:
- Endpoint ini khusus flow guest checkout.
- Tetap kena validasi limit/rate-limit dan surcharge guest.

## 4.3 List my orders
`GET /api/v1/convert/orders?page=1&limit=20&asset_type=pulsa&status=pending_transfer`

Response `200` + `meta` pagination.

## 4.4 Detail my order
`GET /api/v1/convert/orders/:id`

Response `200` detail lengkap + timeline events ringkas.

## 4.5 Guest/member tracking by token
`GET /api/v1/convert/track/:token`

Response `200` status order untuk halaman tracking publik.

## 4.6 Upload proof by order id (member login)
`POST /api/v1/convert/orders/:id/proofs`

Body (multipart atau JSON URL):
- `file` (opsional)
- `file_url` (opsional)
- `note` (opsional)

Rule:
- Minimal salah satu dari `file` atau `file_url`.
- `file_url` harus URL valid `http/https`.
- Untuk upload file, penyimpanan bisa di-local storage atau R2 sesuai env server.
- Proof tipe endpoint ini: `user_payment`.
- Setelah proof valid masuk, status boleh naik ke `waiting_review` (sesuai policy ops).

## 4.7 Upload proof by tracking token (guest/public)
`POST /api/v1/convert/track/:token/proofs`

Body sama seperti endpoint upload proof biasa.

Rule tambahan:
- Token tracking wajib valid dan aktif.
- Proof tipe endpoint ini: `user_payment`.
- Jika order sudah final (`success/failed/expired/canceled`), upload proof ditolak.

## 4.8 View proof via proxy (public)
`GET /api/v1/convert/proofs/:proofId/view`

Tujuan:
- Proxy viewer untuk bukti yang disimpan di R2 agar halaman admin/user tidak tergantung akses cert langsung ke domain R2.

Rule:
- Hanya URL proof dari host R2 publik yang dikonfigurasi server yang bisa diproxy.
- Kalau proof berasal dari URL eksternal non-R2, fallback tetap lewat link asli.

---

## 5) Admin API Contract

## 5.1 List queue
`GET /api/v1/admin/convert/orders?page=1&limit=20&status=waiting_review&asset_type=paypal&q=...`

## 5.2 Detail order (include proofs + events)
`GET /api/v1/admin/convert/orders/:id`

Tujuan:
- Admin bisa review detail order, termasuk semua bukti transfer yang sudah diunggah user.

## 5.3 Upload admin settlement proof
`POST /api/v1/admin/convert/orders/:id/settlement-proofs`

Body sama seperti upload proof endpoint (`file` atau `file_url` + note optional).

Rule:
- Proof tipe endpoint ini: `admin_settlement`.
- Bukti ini dipakai untuk menandai bahwa admin sudah menyelesaikan transfer ke user.

## 5.4 Update status/order action
`PATCH /api/v1/admin/convert/orders/:id/status`

Body:
```json
{
  "to_status": "approved",
  "reason": "bukti valid",
  "internal_note": "ops note"
}
```

Rule:
- Wajib valid transition.
- Wajib simpan actor admin + reason di event log.
- Untuk transisi ke `success`, minimal harus ada 1 bukti `admin_settlement`.

## 5.5 Expire pending orders (ops safety)
`POST /api/v1/admin/convert/orders/expire-pending?limit=200`

Tujuan:
- Menjalankan proses expire pending order secara manual (ops/recovery), selain worker scheduler otomatis.

Response `200`:
```json
{
  "success": true,
  "message": "Expire pending convert selesai",
  "data": {
    "checked": 17,
    "expired": 5
  }
}
```

## 5.6 Get pricing rules
`GET /api/v1/admin/convert/pricing`

## 5.7 Update pricing rules
`PUT /api/v1/admin/convert/pricing`

## 5.8 Get limits/access rules
`GET /api/v1/admin/convert/limits`

## 5.9 Update limits/access rules
`PUT /api/v1/admin/convert/limits`

---

## 6) Data Model Minimum (Phase 1 target)

- `convert_orders`
  - identity, actor (user/guest), source/destination, snapshot pricing, current status, expiry.
- `convert_order_events`
  - order_id, from_status, to_status, reason, actor_type, actor_id, created_at.
- `convert_proofs`
  - order_id, file_url/path, mime_type, size, note, uploaded_by, `proof_type` (`user_payment` | `admin_settlement`).
- `convert_pricing_rules`
  - asset_type, rate, admin_fee, risk_fee, transfer_fee, guest_surcharge, enabled.
- `convert_limit_rules`
  - asset_type, min_amount, max_amount, daily_limit, allow_guest, require_login, manual_review_threshold.
- `convert_tracking_tokens`
  - order_id, token, is_active, expires_at.

Semua tabel pakai kolom audit standar (`created_at`, `updated_at`) + index query utama.

---

## 7) Error Contract

Format standar:
```json
{
  "success": false,
  "message": "<error_message>",
  "data": null
}
```

Contoh message minimum:
- `nominal convert di bawah minimum`
- `nominal convert melebihi batas maksimum`
- `asset convert tidak tersedia`
- `order convert tidak ditemukan`
- `order convert bukan milik user`
- `transisi status tidak valid`
- `bukti transaksi tidak valid`
- `akun diblokir`

---

## 8) Security & Compliance Minimum

- Auth wajib untuk semua endpoint user/admin kecuali tracking token publik.
- Tracking token harus random + tidak bisa ditebak.
- Rate-limit endpoint sensitif (`create`, `upload proof`, `status update`).
- Sanitasi file upload (size/type) dan hindari executable upload.
- Log semua perubahan status dengan actor.

---

## 9) Definition of Done (Phase 0 selesai jika)

- [x] Kontrak route user/admin freeze.
- [x] Formula perhitungan manual freeze.
- [x] Status lifecycle + transition freeze.
- [x] Boundary anti gangguan sistem lain ditetapkan.
- [x] Daftar tabel dan payload minimum disepakati.

---

## 10) Changelog

- `2026-04-09`: Initial freeze contract v1 (manual convert, isolated namespace).
- `2026-04-09`: Phase 4 ops safety update (`expire-pending` admin endpoint + stronger safety guard notes).
- `2026-04-10`: Added admin settlement proof flow (`admin_settlement`) + success guard requiring settlement evidence.
