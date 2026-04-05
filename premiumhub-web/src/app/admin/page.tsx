"use client"

import { useState } from 'react'
import AdminStyles from '@/components/admin/admin-styles'
import AdminSidebar from '@/components/admin/admin-sidebar'
import AdminTopbar from '@/components/admin/admin-topbar'
import DashboardPage from '@/components/admin/dashboard-page'
import ProdukPage from '@/components/admin/produk-page'
import EditProdukPage from '@/components/admin/edit-produk-page'
import StokPage from '@/components/admin/stok-page'
import OrderPage from '@/components/admin/order-page'
import GaransiPage from '@/components/admin/garansi-page'
import PenggunaPage from '@/components/admin/pengguna-page'
import PengaturanPage from '@/components/admin/pengaturan-page'

const PAGES: Record<string, { title: string; sub: string }> = {
  dashboard:     { title: 'Dashboard', sub: 'Sabtu, 4 April 2026' },
  produk:        { title: 'Manajemen Produk', sub: 'Kelola semua produk' },
  'edit-produk': { title: 'Edit Produk', sub: 'Ubah informasi produk secara lengkap' },
  stok:          { title: 'Stok Akun', sub: 'Monitor dan tambah stok' },
  order:         { title: 'Order', sub: 'Semua transaksi' },
  garansi:       { title: 'Klaim Garansi', sub: 'Proses klaim pengguna' },
  pengguna:      { title: 'Pengguna', sub: 'Daftar semua pengguna' },
  pengaturan:    { title: 'Pengaturan', sub: 'Konfigurasi sistem' },
}

export default function AdminDashboardPage() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [toast, setToast] = useState({ show: false, message: '' })

  const switchPage = (name: string) => {
    setCurrentPage(name)
  }

  const showToast = (message: string) => {
    setToast({ show: true, message })
    setTimeout(() => setToast({ show: false, message: '' }), 3000)
  }

  const page = PAGES[currentPage] || { title: currentPage, sub: '' }

  return (
    <>
      <AdminStyles />
      <div className="admin-page-wrapper">
        {/* Toast */}
        <div className={`admin-toast${toast.show ? ' show' : ''}`}>{toast.message}</div>

        <AdminSidebar currentPage={currentPage} onNavigate={switchPage} />

        <div className="admin-main">
          <AdminTopbar title={page.title} sub={page.sub} onNavigate={switchPage} />

          {currentPage === 'dashboard' && <DashboardPage onNavigate={switchPage} />}
          {currentPage === 'produk' && <ProdukPage onNavigate={switchPage} onEditProduk={(id) => switchPage('edit-produk')} />}
          {currentPage === 'edit-produk' && <EditProdukPage onNavigate={switchPage} showToast={showToast} />}
          {currentPage === 'stok' && <StokPage />}
          {currentPage === 'order' && <OrderPage />}
          {currentPage === 'garansi' && <GaransiPage />}
          {currentPage === 'pengguna' && <PenggunaPage />}
          {currentPage === 'pengaturan' && <PengaturanPage />}
        </div>
      </div>
    </>
  )
}
