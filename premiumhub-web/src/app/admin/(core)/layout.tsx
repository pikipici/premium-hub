"use client"

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import AdminMobileDrawer from '@/components/admin/admin-mobile-drawer'
import AdminSidebar, { type AdminSidebarBadgeCounts } from '@/components/admin/admin-sidebar'
import AdminTopbar from '@/components/admin/admin-topbar'
import { adminDashboardService } from '@/services/adminDashboardService'
import { stockService } from '@/services/stockService'

type PageMeta = {
  title: string
  sub: string
}

const STOCK_PAGE_LIMIT = 200
const MAX_STOCK_PAGES = 15

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

async function countCriticalStockProducts() {
  const productAvailableCounts = new Map<string, number>()

  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= MAX_STOCK_PAGES) {
    const res = await stockService.adminList({
      page,
      limit: STOCK_PAGE_LIMIT,
      status: 'available',
    })

    if (!res.success) break
    if (res.data.length === 0) break

    res.data.forEach((stock) => {
      const productID = stock.product_id || stock.product?.id
      if (!productID) return

      const existing = productAvailableCounts.get(productID) || 0
      productAvailableCounts.set(productID, existing + 1)
    })

    totalPages = res.meta?.total_pages ?? 1
    if (page >= totalPages) break
    page += 1
  }

  let criticalCount = 0
  productAvailableCounts.forEach((available) => {
    if (available <= 3) {
      criticalCount += 1
    }
  })

  return criticalCount
}

export default function AdminCoreLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false

    try {
      return window.localStorage.getItem('admin:sidebar:collapsed') === '1'
    } catch {
      return false
    }
  })

  const [sidebarBadges, setSidebarBadges] = useState<AdminSidebarBadgeCounts>({
    orderPending: 0,
    stockCritical: 0,
    claimPending: 0,
  })
  const [sidebarBadgesLoading, setSidebarBadgesLoading] = useState(true)

  const loadSidebarBadges = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true

    if (!silent) {
      setSidebarBadgesLoading(true)
    }

    try {
      const [summaryRes, criticalStockCount] = await Promise.all([
        adminDashboardService.summary(),
        countCriticalStockProducts(),
      ])

      if (!summaryRes.success) {
        if (!silent) {
          setSidebarBadgesLoading(false)
        }
        return
      }

      setSidebarBadges({
        orderPending: summaryRes.data.pending_orders || 0,
        claimPending: summaryRes.data.pending_claims || 0,
        stockCritical: criticalStockCount || 0,
      })
    } catch {
      // fail-open: keep last known badges
    } finally {
      if (!silent) {
        setSidebarBadgesLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadSidebarBadges()
  }, [loadSidebarBadges, pathname])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadSidebarBadges({ silent: true })
    }, 60000)

    return () => window.clearInterval(timer)
  }, [loadSidebarBadges])

  const openMobileMenu = useCallback(() => {
    setMobileMenuOpen(true)
  }, [])

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem('admin:sidebar:collapsed', next ? '1' : '0')
      } catch {
        // ignore storage write errors
      }
      return next
    })
  }, [])

  const page = resolveCorePageMeta(pathname)

  return (
    <>
      <div className={`admin-page-wrapper${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <AdminSidebar
          collapsed={sidebarCollapsed}
          badges={sidebarBadges}
          loadingBadges={sidebarBadgesLoading}
        />

        <div className="admin-main">
          <AdminTopbar
            title={page.title}
            sub={page.sub}
            onOpenMobileMenu={openMobileMenu}
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
          />
          {children}
        </div>
      </div>

      <AdminMobileDrawer
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        badges={sidebarBadges}
        loadingBadges={sidebarBadgesLoading}
      />
    </>
  )
}
