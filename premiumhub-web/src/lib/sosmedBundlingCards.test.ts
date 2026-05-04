import { describe, expect, it } from 'vitest'

import { BUNDLING_PACKAGES, buildSosmedBundleCards, buildSosmedBundleProductCards } from './sosmedBundlingCards'
import type { SosmedBundlePackage } from '@/types/sosmedBundle'

const backendBundle: SosmedBundlePackage = {
  id: 'bundle-ig-starter',
  key: 'instagram-starter',
  title: 'Instagram Starter Pack',
  subtitle: 'Naik pelan tapi aman',
  description: 'Backend source of truth untuk paket IG starter.',
  platform: 'Instagram',
  badge: 'Backend Badge',
  is_highlighted: true,
  sort_order: 1,
  variants: [
    {
      id: 'variant-small',
      key: 'starter-small',
      name: 'Starter Small',
      description: 'Cocok buat coba dulu',
      subtotal_price: 3000,
      discount_amount: 450,
      total_price: 2550,
      original_price: 3000,
      sort_order: 1,
      items: [
        {
          id: 'item-followers',
          service_id: 'svc-followers',
          service_code: 'jap-6331',
          title: 'Instagram Followers Hemat',
          quantity_units: 500,
          line_price: 2500,
          target_strategy: 'same_target',
        },
        {
          id: 'item-likes',
          service_id: 'svc-likes',
          service_code: 'instagram-likes-1111',
          title: 'Instagram Likes',
          quantity_units: 1000,
          line_price: 500,
          target_strategy: 'same_target',
        },
      ],
    },
  ],
}

describe('sosmed bundle catalog card view model', () => {
  it('uses backend bundles and calculated backend prices as source of truth', () => {
    const [card] = buildSosmedBundleCards([backendBundle])

    expect(card.key).toBe('instagram-starter')
    expect(card.title).toBe('Instagram Starter Pack')
    expect(card.targetPlatform).toBe('Instagram')
    expect(card.summary).toBe('Backend source of truth untuk paket IG starter.')
    expect(card.badge).toBe('Backend Badge')
    expect(card.startingPriceLabel).toBe('Rp 2.550')
    expect(card.packages).toEqual([
      {
        key: 'starter-small',
        name: 'Starter Small',
        priceLabel: 'Rp 2.550',
        items: ['500 Instagram Followers Hemat', '1.000 Instagram Likes'],
      },
    ])
    expect(card.features).toEqual(['Instagram Followers Hemat', 'Instagram Likes'])
  })

  it('falls back to curated package cards while backend bundle catalog is unavailable', () => {
    expect(buildSosmedBundleCards([])).toEqual(BUNDLING_PACKAGES)
  })

  it('flattens each bundle variant into a product-style card like Layanan Satuan', () => {
    const [card] = buildSosmedBundleProductCards([backendBundle])

    expect(card).toMatchObject({
      key: 'instagram-starter:starter-small',
      bundleKey: 'instagram-starter',
      variantKey: 'starter-small',
      platform: 'Instagram',
      platformIcon: 'instagram',
      buyerTitle: 'Instagram Starter Pack - Starter Small',
      priceLabel: 'Rp 2.550',
      packageLabel: 'paket bundling isi 2 layanan',
      tone: 'from-[#EEF8FF] to-[#DCEFFF]',
      isRecommended: true,
    })
    expect(card.benefits).toEqual([
      '500 Instagram Followers Hemat',
      '1.000 Instagram Likes',
      'Tanpa perlu password',
      'Harga final sudah termasuk diskon bundling',
    ])
    expect(card.trustBadges).toEqual(['Backend Badge', '2 Layanan', 'Bundling Hemat'])
  })
})
