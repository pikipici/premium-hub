import { describe, expect, it } from 'vitest'

import { getRefillHistoryToggleLabel, isRefillHistoryExpanded } from './sosmedRefillHistoryUi'

describe('sosmed refill history UI', () => {
  it('keeps refill history details hidden until the order toggle is opened', () => {
    const orderId = 'order-8120fbb9'

    expect(isRefillHistoryExpanded(null, orderId)).toBe(false)
    expect(isRefillHistoryExpanded('other-order', orderId)).toBe(false)
    expect(isRefillHistoryExpanded(orderId, orderId)).toBe(true)
  })

  it('shows a compact button label with claim count', () => {
    expect(getRefillHistoryToggleLabel(1, false)).toBe('Lihat Riwayat Refill (1x)')
    expect(getRefillHistoryToggleLabel(2, false)).toBe('Lihat Riwayat Refill (2x)')
    expect(getRefillHistoryToggleLabel(2, true)).toBe('Sembunyikan Riwayat Refill')
  })
})
