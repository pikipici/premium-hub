export type WalletTopupStatus = 'pending' | 'success' | 'failed' | 'expired' | 'paid'

export interface Wallet {
  id?: string
  user_id?: string
  balance: number
  total_topup?: number
  total_spent?: number
  updated_at?: string
}

export interface WalletBalance {
  balance: number
  fivesim_wallet_price_multiplier?: number
  fivesim_wallet_min_debit?: number
}

export interface WalletTopup {
  id: string
  provider?: string
  provider_trx_id?: string

  requested_amount?: number
  unique_code?: number
  payable_amount?: number

  amount?: number
  bonus?: number
  total_credit?: number
  payment_method?: string
  snap_token?: string
  midtrans_order_id?: string

  status: WalletTopupStatus
  provider_status?: string
  idempotency_key?: string
  expires_at?: string
  expired_at?: string
  is_overdue?: boolean
  last_checked_at?: string | null
  settled_at?: string | null
  paid_at?: string | null
  created_at: string
  updated_at?: string
}

export interface WalletLedger {
  id: string
  type: 'credit' | 'debit' | 'topup' | 'purchase' | 'refund' | 'adjustment' | string
  category: string
  amount: number
  balance_before: number
  balance_after: number
  reference: string
  description: string
  created_at: string
}

export interface WalletListParams {
  page?: number
  limit?: number
}
