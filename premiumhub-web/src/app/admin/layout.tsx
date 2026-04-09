"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import AdminStyles from '@/components/admin/admin-styles'
import { useAuthStore } from '@/store/authStore'

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <>
      <AdminStyles />
      {children}
    </>
  )
}
