"use client"

import { useRouter } from 'next/navigation'
import ProdukPage from '@/components/admin/produk-page'

const ROUTE_MAP: Record<string, string> = {
  dashboard: '/admin',
  produk: '/admin/produk',
  stok: '/admin/stok',
  order: '/admin/order',
  garansi: '/admin/garansi',
  pengguna: '/admin/pengguna',
  pengaturan: '/admin/pengaturan',
}

export default function AdminProdukPage() {
  const router = useRouter()

  return (
    <ProdukPage
      onNavigate={(page) => router.push(ROUTE_MAP[page] ?? '/admin/produk')}
      onEditProduk={() => router.push('/admin/produk')}
    />
  )
}
