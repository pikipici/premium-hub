import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { SiteHeroBg } from '@/types/heroBg'

export const heroBgService = {
  getPublicHeroBg: async (pageKey: string) => {
    const res = await api.get<ApiResponse<SiteHeroBg | null>>('/public/hero-bg', { params: { page_key: pageKey } })
    return res.data
  },

  adminGetHeroBg: async (pageKey: string) => {
    const res = await api.get<ApiResponse<SiteHeroBg | null>>('/admin/hero-bg', { params: { page_key: pageKey } })
    return res.data
  },

  adminSaveHeroBg: async (data: Partial<SiteHeroBg>) => {
    const res = await api.put<ApiResponse<SiteHeroBg>>('/admin/hero-bg', data)
    return res.data
  },
}
