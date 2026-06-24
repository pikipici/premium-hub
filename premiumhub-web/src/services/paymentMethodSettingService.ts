import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'

export type PaymentMethodKey =
  | 'wallet'
  | 'qris'
  | 'bca_va'
  | 'bni_va'
  | 'bri_va'
  | 'mandiri_va'
  | 'ovo'
  | 'dana'
  | 'shopeepay'

export interface PaymentMethodSetting {
  key: PaymentMethodKey
  label: string
  is_enabled: boolean
  unavailable_note: string
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface UpdatePaymentMethodSettingItem {
  key: PaymentMethodKey
  is_enabled: boolean
  unavailable_note: string
}

export const paymentMethodSettingService = {
  publicList: async () => {
    const res = await api.get<ApiResponse<PaymentMethodSetting[]>>('/public/payment-method-settings')
    return res.data
  },

  adminList: async () => {
    const res = await api.get<ApiResponse<PaymentMethodSetting[]>>('/admin/settings/payment-method-settings')
    return res.data
  },

  adminUpdate: async (items: UpdatePaymentMethodSettingItem[]) => {
    const res = await api.put<ApiResponse<PaymentMethodSetting[]>>('/admin/settings/payment-method-settings', { items })
    return res.data
  },
}
