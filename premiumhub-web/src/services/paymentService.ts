import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'

export interface CreatePaymentResponse {
  order_id: string
  provider: string
  payment_method: string
  payment_number: string
  gateway_order_id: string
  amount: number
  total_payment?: number
  expires_at?: string
}

export const paymentService = {
  create: async (data: { order_id: string; payment_method?: string }) => {
    const res = await api.post<ApiResponse<CreatePaymentResponse>>('/payment/create', data)
    return res.data
  },

  getStatus: async (orderId: string) => {
    const res = await api.get<ApiResponse<{ order_id: string; payment_status: string; order_status: string; total_price: number }>>(`/payment/status/${orderId}`)
    return res.data
  },
}
