import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { SiteBanner } from '@/types/banner'

export const bannerService = {
  getPublicBanners: async () => {
    const res = await api.get<ApiResponse<SiteBanner[]>>('/public/banners')
    return res.data
  },

  adminList: async () => {
    const res = await api.get<ApiResponse<SiteBanner[]>>('/admin/banners')
    return res.data
  },

  adminCreate: async (data: Partial<SiteBanner>) => {
    const res = await api.post<ApiResponse<SiteBanner>>('/admin/banners', data)
    return res.data
  },

  adminUpdate: async (id: string, data: Partial<SiteBanner>) => {
    const res = await api.put<ApiResponse<SiteBanner>>(`/admin/banners/${id}`, data)
    return res.data
  },

  adminDelete: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/banners/${id}`)
    return res.data
  },

  adminUploadImage: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<ApiResponse<{ url: string }>>('/admin/banners/upload-image', formData)
    return res.data
  },
}
