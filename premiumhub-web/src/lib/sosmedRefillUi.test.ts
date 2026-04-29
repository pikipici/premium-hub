import { describe, expect, it } from 'vitest'

import {
  canAdminTriggerRefill,
  getAdminRefillStatusLabel,
  getUserRefillDescription,
  getUserRefillMeta,
  getUserRefillTitle,
} from './sosmedRefillUi'
import type { SosmedOrder } from '@/types/sosmedOrder'

const baseOrder: SosmedOrder = {
  id: 'order-1',
  user_id: 'user-1',
  service_id: 'service-1',
  service_code: 'instagram-followers',
  service_title: 'Instagram Followers',
  quantity: 1,
  unit_price: 19000,
  total_price: 19000,
  payment_method: 'wallet',
  payment_status: 'paid',
  order_status: 'success',
  provider_code: 'jap',
  provider_order_id: '123456',
  refill_eligible: true,
  refill_period_days: 30,
  refill_deadline: '2099-01-01T00:00:00Z',
  refill_status: 'processing',
  created_at: '2026-04-29T00:00:00Z',
}

describe('sosmed refill UI helpers', () => {
  it('shows JAP cooldown as a clear admin status instead of generic processing', () => {
    const order = {
      ...baseOrder,
      refill_provider_status: 'cooldown',
      refill_provider_error: 'Please wait 24 hours before requesting refill again',
    }

    expect(getAdminRefillStatusLabel(order)).toMatchObject({
      text: 'Menunggu Cooldown JAP',
      tone: 'warning',
    })
  })

  it('allows admin to retry a cooldown refill when JAP has not returned a refill ID', () => {
    const cooldownWithoutRefillID = {
      ...baseOrder,
      refill_provider_status: 'cooldown',
      refill_provider_order_id: '',
    }

    expect(canAdminTriggerRefill(cooldownWithoutRefillID)).toBe(true)
  })

  it('does not allow admin cooldown retry after a JAP refill ID exists', () => {
    const cooldownWithRefillID = {
      ...baseOrder,
      refill_provider_status: 'cooldown',
      refill_provider_order_id: 'refill-123',
    }

    expect(canAdminTriggerRefill(cooldownWithRefillID)).toBe(false)
  })

  it('keeps user cooldown copy friendly and keeps claim disabled', () => {
    const order = {
      ...baseOrder,
      refill_provider_status: 'cooldown',
      refill_provider_error: 'Please wait 24 hours before requesting refill again',
    }

    expect(getUserRefillMeta(order)).toMatchObject({
      label: 'Refill Menunggu Antrian',
      canClaim: false,
    })
    expect(getUserRefillTitle(order)).toBe('Refill Sedang Diproses')
    expect(getUserRefillDescription(order)).toBe(
      'Refill lu sudah masuk antrian sistem. Kalau sistem lagi nunggu giliran refill, tombol klaim tetap dikunci biar nggak dobel request.'
    )
  })
})
