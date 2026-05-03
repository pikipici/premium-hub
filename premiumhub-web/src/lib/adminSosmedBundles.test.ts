import { describe, expect, it } from 'vitest'

import { buildAdminSosmedBundleRows, getAdminSosmedBundleSummary } from './adminSosmedBundles'
import type { SosmedBundlePackage } from '@/types/sosmedBundle'

const bundles: SosmedBundlePackage[] = [
  {
    id: 'bundle-2',
    key: 'tiktok-booster',
    title: 'TikTok Booster',
    subtitle: 'Naikin views + engagement',
    description: 'Paket boost konten TikTok.',
    platform: 'TikTok',
    badge: 'Konten Viral',
    is_highlighted: false,
    sort_order: 20,
    variants: [
      {
        id: 'variant-2b',
        key: 'pro',
        name: 'Pro',
        description: 'Paket lebih besar',
        subtotal_price: 80000,
        discount_amount: 12000,
        original_price: 80000,
        total_price: 68000,
        sort_order: 2,
        items: [
          {
            service_code: 'tiktok-views-10161',
            title: 'TikTok Views',
            quantity_units: 30000,
            line_price: 50000,
            target_strategy: 'same_target',
          },
          {
            service_code: 'tiktok-likes-10098',
            title: 'TikTok Likes',
            quantity_units: 1000,
            line_price: 18000,
            target_strategy: 'same_target',
          },
        ],
      },
      {
        id: 'variant-2a',
        key: 'starter',
        name: 'Starter',
        subtotal_price: 35000,
        discount_amount: 5000,
        original_price: 35000,
        total_price: 30000,
        sort_order: 1,
        items: [
          {
            service_code: 'tiktok-views-10161',
            title: 'TikTok Views',
            quantity_units: 10000,
            line_price: 30000,
            target_strategy: 'same_target',
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
    platform: 'Instagram',
    badge: 'Rekomendasi',
    is_highlighted: true,
    sort_order: 10,
    variants: [
      {
        id: 'variant-1',
        key: 'starter',
        name: 'Starter',
        subtotal_price: 50000,
        discount_amount: 7500,
        original_price: 50000,
        total_price: 42500,
        sort_order: 1,
        items: [
          {
            service_code: 'instagram-followers-6331',
            title: 'Instagram Followers Hemat',
            quantity_units: 1000,
            line_price: 42500,
            target_strategy: 'same_target',
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
    })
    expect(rows[2].itemTitles).toEqual(['TikTok Views', 'TikTok Likes'])
    expect(rows[2].itemSummary).toBe('2 layanan / 31.000 unit')
  })

  it('summarizes active packages, variants, and child service totals for admin header', () => {
    expect(getAdminSosmedBundleSummary(bundles)).toEqual({
      packageCount: 2,
      variantCount: 3,
      itemCount: 4,
    })
  })
})
