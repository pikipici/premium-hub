# Backend Audit — Wallet Topup + Neticon H2H

Tanggal: 2026-04-04 (UTC)
Scope: Go backend `premiumhub-api` untuk integrasi payment gateway QRIS Neticon ke wallet topup.

## Temuan Awal (sebelum patch)

1. **CRITICAL** — Tidak ada wallet ledger atomik
   - Dampak: risiko double-credit saat callback/polling dipanggil berulang.
2. **HIGH** — Tidak ada idempotency request topup
   - Dampak: duplicate invoice dari retry frontend/network.
3. **HIGH** — Payment flow lama masih mock/dev-centric (`snap_token` palsu, simulate endpoint)
   - Dampak: tidak siap produksi untuk topup wallet.
4. **HIGH** — Tidak ada jalur rekonsiliasi pending transaksi
   - Dampak: transaksi pending bisa nyangkut tanpa closure.
5. **HIGH** — Tidak ada pemisahan status provider vs status internal settlement
   - Dampak: audit trail sulit dan rawan mismatch.

## Patch Yang Diterapkan

- Menambahkan domain wallet:
  - `wallet_balance` di user.
  - `wallet_topups` (status lifecycle + provider trx + idempotency key).
  - `wallet_ledgers` (append-only ledger credit/debit dengan `reference` unik).
- Menambahkan Neticon H2H client server-to-server (`request_deposit`, `check_status`) tanpa bypass TLS verification.
- Menambahkan wallet service dengan:
  - pembuatan invoice topup,
  - polling status,
  - settlement idempotent berbasis transaction + row lock,
  - pending reconcile batch untuk admin.
- Menambahkan endpoint API:
  - `GET /api/v1/wallet/balance`
  - `GET /api/v1/wallet/ledger`
  - `POST /api/v1/wallet/topups`
  - `GET /api/v1/wallet/topups`
  - `GET /api/v1/wallet/topups/:id`
  - `POST /api/v1/wallet/topups/:id/check`
  - `POST /api/v1/admin/wallet/topups/reconcile`
- Menyimpan snapshot dokumentasi vendor ke repo:
  - `docs/vendor/neticonpay/index.html`

## Status Risk Setelah Patch

- CRITICAL: **0 open**
- HIGH: **0 open**
- MEDIUM/LOW: tersisa pada area operasional (rate limiting global, observability external, alerting SLO) dan bisa ditangani phase berikutnya.

## Catatan Operasional Go-Live

1. Isi env production:
   - `NETICON_API_KEY`
   - `NETICON_USER_ID`
   - `NETICON_BASE_URL`
2. Aktifkan IP whitelist di dashboard Neticon.
3. Wajib run reconcile terjadwal (cron internal/ops job).
4. Nonaktifkan endpoint simulasi payment lama untuk production path.
5. Tambahkan dashboard monitoring untuk pending topup age + failure ratio.
