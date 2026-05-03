import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  AdminSosmedBundleItem,
  AdminSosmedBundleListParams,
  AdminSosmedBundlePackage,
  AdminSosmedBundleVariant,
  CreateAdminSosmedBundleItemPayload,
  CreateAdminSosmedBundlePackagePayload,
  CreateAdminSosmedBundleVariantPayload,
  CreateSosmedBundleOrderPayload,
  SosmedBundleOrder,
  SosmedBundlePackage,
  UpdateAdminSosmedBundleItemPayload,
  UpdateAdminSosmedBundlePackagePayload,
  UpdateAdminSosmedBundleVariantPayload,
} from '@/types/sosmedBundle'

export const sosmedBundleService = {
  list: async () => {
    const res = await api.get<ApiResponse<SosmedBundlePackage[]>>('/public/sosmed/bundles')
    return res.data
  },

  getByKey: async (key: string) => {
    const res = await api.get<ApiResponse<SosmedBundlePackage>>(`/public/sosmed/bundles/${key}`)
    return res.data
  },

  createOrder: async (payload: CreateSosmedBundleOrderPayload) => {
    const res = await api.post<ApiResponse<SosmedBundleOrder>>('/sosmed/bundle-orders', payload)
    return res.data
  },

  getOrderByNumber: async (orderNumber: string) => {
    const res = await api.get<ApiResponse<SosmedBundleOrder>>(`/sosmed/bundle-orders/${orderNumber}`)
    return res.data
  },

  adminList: async (params: AdminSosmedBundleListParams = {}) => {
    const res = await api.get<ApiResponse<AdminSosmedBundlePackage[]>>('/admin/sosmed/bundles', { params })
    return res.data
  },

  adminCreatePackage: async (payload: CreateAdminSosmedBundlePackagePayload) => {
    const res = await api.post<ApiResponse<AdminSosmedBundlePackage>>('/admin/sosmed/bundles', payload)
    return res.data
  },

  adminUpdatePackage: async (id: string, payload: UpdateAdminSosmedBundlePackagePayload) => {
    const res = await api.put<ApiResponse<AdminSosmedBundlePackage>>(`/admin/sosmed/bundles/${id}`, payload)
    return res.data
  },

  adminDeletePackage: async (id: string) => {
    const res = await api.delete<ApiResponse<AdminSosmedBundlePackage>>(`/admin/sosmed/bundles/${id}`)
    return res.data
  },

  adminCreateVariant: async (packageId: string, payload: CreateAdminSosmedBundleVariantPayload) => {
    const res = await api.post<ApiResponse<AdminSosmedBundleVariant>>(
      `/admin/sosmed/bundles/${packageId}/variants`,
      payload
    )
    return res.data
  },

  adminUpdateVariant: async (variantId: string, payload: UpdateAdminSosmedBundleVariantPayload) => {
    const res = await api.put<ApiResponse<AdminSosmedBundleVariant>>(
      `/admin/sosmed/bundle-variants/${variantId}`,
      payload
    )
    return res.data
  },

  adminDeleteVariant: async (variantId: string) => {
    const res = await api.delete<ApiResponse<AdminSosmedBundleVariant>>(`/admin/sosmed/bundle-variants/${variantId}`)
    return res.data
  },

  adminCreateItem: async (variantId: string, payload: CreateAdminSosmedBundleItemPayload) => {
    const res = await api.post<ApiResponse<AdminSosmedBundleItem>>(
      `/admin/sosmed/bundle-variants/${variantId}/items`,
      payload
    )
    return res.data
  },

  adminUpdateItem: async (itemId: string, payload: UpdateAdminSosmedBundleItemPayload) => {
    const res = await api.put<ApiResponse<AdminSosmedBundleItem>>(`/admin/sosmed/bundle-items/${itemId}`, payload)
    return res.data
  },

  adminDeleteItem: async (itemId: string) => {
    const res = await api.delete<ApiResponse<AdminSosmedBundleItem>>(`/admin/sosmed/bundle-items/${itemId}`)
    return res.data
  },
}
