import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { ActivityHistoryItem } from '@/types/activity'

interface ActivityListParams {
  page?: number
  limit?: number
}

export const activityService = {
  listHistory: async (params?: ActivityListParams) => {
    const res = await api.get<ApiResponse<ActivityHistoryItem[]>>('/activities/history', { params })
    return res.data
  },
}
