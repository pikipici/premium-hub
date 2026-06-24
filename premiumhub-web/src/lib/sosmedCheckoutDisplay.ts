import { buildSosmedServiceCards } from './sosmedProductCards'
import type { SosmedService } from '@/types/sosmedService'

export interface SosmedCheckoutServiceDisplay {
  productTitle: string
  quantityLabel: string
  startTime: string
  eta: string
  refill: string
  minOrderLabel: string
  categoryLabel: string
}

function clean(value: string | null | undefined) {
  return (value || '').trim()
}

function formatPackageQuantity(packageQuantity: number) {
  const normalizedQuantity = Math.max(1, Math.trunc(Number.isFinite(packageQuantity) ? packageQuantity : 1))
  const estimatedUnits = normalizedQuantity * 1000
  return `${normalizedQuantity.toLocaleString('id-ID')} paket (${estimatedUnits.toLocaleString('id-ID')} unit)`
}

function formatMinOrder(minOrder: string | null | undefined): string {
  const raw = clean(minOrder)
  if (!raw) return '-'
  // raw bisa berupa '100', '1.000', etc — normalize ke angka
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

  return {
    productTitle,
    quantityLabel: formatPackageQuantity(packageQuantity),
    startTime: clean(service.start_time) || '-',
    eta: clean(service.eta) || '-',
    refill: formatRefill(service.refill),
    minOrderLabel: formatMinOrder(service.min_order),
    categoryLabel: CATEGORY_LABELS[catCode] || (catCode ? catCode.charAt(0).toUpperCase() + catCode.slice(1) : '-'),
  }
}
