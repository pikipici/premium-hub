"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import Navbar from '@/components/layout/Navbar'
import AdminSidebar from '@/components/layout/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
    else if (user?.role !== 'admin') router.push('/dashboard')
  }, [isAuthenticated, user, router])

  if (!isAuthenticated || user?.role !== 'admin') return null

  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-64px)]">
        <AdminSidebar />
        <main className="flex-1 p-6 md:p-8 bg-[#F7F7F5]">
          {children}
        </main>
      </div>
    </>
  )
}
