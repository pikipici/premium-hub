import { describe, expect, it } from 'vitest'

import { buildSosmedOrderTimeline, shortSosmedOrderID } from './sosmedOrderTimeline'
import type { SosmedOrder, SosmedOrderEvent } from '@/types/sosmedOrder'

const baseOrder: SosmedOrder = {
  id: '12345678-1234-1234-1234-123456789abc',
  user_id: 'user-1',
  service_id: 'service-1',
  service_code: 'jap-1000',
  service_title: 'Instagram Followers',
  quantity: 2,
  unit_price: 1000,
  total_price: 2000,
  payment_method: 'wallet',
  payment_status: 'paid',
  order_status: 'processing',
  created_at: '2026-05-01T01:00:00Z',
  paid_at: '2026-05-01T01:02:00Z',
  updated_at: '2026-05-01T01:04:00Z',
}

it('formats short order id', () => {
  expect(shortSosmedOrderID(baseOrder.id)).toBe('#12345678')
})

describe('buildSosmedOrderTimeline', () => {
  it('builds friendly processing timeline without raw provider copy', () => {
    const timeline = buildSosmedOrderTimeline({ ...baseOrder, provider_synced_at: '2026-05-01T01:10:00Z', start_count: 150 })

    expect(timeline.map((item) => item.key)).toContain('paid')
    expect(timeline.map((item) => item.key)).toContain('processing')
    expect(timeline.map((item) => item.key)).toContain('start-count')
    expect(timeline.map((item) => item.description).join(' ')).not.toMatch(/JAP|supplier|provider/i)
  })

  it('adds refill and terminal refund items', () => {
    const events: SosmedOrderEvent[] = [
      {
        id: 'event-1',
        order_id: baseOrder.id,
        from_status: 'processing',
        to_status: 'failed',
        actor_type: 'system',
        created_at: '2026-05-01T03:00:00Z',
      },
    ]
    const timeline = buildSosmedOrderTimeline({
      ...baseOrder,
      payment_status: 'failed',
      order_status: 'failed',
      refill_history: [
        {
          id: 'refill-1',
          order_id: baseOrder.id,
          attempt_number: 1,
          status: 'completed',
          actor_type: 'user',
          requested_at: '2026-05-01T02:00:00Z',
          completed_at: '2026-05-01T02:30:00Z',
          created_at: '2026-05-01T02:00:00Z',
        },
      ],
    }, events)

    expect(timeline.some((item) => item.key === 'refill-1')).toBe(true)
    expect(timeline.at(-1)?.title).toBe('Gagal / Refund')
  })
})
