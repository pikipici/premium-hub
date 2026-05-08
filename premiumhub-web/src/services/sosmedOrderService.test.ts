import { beforeEach, describe, expect, it, vi } from 'vitest'

import api from '@/lib/api'
import { sosmedOrderService } from './sosmedOrderService'

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedPost = vi.mocked(api.post)

const cancelDetailResponse = {
  success: true,
  message: 'Order sosmed dibatalkan',
  data: {
    order: {
      id: 'order-jap-cancel-1',
      user_id: 'user-1',
      service_id: 'service-1',
      service_code: 'jap-6331',
      service_title: 'Instagram Followers Hemat',
      quantity: 1,
      unit_price: 12000,
      total_price: 12000,
      payment_status: 'paid',
      order_status: 'processing',
      provider_code: 'jap',
      provider_order_id: '991122',
      provider_cancel_status: 'requested',
      cancel_eligible: false,
      created_at: '2026-05-08T09:00:00Z',
    },
    events: [],
  },
}

describe('sosmedOrderService', () => {
  beforeEach(() => {
    mockedPost.mockReset()
  })

  it('requests provider cancel through the explicit POST endpoint', async () => {
    mockedPost.mockResolvedValueOnce({ data: cancelDetailResponse })

    const response = await sosmedOrderService.requestCancel('order-jap-cancel-1')

    expect(mockedPost).toHaveBeenCalledWith('/sosmed/orders/order-jap-cancel-1/cancel')
    expect(response.data.order.provider_cancel_status).toBe('requested')
  })
})
