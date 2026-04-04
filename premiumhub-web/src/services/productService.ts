import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Product } from '@/types/product'

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
}
