"use client"

import { useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'

import AdminMobileDrawer from '@/components/admin/admin-mobile-drawer'
import AdminSidebar from '@/components/admin/admin-sidebar'
import AdminTopbar from '@/components/admin/admin-topbar'

type PageMeta = {
  title: string
  sub: string
}

function resolveCorePageMeta(pathname: string): PageMeta {
  if (pathname === '/admin') {
    return { title: 'Dashboard', sub: 'Ringkasan operasional hari ini' }
  }

  if (pathname.startsWith('/admin/produk')) {
    return { title: 'Manajemen Produk', sub: 'Kelola semua produk' }
  }

  if (pathname.startsWith('/admin/stok')) {
    return { title: 'Stok Akun', sub: 'Monitor dan tambah stok' }
  }

  if (pathname.startsWith('/admin/order')) {
    return { title: 'Order', sub: 'Semua transaksi' }
  }

  if (pathname.startsWith('/admin/garansi')) {
    return { title: 'Klaim Garansi', sub: 'Proses klaim pengguna' }
  }

  if (pathname.startsWith('/admin/pengguna')) {
    return { title: 'Pengguna', sub: 'Daftar semua pengguna' }
  }

  if (pathname.startsWith('/admin/pengaturan')) {
    return { title: 'Pengaturan', sub: 'Konfigurasi sistem' }
  }

  return { title: 'Admin', sub: 'Panel administrasi' }
}

export default function AdminCoreLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const openMobileMenu = useCallback(() => {
    setMobileMenuOpen(true)
  }, [])

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  const page = resolveCorePageMeta(pathname)

  return (
    <>
      <div className="admin-page-wrapper">
        <AdminSidebar />

        <div className="admin-main">
          <AdminTopbar title={page.title} sub={page.sub} onOpenMobileMenu={openMobileMenu} />
          {children}
        </div>
      </div>

      <AdminMobileDrawer open={mobileMenuOpen} onClose={closeMobileMenu} />
    </>
  )
}
