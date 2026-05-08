import { beforeEach, describe, expect, it, vi } from 'vitest'

import api from '@/lib/api'
import { sosmedOrderService, type CreateSosmedOrderPayload } from './sosmedOrderService'

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

  it('creates a wallet sosmed order and forwards the backend idempotency key exactly', async () => {
    const createResponse = {
      success: true,
      message: 'Order sosmed berhasil dibuat',
      data: {
        order: {
          id: 'order-sosmed-1',
          user_id: 'user-1',
          service_id: 'service-1',
          service_code: 'jap-6331',
          service_title: 'Instagram Followers Hemat',
          quantity: 500,
          unit_price: 12,
          total_price: 6000,
          payment_method: 'wallet',
          payment_status: 'paid',
          order_status: 'processing',
          target_link: 'https://instagram.com/example',
          created_at: '2026-05-08T09:00:00Z',
        },
        events: [],
      },
    }
    mockedPost.mockResolvedValueOnce({ data: createResponse })

    const payload: CreateSosmedOrderPayload = {
      service_id: 'service-1',
      target_link: 'https://instagram.com/example',
      quantity: 500,
      notes: 'gas single',
      target_public_confirmed: true,
      idempotency_key: 'sosmed-order-abc123',
    }

    const response = await sosmedOrderService.create(payload)

    expect(mockedPost).toHaveBeenCalledWith('/sosmed/orders', payload)
    expect(mockedPost.mock.calls[0]?.[1]).toMatchObject({
      idempotency_key: 'sosmed-order-abc123',
    })
    expect(response.data.order.id).toBe('order-sosmed-1')
  })

  it('requests provider cancel through the explicit POST endpoint', async () => {
    mockedPost.mockResolvedValueOnce({ data: cancelDetailResponse })

    const response = await sosmedOrderService.requestCancel('order-jap-cancel-1')

    expect(mockedPost).toHaveBeenCalledWith('/sosmed/orders/order-jap-cancel-1/cancel')
    expect(response.data.order.provider_cancel_status).toBe('requested')
  })
})
