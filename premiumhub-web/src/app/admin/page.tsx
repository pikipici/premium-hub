"use client"

import { useRouter } from 'next/navigation'
import DashboardPage from '@/components/admin/dashboard-page'

const ROUTE_MAP: Record<string, string> = {
  dashboard: '/admin',
  produk: '/admin/produk',
  stok: '/admin/stok',
  order: '/admin/order',
  garansi: '/admin/garansi',
  pengguna: '/admin/pengguna',
  pengaturan: '/admin/pengaturan',
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const handleNavigate = (page: string) => {
    router.push(ROUTE_MAP[page] ?? '/admin')
  }

  return <DashboardPage onNavigate={handleNavigate} />
}
