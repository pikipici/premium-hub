import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { MaintenanceEvaluation, MaintenanceRule, MaintenanceTargetType } from '@/types/maintenance'

export interface AdminMaintenanceRulePayload {
  name: string
  target_type: MaintenanceTargetType
  target_path?: string
  title?: string
  message?: string
  is_active?: boolean
  allow_admin_bypass?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export interface AdminMaintenanceRuleUpdatePayload {
  name?: string
  target_type?: MaintenanceTargetType
  target_path?: string
  title?: string
  message?: string
  is_active?: boolean
  allow_admin_bypass?: boolean
  starts_at?: string | null
  ends_at?: string | null
  clear_starts_at?: boolean
  clear_ends_at?: boolean
}

export const maintenanceService = {
  evaluate: async (path: string) => {
    const res = await api.get<ApiResponse<MaintenanceEvaluation>>('/maintenance/evaluate', {
      params: { path },
    })
    return res.data
  },

  adminList: async (params?: { include_inactive?: boolean }) => {
    const res = await api.get<ApiResponse<MaintenanceRule[]>>('/admin/maintenance/rules', { params })
    return res.data
  },

  adminCreate: async (data: AdminMaintenanceRulePayload) => {
    const res = await api.post<ApiResponse<MaintenanceRule>>('/admin/maintenance/rules', data)
    return res.data
  },

  adminUpdate: async (id: string, data: AdminMaintenanceRuleUpdatePayload) => {
    const res = await api.put<ApiResponse<MaintenanceRule>>(`/admin/maintenance/rules/${id}`, data)
    return res.data
  },

  adminDelete: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/admin/maintenance/rules/${id}`)
    return res.data
  },
}
