import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Wallet, WalletBalance, WalletLedger, WalletListParams, WalletTopup } from '@/types/wallet'

interface CreateTopupPayload {
  amount: number
  idempotencyKey?: string
  paymentMethod?: string
}

export const walletService = {
  getBalance: async () => {
    const res = await api.get<ApiResponse<WalletBalance>>('/wallet/balance')
    return res.data
  },

  getWallet: async (): Promise<Wallet> => {
    const res = await api.get<ApiResponse<WalletBalance>>('/wallet/balance')
    return {
      balance: res.data.data.balance,
      total_topup: 0,
      total_spent: 0,
      updated_at: new Date().toISOString(),
    }
  },

  createTopup: async ({ amount, idempotencyKey, paymentMethod }: CreateTopupPayload) => {
    const res = await api.post<ApiResponse<WalletTopup>>(
      '/wallet/topups',
      { amount, idempotency_key: idempotencyKey, payment_method: paymentMethod },
      {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }
    )
    return res.data
  },

  listTopups: async (params?: WalletListParams) => {
    const res = await api.get<ApiResponse<WalletTopup[]>>('/wallet/topups', { params })
    return res.data
  },

  getTopupByID: async (id: string) => {
    const res = await api.get<ApiResponse<WalletTopup>>(`/wallet/topups/${id}`)
    return res.data
  },

  checkTopup: async (id: string) => {
    const res = await api.post<ApiResponse<WalletTopup>>(`/wallet/topups/${id}/check`)
    return res.data
  },

  listLedger: async (params?: WalletListParams) => {
    const res = await api.get<ApiResponse<WalletLedger[]>>('/wallet/ledger', { params })
    return res.data
  },
}
