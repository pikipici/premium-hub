import type { SosmedBundlePackage } from '@/types/sosmedBundle'

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
}

export interface AdminSosmedBundleSummary {
  packageCount: number
  variantCount: number
  itemCount: number
}

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatUnitCount(value: number) {
  return Math.max(0, Math.round(value)).toLocaleString('id-ID')
}

export function buildAdminSosmedBundleRows(bundles: SosmedBundlePackage[]): AdminSosmedBundleRow[] {
  return [...bundles]
    .sort((left, right) => {
      const sortDiff = (left.sort_order ?? 100) - (right.sort_order ?? 100)
      if (sortDiff !== 0) return sortDiff
      return (left.key || '').localeCompare(right.key || '')
    })
    .flatMap((bundle) =>
      [...(bundle.variants || [])]
        .sort((left, right) => {
          const sortDiff = (left.sort_order ?? 100) - (right.sort_order ?? 100)
          if (sortDiff !== 0) return sortDiff
          return (left.key || '').localeCompare(right.key || '')
        })
        .map((variant) => {
          const items = variant.items || []
          const totalUnits = items.reduce((sum, item) => sum + (item.quantity_units || 0), 0)
          const itemCount = items.length
          const discount = variant.discount_amount || Math.max(0, (variant.original_price || 0) - (variant.total_price || 0))

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
            itemTitles: items.map((item) => item.title).filter(Boolean),
            statusLabel: bundle.is_highlighted ? 'Highlight' : 'Aktif',
            sortOrder: bundle.sort_order ?? 100,
          }
        })
    )
}

export function getAdminSosmedBundleSummary(bundles: SosmedBundlePackage[]): AdminSosmedBundleSummary {
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
