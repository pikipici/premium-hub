import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/google', '/auth/logout']

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status
    const url = String(err.config?.url || '')
    const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => url.includes(ep))

    if (typeof window !== 'undefined' && status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }

    return Promise.reject(err)
  }
)

export default api
