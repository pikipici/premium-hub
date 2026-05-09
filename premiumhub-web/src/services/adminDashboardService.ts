import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { Claim, Order } from '@/types/order'

export interface AdminDashboardStockSummary {
  product_id: string
  name: string
  icon: string
  available: number
}

export interface AdminDashboardSummary {
  total_revenue: number
  pending_orders: number
  active_orders: number
  completed_orders: number
  pending_claims: number
  recent_orders: Order[]
  analytics_orders: Order[]
  pending_claim_rows: Claim[]
  monthly_claims_count: number
  stock_summary: AdminDashboardStockSummary[]
  active_users_total: number
}

export const adminDashboardService = {
  summary: async () => {
    const res = await api.get<ApiResponse<AdminDashboardSummary>>('/admin/dashboard')
    return res.data
  },
}
