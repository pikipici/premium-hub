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

function resolveConvertPageMeta(pathname: string): PageMeta {
  if (pathname === '/admin/convert') {
    return { title: 'Control Convert', sub: 'Overview operasional convert lintas channel' }
  }

  if (pathname.startsWith('/admin/convert/orders')) {
    return { title: 'Queue Convert', sub: 'Kelola antrian order convert' }
  }

  if (pathname.startsWith('/admin/convert/pricing')) {
    return { title: 'Pricing Convert', sub: 'Atur rate dan fee per channel aset' }
  }

  if (pathname.startsWith('/admin/convert/limits')) {
    return { title: 'Limits Convert', sub: 'Atur policy akses, limit, dan risk threshold' }
  }

  return { title: 'Control Convert', sub: 'Kelola modul convert' }
}

export default function AdminConvertLayout({ children }: { children: React.ReactNode }) {
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

  const page = resolveConvertPageMeta(pathname)

  const actions = [
    { label: 'Overview', href: '/admin/convert' },
    { label: 'Queue', href: '/admin/convert/orders' },
    { label: 'Pricing', href: '/admin/convert/pricing' },
    { label: 'Limits', href: '/admin/convert/limits' },
  ]

  return (
    <>
      <div className={`admin-page-wrapper${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <AdminSidebar collapsed={sidebarCollapsed} />

        <div className="admin-main">
          <AdminTopbar
            title={page.title}
            sub={page.sub}
            onOpenMobileMenu={openMobileMenu}
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
            actions={actions}
            activePathname={pathname}
          />
          {children}
        </div>
      </div>

      <AdminMobileDrawer open={mobileMenuOpen} onClose={closeMobileMenu} />
    </>
  )
}
