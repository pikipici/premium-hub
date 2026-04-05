"use client"

import AdminStyles from '@/components/admin/admin-styles'
import ProdukPage from '@/components/admin/produk-page'

export default function AdminProdukPage() {
  return (
    <>
      <AdminStyles />
      <ProdukPage onNavigate={() => {}} onEditProduk={() => {}} />
    </>
  )
}
