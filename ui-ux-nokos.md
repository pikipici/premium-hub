# UI/UX NOKOS — FE Contract Spec (Match 100% ke BE)

## 0) Tujuan Dokumen
Dokumen ini ngejelasin **kontrak FE** biar modul nokos (5sim) bisa langsung nyambung ke backend tanpa tebak-tebakan.
Targetnya: tim FE tinggal fokus di **styling + UX polish**, bukan debat endpoint/payload.

---

## 1) Baseline Backend (Source of Truth)
- Baseline commit BE: **`4f9845b`**
  - `feat(api): add 5sim backend integration with owned order tracking`
- Scope commit: client 5sim, service logic, handler, model/repo order lokal, routing user/admin, config+validasi, test service.

> Kalau FE ngoding di atas behavior BE yang lain dari commit ini, siap-siap mismatch.

---

## 2) Global API Contract (WAJIB FE PATUH)

### 2.1 Base URL
- Prefix API: **`/api/v1`**
- Untuk setup workspace sekarang, FE disarankan pakai: **`NEXT_PUBLIC_API_URL=/api/v1`** (proxy via Next rewrite).

### 2.2 Auth mechanism
- Protected endpoint baca token dari:
  1) cookie `access_token` (utama)
  2) fallback header `Authorization: Bearer <token>`
- FE wajib kirim credential cookie:
  - Axios/fetch: `withCredentials: true` / `credentials: 'include'`.

### 2.3 Standard response envelope
- Success (200):
```json
{ "success": true, "message": "OK", "data": {} }
```
- Created (201):
```json
{ "success": true, "message": "...", "data": {} }
```
- Success + pagination meta:
```json
{
  "success": true,
  "message": "OK",
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 100, "total_pages": 5 }
}
```
- Error:
```json
{ "success": false, "message": "...", "data": null }
```

### 2.4 HTTP status yang dipakai
- `200` success
- `201` created (buy endpoint)
- `400` validation/provider error
- `401` unauthorized
- `403` forbidden (admin route)

---

## 3) Endpoint Inventory — NOKOS / 5SIM

## 3.1 USER (login required + user aktif)

### Catalog
- `GET /5sim/catalog/countries`
- `GET /5sim/catalog/products?country=any&operator=any`
- `GET /5sim/catalog/prices?country=<str>&product=<str>`

> **Update hardening (anti supplier-price leak):**
> endpoint `catalog/prices` untuk user sekarang ngembaliin payload sanitasi (IDR wallet debit), bukan raw harga USD supplier.

### Orders
- `GET /5sim/orders?page=1&limit=20`
  - default: `page=1`, `limit=20`
  - limit max: `100`
- `POST /5sim/orders/activation`
- `POST /5sim/orders/hosting`
- `POST /5sim/orders/reuse`
- `GET /5sim/orders/:id` *(id = provider_order_id, int64)*
- `POST /5sim/orders/:id/finish`
- `POST /5sim/orders/:id/cancel`
- `POST /5sim/orders/:id/ban`
- `GET /5sim/orders/:id/sms-inbox`

## 3.2 ADMIN ONLY
- `GET /admin/5sim/profile`
- `GET /admin/5sim/orders?category=activation&limit=20&offset=0&order=id&reverse=true`

`reverse` dianggap true kecuali query `reverse=false`.

---

## 4) Payload Request Contract (FE Form Rules)

## 4.1 Buy Activation
`POST /5sim/orders/activation`
```json
{
  "country": "england",
  "operator": "any",
  "product": "telegram",
  "forwarding": true,
  "number": "",
  "reuse": false,
  "voice": false,
  "ref": "",
  "max_price": 0.35
}
```

Rules dari BE:
- `country` wajib
- `product` wajib
- `max_price` kalau dikirim harus `> 0`

## 4.2 Buy Hosting
`POST /5sim/orders/hosting`
```json
{
  "country": "england",
  "operator": "any",
  "product": "telegram"
}
```

Rules:
- `country` wajib
- `product` wajib

## 4.3 Reuse Number
`POST /5sim/orders/reuse`
```json
{
  "product": "telegram",
  "number": "+447000001111"
}
```

Rules:
- `product` wajib
- `number` wajib

## 4.4 Order Action by Provider ID
- Path param `:id` harus integer positif (`provider_order_id`), **bukan UUID lokal**.

---

## 5) Response Data Shape (Type FE)

## 5.0 Catalog prices (sanitized for user)
```ts
type FiveSimCatalogPrices = {
  country: string;
  product: string;
  currency: "IDR";
  prices: {
    operator: string;
    wallet_debit: number; // nominal debit wallet user
    number_count?: number; // stok opsional dari provider
  }[];
};
```

Catatan:
- Payload ini **tidak expose harga USD supplier**.
- FE user wajib pakai `wallet_debit` untuk display harga ke user.

## 5.1 Local order (`model.FiveSimOrder`)
```ts
type FiveSimOrder = {
  id: string; // UUID lokal
  user_id: string;
  provider_order_id: number;
  order_type: string; // activation | hosting | reuse
  phone: string;
  country: string;
  operator: string;
  product: string;
  provider_price: number; // disanitasi (user endpoint tidak expose harga supplier)
  provider_status: string;
  raw_payload?: string; // disanitasi (kosong di user endpoint)
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
};
```

## 5.2 Provider payload (`FiveSimOrderPayload`)
```ts
type FiveSimOrderPayload = {
  id: number;
  phone: string;
  operator: string;
  product: string;
  price: number; // disanitasi (0 di user endpoint)
  status: string;
  expires: string;
  sms: {
    id?: number;
    created_at?: string;
    date?: string;
    sender?: string;
    text?: string;
    code?: string;
    is_wave?: boolean;
    wave_uuid?: string;
  }[];
  created_at: string;
  forwarding: boolean;
  forwarding_number: string;
  country: string;
};
```

## 5.3 Buy/Action response wrapper
```ts
type FiveSimMutateResponse = {
  local_order: FiveSimOrder;
  provider_order: FiveSimOrderPayload;
};
```

---

## 6) Business Rules dari BE (Jangan Dirombak di FE)

1. **Ownership strict**
   - User cuma bisa akses order yang dia punya.
   - Kalau bukan punya user: message biasanya `order 5sim tidak ditemukan`.

2. **User must be active**
   - Akun diblokir => error `akun diblokir`.

3. **Order upsert by provider_order_id**
   - Key unik global di BE: `provider_order_id`.

4. **Wallet debit wajib saat buy order 5sim**
   - Endpoint buy (`activation/hosting/reuse`) akan debit wallet user setelah order provider berhasil dibuat.
   - Debit dicatat ke wallet ledger (`type=debit`, `category=5sim_purchase`, reference unik `fivesim_order:<provider_order_id>:charge`).
   - Kalau saldo kurang: buy dianggap gagal untuk user.

5. **Rollback provider saat wallet debit gagal**
   - Jika debit wallet gagal (mis. saldo kurang), backend akan coba `cancel` order ke provider secara otomatis.
   - Kalau rollback provider gagal, backend return error eskalasi (minta hubungi admin).

6. **Status sinkron dari provider**
   - FE jangan hardcode state machine sendiri yang ngelawan response provider.

7. **Error mapping BE sudah dinormalisasi**
   - Contoh message penting:
     - `autentikasi 5sim gagal, cek API key`
     - `resource 5sim tidak ditemukan`
     - `limit request 5sim tercapai, coba lagi sebentar`
     - `5sim sedang sibuk/offline, coba lagi`
     - `5sim sedang bermasalah, coba lagi`
     - `saldo wallet tidak cukup untuk beli nomor 5sim`

---

## 7) Screen/Module FE yang WAJIB Ada

## 7.1 Catalog Screen
- Countries list
- Products list (depends: country + operator)
- Prices list (depends: country + product)
- Loading/empty/error state per block (jangan satu layar ngeblank semua)

## 7.2 Buy Flow Screen
- Tab/segment: Activation / Hosting / Reuse
- Form rules harus align sama section #4
- Wajib ada konteks wallet:
  - tampilkan saldo wallet user sebelum submit (`GET /wallet/balance`)
  - setelah buy sukses, refresh saldo + ledger agar state FE sinkron
- Submit result tampilkan:
  - provider order id
  - nomor
  - status provider
  - harga provider

## 7.3 Order List Screen
- Pagination UI:
  - pakai `meta.page`, `meta.limit`, `meta.total`, `meta.total_pages`
- Table/card minimal field:
  - provider_order_id, order_type, product, phone, country, operator, provider_status, provider_price, last_synced_at

## 7.4 Order Detail + Actions
- Aksi tombol:
  - Check
  - Finish
  - Cancel
  - Ban
  - SMS Inbox
- Semua aksi by `provider_order_id`
- Setelah action sukses: refresh detail + list (optimistic optional, tapi final source tetap response BE)

## 7.5 SMS Inbox Viewer
- Render list SMS (`sender`, `text`, `code`, `date`)
- Empty state jelas kalau belum ada SMS

## 7.6 Admin Panel (jika role admin)
- Provider profile
- Provider order history dengan filter:
  - category, limit, offset, order, reverse

---

## 8) UX Behavior yang Harus Konsisten

1. **Action guard**
   - Disable tombol saat request ongoing (hindari double submit spam).

2. **Error surfacing**
   - Tampilkan `message` dari backend apa adanya untuk debugging operasional.
   - Optional: map ke copywriting ramah, tapi simpan raw message di detail/log panel.

3. **Retry strategy**
   - Untuk 429/503 message, tampilkan CTA retry + countdown ringan (opsional).

4. **Auth expiry**
   - Jika 401: redirect ke login, preserve intended path.

5. **No fake state**
   - Jangan pakai status internal FE yang beda dari `provider_status`.

---

## 9) Technical Criteria FE (Definition of Done)

FE dianggap **match 100%** kalau:

- [ ] Semua endpoint di section #3 bisa dipanggil tanpa payload mismatch.
- [ ] Semua payload form memenuhi rules section #4.
- [ ] Semua response di-parse sesuai shape section #5.
- [ ] Semua action pakai **provider_order_id**, bukan local UUID.
- [ ] Pagination list order pakai `meta` dari backend.
- [ ] Error handling preserve `message` backend.
- [ ] `withCredentials` aktif untuk auth cookie flow.
- [ ] Flow buy 5sim refresh saldo wallet setelah success.
- [ ] FE handle error saldo kurang (`saldo wallet tidak cukup untuk beli nomor 5sim`) dengan CTA topup.
- [ ] Admin route diproteksi role (UI guard + fallback handle 403).

---

## 10) Recommended FE Service Contract (TypeScript)
```ts
// relative base, biar aman via proxy/tunnel/domain
const API_BASE = '/api/v1';

// axios/fetch wajib include cookie
// axios: withCredentials: true
// fetch: credentials: 'include'
```

---

## 11) Catatan Implementasi Tim FE
- BE saat ini **sudah siap kontrak** untuk modul nokos.
- Kalau ada UX flow baru (mis. bulk action, auto-refresh interval, smart polling SMS), itu enhancement FE dan tidak wajib untuk parity kontrak.
- Jika mau tambah endpoint baru, jangan patch FE duluan: lock dulu kontrak di BE biar nggak jadi fitur Frankenstein.

---

## 12) TL;DR buat Tim FE
Kalau kalian implement seluruh checklist di dokumen ini, integrasi ke BE 5sim bakal lurus.
Sisanya tinggal seni: visual hierarchy, spacing, micro-interaction, accessibility, dan performa.
