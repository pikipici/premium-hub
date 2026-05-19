import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { WalletWithdrawal } from '@/types/walletWithdrawal'

interface AdminListParams {
  page?: number
  limit?: number
  status?: string
  user_id?: string
}

export const adminWalletWithdrawalService = {
  list: async (params?: AdminListParams) => {
    const res = await api.get<ApiResponse<WalletWithdrawal[]>>('/admin/wallet/withdrawals', {
      params,
    })
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<WalletWithdrawal>>(`/admin/wallet/withdrawals/${id}`)
    return res.data
  },

  approve: async (id: string, note?: string) => {
    const res = await api.post<ApiResponse<WalletWithdrawal>>(
      `/admin/wallet/withdrawals/${id}/approve`,
      { note },
    )
    return res.data
  },

  reject: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<WalletWithdrawal>>(
      `/admin/wallet/withdrawals/${id}/reject`,
      { reason },
    )
    return res.data
  },

  markProcessing: async (id: string) => {
    const res = await api.post<ApiResponse<WalletWithdrawal>>(
      `/admin/wallet/withdrawals/${id}/mark-processing`,
    )
    return res.data
  },

  markPaid: async (id: string, payoutRailKind?: string, payoutRailRef?: string) => {
    const res = await api.post<ApiResponse<WalletWithdrawal>>(
      `/admin/wallet/withdrawals/${id}/mark-paid`,
      { payout_rail_kind: payoutRailKind, payout_rail_ref: payoutRailRef },
    )
    return res.data
  },

  markFailed: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<WalletWithdrawal>>(
      `/admin/wallet/withdrawals/${id}/mark-failed`,
      { reason },
    )
    return res.data
  },
}
