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

  const openMobileMenu = useCallback(() => {
    setMobileMenuOpen(true)
  }, [])

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
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
      <div className="admin-page-wrapper">
        <AdminSidebar />

        <div className="admin-main">
          <AdminTopbar
            title={page.title}
            sub={page.sub}
            onOpenMobileMenu={openMobileMenu}
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
