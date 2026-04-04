import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'

export const paymentService = {
  create: async (data: { order_id: string }) => {
    const res = await api.post<ApiResponse<{ order_id: string; snap_token: string; midtrans_id: string; amount: number }>>('/payment/create', data)
    return res.data
  },

  getStatus: async (orderId: string) => {
    const res = await api.get<ApiResponse<{ order_id: string; payment_status: string; order_status: string; total_price: number }>>(`/payment/status/${orderId}`)
    return res.data
  },

  simulate: async (orderId: string) => {
    const res = await api.post<ApiResponse<null>>(`/payment/simulate/${orderId}`)
    return res.data
  },
}
