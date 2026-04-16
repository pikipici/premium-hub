import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { ProductCategory, ProductCategoryScope } from '@/types/productCategory'

export interface AdminProductCategoryPayload {
  scope: ProductCategoryScope
  code: string
  label: string
  description?: string
  sort_order?: number
  is_active?: boolean
}

export interface AdminProductCategoryUpdatePayload {
  scope?: ProductCategoryScope
  code?: string
  label?: string
  description?: string
  sort_order?: number
  is_active?: boolean
}

export const productCategoryService = {
  list: async (params?: { scope?: ProductCategoryScope; include_inactive?: boolean }) => {
    const res = await api.get<ApiResponse<ProductCategory[]>>('/product-categories', { params })
    return res.data
  },

  adminList: async (params?: { scope?: ProductCategoryScope; include_inactive?: boolean }) => {
    const res = await api.get<ApiResponse<ProductCategory[]>>('/admin/product-categories', { params })
    return res.data
  },

  adminCreate: async (data: AdminProductCategoryPayload) => {
    const res = await api.post<ApiResponse<ProductCategory>>('/admin/product-categories', data)
    return res.data
  },

  adminUpdate: async (id: string, data: AdminProductCategoryUpdatePayload) => {
    const res = await api.put<ApiResponse<ProductCategory>>(`/admin/product-categories/${id}`, data)
    return res.data
  },

  adminDelete: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/product-categories/${id}`)
    return res.data
  },
}
