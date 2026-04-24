import axios, { type InternalAxiosRequestConfig } from 'axios'

import { buildLoginHref, getCurrentPathWithSearch, isProtectedPath } from '@/lib/auth'
import { restoreSession } from '@/lib/authSession'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  withCredentials: true,
})

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/google', '/auth/logout', '/auth/session']

type RetryableConfig = InternalAxiosRequestConfig & {
  _retrySessionRestore?: boolean
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err.response?.status
    const config = (err.config || {}) as RetryableConfig
    const url = String(config.url || '')
    const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => url.includes(ep))

    if (typeof window !== 'undefined' && status === 401 && !isAuthEndpoint && !config._retrySessionRestore) {
      config._retrySessionRestore = true

      const user = await restoreSession()
      if (user) {
        return api(config)
      }

      if (isProtectedPath(window.location.pathname)) {
        window.location.replace(buildLoginHref(getCurrentPathWithSearch()))
      } else {
        useAuthStore.getState().logout()
      }
    }

    return Promise.reject(err)
  }
)

export default api
