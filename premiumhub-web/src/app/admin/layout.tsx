"use client"

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import AdminStyles from '@/components/admin/admin-styles'
import AdminSidebar from '@/components/admin/admin-sidebar'
import AdminTopbar from '@/components/admin/admin-topbar'
import AdminMobileDrawer from '@/components/admin/admin-mobile-drawer'

type PageMeta = {
  title: string
  sub: string
}

function resolvePageMeta(pathname: string): PageMeta {
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

  if (pathname.startsWith('/admin/convert')) {
    return { title: 'Control Convert', sub: 'Kelola fee, limit, channel, dan queue convert' }
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, hasHydrated } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const openMobileMenu = useCallback(() => {
    setMobileMenuOpen(true)
  }, [])

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    if (!hasHydrated) return

    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    if (user?.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [hasHydrated, isAuthenticated, user, router])

  if (!hasHydrated || !isAuthenticated || user?.role !== 'admin') return null

  const page = resolvePageMeta(pathname)

  return (
    <>
      <AdminStyles />

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
