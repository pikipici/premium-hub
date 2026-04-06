import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Stock } from '@/types/stock'

export type AdminStockStatus = 'available' | 'used'

export interface AdminStockPayload {
  product_id: string
  account_type: string
  email: string
  password: string
  profile_name?: string
}

export interface AdminBulkStockAccount {
  email: string
  password: string
  profile_name?: string
}

export interface AdminBulkStockPayload {
  product_id: string
  account_type: string
  accounts: AdminBulkStockAccount[]
}

export const stockService = {
  adminList: async (params?: {
    page?: number
    limit?: number
    status?: AdminStockStatus
    product_id?: string
  }) => {
    const res = await api.get<ApiResponse<Stock[]>>('/admin/stocks', { params })
    return res.data
  },

  adminCreate: async (data: AdminStockPayload) => {
    const res = await api.post<ApiResponse<Stock>>('/admin/stocks', data)
    return res.data
  },

  adminCreateBulk: async (data: AdminBulkStockPayload) => {
    const res = await api.post<ApiResponse<{ count: number }>>('/admin/stocks/bulk', data)
    return res.data
  },

  adminUpdate: async (id: string, data: AdminStockPayload) => {
    const res = await api.put<ApiResponse<Stock>>(`/admin/stocks/${id}`, data)
    return res.data
  },

  adminDelete: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/stocks/${id}`)
    return res.data
  },
}
