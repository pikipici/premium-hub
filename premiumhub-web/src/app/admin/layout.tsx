"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, hasHydrated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return

    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    if (user?.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [hasHydrated, isAuthenticated, user, router])

  if (!hasHydrated || !isAuthenticated || user?.role !== 'admin') return null

  // New admin dashboard has its own sidebar, navbar, and layout
  return <>{children}</>
}
