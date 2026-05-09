import api from '@/lib/api'

export type WalletReconciliationIssue = {
  key: string
  type: string
  severity: string
  order_id: string
  user_id: string
  payment_status: string
  order_status: string
  amount: number
  expected_ref?: string
  ledger_refs?: string[]
  description: string
  repairable: boolean
  repair_action?: string
  created_at: string
}

export type WalletReconciliationSummary = {
  total_issues: number
  paid_missing_debit: number
  terminal_missing_refund: number
  duplicate_refund: number
  payment_order_mismatch: number
}

export type WalletReconciliationReport = {
  summary: WalletReconciliationSummary
  issues: WalletReconciliationIssue[]
  filters: {
    from?: string
    to?: string
    user_id?: string
    order_id?: string
    limit: number
  }
}

export type WalletReconciliationFilters = {
  from?: string
  to?: string
  user_id?: string
  order_id?: string
  limit?: number
}

export type WalletReconciliationRepairResult = {
  repaired: boolean
  issue_key: string
  action: string
  ledger_id?: string
  message: string
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export const walletReconciliationService = {
  async getReport(filters: WalletReconciliationFilters = {}) {
    const { data } = await api.get<ApiResponse<WalletReconciliationReport>>('/admin/wallet/reconciliation', {
      params: filters,
    })
    return data.data
  },

  async repair(issueKey: string, action: string) {
    const { data } = await api.post<ApiResponse<WalletReconciliationRepairResult>>(
      '/admin/wallet/reconciliation/repair',
      { issue_key: issueKey, action }
    )
    return data.data
  },
}
