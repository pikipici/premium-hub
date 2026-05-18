"use client"

import { useEffect, useRef } from 'react'

/**
 * Refetch a callback when the tab becomes visible again, throttled to avoid
 * thrashing when the user is rapidly tabbing back-and-forth.
 *
 * Apply this in dashboard pages that fetch data once on mount; without it,
 * a user returning after 30+ minutes sees stale balance / order status / API key list.
 *
 * Pattern matches the established `AuthBootstrap` wallet refresh convention.
 *
 * @param refetch async callback that re-fetches the page data
 * @param throttleMs minimum gap between auto-refetches (default 60s)
 */
export function useVisibilityRefresh(
  refetch: () => void | Promise<void>,
  throttleMs: number = 60_000,
) {
  const lastRefetchRef = useRef<number>(0)
  const refetchRef = useRef(refetch)

  // Keep latest callback without retriggering effect
  useEffect(() => {
    refetchRef.current = refetch
  }, [refetch])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handler = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefetchRef.current < throttleMs) return
      lastRefetchRef.current = now
      void refetchRef.current()
    }

    document.addEventListener('visibilitychange', handler)
    window.addEventListener('focus', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      window.removeEventListener('focus', handler)
    }
  }, [throttleMs])
}
