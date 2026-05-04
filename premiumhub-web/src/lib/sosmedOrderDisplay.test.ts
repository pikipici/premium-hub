import { describe, expect, it } from 'vitest'

import { buildSosmedServiceCards } from './sosmedProductCards'
import { buildUserSosmedOrderDisplay } from './sosmedOrderDisplay'
import type { SosmedOrder } from '@/types/sosmedOrder'
import type { SosmedService } from '@/types/sosmedService'

const rawFacebookService: SosmedService = {
  id: 'svc-facebook-followers',
  category_code: 'followers',
  code: 'jap-10098',
  title: 'Facebook Profile Followers [HQ] [Max: 50K]',
  summary: 'Followers Facebook untuk profil publik.',
  platform_label: 'Facebook',
  badge_text: 'HQ',
  theme: 'blue',
  min_order: '1.000',
  start_time: '± 1 jam',
  refill: 'Tidak ada',
  eta: 'Bertahap',
  price_start: 'Rp 10.500/1K',
  price_per_1k: '1 paket = 1.000 followers',
  checkout_price: 10500,
  trust_badges: ['No Password'],
  sort_order: 10,
  is_active: true,
}

const baseOrder: SosmedOrder = {
  id: '6286e732-0000-4000-9000-000000000001',
  user_id: 'user-1',
  service_id: rawFacebookService.id,
  service_code: rawFacebookService.code,
  service_title: rawFacebookService.title,
  target_link: 'facebook.com/fikrIramaa',
  quantity: 2,
  unit_price: 10500,
  total_price: 21000,
  payment_method: 'wallet',
  payment_status: 'paid',
  order_status: 'processing',
  created_at: '2026-05-04T12:46:00Z',
  service: rawFacebookService,
}

describe('user sosmed order display view model', () => {
  it('uses the catalog package title instead of raw supplier service title', () => {
    const [catalogCard] = buildSosmedServiceCards([rawFacebookService])
    const display = buildUserSosmedOrderDisplay(baseOrder)

    expect(catalogCard.buyerTitle).toBe('Paket Followers Facebook')
    expect(display.productTitle).toBe(catalogCard.buyerTitle)
    expect(display.productTitle).not.toContain('Profile Followers [HQ]')
    expect(display.productTitle).not.toContain('[Max: 50K]')
  })

  it('shows the ordered quantity in real customer-facing units', () => {
    const display = buildUserSosmedOrderDisplay(baseOrder)

    expect(display.quantityLabel).toBe('Jumlah: ±2.000 followers (2 paket)')
  })

  it('can infer package display from an older order snapshot without preloaded service metadata', () => {
    const display = buildUserSosmedOrderDisplay({
      ...baseOrder,
      service: undefined,
      service_title: 'Instagram Followers Hemat',
      quantity: 1,
    })

    expect(display.productTitle).toBe('Paket Followers Instagram')
    expect(display.quantityLabel).toBe('Jumlah: ±1.000 followers (1 paket)')
  })
})
