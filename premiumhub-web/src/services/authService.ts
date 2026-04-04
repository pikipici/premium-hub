import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { User } from '@/types/user'

interface AuthResponse {
  user: User
  token: string
}

export const authService = {
  register: async (data: { name: string; email: string; phone?: string; password: string }) => {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/register', data)
    return res.data
  },

  login: async (data: { email: string; password: string }) => {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/login', data)
    return res.data
  },

  logout: async () => {
    const res = await api.post<ApiResponse<null>>('/auth/logout')
    return res.data
  },

  getProfile: async () => {
    const res = await api.get<ApiResponse<User>>('/me')
    return res.data
  },

  updateProfile: async (data: { name: string; phone?: string }) => {
    const res = await api.put<ApiResponse<User>>('/me', data)
    return res.data
  },

  changePassword: async (data: { old_password: string; new_password: string }) => {
    const res = await api.put<ApiResponse<null>>('/me/password', data)
    return res.data
  },
}
