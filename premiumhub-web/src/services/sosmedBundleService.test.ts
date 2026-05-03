import { beforeEach, describe, expect, it, vi } from 'vitest'

import api from '@/lib/api'
import { sosmedBundleService } from './sosmedBundleService'

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)

const bundleResponse = {
  success: true,
  message: 'OK',
  data: [
    {
      id: 'bundle-1',
      key: 'instagram-starter',
      title: 'Instagram Starter Pack',
      subtitle: 'Naik pelan tapi aman',
      description: 'Paket awal untuk akun baru.',
      platform: 'instagram',
      badge: 'Paling Hemat',
      is_highlighted: true,
      sort_order: 1,
      variants: [
        {
          id: 'variant-1',
          key: 'starter-500',
          name: 'Starter 500',
          description: 'Cocok buat test awal',
          subtotal_price: 3000,
          discount_amount: 450,
          total_price: 2550,
          original_price: 3000,
          sort_order: 1,
          items: [
            {
              id: 'item-1',
              service_id: 'service-1',
              service_code: 'instagram-followers-6331',
              title: 'Instagram Followers Hemat',
              quantity_units: 500,
              line_price: 2500,
              target_strategy: 'same_target',
            },
          ],
        },
      ],
      created_at: '2026-05-02T10:00:00Z',
      updated_at: '2026-05-02T10:00:00Z',
    },
  ],
}

describe('sosmedBundleService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
  })

  it('lists public sosmed bundles from the backend catalog endpoint', async () => {
    mockedGet.mockResolvedValueOnce({ data: bundleResponse })

    const response = await sosmedBundleService.list()

    expect(mockedGet).toHaveBeenCalledWith('/public/sosmed/bundles')
    expect(response.data[0].key).toBe('instagram-starter')
    expect(response.data[0].variants[0].total_price).toBe(2550)
    expect(response.data[0].variants[0].items[0].quantity_units).toBe(500)
  })

  it('gets a public sosmed bundle detail by key without leaking provider metadata in the type shape', async () => {
    const detail = { ...bundleResponse, data: bundleResponse.data[0] }
    mockedGet.mockResolvedValueOnce({ data: detail })

    const response = await sosmedBundleService.getByKey('instagram-starter')

    expect(mockedGet).toHaveBeenCalledWith('/public/sosmed/bundles/instagram-starter')
    expect(response.data.title).toBe('Instagram Starter Pack')
    expect(response.data.variants[0].items[0]).not.toHaveProperty('provider_code')
    expect(response.data.variants[0].items[0]).not.toHaveProperty('provider_service_id')
    expect(response.data.variants[0].items[0]).not.toHaveProperty('provider_rate')
  })

  it('creates an authenticated bundle order with wallet payment and target confirmation', async () => {
    const createdOrderResponse = {
      success: true,
      message: 'Order bundle sosmed berhasil dibuat',
      data: {
        id: 'bundle-order-1',
        order_number: 'SB-20260502-00000001',
        package_key_snapshot: 'instagram-starter',
        variant_key_snapshot: 'starter-500',
        title_snapshot: 'Instagram Starter Pack - Starter 500',
        target_link: 'https://instagram.com/example',
        subtotal_price: 3000,
        discount_amount: 450,
        total_price: 2550,
        status: 'processing',
        payment_method: 'wallet',
        items: [
          {
            id: 'bundle-order-item-1',
            service_code_snapshot: 'instagram-followers-6331',
            service_title_snapshot: 'Instagram Followers Hemat',
            quantity_units: 500,
            line_price: 2500,
            status: 'submitted',
          },
        ],
      },
    }
    mockedPost.mockResolvedValueOnce({ data: createdOrderResponse })

    const response = await sosmedBundleService.createOrder({
      bundle_key: 'instagram-starter',
      variant_key: 'starter-500',
      target_link: 'https://instagram.com/example',
      notes: 'gas bundle',
      payment_method: 'wallet',
      target_public_confirmed: true,
    })

    expect(mockedPost).toHaveBeenCalledWith('/sosmed/bundle-orders', {
      bundle_key: 'instagram-starter',
      variant_key: 'starter-500',
      target_link: 'https://instagram.com/example',
      notes: 'gas bundle',
      payment_method: 'wallet',
      target_public_confirmed: true,
    })
    expect(response.data.order_number).toBe('SB-20260502-00000001')
    expect(response.data.items[0].quantity_units).toBe(500)
  })

  it('gets an authenticated bundle order detail by order number', async () => {
    const detailResponse = {
      success: true,
      message: 'OK',
      data: {
        id: 'bundle-order-1',
        order_number: 'SB-20260502-00000001',
        package_key_snapshot: 'instagram-starter',
        variant_key_snapshot: 'starter-500',
        title_snapshot: 'Instagram Starter Pack - Starter 500',
        target_link: 'https://instagram.com/example',
        subtotal_price: 3000,
        discount_amount: 450,
        total_price: 2550,
        status: 'processing',
        payment_method: 'wallet',
        items: [],
      },
    }
    mockedGet.mockResolvedValueOnce({ data: detailResponse })

    const response = await sosmedBundleService.getOrderByNumber('SB-20260502-00000001')

    expect(mockedGet).toHaveBeenCalledWith('/sosmed/bundle-orders/SB-20260502-00000001')
    expect(response.data.title_snapshot).toBe('Instagram Starter Pack - Starter 500')
  })
})
