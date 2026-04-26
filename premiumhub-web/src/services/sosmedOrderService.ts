import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { SosmedOrder, SosmedOrderDetail } from '@/types/sosmedOrder'

export interface CreateSosmedOrderPayload {
  service_id: string
  target_link?: string
  quantity?: number
  notes?: string
}

export interface CreateSosmedPaymentPayload {
  order_id: string
  payment_method: string
}

export interface AdminUpdateSosmedOrderStatusPayload {
  to_status: string
  reason?: string
  internal_note?: string
}

export interface AdminRetrySosmedProviderPayload {
  reason?: string
}

export interface AdminSyncSosmedProviderResultItem {
  order_id: string
  service_code: string
  provider_code: string
  provider_order_id: string
  provider_status: string
  order_status: string
  result: string
  message?: string
}

export interface AdminSyncSosmedProviderResult {
  requested: number
  synced: number
  updated: number
  failed: number
  skipped: number
  items?: AdminSyncSosmedProviderResultItem[]
}

export const sosmedOrderService = {
  create: async (payload: CreateSosmedOrderPayload) => {
    const res = await api.post<ApiResponse<SosmedOrderDetail>>('/sosmed/orders', payload)
    return res.data
  },

  list: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<SosmedOrder[]>>('/sosmed/orders', { params })
    return res.data
  },

  getByID: async (id: string) => {
    const res = await api.get<ApiResponse<SosmedOrderDetail>>(`/sosmed/orders/${id}`)
    return res.data
  },

  cancel: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/sosmed/orders/${id}`)
    return res.data
  },

  createPayment: async (payload: CreateSosmedPaymentPayload) => {
    const res = await api.post<ApiResponse<{
      order_id: string
      provider: string
      payment_method: string
      payment_number: string
      gateway_order_id: string
      amount: number
      total_payment: number
      expires_at?: string
    }>>('/sosmed/payments', payload)
    return res.data
  },

  getPaymentStatus: async (orderId: string) => {
    const res = await api.get<ApiResponse<{
      order_id: string
      payment_status: string
      order_status: string
      total_price: number
    }>>(`/sosmed/payments/status/${orderId}`)
    return res.data
  },

  adminList: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<SosmedOrder[]>>('/admin/sosmed/orders', { params })
    return res.data
  },

  adminGetByID: async (id: string) => {
    const res = await api.get<ApiResponse<SosmedOrderDetail>>(`/admin/sosmed/orders/${id}`)
    return res.data
  },

  adminUpdateStatus: async (id: string, payload: AdminUpdateSosmedOrderStatusPayload) => {
    const res = await api.patch<ApiResponse<SosmedOrderDetail>>(`/admin/sosmed/orders/${id}/status`, payload)
    return res.data
  },

  adminSyncProvider: async (id: string) => {
    const res = await api.post<ApiResponse<SosmedOrderDetail>>(`/admin/sosmed/orders/${id}/sync-provider`)
    return res.data
  },

  adminSyncProcessingProviders: async (params?: { limit?: number }) => {
    const res = await api.post<ApiResponse<AdminSyncSosmedProviderResult>>('/admin/sosmed/orders/sync-provider', null, { params })
    return res.data
  },

  adminRetryProvider: async (id: string, payload: AdminRetrySosmedProviderPayload) => {
    const res = await api.post<ApiResponse<SosmedOrderDetail>>(`/admin/sosmed/orders/${id}/retry-provider`, payload)
    return res.data
  },
}
