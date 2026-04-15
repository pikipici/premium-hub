export type ActivitySource = 'premium_apps' | 'nokos' | 'other'
export type ActivityDirection = 'debit' | 'credit'

export interface ActivityHistoryItem {
  id: string
  source: ActivitySource
  source_label: string
  kind: 'premium_order' | 'nokos_purchase' | 'nokos_refund' | 'other'
  title: string
  subtitle: string
  icon: string
  amount: number
  direction: ActivityDirection
  status: string
  occurred_at: string
}
