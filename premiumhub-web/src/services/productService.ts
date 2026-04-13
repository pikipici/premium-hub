import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  Product,
  ProductFAQItem,
  ProductPrice,
  ProductSpecItem,
  ProductTrustBadge,
} from '@/types/product'

export interface AdminProductPayload {
  name: string
  slug?: string
  category: string
  description?: string
  tagline?: string
  icon?: string
  icon_image_url?: string
  color?: string
  hero_bg_url?: string
  badge_popular_text?: string
  badge_guarantee_text?: string
  sold_text?: string
  shared_note?: string
  private_note?: string
  feature_items?: string[]
  spec_items?: ProductSpecItem[]
  trust_items?: string[]
  trust_badges?: ProductTrustBadge[]
  faq_items?: ProductFAQItem[]
  price_original_text?: string
  price_per_day_text?: string
  discount_badge_text?: string
  show_whatsapp_button?: boolean
  whatsapp_number?: string
  whatsapp_button_text?: string
  seo_description?: string
  sort_priority?: number
  is_popular?: boolean
  is_active?: boolean
}

export interface AdminProductPricePayload {
  duration: number
  account_type: ProductPrice['account_type']
  label?: string
  savings_text?: string
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

  adminDeletePermanent: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/products/${id}/permanent`)
    return res.data
  },

  adminCreatePrice: async (productId: string, data: AdminProductPricePayload) => {
    const res = await api.post<ApiResponse<ProductPrice>>(`/admin/products/${productId}/prices`, data)
    return res.data
  },

  adminUpdatePrice: async (
    productId: string,
    priceId: string,
    data: Partial<AdminProductPricePayload>
  ) => {
    const res = await api.put<ApiResponse<ProductPrice>>(
      `/admin/products/${productId}/prices/${priceId}`,
      data
    )
    return res.data
  },

  adminDeletePrice: async (productId: string, priceId: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/products/${productId}/prices/${priceId}`)
    return res.data
  },

  adminUploadAsset: async (productId: string, kind: 'icon' | 'hero', file: File) => {
    const formData = new FormData()
    formData.append('kind', kind)
    formData.append('file', file)

    const res = await api.post<ApiResponse<{ url: string }>>(`/admin/products/${productId}/assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
