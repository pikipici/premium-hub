import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { SosmedHeroSlide } from '@/types/sosmedHeroSlide'

export const sosmedHeroSlideService = {
  getPublic: async () => {
    const res = await api.get<ApiResponse<SosmedHeroSlide | null>>('/public/sosmed-hero')
    return res.data
  },

  adminGet: async () => {
    const res = await api.get<ApiResponse<SosmedHeroSlide | null>>('/admin/sosmed-hero')
    return res.data
  },

  adminSave: async (data: Partial<SosmedHeroSlide>) => {
    const res = await api.put<ApiResponse<SosmedHeroSlide>>('/admin/sosmed-hero', data)
    return res.data
  },

  adminUploadImage: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<ApiResponse<{ url: string }>>('/admin/sosmed-hero/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
