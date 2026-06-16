import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { SiteFlashSale } from '@/types/flashSale'

export const flashSaleService = {
  getPublicActive: async () => {
    const res = await api.get<ApiResponse<SiteFlashSale[]>>('/public/flash-sale')
    return res.data
  },

  adminList: async () => {
    const res = await api.get<ApiResponse<SiteFlashSale[]>>('/admin/flash-sale')
    return res.data
  },

  adminCreate: async (data: Partial<SiteFlashSale>) => {
    const res = await api.post<ApiResponse<SiteFlashSale>>('/admin/flash-sale', data)
    return res.data
  },

  adminUpdate: async (id: string, data: Partial<SiteFlashSale>) => {
    const res = await api.put<ApiResponse<SiteFlashSale>>(`/admin/flash-sale/${id}`, data)
    return res.data
  },

  adminDelete: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/flash-sale/${id}`)
    return res.data
  },
}
