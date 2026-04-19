"use client"

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import Navbar from '@/components/layout/Navbar'
import DashboardSidebar from '@/components/layout/DashboardSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const router = useRouter()

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false

    try {
      return window.localStorage.getItem('dashboard:sidebar:collapsed') === '1'
    } catch {
      return false
    }
  })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem('dashboard:sidebar:collapsed', next ? '1' : '0')
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated) router.replace('/login')
  }, [hasHydrated, isAuthenticated, router])

  if (!hasHydrated || !isAuthenticated) return null

  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-64px)]">
        <DashboardSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <main className="min-w-0 w-full flex-1 overflow-x-hidden bg-[#F7F7F5] p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </>
  )
}
