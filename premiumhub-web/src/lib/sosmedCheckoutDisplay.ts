import { buildSosmedServiceCards } from './sosmedProductCards'
import type { SosmedService } from '@/types/sosmedService'

export interface SosmedCheckoutServiceDisplay {
  productTitle: string
  quantityLabel: string
  quantityUnitLabel: string  // e.g. 'K' untuk standard, '' untuk custom
  stepperLabel: string       // e.g. 'Jumlah Paket 1K', 'Jumlah Komentar'
  helperText: string         // helper di bawah stepper
  unitLabel: string          // e.g. 'Followers', 'Views', 'Komentar'
  isCustomUnit: boolean      // true kalau bukan model 1 paket = 1K
  startTime: string
  eta: string
  refill: string
  minOrderLabel: string
  categoryLabel: string
}

function clean(value: string | null | undefined) {
  return (value || '').trim()
}

const UNIT_LABELS: Record<string, string> = {
  followers: 'Followers',
  likes: 'Likes',
  views: 'Views',
  komentar: 'Komentar',
  share: 'Share',
  saves: 'Simpan',
  subscribers: 'Subscribers',
}

// Unit yang tidak pakai model 1 paket = 1K
const CUSTOM_UNITS = new Set(['komentar'])

function detectUnit(service: SosmedService): string {
  const haystack = `${service.category_code || ''} ${service.title || ''} ${service.platform_label || ''}`.toLowerCase()
  if (haystack.includes('comment like')) return 'likes'
  if (haystack.includes('like')) return 'likes'
  if (haystack.includes('view')) return 'views'
  if (haystack.includes('comment') || haystack.includes('komentar')) return 'komentar'
  if (haystack.includes('share') || haystack.includes('save')) return 'share'
  if (haystack.includes('subscriber')) return 'subscribers'
  return 'followers'
}

function formatPackageQuantity(packageQuantity: number, unitLabel: string, isCustomUnit: boolean): string {
  const normalizedQuantity = Math.max(1, Math.trunc(Number.isFinite(packageQuantity) ? packageQuantity : 1))
  if (isCustomUnit) {
    return `${normalizedQuantity.toLocaleString('id-ID')} ${unitLabel}`
  }
  const estimatedUnits = normalizedQuantity * 1000
  return `${normalizedQuantity.toLocaleString('id-ID')} paket (${estimatedUnits.toLocaleString('id-ID')} ${unitLabel})`
}

function formatMinOrder(minOrder: string | null | undefined): string {
  const raw = clean(minOrder)
  if (!raw) return '-'
  const num = parseInt(raw.replace(/[.,]/g, ''), 10)
  if (!Number.isFinite(num) || num <= 0) return raw
  return `${num.toLocaleString('id-ID')} unit`
}

const CATEGORY_LABELS: Record<string, string> = {
  followers: 'Followers',
  likes: 'Likes',
  views: 'Views',
  comments: 'Komentar',
  shares: 'Share',
  saves: 'Simpan',
  subscribers: 'Subscribers',
}

function formatRefill(refill: string | null | undefined): string {
  const raw = clean(refill)
  if (!raw) return 'Tidak ada'
  const lower = raw.toLowerCase()
  if (lower.includes('tanpa') || lower === 'n/a' || lower === 'na' || lower.includes('no refill') || lower.includes('tidak ada')) {
    return 'Tidak ada'
  }
  return raw
}

export function buildSosmedCheckoutServiceDisplay(
  service: SosmedService,
  packageQuantity: number
): SosmedCheckoutServiceDisplay {
  const [catalogCard] = buildSosmedServiceCards([service])
  const productTitle = clean(catalogCard?.buyerTitle) || `Paket ${clean(service.platform_label) || 'Sosmed'}`
  const catCode = clean(service.category_code).toLowerCase()
  const unit = detectUnit(service)
  const unitLabel = UNIT_LABELS[unit] || (unit ? unit.charAt(0).toUpperCase() + unit.slice(1) : 'Unit')
  const isCustomUnit = CUSTOM_UNITS.has(unit)

  const stepperLabel = isCustomUnit ? `Jumlah ${unitLabel}` : 'Jumlah Paket 1K'
  const quantityUnitLabel = isCustomUnit ? '' : 'K'
  const helperText = isCustomUnit
    ? `Masukkan jumlah ${unitLabel.toLowerCase()} yang diinginkan. Min. ${formatMinOrder(service.min_order)}.`
    : `1 paket = 1.000 ${unitLabel}. Contoh: 5 paket = sekitar 5.000 ${unitLabel}.`

  return {
    productTitle,
    quantityLabel: formatPackageQuantity(packageQuantity, unitLabel, isCustomUnit),
    quantityUnitLabel,
    stepperLabel,
    helperText,
    unitLabel,
    isCustomUnit,
    startTime: clean(service.start_time) || '-',
    eta: clean(service.eta) || '-',
    refill: formatRefill(service.refill),
    minOrderLabel: formatMinOrder(service.min_order),
    categoryLabel: CATEGORY_LABELS[catCode] || (catCode ? catCode.charAt(0).toUpperCase() + catCode.slice(1) : '-'),
  }
}
