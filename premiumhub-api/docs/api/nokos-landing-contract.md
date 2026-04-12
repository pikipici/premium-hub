# Nokos Landing Summary API Contract

Tanggal update: 2026-04-12 (UTC)

Endpoint ini dipakai landing page `/product/nokos` untuk render metrik real data provider.

## Endpoint

`GET /api/v1/public/nokos/landing-summary`

`GET /api/v1/public/nokos/countries`

- **Public** (tanpa login)
- Read-only

## Response

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "source": "5sim",
    "countries_count": 102,
    "sent_total_all_time": 51420,
    "payment_methods": ["qris", "bri_va", "bni_va"],
    "last_synced_at": "2026-04-12T14:20:11Z",
    "is_stale": false,
    "last_sync_status": "ok"
  }
}
```

Contoh response countries:

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "source": "5sim",
    "countries_count": 153,
    "countries": [
      { "key": "ID", "name": "Indonesia", "iso": "ID", "dial_code": "+62" },
      { "key": "US", "name": "United States", "iso": "US", "dial_code": "+1" }
    ],
    "last_synced_at": "2026-04-12T14:20:11Z",
    "is_stale": false,
    "last_sync_status": "ok"
  }
}
```

## Semantik data

- `countries_count`
  - jumlah negara tersedia dari provider (`5sim guest countries`).
- `countries`
  - daftar negara real provider hasil snapshot (key, nama, ISO, dan dial code jika tersedia).
- `sent_total_all_time`
  - total all-time order provider (kategori `activation + hosting`) dengan rule:
  - **exclude** status `canceled/cancelled` dan `banned/ban`.
- `payment_methods`
  - metode pembayaran aktif yang lolos probe gateway saat sinkronisasi.
  - metode yang down tidak dikembalikan (di-hide dari UI).

## Sinkronisasi

- Worker periodik (default 10 menit) menyimpan snapshot ke DB.
- Endpoint boleh trigger on-demand sync jika snapshot stale.
- Jika sebagian sumber gagal, snapshot tetap dipublish dengan `last_sync_status = degraded`.

## Config env terkait

- `NOKOS_LANDING_WORKER_ENABLED`
- `NOKOS_LANDING_WORKER_INTERVAL`
- `NOKOS_LANDING_SYNC_TIMEOUT`
- `NOKOS_LANDING_STALE_AFTER`
- `NOKOS_LANDING_METHOD_CANDIDATES`
- `NOKOS_LANDING_METHOD_PROBE_AMOUNT`
