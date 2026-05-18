/**
 * Centralized loading copy untuk konsistensi tone di seluruh dashboard + checkout flows.
 *
 * Tone: relaxed, casual Indonesian. Hindari kata "Sedang", "Mohon tunggu", "Loading...".
 * Hindari "Please wait" / "Loading..." formal.
 *
 * Reuse pattern: `import { LOADING_COPY } from '@/lib/copy/loading'`
 * lalu gunakan `LOADING_COPY.list` etc supaya kalau ke depan ada style tweak,
 * cukup edit file ini.
 */

export const LOADING_COPY = {
  /** Default — generic loading untuk fallback / detail page yang tidak spesifik. */
  generic: 'Memuat data...',

  /** Loading list/feed (riwayat, order, mutasi, notifikasi). */
  list: 'Memuat daftar...',

  /** Loading detail entity tunggal (order, topup, akun aktif, request). */
  detail: 'Memuat detail...',

  /** Loading shell dashboard utama (layout-level fallback). */
  dashboard: 'Lagi siapin dashboard...',

  /** Loading saldo wallet — preserve angka placeholder context. */
  walletBalance: 'Memuat saldo...',

  /** Loading riwayat topup spesifik. */
  topup: 'Memuat data topup...',

  /** Loading riwayat order/transaksi. */
  orders: 'Memuat order...',

  /** Loading riwayat aktivitas gabungan. */
  history: 'Memuat riwayat...',

  /** Refreshing — sudah ada data, tinggal sinkron ulang. */
  refreshing: 'Sinkron data...',
} as const

export type LoadingCopyKey = keyof typeof LOADING_COPY
