import { buildSosmedServiceCards } from './sosmedProductCards'
import type { SosmedOrder } from '@/types/sosmedOrder'
import type { SosmedService } from '@/types/sosmedService'

export interface UserSosmedOrderDisplay {
  productTitle: string
  quantityLabel: string
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

export function buildUserSosmedOrderDisplay(order: SosmedOrder): UserSosmedOrderDisplay {
  const service = serviceForOrderDisplay(order)
  const [catalogCard] = buildSosmedServiceCards([service])
  const productTitle = clean(catalogCard?.buyerTitle) || `Paket ${clean(order.service_title) || 'Sosmed'}`
  const unit = unitFromServiceLike(service)

  return {
    productTitle,
    quantityLabel: formatQuantityLabel(order.quantity, unit),
  }
}
