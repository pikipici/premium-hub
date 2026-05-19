import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  CreateWithdrawalPayload,
  WalletWithdrawal,
  WithdrawalDestinationsResponse,
} from '@/types/walletWithdrawal'

interface ListParams {
  page?: number
  limit?: number
}

export const walletWithdrawalService = {
  // Static destinations + policy. Cache aggressively on FE — server
  // payload is essentially const for a given deploy.
  getDestinations: async () => {
    const res = await api.get<ApiResponse<WithdrawalDestinationsResponse>>(
      '/wallet/withdrawals/destinations',
    )
    return res.data
  },

  create: async (payload: CreateWithdrawalPayload) => {
    const res = await api.post<ApiResponse<WalletWithdrawal>>(
      '/wallet/withdrawals',
      payload,
    )
    return res.data
  },

  listMine: async (params?: ListParams) => {
    const res = await api.get<ApiResponse<WalletWithdrawal[]>>(
      '/wallet/withdrawals',
      { params },
    )
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<WalletWithdrawal>>(
      `/wallet/withdrawals/${id}`,
    )
    return res.data
  },

  cancel: async (id: string) => {
    const res = await api.post<ApiResponse<WalletWithdrawal>>(
      `/wallet/withdrawals/${id}/cancel`,
    )
    return res.data
  },
}
