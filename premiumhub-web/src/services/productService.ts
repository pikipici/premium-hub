import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Product, ProductPrice } from '@/types/product'

export interface AdminProductPayload {
  name: string
  slug?: string
  category: string
  description?: string
  icon?: string
  color?: string
  is_popular?: boolean
  is_active?: boolean
}

export interface AdminProductPricePayload {
  duration: number
  account_type: ProductPrice['account_type']
  price: number
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

  adminCreatePrice: async (productId: string, data: AdminProductPricePayload) => {
    const res = await api.post<ApiResponse<ProductPrice>>(`/admin/products/${productId}/prices`, data)
    return res.data
  },

  adminUpdatePrice: async (productId: string, priceId: string, data: Partial<AdminProductPricePayload>) => {
    const res = await api.put<ApiResponse<ProductPrice>>(`/admin/products/${productId}/prices/${priceId}`, data)
    return res.data
  },

  adminDeletePrice: async (productId: string, priceId: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/products/${productId}/prices/${priceId}`)
    return res.data
  },
}
