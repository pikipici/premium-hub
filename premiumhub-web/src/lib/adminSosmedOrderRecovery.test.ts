import { describe, expect, it } from 'vitest'

import {
  buildMissingProviderOrderIdRecoveryPayload,
  canRetrySosmedProvider,
  getMissingProviderOrderIdNotice,
  isMissingProviderOrderIdRecoveryCandidate,
} from './adminSosmedOrderRecovery'
import type { SosmedOrder } from '@/types/sosmedOrder'

function buildOrder(overrides: Partial<SosmedOrder> = {}): SosmedOrder {
  return {
    id: '6286e732-4930-47dd-b62f-a6dcf0062372',
    user_id: 'user-1',
    service_id: 'service-1',
    service_code: 'jap-6331',
    service_title: 'Paket Followers Instagram',
    quantity: 1,
    unit_price: 19000,
    total_price: 19000,
    payment_method: 'wallet',
    payment_status: 'paid',
    order_status: 'processing',
    provider_code: 'jap',
    provider_order_id: '',
    created_at: '2026-05-09T00:00:00Z',
    ...overrides,
  }
}

describe('admin sosmed order recovery helpers', () => {
  it('flags paid processing JAP wallet orders without provider order ID as manual recovery candidates', () => {
    expect(isMissingProviderOrderIdRecoveryCandidate(buildOrder())).toBe(true)
    expect(isMissingProviderOrderIdRecoveryCandidate(buildOrder({ provider_order_id: '955388723' }))).toBe(false)
    expect(isMissingProviderOrderIdRecoveryCandidate(buildOrder({ order_status: 'failed' }))).toBe(false)
    expect(isMissingProviderOrderIdRecoveryCandidate(buildOrder({ payment_status: 'pending' }))).toBe(false)
  })

  it('keeps retry provider limited to failed wallet JAP orders without provider order ID', () => {
    expect(canRetrySosmedProvider(buildOrder({ order_status: 'failed' }))).toBe(true)
    expect(canRetrySosmedProvider(buildOrder())).toBe(false)
    expect(canRetrySosmedProvider(buildOrder({ order_status: 'failed', provider_order_id: '955388723' }))).toBe(false)
  })

  it('builds caution copy and status payload for the manual recovery step', () => {
    expect(getMissingProviderOrderIdNotice(buildOrder())).toContain('Jangan auto-submit')
    expect(getMissingProviderOrderIdNotice(buildOrder({ provider_order_id: '955388723' }))).toBe('')
    expect(buildMissingProviderOrderIdRecoveryPayload()).toEqual({
      to_status: 'failed',
      reason: 'admin menandai order paid tanpa provider order id agar bisa diretry manual setelah cek supplier',
      internal_note: 'Missing provider_order_id recovery: pastikan order belum tercatat di JAP sebelum menekan Retry Provider.',
    })
  })
})
