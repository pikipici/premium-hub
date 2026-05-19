import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  BuyPayload,
  CreateClaimPayload,
  GmailAvailability,
  GmailBuyResult,
  GmailClaim,
  GmailClaimResult,
  GmailOrder,
  GmailOrderDetail,
  GmailPricingPreview,
  GmailSlot,
  GmailSlotResponse,
} from '@/types/gmail'

interface ListParams {
  page?: number
  limit?: number
}

export const gmailService = {
  // ----- public -----
  // Pricing + availability are public (no auth) so landing pages can
  // pre-render. Cache 60s on the network layer.
  getPricing: async () => {
    const res = await api.get<ApiResponse<GmailPricingPreview>>(
      '/public/gmail/pricing',
    )
    return res.data
  },
  getAvailability: async () => {
    const res = await api.get<ApiResponse<GmailAvailability>>(
      '/public/gmail/availability',
    )
    return res.data
  },

  // ----- sell-side -----
  requestSlot: async () => {
    const res = await api.post<ApiResponse<GmailSlotResponse>>('/gmail/slots')
    return res.data
  },
  submitSlot: async (id: string) => {
    const res = await api.post<ApiResponse<GmailSlot>>(
      `/gmail/slots/${id}/submit`,
    )
    return res.data
  },
  listMySlots: async (params?: ListParams) => {
    const res = await api.get<ApiResponse<GmailSlot[]>>('/gmail/slots', {
      params,
    })
    return res.data
  },
  getMySlot: async (id: string) => {
    const res = await api.get<ApiResponse<GmailSlot>>(`/gmail/slots/${id}`)
    return res.data
  },

  // ----- buy-side -----
  buy: async (payload: BuyPayload) => {
    const res = await api.post<ApiResponse<GmailBuyResult>>(
      '/gmail/buy',
      payload,
    )
    return res.data
  },
  listMyOrders: async (params?: ListParams) => {
    const res = await api.get<ApiResponse<GmailOrder[]>>('/gmail/orders', {
      params,
    })
    return res.data
  },
  getMyOrder: async (id: string) => {
    const res = await api.get<ApiResponse<GmailOrderDetail>>(
      `/gmail/orders/${id}`,
    )
    return res.data
  },

  // ----- warranty -----
  createClaim: async (orderID: string, payload: CreateClaimPayload) => {
    const res = await api.post<ApiResponse<GmailClaimResult>>(
      `/gmail/orders/${orderID}/claims`,
      payload,
    )
    return res.data
  },
  listClaims: async (orderID: string) => {
    const res = await api.get<ApiResponse<{ items: GmailClaim[] }>>(
      `/gmail/orders/${orderID}/claims`,
    )
    return res.data
  },
}
