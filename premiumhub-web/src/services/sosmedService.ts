import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { SosmedPromotionPrice, SosmedService } from '@/types/sosmedService'

export interface AdminSosmedServicePayload {
  category_code: string
  code: string
  title: string
  provider_code?: string
  provider_service_id?: string
  provider_title?: string
  provider_category?: string
  provider_type?: string
  provider_rate?: string
  provider_currency?: string
  provider_refill_supported?: boolean
  provider_cancel_supported?: boolean
  provider_dripfeed_supported?: boolean
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
  provider_code?: string
  provider_service_id?: string
  provider_title?: string
  provider_category?: string
  provider_type?: string
  provider_rate?: string
  provider_currency?: string
  provider_refill_supported?: boolean
  provider_cancel_supported?: boolean
  provider_dripfeed_supported?: boolean
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
  provider_code?: string
  dry_run?: boolean
}

export interface AdminSosmedResellerRepriceResult {
  mode: 'fixed' | 'live' | string
  rate_source: string
  rate_used: number
  warning?: string
  code_prefix: string
  provider_code: string
  include_inactive: boolean
  dry_run: boolean
  total: number
  eligible: number
  updated: number
  skipped: number
}

export type AdminSosmedPromotionTargetType = 'service' | 'bundle_variant'
export type AdminSosmedPromotionDiscountType = 'percent' | 'amount'

export interface AdminSosmedPromotion extends SosmedPromotionPrice {
  target_type: AdminSosmedPromotionTargetType
  target_id: string
  service_id?: string
  bundle_variant_id?: string
  service_title?: string
  bundle_title?: string
  variant_name?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface AdminSosmedPromotionPayload {
  name: string
  target_type: AdminSosmedPromotionTargetType
  target_id: string
  discount_type: AdminSosmedPromotionDiscountType
  discount_value: number
  starts_at: string
  ends_at: string
  is_active?: boolean
}

interface AdminSosmedPromotionApiPayload extends Omit<AdminSosmedPromotionPayload, 'target_id'> {
  service_id?: string
  bundle_variant_id?: string
}

function toAdminSosmedPromotionApiPayload(data: AdminSosmedPromotionPayload): AdminSosmedPromotionApiPayload {
  const { target_id: targetId, ...payload } = data
  return data.target_type === 'bundle_variant'
    ? { ...payload, bundle_variant_id: targetId }
    : { ...payload, service_id: targetId }
}

function normalizeAdminSosmedPromotion(item: AdminSosmedPromotion): AdminSosmedPromotion {
  return {
    ...item,
    target_id: item.target_id || item.service_id || item.bundle_variant_id || '',
  }
}

export interface AdminSosmedImportJAPPayload {
  service_ids: number[]
}

export interface AdminSosmedImportJAPPreviewItem {
  service_id: string
  provider_name: string
  provider_category: string
  provider_type: string
  provider_rate: string
  provider_currency: string
  min: string
  max: string
  refill_supported: boolean
  cancel_supported: boolean
  dripfeed_supported: boolean
  local_code: string
  local_title: string
  local_category_code: string
  platform_label: string
  price_start: string
  price_per_1k: string
  start_time: string
  eta: string
  refill: string
  fulfillment_mode: string
  required_order_fields: string[]
  optional_order_fields: string[]
  supported_for_initial_order: boolean
  existing_id?: string
  existing_code?: string
  existing_active?: boolean
  warnings: string[]
}

export interface AdminSosmedImportJAPPreviewResult {
  mode: string
  rate_source: string
  rate_used: number
  warning?: string
  requested: number
  matched: number
  not_found: string[]
  items: AdminSosmedImportJAPPreviewItem[]
}

export interface AdminSosmedImportJAPResult {
  mode: string
  rate_source: string
  rate_used: number
  warning?: string
  requested: number
  created: number
  updated: number
  skipped: number
  not_found: string[]
  items: SosmedService[]
}

export interface AdminJAPBalance {
  balance: string
  currency: string
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

  adminGetJAPBalance: async () => {
    const res = await api.get<ApiResponse<AdminJAPBalance>>('/admin/sosmed/provider/jap/balance')
    return res.data
  },

  adminListJAPCatalogOptions: async () => {
    const res = await api.get<ApiResponse<AdminSosmedImportJAPPreviewResult>>('/admin/sosmed/services/jap-catalog-options')
    return res.data
  },

  adminListPromotions: async () => {
    const res = await api.get<ApiResponse<AdminSosmedPromotion[]>>('/admin/sosmed/promotions')
    return {
      ...res.data,
      data: (res.data.data || []).map(normalizeAdminSosmedPromotion),
    }
  },

  adminCreatePromotion: async (data: AdminSosmedPromotionPayload) => {
    const res = await api.post<ApiResponse<AdminSosmedPromotion>>(
      '/admin/sosmed/promotions',
      toAdminSosmedPromotionApiPayload(data)
    )
    return {
      ...res.data,
      data: res.data.data ? normalizeAdminSosmedPromotion(res.data.data) : res.data.data,
    }
  },

  adminUpdatePromotion: async (id: string, data: AdminSosmedPromotionPayload) => {
    const res = await api.put<ApiResponse<AdminSosmedPromotion>>(
      `/admin/sosmed/promotions/${id}`,
      toAdminSosmedPromotionApiPayload(data)
    )
    return {
      ...res.data,
      data: res.data.data ? normalizeAdminSosmedPromotion(res.data.data) : res.data.data,
    }
  },

  adminSetPromotionStatus: async (id: string, is_active: boolean) => {
    const res = await api.patch<ApiResponse<AdminSosmedPromotion>>(`/admin/sosmed/promotions/${id}/status`, { is_active })
    return {
      ...res.data,
      data: res.data.data ? normalizeAdminSosmedPromotion(res.data.data) : res.data.data,
    }
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

  adminPreviewJAPSelected: async (data: AdminSosmedImportJAPPayload) => {
    const res = await api.post<ApiResponse<AdminSosmedImportJAPPreviewResult>>(
      '/admin/sosmed/services/preview-jap-selected',
      data
    )
    return res.data
  },

  adminImportJAPSelected: async (data: AdminSosmedImportJAPPayload) => {
    const res = await api.post<ApiResponse<AdminSosmedImportJAPResult>>(
      '/admin/sosmed/services/import-jap-selected',
      data
    )
    return res.data
  },

  adminSyncJAPMetadata: async () => {
    const res = await api.post<ApiResponse<{ updated: number }>>(
      '/admin/sosmed/provider/jap/sync-metadata'
    )
    return res.data
  },
}
