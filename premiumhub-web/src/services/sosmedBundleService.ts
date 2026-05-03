import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { CreateSosmedBundleOrderPayload, SosmedBundleOrder, SosmedBundlePackage } from '@/types/sosmedBundle'

export const sosmedBundleService = {
  list: async () => {
    const res = await api.get<ApiResponse<SosmedBundlePackage[]>>('/public/sosmed/bundles')
    return res.data
  },

  getByKey: async (key: string) => {
    const res = await api.get<ApiResponse<SosmedBundlePackage>>(`/public/sosmed/bundles/${key}`)
    return res.data
  },

  createOrder: async (payload: CreateSosmedBundleOrderPayload) => {
    const res = await api.post<ApiResponse<SosmedBundleOrder>>('/sosmed/bundle-orders', payload)
    return res.data
  },

  getOrderByNumber: async (orderNumber: string) => {
    const res = await api.get<ApiResponse<SosmedBundleOrder>>(`/sosmed/bundle-orders/${orderNumber}`)
    return res.data
  },
}
