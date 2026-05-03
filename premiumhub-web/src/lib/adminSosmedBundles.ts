import type {
  AdminSosmedBundleItem,
  AdminSosmedBundlePackage,
  AdminSosmedBundleVariant,
} from '@/types/sosmedBundle'

export interface AdminSosmedBundleRow {
  key: string
  packageKey: string
  variantKey: string
  title: string
  variantName: string
  platform: string
  badge: string
  priceLabel: string
  discountLabel: string
  itemSummary: string
  itemTitles: string[]
  statusLabel: string
  sortOrder: number
  canCheckout: boolean
  checkoutHref: string | null
}

export interface AdminSosmedBundleSummary {
  packageCount: number
  variantCount: number
  itemCount: number
}

export interface AdminSosmedBundleDetailServiceItem {
  key: string
  title: string
  serviceCode: string
  quantityLabel: string
  linePriceLabel: string
  targetStrategyLabel: string
  itemStatusLabel: string
  serviceStatusLabel: string
  isActive: boolean
  serviceIsActive: boolean
}

export interface AdminSosmedBundleDetail {
  key: string
  packageKey: string
  packageTitle: string
  variantKey: string
  variantName: string
  platform: string
  badge: string
  priceLabel: string
  discountLabel: string
  serviceSummary: string
  statusLabel: string
  canCheckout: boolean
  checkoutHref: string | null
  emptyState: string | null
  serviceItems: AdminSosmedBundleDetailServiceItem[]
}

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatUnitCount(value: number) {
  return Math.max(0, Math.round(value)).toLocaleString('id-ID')
}

function isBundleItemActive(item: AdminSosmedBundleItem) {
  return item.is_active && item.service_is_active
}

function getBundleItemTitle(item: AdminSosmedBundleItem) {
  const title = item.label || item.service_title || item.service_code
  return isBundleItemActive(item) ? title : `${title} (nonaktif)`
}

function getRowStatusLabel(args: {
  packageActive: boolean
  packageHighlighted: boolean
  variantActive: boolean
  hasInactiveItem: boolean
}) {
  if (!args.packageActive) return 'Nonaktif'
  if (!args.variantActive) return 'Variant Nonaktif'
  if (args.hasInactiveItem) return 'Ada Item Nonaktif'
  if (args.packageHighlighted) return 'Highlight'
  return 'Aktif'
}

function buildCheckoutHref(packageKey: string, variantKey: string) {
  return `/product/sosmed/checkout?bundle=${encodeURIComponent(packageKey)}&variant=${encodeURIComponent(variantKey)}`
}

function getVariantDiscountLabel(variant: AdminSosmedBundleVariant | null) {
  if (!variant) return '-'
  const discount = variant.discount_amount || Math.max(0, (variant.original_price || 0) - (variant.total_price || 0))
  return discount > 0 ? `Diskon ${formatRupiah(discount)}` : 'Tanpa diskon'
}

function getTargetStrategyLabel(strategy: string | undefined) {
  if (strategy === 'same_target' || !strategy) return 'Target yang sama'
  return strategy
}

function getBundleDetailKey(packageKey: string, variant: AdminSosmedBundleVariant | null) {
  return variant ? `${packageKey}:${variant.key}` : `${packageKey}:__no-variant`
}

function buildDetailServiceItems(items: AdminSosmedBundleItem[]): AdminSosmedBundleDetailServiceItem[] {
  return [...items]
    .sort((left, right) => {
      const sortDiff = (left.sort_order ?? 100) - (right.sort_order ?? 100)
      if (sortDiff !== 0) return sortDiff
      return (left.service_code || left.id || '').localeCompare(right.service_code || right.id || '')
    })
    .map((item) => ({
      key: item.id || item.service_code,
      title: item.label || item.service_title || item.service_code || '-',
      serviceCode: item.service_code || '-',
      quantityLabel: `${formatUnitCount(item.quantity_units || 0)} unit`,
      linePriceLabel: formatRupiah(item.line_price || 0),
      targetStrategyLabel: getTargetStrategyLabel(item.target_strategy),
      itemStatusLabel: item.is_active ? 'Item Aktif' : 'Item Nonaktif',
      serviceStatusLabel: item.service_is_active ? 'Master Aktif' : 'Master Nonaktif',
      isActive: item.is_active,
      serviceIsActive: item.service_is_active,
    }))
}

export function buildAdminSosmedBundleDetail(
  bundle: AdminSosmedBundlePackage,
  variantKey: string
): AdminSosmedBundleDetail {
  const variants = [...(bundle.variants || [])]
  const variant = variants.find((item) => item.key === variantKey) || null
  const items = variant?.items || []
  const serviceItems = buildDetailServiceItems(items)
  const totalUnits = items.reduce((sum, item) => sum + (item.quantity_units || 0), 0)
  const activeItemCount = items.filter(isBundleItemActive).length
  const hasInactiveItem = items.some((item) => !isBundleItemActive(item))
  const canCheckout = Boolean(bundle.is_active && variant?.is_active && activeItemCount > 0)
  const statusLabel = variant
    ? getRowStatusLabel({
        packageActive: bundle.is_active,
        packageHighlighted: bundle.is_highlighted,
        variantActive: variant.is_active,
        hasInactiveItem,
      })
    : bundle.is_active ? 'Belum Ada Variant' : 'Nonaktif'

  return {
    key: getBundleDetailKey(bundle.key, variant),
    packageKey: bundle.key,
    packageTitle: bundle.title,
    variantKey: variant?.key || '-',
    variantName: variant?.name || 'Belum ada variant',
    platform: bundle.platform || '-',
    badge: bundle.badge || '-',
    priceLabel: variant ? formatRupiah(variant.total_price || 0) : '-',
    discountLabel: getVariantDiscountLabel(variant),
    serviceSummary: `${items.length} layanan / ${formatUnitCount(totalUnits)} unit`,
    statusLabel,
    canCheckout,
    checkoutHref: canCheckout && variant ? buildCheckoutHref(bundle.key, variant.key) : null,
    emptyState: serviceItems.length > 0 ? null : 'Belum ada layanan satuan di variant ini.',
    serviceItems,
  }
}

export function buildAdminSosmedBundleRows(bundles: AdminSosmedBundlePackage[]): AdminSosmedBundleRow[] {
  return [...bundles]
    .sort((left, right) => {
      const sortDiff = (left.sort_order ?? 100) - (right.sort_order ?? 100)
      if (sortDiff !== 0) return sortDiff
      return (left.key || '').localeCompare(right.key || '')
    })
    .flatMap((bundle) => {
      const variants = [...(bundle.variants || [])]

      if (variants.length === 0) {
        return [
          {
            key: `${bundle.key}:__no-variant`,
            packageKey: bundle.key,
            variantKey: '-',
            title: bundle.title,
            variantName: 'Belum ada variant',
            platform: bundle.platform || '-',
            badge: bundle.badge || '-',
            priceLabel: '-',
            discountLabel: '-',
            itemSummary: '0 layanan / 0 unit',
            itemTitles: [],
            statusLabel: bundle.is_active ? 'Belum Ada Variant' : 'Nonaktif',
            sortOrder: bundle.sort_order ?? 100,
            canCheckout: false,
            checkoutHref: null,
          },
        ]
      }

      return variants
        .sort((left, right) => {
          const sortDiff = (left.sort_order ?? 100) - (right.sort_order ?? 100)
          if (sortDiff !== 0) return sortDiff
          return (left.key || '').localeCompare(right.key || '')
        })
        .map((variant) => {
          const items = variant.items || []
          const totalUnits = items.reduce((sum, item) => sum + (item.quantity_units || 0), 0)
          const itemCount = items.length
          const activeItemCount = items.filter(isBundleItemActive).length
          const hasInactiveItem = items.some((item) => !isBundleItemActive(item))
          const discount = variant.discount_amount || Math.max(0, (variant.original_price || 0) - (variant.total_price || 0))
          const packageActive = bundle.is_active
          const variantActive = variant.is_active
          const canCheckout = packageActive && variantActive && activeItemCount > 0

          return {
            key: `${bundle.key}:${variant.key}`,
            packageKey: bundle.key,
            variantKey: variant.key,
            title: bundle.title,
            variantName: variant.name,
            platform: bundle.platform || '-',
            badge: bundle.badge || '-',
            priceLabel: formatRupiah(variant.total_price || 0),
            discountLabel: discount > 0 ? `Diskon ${formatRupiah(discount)}` : 'Tanpa diskon',
            itemSummary: `${itemCount} layanan / ${formatUnitCount(totalUnits)} unit`,
            itemTitles: items.map(getBundleItemTitle).filter(Boolean),
            statusLabel: getRowStatusLabel({
              packageActive,
              packageHighlighted: bundle.is_highlighted,
              variantActive,
              hasInactiveItem,
            }),
            sortOrder: bundle.sort_order ?? 100,
            canCheckout,
            checkoutHref: canCheckout ? buildCheckoutHref(bundle.key, variant.key) : null,
          }
        })
    })
}

export function getAdminSosmedBundleSummary(bundles: AdminSosmedBundlePackage[]): AdminSosmedBundleSummary {
  return bundles.reduce<AdminSosmedBundleSummary>(
    (summary, bundle) => {
      const variants = bundle.variants || []
      summary.packageCount += 1
      summary.variantCount += variants.length
      summary.itemCount += variants.reduce((count, variant) => count + (variant.items || []).length, 0)
      return summary
    },
    { packageCount: 0, variantCount: 0, itemCount: 0 }
  )
}
