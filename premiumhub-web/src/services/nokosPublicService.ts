import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { NokosLandingSummary } from '@/types/nokos'

export const nokosPublicService = {
  getLandingSummary: async () => {
    const res = await api.get<ApiResponse<NokosLandingSummary>>('/public/nokos/landing-summary')
    return res.data
  },
}
