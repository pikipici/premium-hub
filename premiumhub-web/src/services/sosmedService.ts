import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { SosmedService } from '@/types/sosmedService'

export interface AdminSosmedServicePayload {
  category_code: string
  code: string
  title: string
  provider_title?: string
  summary?: string
  platform_label?: string
  badge_text?: string
  theme?: string
  min_order?: string
  start_time?: string
  refill?: string
  eta?: string
  price_start?: string
  price_per_1k?: string
  checkout_price?: number
  trust_badges?: string[]
  sort_order?: number
  is_active?: boolean
}

export interface AdminSosmedServiceUpdatePayload {
  category_code?: string
  code?: string
  title?: string
  provider_title?: string
  summary?: string
  platform_label?: string
  badge_text?: string
  theme?: string
  min_order?: string
  start_time?: string
  refill?: string
  eta?: string
  price_start?: string
  price_per_1k?: string
  checkout_price?: number
  trust_badges?: string[]
  sort_order?: number
  is_active?: boolean
}

export interface AdminSosmedResellerRepricePayload {
  mode?: 'fixed' | 'live'
  fixed_rate?: number
  include_inactive?: boolean
  code_prefix?: string
  dry_run?: boolean
}

export interface AdminSosmedResellerRepriceResult {
  mode: 'fixed' | 'live' | string
  rate_source: string
  rate_used: number
  warning?: string
  code_prefix: string
  include_inactive: boolean
  dry_run: boolean
  total: number
  eligible: number
  updated: number
  skipped: number
}

export const sosmedService = {
  list: async () => {
    const res = await api.get<ApiResponse<SosmedService[]>>('/public/sosmed/services')
    return res.data
  },

  adminList: async (params?: { include_inactive?: boolean }) => {
    const res = await api.get<ApiResponse<SosmedService[]>>('/admin/sosmed/services', { params })
    return res.data
  },

  adminCreate: async (data: AdminSosmedServicePayload) => {
    const res = await api.post<ApiResponse<SosmedService>>('/admin/sosmed/services', data)
    return res.data
  },

  adminUpdate: async (id: string, data: AdminSosmedServiceUpdatePayload) => {
    const res = await api.put<ApiResponse<SosmedService>>(`/admin/sosmed/services/${id}`, data)
    return res.data
  },

  adminDelete: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/sosmed/services/${id}`)
    return res.data
  },

  adminRepriceReseller: async (data: AdminSosmedResellerRepricePayload) => {
    const res = await api.post<ApiResponse<AdminSosmedResellerRepriceResult>>(
      '/admin/sosmed/services/reprice-reseller',
      data
    )
    return res.data
  },
}
