import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  FiveSimBuyActivationPayload,
  FiveSimBuyHostingPayload,
  FiveSimCountriesPayload,
  FiveSimMutateResponse,
  FiveSimOrder,
  FiveSimPricesPayload,
  FiveSimProductsPayload,
  FiveSimReusePayload,
  FiveSimSMS,
} from '@/types/fiveSim'

interface OrderListParams {
  page?: number
  limit?: number
}

export const fiveSimService = {
  getCountries: async () => {
    const res = await api.get<ApiResponse<FiveSimCountriesPayload>>('/5sim/catalog/countries')
    return res.data
  },

  getProducts: async (params: { country: string; operator?: string }) => {
    const res = await api.get<ApiResponse<FiveSimProductsPayload>>('/5sim/catalog/products', {
      params: { country: params.country, operator: params.operator || 'any' },
    })
    return res.data
  },

  getPrices: async (params: { country: string; product: string }) => {
    const res = await api.get<ApiResponse<FiveSimPricesPayload>>('/5sim/catalog/prices', {
      params,
    })
    return res.data
  },

  listOrders: async (params?: OrderListParams) => {
    const res = await api.get<ApiResponse<FiveSimOrder[]>>('/5sim/orders', { params })
    return res.data
  },

  buyActivation: async (payload: FiveSimBuyActivationPayload) => {
    const res = await api.post<ApiResponse<FiveSimMutateResponse>>('/5sim/orders/activation', payload)
    return res.data
  },

  buyHosting: async (payload: FiveSimBuyHostingPayload) => {
    const res = await api.post<ApiResponse<FiveSimMutateResponse>>('/5sim/orders/hosting', payload)
    return res.data
  },

  reuseNumber: async (payload: FiveSimReusePayload) => {
    const res = await api.post<ApiResponse<FiveSimMutateResponse>>('/5sim/orders/reuse', payload)
    return res.data
  },

  checkOrder: async (providerOrderID: number) => {
    const res = await api.get<ApiResponse<FiveSimMutateResponse>>(`/5sim/orders/${providerOrderID}`)
    return res.data
  },

  finishOrder: async (providerOrderID: number) => {
    const res = await api.post<ApiResponse<FiveSimMutateResponse>>(`/5sim/orders/${providerOrderID}/finish`)
    return res.data
  },

  cancelOrder: async (providerOrderID: number) => {
    const res = await api.post<ApiResponse<FiveSimMutateResponse>>(`/5sim/orders/${providerOrderID}/cancel`)
    return res.data
  },

  banOrder: async (providerOrderID: number) => {
    const res = await api.post<ApiResponse<FiveSimMutateResponse>>(`/5sim/orders/${providerOrderID}/ban`)
    return res.data
  },

  getSMSInbox: async (providerOrderID: number) => {
    const res = await api.get<ApiResponse<Record<string, unknown> | { sms: FiveSimSMS[] }>>(
      `/5sim/orders/${providerOrderID}/sms-inbox`
    )
    return res.data
  },
}
