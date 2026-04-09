import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  ConvertLimitRule,
  ConvertListParams,
  ConvertOrderDetail,
  ConvertOrderSummary,
  ConvertPricingRule,
  CreateConvertOrderPayload,
  UploadConvertProofPayload,
} from '@/types/convert'

export const convertService = {
  createOrder: async (payload: CreateConvertOrderPayload) => {
    const res = await api.post<ApiResponse<ConvertOrderDetail>>('/convert/orders', payload)
    return res.data
  },

  listOrders: async (params?: ConvertListParams) => {
    const res = await api.get<ApiResponse<ConvertOrderSummary[]>>('/convert/orders', { params })
    return res.data
  },

  getOrderByID: async (id: string) => {
    const res = await api.get<ApiResponse<ConvertOrderDetail>>(`/convert/orders/${id}`)
    return res.data
  },

  trackOrderByToken: async (token: string) => {
    const res = await api.get<ApiResponse<ConvertOrderDetail>>(`/convert/track/${encodeURIComponent(token)}`)
    return res.data
  },

  uploadProof: async (orderID: string, payload: UploadConvertProofPayload | FormData) => {
    const config = payload instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined

    const res = await api.post<ApiResponse<ConvertOrderDetail>>(`/convert/orders/${orderID}/proofs`, payload, config)
    return res.data
  },

  adminListOrders: async (params?: ConvertListParams) => {
    const res = await api.get<ApiResponse<ConvertOrderSummary[]>>('/admin/convert/orders', { params })
    return res.data
  },

  adminUpdateOrderStatus: async (orderID: string, payload: { to_status: string; reason?: string; internal_note?: string }) => {
    const res = await api.patch<ApiResponse<ConvertOrderDetail>>(`/admin/convert/orders/${orderID}/status`, payload)
    return res.data
  },

  adminGetPricingRules: async () => {
    const res = await api.get<ApiResponse<ConvertPricingRule[]>>('/admin/convert/pricing')
    return res.data
  },

  adminUpdatePricingRules: async (rules: ConvertPricingRule[]) => {
    const res = await api.put<ApiResponse<ConvertPricingRule[]>>('/admin/convert/pricing', { rules })
    return res.data
  },

  adminGetLimitRules: async () => {
    const res = await api.get<ApiResponse<ConvertLimitRule[]>>('/admin/convert/limits')
    return res.data
  },

  adminUpdateLimitRules: async (rules: ConvertLimitRule[]) => {
    const res = await api.put<ApiResponse<ConvertLimitRule[]>>('/admin/convert/limits', { rules })
    return res.data
  },
}
