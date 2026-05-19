import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { PaymentMethodOption, Wallet, WalletBalance, WalletLedger, WalletListParams, WalletTopup } from '@/types/wallet'
import type { WalletBalanceDetailed } from '@/types/walletWithdrawal'

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

  // Dual-pocket balance — Saldo Utama (spend) + Saldo Pendapatan (earn).
  // Added in WD plan Round 1. New code should prefer this over
  // getBalance for any UI that surfaces the breakdown.
  getBalanceDetailed: async () => {
    const res = await api.get<ApiResponse<WalletBalanceDetailed>>('/wallet/balance-detailed')
    return res.data
  },

  getWallet: async (): Promise<Wallet> => {
    const res = await api.get<ApiResponse<WalletBalance>>('/wallet/balance')
    return {
      balance: res.data.data.balance,
      total_topup: res.data.data.total_topup ?? 0,
      total_spent: res.data.data.total_spent ?? 0,
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

  listPaymentMethods: async (amount?: number) => {
    const res = await api.get<ApiResponse<PaymentMethodOption[]>>('/payment/methods', {
      params: amount ? { amount } : undefined,
    })
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
