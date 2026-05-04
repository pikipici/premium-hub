import { beforeEach, describe, expect, it, vi } from 'vitest'

import api from '@/lib/api'
import { sosmedBundleService } from './sosmedBundleService'

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)
const mockedPut = vi.mocked(api.put)
const mockedDelete = vi.mocked(api.delete)

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
              service_code: 'jap-6331',
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

const adminBundleResponse = {
  success: true,
  message: 'OK',
  data: [
    {
      id: 'package-1',
      key: 'umkm-starter',
      title: 'UMKM Starter',
      subtitle: 'Paket awal',
      description: 'Paket admin editable',
      platform: 'instagram',
      badge: 'Hemat',
      is_highlighted: true,
      is_active: false,
      sort_order: 10,
      variants: [
        {
          id: 'variant-1',
          bundle_package_id: 'package-1',
          key: 'starter',
          name: 'Starter',
          description: 'Variant admin',
          price_mode: 'computed_with_discount',
          fixed_price: 0,
          discount_percent: 10,
          discount_amount: 250,
          discount_amount_calculated: 500,
          subtotal_price: 5000,
          total_price: 4500,
          original_price: 5000,
          is_active: false,
          sort_order: 20,
          items: [
            {
              id: 'item-1',
              bundle_variant_id: 'variant-1',
              sosmed_service_id: 'service-1',
              service_code: 'jap-6331',
              service_title: 'Instagram Followers Hemat',
              label: 'Followers awal',
              quantity_units: 500,
              line_price: 2500,
              target_strategy: 'same_target',
              is_active: false,
              sort_order: 30,
              service_is_active: true,
              created_at: '2026-05-03T10:00:00Z',
              updated_at: '2026-05-03T10:00:00Z',
            },
          ],
          created_at: '2026-05-03T10:00:00Z',
          updated_at: '2026-05-03T10:00:00Z',
        },
      ],
      created_at: '2026-05-03T10:00:00Z',
      updated_at: '2026-05-03T10:00:00Z',
    },
  ],
}

describe('sosmedBundleService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
    mockedPut.mockReset()
    mockedDelete.mockReset()
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
            service_code_snapshot: 'jap-6331',
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

  it('lists admin sosmed bundles with inactive graph and admin-only fields', async () => {
    mockedGet.mockResolvedValueOnce({ data: adminBundleResponse })

    const response = await sosmedBundleService.adminList({ include_inactive: true })

    expect(mockedGet).toHaveBeenCalledWith('/admin/sosmed/bundles', {
      params: { include_inactive: true },
    })
    expect(response.data[0].is_active).toBe(false)
    expect(response.data[0].variants[0].price_mode).toBe('computed_with_discount')
    expect(response.data[0].variants[0].discount_amount_calculated).toBe(500)
    expect(response.data[0].variants[0].items[0].sosmed_service_id).toBe('service-1')
    expect(response.data[0].variants[0].items[0].service_is_active).toBe(true)
  })

  it('calls admin package CRUD endpoints with backend payload shapes', async () => {
    const packageResponse = { ...adminBundleResponse, data: adminBundleResponse.data[0] }
    mockedPost.mockResolvedValueOnce({ data: packageResponse })
    mockedPut.mockResolvedValueOnce({ data: packageResponse })
    mockedDelete.mockResolvedValueOnce({ data: packageResponse })

    const createPayload = {
      key: 'custom-package',
      title: 'Custom Package',
      subtitle: 'Sub',
      description: 'Desc',
      platform: 'instagram',
      badge: 'Promo',
      is_highlighted: true,
      is_active: false,
      sort_order: 40,
    }
    const updatePayload = {
      title: 'Custom Package Updated',
      subtitle: 'Sub updated',
      description: 'Desc updated',
      platform: 'tiktok',
      badge: 'Baru',
      is_highlighted: false,
      is_active: true,
      sort_order: 41,
    }

    const created = await sosmedBundleService.adminCreatePackage(createPayload)
    const updated = await sosmedBundleService.adminUpdatePackage('package-1', updatePayload)
    const deleted = await sosmedBundleService.adminDeletePackage('package-1')

    expect(mockedPost).toHaveBeenCalledWith('/admin/sosmed/bundles', createPayload)
    expect(mockedPut).toHaveBeenCalledWith('/admin/sosmed/bundles/package-1', updatePayload)
    expect(mockedDelete).toHaveBeenCalledWith('/admin/sosmed/bundles/package-1')
    expect(created.data.key).toBe('umkm-starter')
    expect(updated.data.is_active).toBe(false)
    expect(deleted.data.variants[0].items[0].is_active).toBe(false)
  })

  it('calls admin variant CRUD endpoints with pricing payloads', async () => {
    const variantResponse = { ...adminBundleResponse, data: adminBundleResponse.data[0].variants[0] }
    mockedPost.mockResolvedValueOnce({ data: variantResponse })
    mockedPut.mockResolvedValueOnce({ data: variantResponse })
    mockedDelete.mockResolvedValueOnce({ data: variantResponse })

    const createPayload = {
      key: 'growth',
      name: 'Growth',
      description: 'Naik lebih cepat',
      price_mode: 'fixed',
      fixed_price: 15000,
      discount_percent: 0,
      discount_amount: 0,
      is_active: true,
      sort_order: 50,
    } as const
    const updatePayload = {
      name: 'Growth Updated',
      description: 'Desc updated',
      price_mode: 'computed',
      fixed_price: 0,
      discount_percent: 0,
      discount_amount: 0,
      is_active: false,
      sort_order: 51,
    } as const

    const created = await sosmedBundleService.adminCreateVariant('package-1', createPayload)
    const updated = await sosmedBundleService.adminUpdateVariant('variant-1', updatePayload)
    const deleted = await sosmedBundleService.adminDeleteVariant('variant-1')

    expect(mockedPost).toHaveBeenCalledWith('/admin/sosmed/bundles/package-1/variants', createPayload)
    expect(mockedPut).toHaveBeenCalledWith('/admin/sosmed/bundle-variants/variant-1', updatePayload)
    expect(mockedDelete).toHaveBeenCalledWith('/admin/sosmed/bundle-variants/variant-1')
    expect(created.data.fixed_price).toBe(0)
    expect(updated.data.discount_amount_calculated).toBe(500)
    expect(deleted.data.is_active).toBe(false)
  })

  it('calls admin item CRUD endpoints with service and quantity payloads', async () => {
    const itemResponse = { ...adminBundleResponse, data: adminBundleResponse.data[0].variants[0].items[0] }
    mockedPost.mockResolvedValueOnce({ data: itemResponse })
    mockedPut.mockResolvedValueOnce({ data: itemResponse })
    mockedDelete.mockResolvedValueOnce({ data: itemResponse })

    const createPayload = {
      sosmed_service_id: 'service-1',
      label: 'Followers awal',
      quantity_units: 500,
      target_strategy: 'same_target',
      is_active: true,
      sort_order: 60,
    }
    const updatePayload = {
      sosmed_service_id: 'service-2',
      label: 'Followers update',
      quantity_units: 750,
      target_strategy: 'same_target',
      is_active: false,
      sort_order: 61,
    }

    const created = await sosmedBundleService.adminCreateItem('variant-1', createPayload)
    const updated = await sosmedBundleService.adminUpdateItem('item-1', updatePayload)
    const deleted = await sosmedBundleService.adminDeleteItem('item-1')

    expect(mockedPost).toHaveBeenCalledWith('/admin/sosmed/bundle-variants/variant-1/items', createPayload)
    expect(mockedPut).toHaveBeenCalledWith('/admin/sosmed/bundle-items/item-1', updatePayload)
    expect(mockedDelete).toHaveBeenCalledWith('/admin/sosmed/bundle-items/item-1')
    expect(created.data.service_title).toBe('Instagram Followers Hemat')
    expect(updated.data.quantity_units).toBe(500)
    expect(deleted.data.is_active).toBe(false)
  })
})
