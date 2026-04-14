import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { AdminUser } from '@/types/adminUser'

export type AdminUserStatusFilter = 'active' | 'inactive'

export const adminUserService = {
  list: async (params?: {
    page?: number
    limit?: number
    search?: string
    status?: AdminUserStatusFilter
  }) => {
    const res = await api.get<ApiResponse<AdminUser[]>>('/admin/users', { params })
    return res.data
  },

  toggleBlock: async (id: string) => {
    const res = await api.put<ApiResponse<AdminUser>>(`/admin/users/${id}/block`)
    return res.data
  },
}
