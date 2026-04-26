import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'

export type UserSidebarMenuSettingKey =
  | 'convert_history'
  | 'active_accounts'
  | 'order_history'
  | 'warranty_claim'

export interface UserSidebarMenuSetting {
  key: UserSidebarMenuSettingKey
  label: string
  href: string
  sort_order: number
  is_visible: boolean
  is_system: boolean
  created_at?: string
  updated_at?: string
}

export interface UpdateUserSidebarMenuSettingItem {
  key: UserSidebarMenuSettingKey
  is_visible: boolean
}

export const userSidebarMenuSettingService = {
  list: async () => {
    const res = await api.get<ApiResponse<UserSidebarMenuSetting[]>>('/me/sidebar-menu')
    return res.data
  },

  adminList: async () => {
    const res = await api.get<ApiResponse<UserSidebarMenuSetting[]>>('/admin/settings/user-sidebar-menu')
    return res.data
  },

  adminUpdate: async (items: UpdateUserSidebarMenuSettingItem[]) => {
    const res = await api.put<ApiResponse<UserSidebarMenuSetting[]>>('/admin/settings/user-sidebar-menu', { items })
    return res.data
  },
}
