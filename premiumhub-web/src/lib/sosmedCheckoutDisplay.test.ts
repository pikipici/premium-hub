import { describe, expect, it } from 'vitest'

import { buildSosmedCheckoutServiceDisplay } from './sosmedCheckoutDisplay'
import { buildSosmedServiceCards } from './sosmedProductCards'
import type { SosmedService } from '@/types/sosmedService'

const rawFacebookService: SosmedService = {
  id: 'svc-facebook-followers',
  category_code: 'followers',
  code: 'jap-9274',
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

describe('sosmed checkout service display', () => {
  it('uses the catalog package title instead of raw supplier/JAP service title', () => {
    const [catalogCard] = buildSosmedServiceCards([rawFacebookService])
    const display = buildSosmedCheckoutServiceDisplay(rawFacebookService, 1)

    expect(catalogCard.buyerTitle).toBe('Paket Followers Facebook')
    expect(display.productTitle).toBe(catalogCard.buyerTitle)
    expect(display.productTitle).not.toContain('Profile Followers [HQ]')
    expect(display.productTitle).not.toContain('[Max: 50K]')
  })

  it('keeps the package quantity clear for checkout summary', () => {
    const display = buildSosmedCheckoutServiceDisplay(rawFacebookService, 5)

    expect(display.quantityLabel).toBe('5 paket (5.000 unit)')
  })
})
