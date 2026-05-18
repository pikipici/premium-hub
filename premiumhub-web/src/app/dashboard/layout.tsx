"use client"

import { Suspense, type ReactNode, useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Menu } from 'lucide-react'

import { buildLoginHref, buildPathWithSearch } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import Navbar from '@/components/layout/Navbar'
import DashboardSidebar from '@/components/layout/DashboardSidebar'
import { DigiLoading } from '@/components/shared/DigiLoading'

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const { isAuthenticated, hasHydrated, isBootstrapped } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const authReady = hasHydrated && isBootstrapped

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('dashboard:sidebar:collapsed') === '1'
    } catch {
      return false
    }
  })

  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem('dashboard:sidebar:collapsed', next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.replace(buildLoginHref(buildPathWithSearch(pathname, searchParams?.toString())))
    }
  }, [authReady, isAuthenticated, pathname, router, searchParams])

  if (!authReady || !isAuthenticated) return null

  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-64px)]">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="min-w-0 w-full flex-1 overflow-x-hidden bg-[#F7F7F5] p-4 sm:p-6 md:p-8">
          {/* Mobile menu trigger (hidden on md+) */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="mb-4 inline-flex h-10 items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-4 text-sm font-bold text-[#141414] shadow-sm transition hover:bg-[#F4F4F2] md:hidden"
            aria-label="Buka menu dashboard"
            aria-expanded={mobileOpen}
            aria-controls="dashboard-sidebar-drawer"
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
          {children}
        </main>
      </div>
    </>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DigiLoading message="Memuat dashboard kamu..." />}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  )
}
