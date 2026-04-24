import axios from 'axios'

import { useAuthStore } from '@/store/authStore'
import type { ApiResponse } from '@/types/api'
import type { User } from '@/types/user'

interface SessionResponse {
  user: User
}

const sessionClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  withCredentials: true,
})

let restorePromise: Promise<User | null> | null = null

export async function restoreSession() {
  if (restorePromise) return restorePromise

  restorePromise = (async () => {
    const store = useAuthStore.getState()

    try {
      const res = await sessionClient.get<ApiResponse<SessionResponse>>('/auth/session')
      const user = res.data?.data?.user || null

      if (user) {
        store.setUser(user)
        return user
      }

      store.logout()
      return null
    } catch {
      store.logout()
      return null
    } finally {
      useAuthStore.getState().setBootstrapped(true)
      restorePromise = null
    }
  })()

  return restorePromise
}
