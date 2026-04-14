import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Claim } from '@/types/order'

export type AdminClaimStatus = 'pending' | 'approved' | 'rejected'

export const claimService = {
  create: async (data: { order_id: string; reason: string; description: string; screenshot_url?: string }) => {
    const res = await api.post<ApiResponse<Claim>>('/claims', data)
    return res.data
  },

  list: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<Claim[]>>('/claims', { params })
    return res.data
  },

  getByID: async (id: string) => {
    const res = await api.get<ApiResponse<Claim>>(`/claims/${id}`)
    return res.data
  },

  adminList: async (params?: { page?: number; limit?: number; status?: AdminClaimStatus }) => {
    const res = await api.get<ApiResponse<Claim[]>>('/admin/claims', { params })
    return res.data
  },

  adminApprove: async (id: string, data?: { admin_note?: string }) => {
    const res = await api.put<ApiResponse<null>>(`/admin/claims/${id}/approve`, data)
    return res.data
  },

  adminReject: async (id: string, data?: { admin_note?: string }) => {
    const res = await api.put<ApiResponse<null>>(`/admin/claims/${id}/reject`, data)
    return res.data
  },
}
