import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { NotificationItem, NotificationListPayload } from '@/types/notification'

export const notificationService = {
  myList: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<NotificationListPayload>>('/me/notifications', { params })
    return res.data
  },

  markRead: async (id: string) => {
    const res = await api.put<ApiResponse<null>>(`/me/notifications/${id}/read`)
    return res.data
  },
}

export type { NotificationItem }
