import { describe, expect, it } from 'vitest'

import {
  buildAdminSosmedBundleDetail,
  buildAdminSosmedBundleRows,
  getAdminSosmedBundleSummary,
} from './adminSosmedBundles'
import type { AdminSosmedBundlePackage } from '@/types/sosmedBundle'

const bundles: AdminSosmedBundlePackage[] = [
  {
    id: 'bundle-2',
    key: 'tiktok-booster',
    title: 'TikTok Booster',
    subtitle: 'Naikin views + engagement',
    description: 'Paket boost konten TikTok.',
    platform: 'TikTok',
    badge: 'Konten Viral',
    is_highlighted: false,
    is_active: true,
    sort_order: 20,
    variants: [
      {
        id: 'variant-2b',
        bundle_package_id: 'bundle-2',
        key: 'pro',
        name: 'Pro',
        description: 'Paket lebih besar',
        price_mode: 'computed_with_discount',
        fixed_price: 0,
        discount_percent: 0,
        discount_amount: 12000,
        discount_amount_calculated: 12000,
        subtotal_price: 80000,
        original_price: 80000,
        total_price: 68000,
        is_active: true,
        sort_order: 2,
        items: [
          {
            id: 'item-2b1',
            bundle_variant_id: 'variant-2b',
            sosmed_service_id: 'svc-tiktok-views',
            service_code: 'tiktok-views-10161',
            service_title: 'TikTok Views',
            label: 'TikTok Views',
            quantity_units: 30000,
            line_price: 50000,
            target_strategy: 'same_target',
            is_active: true,
            sort_order: 1,
            service_is_active: true,
          },
          {
            id: 'item-2b2',
            bundle_variant_id: 'variant-2b',
            sosmed_service_id: 'svc-tiktok-likes',
            service_code: 'tiktok-likes-10098',
            service_title: 'TikTok Likes',
            label: 'TikTok Likes',
            quantity_units: 1000,
            line_price: 18000,
            target_strategy: 'same_target',
            is_active: true,
            sort_order: 2,
            service_is_active: true,
          },
        ],
      },
      {
        id: 'variant-2a',
        bundle_package_id: 'bundle-2',
        key: 'starter',
        name: 'Starter',
        description: 'Paket mulai',
        price_mode: 'computed_with_discount',
        fixed_price: 0,
        discount_percent: 0,
        discount_amount: 5000,
        discount_amount_calculated: 5000,
        subtotal_price: 35000,
        original_price: 35000,
        total_price: 30000,
        is_active: true,
        sort_order: 1,
        items: [
          {
            id: 'item-2a1',
            bundle_variant_id: 'variant-2a',
            sosmed_service_id: 'svc-tiktok-views',
            service_code: 'tiktok-views-10161',
            service_title: 'TikTok Views',
            label: 'TikTok Views',
            quantity_units: 10000,
            line_price: 30000,
            target_strategy: 'same_target',
            is_active: true,
            sort_order: 1,
            service_is_active: true,
          },
        ],
      },
    ],
  },
  {
    id: 'bundle-1',
    key: 'umkm-starter',
    title: 'UMKM Starter',
    subtitle: 'Paket awal toko online',
    description: 'Paket awal toko online.',
    platform: 'Instagram',
    badge: 'Rekomendasi',
    is_highlighted: true,
    is_active: true,
    sort_order: 10,
    variants: [
      {
        id: 'variant-1',
        bundle_package_id: 'bundle-1',
        key: 'starter',
        name: 'Starter',
        description: 'Paket awal',
        price_mode: 'computed_with_discount',
        fixed_price: 0,
        discount_percent: 0,
        discount_amount: 7500,
        discount_amount_calculated: 7500,
        subtotal_price: 50000,
        original_price: 50000,
        total_price: 42500,
        is_active: true,
        sort_order: 1,
        items: [
          {
            id: 'item-1',
            bundle_variant_id: 'variant-1',
            sosmed_service_id: 'svc-instagram-followers',
            service_code: 'jap-6331',
            service_title: 'Instagram Followers Hemat',
            label: 'Instagram Followers Hemat',
            quantity_units: 1000,
            line_price: 42500,
            target_strategy: 'same_target',
            is_active: true,
            sort_order: 1,
            service_is_active: true,
          },
        ],
      },
    ],
  },
]

const inactiveBundles: AdminSosmedBundlePackage[] = [
  {
    id: 'bundle-inactive',
    key: 'inactive-package',
    title: 'Inactive Package',
    subtitle: '',
    description: '',
    platform: 'Instagram',
    badge: '',
    is_highlighted: false,
    is_active: false,
    sort_order: 1,
    variants: [
      {
        id: 'variant-active-on-inactive-package',
        bundle_package_id: 'bundle-inactive',
        key: 'solo',
        name: 'Solo',
        description: '',
        price_mode: 'computed',
        fixed_price: 0,
        discount_percent: 0,
        discount_amount: 0,
        discount_amount_calculated: 0,
        subtotal_price: 19000,
        total_price: 19000,
        original_price: 19000,
        is_active: true,
        sort_order: 1,
        items: [
          {
            id: 'item-active-on-inactive-package',
            bundle_variant_id: 'variant-active-on-inactive-package',
            sosmed_service_id: 'svc-active',
            service_code: 'jap-6331',
            service_title: 'Instagram Followers Hemat',
            label: 'Instagram Followers Hemat',
            quantity_units: 1000,
            line_price: 19000,
            target_strategy: 'same_target',
            is_active: true,
            sort_order: 1,
            service_is_active: true,
          },
        ],
      },
    ],
  },
  {
    id: 'bundle-active',
    key: 'active-package',
    title: 'Active Package',
    subtitle: '',
    description: '',
    platform: 'TikTok',
    badge: '',
    is_highlighted: false,
    is_active: true,
    sort_order: 2,
    variants: [
      {
        id: 'variant-inactive',
        bundle_package_id: 'bundle-active',
        key: 'inactive-variant',
        name: 'Inactive Variant',
        description: '',
        price_mode: 'computed',
        fixed_price: 0,
        discount_percent: 0,
        discount_amount: 0,
        discount_amount_calculated: 0,
        subtotal_price: 18000,
        total_price: 18000,
        original_price: 18000,
        is_active: false,
        sort_order: 1,
        items: [
          {
            id: 'item-active-on-inactive-variant',
            bundle_variant_id: 'variant-inactive',
            sosmed_service_id: 'svc-active',
            service_code: 'tiktok-views-10161',
            service_title: 'TikTok Views',
            label: 'TikTok Views',
            quantity_units: 1000,
            line_price: 18000,
            target_strategy: 'same_target',
            is_active: true,
            sort_order: 1,
            service_is_active: true,
          },
        ],
      },
      {
        id: 'variant-inactive-item',
        bundle_package_id: 'bundle-active',
        key: 'item-warning',
        name: 'Item Warning',
        description: '',
        price_mode: 'computed',
        fixed_price: 0,
        discount_percent: 0,
        discount_amount: 0,
        discount_amount_calculated: 0,
        subtotal_price: 36000,
        total_price: 36000,
        original_price: 36000,
        is_active: true,
        sort_order: 2,
        items: [
          {
            id: 'item-active',
            bundle_variant_id: 'variant-inactive-item',
            sosmed_service_id: 'svc-active',
            service_code: 'tiktok-views-10161',
            service_title: 'TikTok Views',
            label: 'TikTok Views',
            quantity_units: 1000,
            line_price: 18000,
            target_strategy: 'same_target',
            is_active: true,
            sort_order: 1,
            service_is_active: true,
          },
          {
            id: 'item-inactive',
            bundle_variant_id: 'variant-inactive-item',
            sosmed_service_id: 'svc-inactive',
            service_code: 'tiktok-likes-10098',
            service_title: 'TikTok Likes',
            label: 'TikTok Likes',
            quantity_units: 1000,
            line_price: 18000,
            target_strategy: 'same_target',
            is_active: false,
            sort_order: 2,
            service_is_active: true,
          },
        ],
      },
    ],
  },
]

describe('admin sosmed bundle list view model', () => {
  it('builds admin Paket Spesial rows sorted by package and variant order', () => {
    const rows = buildAdminSosmedBundleRows(bundles)

    expect(rows.map((row) => row.key)).toEqual([
      'umkm-starter:starter',
      'tiktok-booster:starter',
      'tiktok-booster:pro',
    ])
    expect(rows[0]).toMatchObject({
      packageKey: 'umkm-starter',
      variantKey: 'starter',
      title: 'UMKM Starter',
      variantName: 'Starter',
      platform: 'Instagram',
      badge: 'Rekomendasi',
      priceLabel: 'Rp 42.500',
      discountLabel: 'Diskon Rp 7.500',
      itemSummary: '1 layanan / 1.000 unit',
      statusLabel: 'Highlight',
      canCheckout: true,
      checkoutHref: '/product/sosmed/checkout?bundle=umkm-starter&variant=starter',
    })
    expect(rows[2].itemTitles).toEqual(['TikTok Views', 'TikTok Likes'])
    expect(rows[2].itemSummary).toBe('2 layanan / 31.000 unit')
  })

  it('builds clicked variant detail with layanan satuan audit rows', () => {
    const detail = buildAdminSosmedBundleDetail(bundles[0], 'pro')

    expect(detail).toMatchObject({
      key: 'tiktok-booster:pro',
      packageKey: 'tiktok-booster',
      packageTitle: 'TikTok Booster',
      variantKey: 'pro',
      variantName: 'Pro',
      platform: 'TikTok',
      badge: 'Konten Viral',
      priceLabel: 'Rp 68.000',
      discountLabel: 'Diskon Rp 12.000',
      statusLabel: 'Aktif',
      serviceSummary: '2 layanan / 31.000 unit',
      checkoutHref: '/product/sosmed/checkout?bundle=tiktok-booster&variant=pro',
      emptyState: null,
    })
    expect(detail.serviceItems).toEqual([
      {
        key: 'item-2b1',
        title: 'TikTok Views',
        serviceCode: 'tiktok-views-10161',
        quantityLabel: '30.000 unit',
        linePriceLabel: 'Rp 50.000',
        targetStrategyLabel: 'Target yang sama',
        itemStatusLabel: 'Item Aktif',
        serviceStatusLabel: 'Master Aktif',
        isActive: true,
        serviceIsActive: true,
      },
      {
        key: 'item-2b2',
        title: 'TikTok Likes',
        serviceCode: 'tiktok-likes-10098',
        quantityLabel: '1.000 unit',
        linePriceLabel: 'Rp 18.000',
        targetStrategyLabel: 'Target yang sama',
        itemStatusLabel: 'Item Aktif',
        serviceStatusLabel: 'Master Aktif',
        isActive: true,
        serviceIsActive: true,
      },
    ])
  })

  it('keeps inactive layanan satuan states visible in bundle detail', () => {
    const detail = buildAdminSosmedBundleDetail(inactiveBundles[1], 'item-warning')

    expect(detail.statusLabel).toBe('Ada Item Nonaktif')
    expect(detail.serviceItems.map((item) => item.itemStatusLabel)).toEqual(['Item Aktif', 'Item Nonaktif'])
    expect(detail.serviceItems.map((item) => item.serviceStatusLabel)).toEqual(['Master Aktif', 'Master Aktif'])
  })

  it('builds a safe empty detail for packages without variants', () => {
    const detail = buildAdminSosmedBundleDetail(
      {
        id: 'bundle-empty',
        key: 'new-admin-package',
        title: 'New Admin Package',
        subtitle: '',
        description: '',
        platform: 'Instagram',
        badge: '',
        is_highlighted: false,
        is_active: true,
        sort_order: 1,
        variants: [],
      },
      '-'
    )

    expect(detail).toMatchObject({
      key: 'new-admin-package:__no-variant',
      packageKey: 'new-admin-package',
      packageTitle: 'New Admin Package',
      variantKey: '-',
      variantName: 'Belum ada variant',
      serviceSummary: '0 layanan / 0 unit',
      statusLabel: 'Belum Ada Variant',
      canCheckout: false,
      checkoutHref: null,
      emptyState: 'Belum ada layanan satuan di variant ini.',
      serviceItems: [],
    })
  })

  it('distinguishes inactive package variant and item states while hiding unsafe checkout links', () => {
    const rows = buildAdminSosmedBundleRows(inactiveBundles)
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]))

    expect(byKey['inactive-package:solo']).toMatchObject({
      statusLabel: 'Nonaktif',
      canCheckout: false,
      checkoutHref: null,
    })
    expect(byKey['active-package:inactive-variant']).toMatchObject({
      statusLabel: 'Variant Nonaktif',
      canCheckout: false,
      checkoutHref: null,
    })
    expect(byKey['active-package:item-warning']).toMatchObject({
      statusLabel: 'Ada Item Nonaktif',
      canCheckout: true,
      checkoutHref: '/product/sosmed/checkout?bundle=active-package&variant=item-warning',
    })
    expect(byKey['active-package:item-warning'].itemTitles).toEqual(['TikTok Views', 'TikTok Likes (nonaktif)'])
  })

  it('keeps newly created packages without variants visible for admin actions', () => {
    const rows = buildAdminSosmedBundleRows([
      {
        id: 'bundle-empty',
        key: 'new-admin-package',
        title: 'New Admin Package',
        subtitle: '',
        description: '',
        platform: 'Instagram',
        badge: '',
        is_highlighted: false,
        is_active: true,
        sort_order: 1,
        variants: [],
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: 'new-admin-package:__no-variant',
      packageKey: 'new-admin-package',
      variantKey: '-',
      title: 'New Admin Package',
      variantName: 'Belum ada variant',
      itemSummary: '0 layanan / 0 unit',
      itemTitles: [],
      statusLabel: 'Belum Ada Variant',
      canCheckout: false,
      checkoutHref: null,
    })
  })

  it('summarizes packages, variants, and child service totals for admin header', () => {
    expect(getAdminSosmedBundleSummary(bundles)).toEqual({
      packageCount: 2,
      variantCount: 3,
      itemCount: 4,
    })
  })
})
