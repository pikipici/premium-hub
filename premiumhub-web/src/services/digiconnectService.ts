import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  DigiConnectAdminOverview,
  DigiConnectApiKey,
  DigiConnectCheckoutPayload,
  DigiConnectDashboard,
  DigiConnectEntitlement,
  DigiConnectListParams,
  DigiConnectPlansView,
  DigiConnectProvisionEntitlementPayload,
  DigiConnectRequest,
  DigiConnectSummary,
} from '@/types/digiconnect'

export const digiconnectService = {
  publicPlans: async () => {
    const res = await api.get<ApiResponse<DigiConnectPlansView>>('/public/digiconnect/plans')
    return res.data
  },

  checkoutWithWallet: async (payload: DigiConnectCheckoutPayload) => {
    const res = await api.post<ApiResponse<DigiConnectEntitlement>>('/digiconnect/checkout', payload)
    return res.data
  },

  getSummary: async () => {
    const res = await api.get<ApiResponse<DigiConnectSummary>>('/digiconnect/summary')
    return res.data
  },

  getDashboard: async () => {
    const res = await api.get<ApiResponse<DigiConnectDashboard>>('/digiconnect/dashboard')
    return res.data
  },

  listApiKeys: async () => {
    const res = await api.get<ApiResponse<DigiConnectApiKey[]>>('/digiconnect/api-keys')
    return res.data
  },

  createApiKey: async (name: string) => {
    const res = await api.post<ApiResponse<DigiConnectApiKey>>('/digiconnect/api-keys', { name })
    return res.data
  },

  listEntitlements: async () => {
    const res = await api.get<ApiResponse<DigiConnectEntitlement[]>>('/digiconnect/entitlements')
    return res.data
  },

  listRequests: async (params?: DigiConnectListParams) => {
    const res = await api.get<ApiResponse<DigiConnectRequest[]>>('/digiconnect/requests', { params })
    return res.data
  },

  adminOverview: async () => {
    const res = await api.get<ApiResponse<DigiConnectAdminOverview>>('/admin/digiconnect/overview')
    return res.data
  },

  adminListRequests: async (params?: DigiConnectListParams) => {
    const res = await api.get<ApiResponse<DigiConnectRequest[]>>('/admin/digiconnect/requests', { params })
    return res.data
  },

  adminListEntitlements: async (params?: DigiConnectListParams) => {
    const res = await api.get<ApiResponse<DigiConnectEntitlement[]>>('/admin/digiconnect/entitlements', { params })
    return res.data
  },

  adminProvisionEntitlement: async (payload: DigiConnectProvisionEntitlementPayload) => {
    const res = await api.post<ApiResponse<DigiConnectEntitlement>>('/admin/digiconnect/entitlements', payload)
    return res.data
  },
}
