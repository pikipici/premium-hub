import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Order } from '@/types/order'

export type AdminOrderStatus = 'pending' | 'active' | 'completed' | 'failed'

export const orderService = {
  create: async (data: { price_id: string; payment_method?: string }) => {
    const res = await api.post<ApiResponse<Order>>('/orders', data)
    return res.data
  },

  list: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<Order[]>>('/orders', { params })
    return res.data
  },

  getByID: async (id: string) => {
    const res = await api.get<ApiResponse<Order>>(`/orders/${id}`)
    return res.data
  },

  cancel: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/orders/${id}`)
    return res.data
  },

  adminList: async (params?: { page?: number; limit?: number; status?: AdminOrderStatus }) => {
    const res = await api.get<ApiResponse<Order[]>>('/admin/orders', { params })
    return res.data
  },

  adminConfirm: async (id: string) => {
    const res = await api.put<ApiResponse<null>>(`/admin/orders/${id}/confirm`)
    return res.data
  },

  adminSendAccount: async (id: string) => {
    const res = await api.post<ApiResponse<null>>(`/admin/orders/${id}/send`)
    return res.data
  },
}
