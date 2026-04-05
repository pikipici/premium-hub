"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
    else if (user?.role !== 'admin') router.push('/dashboard')
  }, [isAuthenticated, user, router])

  if (!isAuthenticated || user?.role !== 'admin') return null

  // New admin dashboard has its own sidebar, navbar, and layout
  return <>{children}</>
}
