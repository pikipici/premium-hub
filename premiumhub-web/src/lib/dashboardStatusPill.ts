/**
 * Dashboard Status Pill Helper
 *
 * Centralized 5-tone hue-distinct status pill system for Premium Hub dashboard.
 * Use across all dashboard routes (sosmed/orders, convert/orders, wallet/topup,
 * klaim-garansi, notifikasi, riwayat-order, akun-aktif) so a "success" tone
 * never reads as amber on one page and emerald on another.
 *
 * Tones (cross-spectrum, beats brand consistency for status semantics):
 * - success  -> emerald (green)  : task completed, paid, sukses
 * - fail     -> rose    (red)    : error, gagal, ditolak
 * - process  -> amber   (yellow) : in-progress, processing, menunggu bayar
 * - neutral  -> stone   (gray)   : expired, canceled, dibatalkan, kedaluwarsa
 * - info     -> sky     (blue)   : approved, waiting review, informasi
 *
 * Reference:
 * - WCAG SC 1.4.1 (Use of Color) — supplemented with text label, not color alone.
 * - NN Group Recognition over Recall — consistent tone meaning across routes.
 */

export type StatusTone = 'success' | 'fail' | 'process' | 'neutral' | 'info'

export interface StatusToneClasses {
  /** background + text + border, ready for `<span className=...>` */
  pill: string
  /** small dot indicator class (`bg-emerald-500` etc.) */
  dot: string
  /** subtle bg for cards/panels (`bg-emerald-50` equivalent via custom hex) */
  surface: string
}

const TONE_CLASSES: Record<StatusTone, StatusToneClasses> = {
  success: {
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    surface: 'bg-emerald-50/60 border-emerald-100',
  },
  fail: {
    pill: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    surface: 'bg-rose-50/60 border-rose-100',
  },
  process: {
    pill: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-400',
    surface: 'bg-amber-50/60 border-amber-100',
  },
  neutral: {
    pill: 'bg-stone-100 text-stone-700 border-stone-200',
    dot: 'bg-stone-400',
    surface: 'bg-stone-50 border-stone-200',
  },
  info: {
    pill: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
    surface: 'bg-sky-50/60 border-sky-100',
  },
}

/**
 * Get className strings for a given tone.
 * Use the returned object's `.pill` for `<span>` status badges,
 * `.dot` for status indicator dots, `.surface` for card backgrounds.
 */
export function statusToneClasses(tone: StatusTone): StatusToneClasses {
  return TONE_CLASSES[tone]
}

/**
 * Status mapping helpers — each domain maps its enum to a StatusTone +
 * Indonesian label. Add new mappers here as routes adopt the helper.
 */

// Sosmed order status
export type SosmedOrderStatus =
  | 'success'
  | 'processing'
  | 'failed'
  | 'canceled'
  | 'expired'
  | 'pending'
  | 'waiting_payment'
  | string

export function sosmedOrderTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'success') return { tone: 'success', label: 'Sukses' }
  if (s === 'processing') return { tone: 'info', label: 'Diproses' }
  if (s === 'pending_verification') return { tone: 'process', label: 'Menunggu Konfirmasi' }
  if (s === 'failed') return { tone: 'fail', label: 'Gagal' }
  if (s === 'canceled' || s === 'cancelled') return { tone: 'neutral', label: 'Dibatalkan' }
  if (s === 'expired') return { tone: 'neutral', label: 'Expired' }
  if (s === 'pending' || s === 'waiting_payment') return { tone: 'process', label: 'Menunggu Bayar' }
  return { tone: 'neutral', label: status || 'Unknown' }
}

// Convert order status (8 enum)
export type ConvertOrderStatus =
  | 'pending_transfer'
  | 'waiting_review'
  | 'approved'
  | 'processing'
  | 'success'
  | 'failed'
  | 'expired'
  | 'canceled'
  | string

export function convertOrderTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'pending_transfer') return { tone: 'process', label: 'Menunggu Transfer' }
  if (s === 'waiting_review') return { tone: 'process', label: 'Menunggu Review' }
  if (s === 'approved') return { tone: 'info', label: 'Approved' }
  if (s === 'processing') return { tone: 'info', label: 'Diproses' }
  if (s === 'success') return { tone: 'success', label: 'Sukses' }
  if (s === 'failed') return { tone: 'fail', label: 'Gagal' }
  if (s === 'expired') return { tone: 'neutral', label: 'Expired' }
  if (s === 'canceled' || s === 'cancelled') return { tone: 'neutral', label: 'Dibatalkan' }
  return { tone: 'neutral', label: status || 'Unknown' }
}

// Wallet topup status
export type WalletTopupStatus = 'success' | 'paid' | 'failed' | 'expired' | 'pending' | string

export function walletTopupTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'success' || s === 'paid') return { tone: 'success', label: 'Berhasil' }
  if (s === 'failed') return { tone: 'fail', label: 'Gagal' }
  if (s === 'expired') return { tone: 'neutral', label: 'Kedaluwarsa' }
  if (s === 'pending') return { tone: 'process', label: 'Menunggu Pembayaran' }
  return { tone: 'neutral', label: status || 'Unknown' }
}

// Wallet ledger group (used in transaction visual)
export type WalletLedgerGroup = 'topup' | 'purchase' | 'refund' | 'other'

export function walletLedgerTone(group: WalletLedgerGroup): { tone: StatusTone; label: string } {
  if (group === 'topup') return { tone: 'success', label: 'Top Up' }
  if (group === 'purchase') return { tone: 'process', label: 'Pembelian' }
  if (group === 'refund') return { tone: 'info', label: 'Refund' }
  return { tone: 'neutral', label: 'Lainnya' }
}

// Claim status
export type ClaimStatus = 'approved' | 'rejected' | 'pending' | string

export function claimTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'approved') return { tone: 'success', label: 'Disetujui' }
  if (s === 'rejected') return { tone: 'fail', label: 'Ditolak' }
  if (s === 'pending') return { tone: 'process', label: 'Pending' }
  return { tone: 'neutral', label: status || 'Unknown' }
}

// Wallet withdrawal status (7 enum). Mirror of WithdrawalStatus*
// constants di backend (premiumhub-api/internal/model/wallet_withdrawal.go).
export type WalletWithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'processing'
  | 'paid'
  | 'failed'
  | string

export function walletWithdrawalTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'pending') return { tone: 'process', label: 'Menunggu Review' }
  if (s === 'approved') return { tone: 'info', label: 'Disetujui' }
  if (s === 'processing') return { tone: 'info', label: 'Diproses' }
  if (s === 'paid') return { tone: 'success', label: 'Cair' }
  if (s === 'rejected') return { tone: 'fail', label: 'Ditolak' }
  if (s === 'failed') return { tone: 'fail', label: 'Gagal' }
  if (s === 'cancelled' || s === 'canceled') return { tone: 'neutral', label: 'Dibatalkan' }
  return { tone: 'neutral', label: status || 'Unknown' }
}

// Generic order status (catch-all for activity, akun-aktif, riwayat-order)
export function genericOrderTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'success' || s === 'completed' || s === 'paid') return { tone: 'success', label: 'Sukses' }
  if (s === 'failed' || s === 'rejected') return { tone: 'fail', label: 'Gagal' }
  if (s === 'processing' || s === 'in_progress') return { tone: 'info', label: 'Diproses' }
  if (s === 'pending' || s === 'waiting_payment' || s === 'pending_transfer')
    return { tone: 'process', label: 'Pending' }
  if (s === 'expired' || s === 'canceled' || s === 'cancelled')
    return { tone: 'neutral', label: s === 'expired' ? 'Expired' : 'Dibatalkan' }
  return { tone: 'neutral', label: status || 'Unknown' }
}

// Gmail marketplace — sell-side slot lifecycle.
export function gmailSlotTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'pending_create') return { tone: 'process', label: 'Buat Akun' }
  if (s === 'pending_verify') return { tone: 'info', label: 'Menunggu Admin' }
  if (s === 'verified') return { tone: 'success', label: 'Diterima' }
  if (s === 'rejected') return { tone: 'fail', label: 'Ditolak' }
  if (s === 'expired') return { tone: 'neutral', label: 'Expired' }
  if (s === 'sold') return { tone: 'info', label: 'Terjual' }
  if (s === 'disposed') return { tone: 'neutral', label: 'Diganti/Refund' }
  return { tone: 'neutral', label: status || 'Unknown' }
}

// Gmail marketplace — buy-side order + warranty claim.
export function gmailOrderTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'completed') return { tone: 'success', label: 'Sukses' }
  if (s === 'refunded') return { tone: 'info', label: 'Direfund' }
  return { tone: 'neutral', label: status || 'Unknown' }
}

export function gmailClaimTone(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'replaced') return { tone: 'success', label: 'Diganti' }
  if (s === 'refunded') return { tone: 'info', label: 'Direfund' }
  if (s === 'rejected') return { tone: 'fail', label: 'Ditolak' }
  return { tone: 'neutral', label: status || 'Unknown' }
}
