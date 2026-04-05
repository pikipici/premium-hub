import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Order } from '@/types/order'

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
}
