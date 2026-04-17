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

  adminUpdateStatus: async (id: string, payload: AdminUpdateSosmedOrderStatusPayload) => {
    const res = await api.patch<ApiResponse<SosmedOrderDetail>>(`/admin/sosmed/orders/${id}/status`, payload)
    return res.data
  },
}
