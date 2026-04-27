import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'

export type NavbarMenuSettingKey =
  | 'apps'
  | 'convert_asset'
  | 'nomor_virtual'
  | 'sosmed'

export interface NavbarMenuSetting {
  key: NavbarMenuSettingKey
  label: string
  href: string
  sort_order: number
  is_visible: boolean
  is_system: boolean
  created_at?: string
  updated_at?: string
}

export interface UpdateNavbarMenuSettingItem {
  key: NavbarMenuSettingKey
  is_visible: boolean
}

export const navbarMenuSettingService = {
  publicList: async () => {
    const res = await api.get<ApiResponse<NavbarMenuSetting[]>>('/public/navbar-menu')
    return res.data
  },

  adminList: async () => {
    const res = await api.get<ApiResponse<NavbarMenuSetting[]>>('/admin/settings/navbar-menu')
    return res.data
  },

  adminUpdate: async (items: UpdateNavbarMenuSettingItem[]) => {
    const res = await api.put<ApiResponse<NavbarMenuSetting[]>>('/admin/settings/navbar-menu', { items })
    return res.data
  },
}
