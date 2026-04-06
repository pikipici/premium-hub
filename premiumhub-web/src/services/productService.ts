import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Product } from '@/types/product'

export interface AdminProductPayload {
  name: string
  category: string
  description?: string
  icon?: string
  color?: string
  is_popular?: boolean
  is_active?: boolean
}

export const productService = {
  list: async (params?: { category?: string; page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<Product[]>>('/products', { params })
    return res.data
  },

  getBySlug: async (slug: string) => {
    const res = await api.get<ApiResponse<Product>>(`/products/${slug}`)
    return res.data
  },

  getPrices: async (slug: string) => {
    const res = await api.get<ApiResponse<Product['prices']>>(`/products/${slug}/prices`)
    return res.data
  },

  adminList: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<Product[]>>('/admin/products', { params })
    return res.data
  },

  adminCreate: async (data: AdminProductPayload) => {
    const res = await api.post<ApiResponse<Product>>('/admin/products', data)
    return res.data
  },

  adminUpdate: async (id: string, data: Partial<AdminProductPayload>) => {
    const res = await api.put<ApiResponse<Product>>(`/admin/products/${id}`, data)
    return res.data
  },

  adminDelete: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/products/${id}`)
    return res.data
  },
}
