"use client"

import { useEffect, useRef } from 'react'

import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

const MIN_RESTORE_INTERVAL_MS = 60_000

export default function AuthBootstrap() {
  const { hasHydrated, isAuthenticated } = useAuthStore()
  const lastRestoreRef = useRef(0)

  useEffect(() => {
    if (!hasHydrated) return

    lastRestoreRef.current = Date.now()
    void authService.restoreSession()
  }, [hasHydrated])

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return

    const maybeRestore = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

      const now = Date.now()
      if (now - lastRestoreRef.current < MIN_RESTORE_INTERVAL_MS) return

      lastRestoreRef.current = now
      void authService.restoreSession()
    }

    window.addEventListener('focus', maybeRestore)
    document.addEventListener('visibilitychange', maybeRestore)

    return () => {
      window.removeEventListener('focus', maybeRestore)
      document.removeEventListener('visibilitychange', maybeRestore)
    }
  }, [hasHydrated, isAuthenticated])

  return null
}
