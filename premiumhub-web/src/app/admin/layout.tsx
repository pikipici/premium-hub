"use client"

import { Suspense, type ReactNode } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import AdminStyles from '@/components/admin/admin-styles'
import { buildLoginHref, buildPathWithSearch } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

function AdminRootLayoutContent({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, hasHydrated, isBootstrapped } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const authReady = hasHydrated && isBootstrapped

  useEffect(() => {
    if (!authReady) return

    if (!isAuthenticated) {
      router.replace(buildLoginHref(buildPathWithSearch(pathname, searchParams?.toString())))
      return
    }

    if (user?.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [authReady, isAuthenticated, pathname, router, searchParams, user])

  if (!authReady || !isAuthenticated || user?.role !== 'admin') return null

  return (
    <>
      <AdminStyles />
      {children}
    </>
  )
}

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminRootLayoutContent>{children}</AdminRootLayoutContent>
    </Suspense>
  )
}
