import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  GmailAccount,
  GmailAdminAnalytics,
  GmailAdminInventoryListResponse,
  GmailAdminPricing,
  GmailAdminPricingUpdate,
  GmailAdminStrikedUser,
  GmailVerifyPayload,
  GmailRejectPayload,
} from '@/types/gmailAdmin'

// Admin-side Gmail marketplace API. All methods unwrap axios response,
// return ApiResponse<T> directly so callers access .data + .meta.
export const gmailAdminService = {
  // ----- Verify queue (Round 1) -----
  listPendingVerify: async (params: { page?: number; limit?: number } = {}) => {
    const res = await api.get<ApiResponse<{ items: GmailAccount[] }>>('/admin/gmail', { params })
    return res.data
  },

  getByID: async (id: string) => {
    const res = await api.get<ApiResponse<GmailAccount>>(`/admin/gmail/${id}`)
    return res.data
  },

  getCredentials: async (id: string) => {
    const res = await api.get<ApiResponse<{ email: string; password: string }>>(
      `/admin/gmail/${id}/credentials`,
    )
    return res.data
  },

  verify: async (id: string, payload: GmailVerifyPayload) => {
    const res = await api.post<ApiResponse<GmailAccount>>(`/admin/gmail/${id}/verify`, payload)
    return res.data
  },

  reject: async (id: string, payload: GmailRejectPayload) => {
    const res = await api.post<ApiResponse<GmailAccount>>(`/admin/gmail/${id}/reject`, payload)
    return res.data
  },

  // ----- Inventory browser (Round 5) -----
  listInventory: async (params: { status?: string; page?: number; limit?: number } = {}) => {
    const res = await api.get<ApiResponse<GmailAdminInventoryListResponse>>(
      '/admin/gmail-inventory',
      { params },
    )
    return res.data
  },

  // ----- Pricing config (Round 5) -----
  getPricing: async () => {
    const res = await api.get<ApiResponse<GmailAdminPricing>>('/admin/gmail-pricing')
    return res.data
  },

  updatePricing: async (payload: GmailAdminPricingUpdate) => {
    const res = await api.put<ApiResponse<GmailAdminPricing>>('/admin/gmail-pricing', payload)
    return res.data
  },

  // ----- Strike management (Round 5) -----
  listStrikedUsers: async () => {
    const res = await api.get<ApiResponse<{ items: GmailAdminStrikedUser[] }>>(
      '/admin/gmail-strikes',
    )
    return res.data
  },

  resetStrikes: async (userID: string) => {
    const res = await api.post<ApiResponse<null>>(`/admin/gmail-strikes/${userID}/reset`)
    return res.data
  },

  // ----- Analytics (Round 5) -----
  analytics: async (weeks: number = 8) => {
    const res = await api.get<ApiResponse<GmailAdminAnalytics>>('/admin/gmail-analytics', {
      params: { weeks },
    })
    return res.data
  },
}
