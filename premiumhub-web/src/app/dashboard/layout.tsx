"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import Navbar from '@/components/layout/Navbar'
import DashboardSidebar from '@/components/layout/DashboardSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-64px)]">
        <DashboardSidebar />
        <main className="flex-1 p-6 md:p-8 bg-[#F7F7F5]">
          {children}
        </main>
      </div>
    </>
  )
}
