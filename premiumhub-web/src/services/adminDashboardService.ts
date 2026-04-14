import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'

export interface AdminDashboardSummary {
  total_revenue: number
  pending_orders: number
  active_orders: number
  completed_orders: number
  pending_claims: number
}

export const adminDashboardService = {
  summary: async () => {
    const res = await api.get<ApiResponse<AdminDashboardSummary>>('/admin/dashboard')
    return res.data
  },
}
