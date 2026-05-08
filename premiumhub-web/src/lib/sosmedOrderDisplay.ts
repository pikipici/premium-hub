import { buildSosmedServiceCards } from './sosmedProductCards'
import type { SosmedOrder } from '@/types/sosmedOrder'
import type { SosmedService } from '@/types/sosmedService'

export interface UserSosmedOrderCancelAction {
  kind: 'local' | 'provider'
  label: string
  confirmMessage: string
}

export interface UserSosmedOrderCancelStatus {
  label?: string
  className: string
}

export interface UserSosmedOrderDisplay {
  productTitle: string
  quantityLabel: string
  startCountLabel?: string
  cancelAction?: UserSosmedOrderCancelAction
  cancelStatus?: UserSosmedOrderCancelStatus
}

function clean(value: string | null | undefined) {
  return (value || '').trim()
}

function inferPlatformLabel(...values: Array<string | null | undefined>) {
  const haystack = values.map((value) => clean(value)).filter(Boolean).join(' ').toLowerCase()

  if (haystack.includes('instagram')) return 'Instagram'
  if (haystack.includes('tiktok') || haystack.includes('tik tok')) return 'TikTok'
  if (haystack.includes('youtube') || haystack.includes('subscriber') || haystack.includes('subscribers')) return 'YouTube'
  if (haystack.includes('twitter') || haystack.includes('tweet') || /(^|\s)x(\s|$)/i.test(haystack)) return 'Twitter/X'
  if (haystack.includes('facebook') || /(^|\s)fb(\s|$)/i.test(haystack)) return 'Facebook'
  if (haystack.includes('telegram')) return 'Telegram'
  if (haystack.includes('shopee')) return 'Shopee'
  if (haystack.includes('spotify')) return 'Spotify'
  if (haystack.includes('website') || haystack.includes('traffic')) return 'Website'

  return 'Sosmed'
}

function inferCategoryCode(...values: Array<string | null | undefined>) {
  const haystack = values.map((value) => clean(value)).filter(Boolean).join(' ').toLowerCase()

  if (haystack.includes('like')) return 'likes'
  if (haystack.includes('view')) return 'views'
  if (haystack.includes('comment') || haystack.includes('komentar')) return 'comments'
  if (haystack.includes('share')) return 'share'
  return 'followers'
}

function unitFromServiceLike(service: Pick<SosmedService, 'category_code' | 'title' | 'platform_label'>) {
  const haystack = `${service.category_code || ''} ${service.title || ''} ${service.platform_label || ''}`.toLowerCase()
  if (haystack.includes('like')) return 'likes'
  if (haystack.includes('view')) return 'views'
  if (haystack.includes('comment') || haystack.includes('komentar')) return 'komentar'
  if (haystack.includes('share')) return 'share'
  return 'followers'
}

function serviceForOrderDisplay(order: SosmedOrder): SosmedService {
  const service = order.service
  const snapshotTitle = clean(order.service_title) || 'Layanan Sosmed'
  const title = clean(service?.title) || snapshotTitle
  const categoryCode = clean(service?.category_code) || inferCategoryCode(title, snapshotTitle, order.service_code)
  const platformLabel = clean(service?.platform_label) || inferPlatformLabel(title, snapshotTitle, order.service_code)

  return {
    ...(service || {}),
    id: clean(service?.id) || clean(order.service_id) || order.id,
    category_code: categoryCode,
    code: clean(service?.code) || clean(order.service_code) || clean(order.service_id) || order.id,
    title,
    platform_label: platformLabel,
    checkout_price: service?.checkout_price ?? order.unit_price,
    is_active: service?.is_active ?? true,
  }
}

function formatPackageCount(quantity: number) {
  const packageCount = Math.max(1, Math.trunc(Number.isFinite(quantity) ? quantity : 1))
  return `${packageCount.toLocaleString('id-ID')} paket`
}

function formatQuantityLabel(quantity: number, unit: string) {
  const packageCount = Math.max(1, Math.trunc(Number.isFinite(quantity) ? quantity : 1))
  const packageText = formatPackageCount(packageCount)

  if (unit === 'komentar') {
    return `Jumlah: ${packageText} komentar`
  }

  const approximateUnits = packageCount * 1000
  return `Jumlah: ±${approximateUnits.toLocaleString('id-ID')} ${unit} (${packageText})`
}

function formatStartCountLabel(value: number | null | undefined) {
  const count = Math.trunc(Number(value))
  if (!Number.isFinite(count) || count <= 0) return undefined
  return `Start count: ${count.toLocaleString('id-ID')}`
}

function shortDisplayOrderID(id: string) {
  return id ? `#${id.slice(0, 8).toUpperCase()}` : 'order ini'
}

export function getUserSosmedOrderCancelAction(order: SosmedOrder): UserSosmedOrderCancelAction | undefined {
  if (order.order_status === 'pending_payment') {
    return {
      kind: 'local',
      label: 'Batalkan',
      confirmMessage: `Batalkan order ${shortDisplayOrderID(order.id)}? Order yang belum dibayar akan ditutup.`,
    }
  }

  if (order.cancel_eligible && order.order_status === 'processing') {
    return {
      kind: 'provider',
      label: 'Ajukan Cancel',
      confirmMessage: `Ajukan cancel supplier untuk order ${shortDisplayOrderID(order.id)}? Kalau supplier sudah mengonfirmasi cancel/gagal, refund wallet akan diproses otomatis.`,
    }
  }

  return undefined
}

function getUserSosmedOrderCancelStatus(order: SosmedOrder): UserSosmedOrderCancelStatus | undefined {
  switch (clean(order.provider_cancel_status).toLowerCase()) {
    case 'requested':
      return {
        label: 'Cancel supplier diproses',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    case 'completed':
      return {
        label: 'Cancel supplier selesai',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      }
    case 'failed':
      return {
        label: 'Cancel supplier gagal',
        className: 'border-red-200 bg-red-50 text-red-700',
      }
    default:
      return undefined
  }
}

export function buildUserSosmedOrderDisplay(order: SosmedOrder): UserSosmedOrderDisplay {
  const service = serviceForOrderDisplay(order)
  const [catalogCard] = buildSosmedServiceCards([service])
  const productTitle = clean(catalogCard?.buyerTitle) || `Paket ${clean(order.service_title) || 'Sosmed'}`
  const unit = unitFromServiceLike(service)

  return {
    productTitle,
    quantityLabel: formatQuantityLabel(order.quantity, unit),
    startCountLabel: formatStartCountLabel(order.start_count),
    cancelAction: getUserSosmedOrderCancelAction(order),
    cancelStatus: getUserSosmedOrderCancelStatus(order),
  }
}
