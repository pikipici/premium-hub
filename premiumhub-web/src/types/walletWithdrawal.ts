// Wallet withdrawal — types mirror premiumhub-api/internal/model/wallet_withdrawal.go.
// Keep field names snake_case to match Go JSON tags exactly.

export type WithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'processing'
  | 'paid'
  | 'failed'

export type WithdrawalDestinationType = 'bank' | 'ewallet'

export interface WalletWithdrawal {
  id: string
  user_id: string
  amount: number
  fee: number
  net_amount: number
  status: WithdrawalStatus
  destination_type: WithdrawalDestinationType
  destination_code: string
  destination_account: string
  destination_name: string
  admin_id?: string | null
  admin_note?: string
  auto_approved: boolean
  ledger_hold_id?: string | null
  ledger_final_id?: string | null
  ledger_refund_id?: string | null
  payout_rail_kind: string
  payout_rail_ref?: string
  failure_reason?: string
  created_at: string
  approved_at?: string | null
  rejected_at?: string | null
  cancelled_at?: string | null
  paid_at?: string | null
  updated_at: string
}

export interface WithdrawalDestination {
  code: string
  label: string
  type: WithdrawalDestinationType
}

export interface WithdrawalPolicy {
  min_amount: number
  max_amount: number
  flat_fee: number
  max_requests_per_day: number
  max_amount_per_day: number
  auto_approve_threshold: number
}

export interface WithdrawalDestinationsResponse {
  destinations: WithdrawalDestination[]
  policy: WithdrawalPolicy
}

export interface CreateWithdrawalPayload {
  amount: number
  destination_type: WithdrawalDestinationType
  destination_code: string
  destination_account: string
  destination_name: string
}

// WalletBalanceDetailed maps backend WalletBalanceDetailedResponse —
// dual-pocket balance for Round-1 onwards. Use this on the wallet
// page; legacy WalletBalance (single number) is still served from
// GET /wallet/balance for callers that don't care about pockets.
export interface WalletBalanceDetailed {
  spend: number
  earn: number
  total: number
  total_topup: number
  total_spent: number
}
