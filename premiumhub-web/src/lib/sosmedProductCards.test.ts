import { describe, expect, it } from 'vitest'

import { buildSosmedServiceCards, normalizeSosmedTrustBadges } from './sosmedProductCards'
import type { SosmedService } from '@/types/sosmedService'

const baseService: SosmedService = {
  id: 'svc-ig-hemat',
  category_code: 'followers',
  code: 'jap-6331',
  title: 'Instagram Followers Hemat',
  summary: 'Paket followers Instagram refill 30 hari dengan harga paling ringan buat naikin social proof bertahap.',
  platform_label: 'Instagram',
  badge_text: 'Hemat',
  theme: 'pink',
  min_order: '1.000',
  start_time: '± 2 jam',
  refill: '30 hari',
  eta: 'Bertahap sampai 30K/hari',
  price_start: 'Rp 19.000/1K',
  price_per_1k: '1 paket = 1.000 followers',
  checkout_price: 19000,
  trust_badges: ['No Password', 'Refill 30 Hari', 'Gradual Delivery', 'Harga Hemat'],
  sort_order: 1,
  is_active: true,
}

describe('sosmed product card view model', () => {
  it('turns technical trust badges into beginner-friendly Indonesian copy', () => {
    expect(normalizeSosmedTrustBadges(['No Password', 'Refill 30 Hari', 'Fast Delivery', 'Twitter/X'])).toEqual([
      'Tanpa Password',
      'Garansi 30 Hari',
      'Proses Cepat',
    ])
  })

  it('builds platform-specific icon keys for catalog cards', () => {
    const twitterService: SosmedService = {
      ...baseService,
      id: 'svc-x-test',
      code: 'jap-8695',
      title: 'Twitter Followers',
      platform_label: 'Twitter/X',
    }

    const [instagramCard, twitterCard] = buildSosmedServiceCards([baseService, twitterService])

    expect(instagramCard.platformIcon).toBe('instagram')
    expect(twitterCard.platformIcon).toBe('twitter-x')
  })

  it('builds cards around package names instead of old add-1000 wording', () => {
    const [card] = buildSosmedServiceCards([baseService])

    expect(card.buyerTitle).toBe('Paket Followers Instagram')
    expect(card.buyerTitle).not.toContain('Tambah')
    expect(card.buyerTitle).not.toContain('±1.000')
    expect(card.bestFor).toBe('Cocok buat akun baru, test awal, atau naik pelan-pelan dengan budget hemat.')
    expect(card.priceLabel).toBe('Rp 19.000')
    expect(card.packageLabel).toBe('per ±1.000 followers')
    expect(card.packageExamples).toEqual(['2 paket = ±2.000 followers', '5 paket = ±5.000 followers'])
    expect(card.benefits).toContain('Tanpa perlu password')
    expect(card.benefits).toContain('Mulai diproses sekitar ± 2 jam')
    expect(card.benefits).toContain('Garansi isi ulang 30 hari')
    expect(card.benefits).not.toContain('No Password')
  })

  it('keeps fallback catalog titles package-based while backend services load', () => {
    const fallbackCards = buildSosmedServiceCards([])

    expect(fallbackCards.map((card) => card.buyerTitle)).toEqual([
      'Paket Followers Instagram',
      'Paket Likes Instagram',
      'Paket Views TikTok',
      'Paket Followers TikTok',
      'Paket YouTube Subs',
      'Paket Views Twitter',
      'Paket Views Shopee',
    ])
    expect(fallbackCards.map((card) => card.buyerTitle).join(' ')).not.toContain('Tambah')
    expect(fallbackCards.map((card) => card.buyerTitle).join(' ')).not.toContain('±1.000')
  })
})
