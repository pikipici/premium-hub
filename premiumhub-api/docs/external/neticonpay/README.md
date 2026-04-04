# Neticon Pay Docs Snapshot

- Source: https://qris.neticonpay.my.id/docs/index.html
- Snapshot taken: 2026-04-04 UTC
- Saved file: `index.html`

## Ringkasan Endpoint

Base endpoint H2H:

- `POST https://qris.neticonpay.my.id/qris.php`

Actions:

1. `request_deposit`
   - request: `api_key`, `user_id`, `amount`
   - response: `result`, `trx_id`, `amount`
2. `check_status`
   - request: `api_key`, `user_id`, `trx_id`
   - response: `result`, `status`

## Catatan Keamanan Penting dari Vendor

- API key wajib backend-only.
- Saldo/order **tidak boleh auto-approve dari frontend**.
- Harus validasi via server-to-server check status.
- Gunakan IP whitelist dari dashboard vendor.

## Catatan Audit Internal

Contoh kode vendor menonaktifkan SSL verify (`CURLOPT_SSL_VERIFYPEER=false`).
Di backend ini SSL verification **tidak dimatikan** untuk koneksi HTTP client.
