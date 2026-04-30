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

export interface UserRefillButtonState {
  label: string
  disabled: boolean
  className: string
}

export interface UserRefillPanelLayout {
  hasCopy: boolean
  panelClassName: string
  contentClassName: string
}

const USER_REFILL_BUTTON_BASE_CLASS =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black shadow-sm transition disabled:cursor-not-allowed'
const USER_REFILL_BUTTON_ENABLED_CLASS = `${USER_REFILL_BUTTON_BASE_CLASS} bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60`
const USER_REFILL_BUTTON_DISABLED_CLASS = `${USER_REFILL_BUTTON_BASE_CLASS} border border-gray-200 bg-gray-200 text-gray-500 shadow-none`

function normalize(value?: string) {
  return (value || '').trim().toLowerCase()
}

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const JAP_REFILL_INITIAL_AVAILABILITY_MS = 72 * HOUR_MS

function parseCooldownDurationMs(message?: string) {
  const text = normalize(message)
  if (!text) return null

  let total = 0
  const durationPattern = /(\d+)\s*(days?|hari|d|hours?|hrs?|jam|h|minutes?|mins?|menit|m)\b/g
  let match: RegExpExecArray | null
  while ((match = durationPattern.exec(text)) !== null) {
    const value = Number.parseInt(match[1], 10)
    if (!Number.isFinite(value) || value <= 0) continue
    const unit = match[2]
    if (unit === 'day' || unit === 'days' || unit === 'hari' || unit === 'd') total += value * DAY_MS
    if (unit === 'hour' || unit === 'hours' || unit === 'hr' || unit === 'hrs' || unit === 'jam' || unit === 'h') {
      total += value * HOUR_MS
    }
    if (unit === 'minute' || unit === 'minutes' || unit === 'min' || unit === 'mins' || unit === 'menit' || unit === 'm') {
      total += value * MINUTE_MS
    }
  }

  return total > 0 ? total : null
}

function parseProviderStartTimeDurationMs(order: Pick<SosmedOrder, 'service'>) {
  const service = order.service
  const candidates = [
    service?.start_time,
    service?.provider_title?.match(/\[\s*start\s*time\s*:\s*([^\]]+)\]/i)?.[1],
  ]

  for (const candidate of candidates) {
    const durationMs = parseCooldownDurationMs(candidate)
    if (durationMs) return durationMs
  }

  return 0
}

function formatRemainingDuration(ms: number) {
  const roundedMinutes = Math.max(1, Math.ceil(ms / MINUTE_MS))
  const days = Math.floor(roundedMinutes / (24 * 60))
  const hours = Math.floor((roundedMinutes % (24 * 60)) / 60)
  const minutes = roundedMinutes % 60
  const parts: string[] = []

  if (days > 0) parts.push(`${days} hari`)
  if (hours > 0) parts.push(`${hours} jam`)
  if (minutes > 0) parts.push(`${minutes} menit`)

  return parts.length > 0 ? parts.join(' ') : 'sebentar lagi'
}

function getRemainingTextFromStartAndDuration(startValue: string | undefined, durationMs: number, now: Date) {
  const startedAt = startValue ? new Date(startValue) : null
  if (!startedAt || Number.isNaN(startedAt.getTime())) return formatRemainingDuration(durationMs)

  const availableAt = startedAt.getTime() + durationMs
  const remainingMs = availableAt - now.getTime()
  if (remainingMs <= 0) return 'sebentar lagi'
  return formatRemainingDuration(remainingMs)
}

function getPositiveRemainingTextFromStartAndDuration(startValue: string | undefined, durationMs: number, now: Date) {
  const startedAt = startValue ? new Date(startValue) : null
  if (!startedAt || Number.isNaN(startedAt.getTime())) return formatRemainingDuration(durationMs)

  const availableAt = startedAt.getTime() + durationMs
  const remainingMs = availableAt - now.getTime()
  if (remainingMs <= 0) return null
  return formatRemainingDuration(remainingMs)
}

export function getJAPRefillCooldownRemainingText(
  order: Pick<SosmedOrder, 'refill_provider_status' | 'refill_provider_error' | 'refill_requested_at'>,
  now: Date = new Date()
) {
  if (!isJAPRefillCooldown(order)) return null

  const durationMs = parseCooldownDurationMs(order.refill_provider_error)
  if (!durationMs) return null

  return getRemainingTextFromStartAndDuration(order.refill_requested_at, durationMs, now)
}

function getSubmittedJAPRefillAvailabilityRemainingText(
  order: Pick<SosmedOrder, 'created_at' | 'refill_provider_error' | 'refill_requested_at' | 'service'>,
  now: Date = new Date()
) {
  const providerDurationMs = parseCooldownDurationMs(order.refill_provider_error)
  if (providerDurationMs) {
    return getPositiveRemainingTextFromStartAndDuration(order.refill_requested_at, providerDurationMs, now)
  }

  const providerStartTimeMs = parseProviderStartTimeDurationMs(order)
  return getPositiveRemainingTextFromStartAndDuration(
    order.created_at,
    providerStartTimeMs + JAP_REFILL_INITIAL_AVAILABILITY_MS,
    now
  )
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

function isSubmittedJAPRefill(order: Pick<SosmedOrder, 'provider_code' | 'refill_provider_status' | 'refill_provider_order_id'>) {
  const providerStatus = normalize(order.refill_provider_status)
  return normalize(order.provider_code) === 'jap' && providerStatus === 'submitted' && normalize(order.refill_provider_order_id) !== ''
}

export function getUserRefillMeta(order: SosmedOrder): UserRefillMeta | null {
  if (!order.refill_eligible) return null

  const status = normalize(order.refill_status) || 'none'
  const deadlineStr = order.refill_deadline
  const isExpired = deadlineStr ? new Date(deadlineStr) < new Date() : false

  if (isJAPRefillCooldown(order)) {
    return { label: 'Refill Menunggu Antrian', className: 'bg-amber-50 text-amber-700 border-amber-200', canClaim: false }
  }
  if (isSubmittedJAPRefill(order)) {
    return { label: 'Refill Sedang Diproses', className: 'bg-indigo-50 text-indigo-700 border-indigo-200', canClaim: false }
  }
  if (status === 'requested' || status === 'processing') {
    return { label: 'Refill Diproses', className: 'bg-sky-50 text-sky-600 border-sky-200', canClaim: false }
  }
  if (status === 'completed') {
    return { label: 'Refill Selesai', className: 'bg-emerald-50 text-emerald-600 border-emerald-200', canClaim: false }
  }
  if (isExpired) {
    return { label: 'Refill Expired', className: 'bg-gray-50 text-gray-500 border-gray-200', canClaim: false }
  }
  if (!deadlineStr) {
    return { label: 'Refill Perlu Dicek Admin', className: 'bg-amber-50 text-amber-600 border-amber-200', canClaim: false }
  }

  const canClaim = order.order_status === 'success' && !isExpired
  if (status === 'rejected') {
    return { label: 'Refill Siap Diklaim Lagi', className: 'bg-violet-50 text-violet-600 border-violet-200', canClaim }
  }
  if (status === 'failed') {
    return { label: 'Refill Gagal', className: 'bg-red-50 text-red-600 border-red-200', canClaim }
  }
  return {
    label: `Refill ${order.refill_period_days || ''}${order.refill_period_days ? ' Hari' : ''}`,
    className: 'bg-violet-50 text-violet-600 border-violet-200',
    canClaim,
  }
}

export function getUserRefillButtonState(refill: UserRefillMeta | null, loading = false): UserRefillButtonState | null {
  if (!refill) return null
  const disabled = loading || !refill.canClaim
  return {
    label: 'Klaim Refill',
    disabled,
    className: refill.canClaim ? USER_REFILL_BUTTON_ENABLED_CLASS : USER_REFILL_BUTTON_DISABLED_CLASS,
  }
}

export function getUserRefillPanelLayout(title?: string, description?: string): UserRefillPanelLayout {
  const hasCopy = Boolean(title?.trim() || description?.trim())
  return {
    hasCopy,
    panelClassName: hasCopy ? 'px-3.5 py-3' : 'px-3.5 py-2',
    contentClassName: hasCopy
      ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
      : 'flex items-center justify-end',
  }
}

export function getUserRefillTitle(order: SosmedOrder) {
  const status = normalize(order.refill_status) || 'none'
  if (isJAPRefillCooldown(order)) return 'Refill Sedang Diproses'
  if (isSubmittedJAPRefill(order)) return 'Refill Sedang Diproses'
  if (status === 'requested' || status === 'processing') return 'Refill Sedang Diproses'
  if (status === 'completed') return 'Refill Sudah Selesai'
  if (status === 'failed') return 'Refill Belum Berhasil'
  if (status === 'rejected') return ''
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

export function getUserRefillDescription(order: SosmedOrder, now: Date = new Date()) {
  const status = normalize(order.refill_status) || 'none'
  if (isJAPRefillCooldown(order)) {
    const remaining = getJAPRefillCooldownRemainingText(order, now)
    if (remaining) {
      return `Refill lu sedang nunggu jadwal sistem. Estimasi bisa diproses lagi sekitar ${remaining}. Tombol klaim tetap dikunci biar nggak dobel request.`
    }
    return 'Refill lu sudah masuk antrian sistem. Kalau sistem lagi nunggu giliran refill, tombol klaim tetap dikunci biar nggak dobel request.'
  }
  if (isSubmittedJAPRefill(order)) {
    const nextRefillRemaining = getSubmittedJAPRefillAvailabilityRemainingText(order, now)
    if (nextRefillRemaining) {
      return `Refill lagi diproses sistem. Next refill bisa diklaim lagi sekitar ${nextRefillRemaining}. Tombol klaim tetap dikunci dulu biar nggak dobel request.`
    }
    return 'Refill lagi diproses sistem. Next refill lagi dicek jadwalnya sama sistem. Tombol klaim tetap dikunci dulu biar nggak dobel request.'
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
    return ''
  }
  if (!order.refill_deadline) {
    return 'Garansi refill perlu dicek admin dulu sebelum bisa diklaim.'
  }
  return `Bisa klaim sampai ${formatRefillDeadline(order.refill_deadline)}.`
}
