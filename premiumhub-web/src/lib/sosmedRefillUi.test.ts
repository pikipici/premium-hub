import { describe, expect, it } from 'vitest'

import {
  canAdminTriggerRefill,
  getAdminRefillStatusLabel,
  getJAPRefillCooldownRemainingText,
  getUserRefillButtonState,
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

  it('shows the remaining JAP cooldown time to users when the provider message contains a duration', () => {
    const order = {
      ...baseOrder,
      refill_provider_status: 'cooldown',
      refill_provider_error: 'Refill will be available in 9 hours 3 minutes',
      refill_requested_at: '2026-04-29T08:00:00Z',
    }

    expect(getJAPRefillCooldownRemainingText(order, new Date('2026-04-29T08:00:00Z'))).toBe('9 jam 3 menit')
    expect(getUserRefillMeta(order)).toMatchObject({
      label: 'Refill Menunggu Antrian',
      canClaim: false,
    })
    expect(getUserRefillTitle(order)).toBe('Refill Sedang Diproses')
    expect(getUserRefillDescription(order, new Date('2026-04-29T08:00:00Z'))).toBe(
      'Refill lu sedang nunggu cooldown JAP. Estimasi bisa diproses lagi sekitar 9 jam 3 menit. Tombol klaim tetap dikunci biar nggak dobel request.'
    )
  })

  it('counts down JAP cooldown time from when the refill request was saved', () => {
    const order = {
      ...baseOrder,
      refill_provider_status: 'cooldown',
      refill_provider_error: 'Refill will be available in 9 hours 3 minutes',
      refill_requested_at: '2026-04-29T08:00:00Z',
    }

    expect(getJAPRefillCooldownRemainingText(order, new Date('2026-04-29T10:30:00Z'))).toBe('6 jam 33 menit')
  })

  it('shows next refill countdown copy for submitted JAP refill instead of provider technical text', () => {
    const order = {
      ...baseOrder,
      refill_status: 'requested',
      refill_provider_status: 'submitted',
      refill_provider_order_id: '98706469',
      refill_requested_at: '2026-04-29T08:00:00Z',
      refill_period_days: 30,
    }

    const refill = getUserRefillMeta(order)

    expect(refill).toMatchObject({
      label: 'Refill Sedang Diproses',
      canClaim: false,
    })
    expect(getUserRefillButtonState(refill, false)).toMatchObject({
      label: 'Klaim Refill',
      disabled: true,
      className: expect.stringContaining('bg-gray-200'),
    })
    expect(getUserRefillTitle(order)).toBe('Refill Sedang Diproses')
    expect(getUserRefillDescription(order, new Date('2026-04-29T08:30:00Z'))).toBe(
      'Refill lagi diproses sistem. Next refill bisa diklaim lagi sekitar 29 hari 23 jam 30 menit. Tombol klaim tetap dikunci dulu biar nggak dobel request.'
    )
  })

  it('shows an enabled claim button style when refill is available', () => {
    const order = {
      ...baseOrder,
      refill_status: 'none',
      refill_provider_status: '',
    }

    const refill = getUserRefillMeta(order)

    expect(refill).toMatchObject({ canClaim: true })
    expect(getUserRefillButtonState(refill, false)).toMatchObject({
      label: 'Klaim Refill',
      disabled: false,
      className: expect.stringContaining('bg-violet-600'),
    })
  })
})
