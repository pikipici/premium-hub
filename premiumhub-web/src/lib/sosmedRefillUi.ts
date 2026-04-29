import type { SosmedOrder } from '@/types/sosmedOrder'

export type RefillTone = 'muted' | 'info' | 'success' | 'danger' | 'warning'

const TONE_COLORS: Record<RefillTone, string> = {
  muted: 'var(--muted)',
  info: '#2563eb',
  success: '#16a34a',
  danger: 'var(--red)',
  warning: '#d97706',
}

export interface AdminRefillStatusLabel {
  text: string
  tone: RefillTone
  color: string
}

export interface UserRefillMeta {
  label: string
  className: string
  canClaim: boolean
}

function normalize(value?: string) {
  return (value || '').trim().toLowerCase()
}

export function isJAPRefillCooldown(order: Pick<SosmedOrder, 'refill_provider_status'>) {
  return normalize(order.refill_provider_status) === 'cooldown'
}

export function formatProviderStatus(value?: string) {
  const normalized = value?.trim()
  if (!normalized) return '-'
  if (normalized.toLowerCase() === 'cooldown') return 'Cooldown'
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getAdminRefillStatusLabel(order: SosmedOrder): AdminRefillStatusLabel {
  if (isJAPRefillCooldown(order)) {
    return { text: 'Menunggu Cooldown JAP', tone: 'warning', color: TONE_COLORS.warning }
  }

  const status = normalize(order.refill_status) || 'none'
  switch (status) {
    case 'none':
      return { text: 'Belum Diklaim', tone: 'muted', color: TONE_COLORS.muted }
    case 'requested':
      return { text: 'Requested', tone: 'info', color: TONE_COLORS.info }
    case 'processing':
      return { text: 'Processing', tone: 'info', color: TONE_COLORS.info }
    case 'completed':
      return { text: 'Selesai', tone: 'success', color: TONE_COLORS.success }
    case 'failed':
      return { text: 'Gagal', tone: 'danger', color: TONE_COLORS.danger }
    case 'rejected':
      return { text: 'Ditolak', tone: 'danger', color: TONE_COLORS.danger }
    default:
      return { text: status, tone: 'muted', color: TONE_COLORS.muted }
  }
}

export function canAdminTriggerRefill(order: SosmedOrder) {
  if (!order.refill_eligible) return false
  if (order.order_status !== 'success') return false
  if (!order.provider_order_id || order.provider_code !== 'jap') return false

  const status = normalize(order.refill_status) || 'none'
  if (isJAPRefillCooldown(order) && !order.refill_provider_order_id) return true
  if (status === 'requested' || status === 'processing') return false
  return true
}

export function getUserRefillMeta(order: SosmedOrder): UserRefillMeta | null {
  if (!order.refill_eligible) return null

  const status = normalize(order.refill_status) || 'none'
  const deadlineStr = order.refill_deadline
  const isExpired = deadlineStr ? new Date(deadlineStr) < new Date() : false

  if (isJAPRefillCooldown(order)) {
    return { label: 'Refill Menunggu Antrian', className: 'bg-amber-50 text-amber-700 border-amber-200', canClaim: false }
  }
  if (status === 'requested' || status === 'processing') {
    return { label: 'Refill Diproses', className: 'bg-sky-50 text-sky-600 border-sky-200', canClaim: false }
  }
  if (status === 'completed') {
    return { label: 'Refill Selesai', className: 'bg-emerald-50 text-emerald-600 border-emerald-200', canClaim: false }
  }
  if (status === 'rejected') {
    return { label: 'Refill Ditolak', className: 'bg-red-50 text-red-600 border-red-200', canClaim: false }
  }
  if (isExpired) {
    return { label: 'Refill Expired', className: 'bg-gray-50 text-gray-500 border-gray-200', canClaim: false }
  }
  if (!deadlineStr) {
    return { label: 'Refill Perlu Dicek Admin', className: 'bg-amber-50 text-amber-600 border-amber-200', canClaim: false }
  }

  const canClaim = order.order_status === 'success' && !isExpired
  if (status === 'failed') {
    return { label: 'Refill Gagal', className: 'bg-red-50 text-red-600 border-red-200', canClaim }
  }
  return {
    label: `Refill ${order.refill_period_days || ''}${order.refill_period_days ? ' Hari' : ''}`,
    className: 'bg-violet-50 text-violet-600 border-violet-200',
    canClaim,
  }
}

export function getUserRefillTitle(order: SosmedOrder) {
  const status = normalize(order.refill_status) || 'none'
  if (isJAPRefillCooldown(order)) return 'Refill Sedang Diproses'
  if (status === 'requested' || status === 'processing') return 'Refill Sedang Diproses'
  if (status === 'completed') return 'Refill Sudah Selesai'
  if (status === 'failed') return 'Refill Belum Berhasil'
  if (status === 'rejected') return 'Refill Ditolak Sistem'
  return 'Garansi Refill Aktif'
}

export function formatRefillDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatRefillDeadline(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

export function getUserRefillDescription(order: SosmedOrder) {
  const status = normalize(order.refill_status) || 'none'
  if (isJAPRefillCooldown(order)) {
    return 'Refill lu sudah masuk antrian sistem. Kalau sistem lagi nunggu giliran refill, tombol klaim tetap dikunci biar nggak dobel request.'
  }
  if (status === 'requested' || status === 'processing') {
    return 'Permintaan refill udah masuk ke sistem. Tinggal tunggu prosesnya jalan.'
  }
  if (status === 'completed') {
    return order.refill_completed_at
      ? `Selesai diproses pada ${formatRefillDate(order.refill_completed_at)}.`
      : 'Refill udah selesai diproses.'
  }
  if (status === 'failed') {
    return 'Refill belum berhasil dikirim. Lu bisa coba klaim ulang kalau tombolnya masih aktif.'
  }
  if (status === 'rejected') {
    return 'Sistem menolak refill ini. Kalau perlu, hubungi admin buat dicek manual.'
  }
  if (!order.refill_deadline) {
    return 'Garansi refill perlu dicek admin dulu sebelum bisa diklaim.'
  }
  return `Bisa klaim sampai ${formatRefillDeadline(order.refill_deadline)}.`
}
