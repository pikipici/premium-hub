import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { AccountType } from '@/types/accountType'

export interface AdminAccountTypePayload {
  code: string
  label: string
  description?: string
  sort_order?: number
  badge_bg_color?: string
  badge_text_color?: string
  is_active?: boolean
}

export interface AdminAccountTypeUpdatePayload {
  code?: string
  label?: string
  description?: string
  sort_order?: number
  badge_bg_color?: string
  badge_text_color?: string
  is_active?: boolean
}

export const accountTypeService = {
  list: async (params?: { include_inactive?: boolean }) => {
    const res = await api.get<ApiResponse<AccountType[]>>('/account-types', { params })
    return res.data
  },

  adminList: async (params?: { include_inactive?: boolean }) => {
    const res = await api.get<ApiResponse<AccountType[]>>('/admin/account-types', { params })
    return res.data
  },

  adminCreate: async (data: AdminAccountTypePayload) => {
    const res = await api.post<ApiResponse<AccountType>>('/admin/account-types', data)
    return res.data
  },

  adminUpdate: async (id: string, data: AdminAccountTypeUpdatePayload) => {
    const res = await api.put<ApiResponse<AccountType>>(`/admin/account-types/${id}`, data)
    return res.data
  },

  adminDelete: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/account-types/${id}`)
    return res.data
  },
}
