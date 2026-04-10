"use client"

import { useRouter } from 'next/navigation'

type TopbarAction = {
  label: string
  href: string
}

interface AdminTopbarProps {
  title: string
  sub: string
  onOpenMobileMenu?: () => void
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
  actions?: TopbarAction[]
  activePathname?: string
}

function isActionActive(pathname: string | undefined, href: string) {
  if (!pathname) return false
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminTopbar({
  title,
  sub,
  onOpenMobileMenu,
  onToggleSidebar,
  sidebarCollapsed,
  actions,
  activePathname,
}: AdminTopbarProps) {
  const router = useRouter()

  const hasCustomActions = Array.isArray(actions) && actions.length > 0

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Buka menu admin"
          onClick={onOpenMobileMenu}
        >
          ☰
        </button>

        <div className="topbar-title-wrap">
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="sidebar-toggle-btn"
          aria-label={sidebarCollapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? '☰ Sidebar' : '⇤ Collapse'}
        </button>

        {hasCustomActions ? (
          actions.map((action) => {
            const active = isActionActive(activePathname, action.href)
            return (
              <button
                key={action.href}
                className={`topbar-btn${active ? ' primary' : ''}`}
                onClick={() => router.push(action.href)}
              >
                {action.label}
              </button>
            )
          })
        ) : (
          <>
            <button className="notif-btn">🔔<span className="notif-dot" /></button>
            <button className="topbar-btn" onClick={() => router.push('/admin/stok')}>+ Tambah Stok</button>
            <button className="topbar-btn primary" onClick={() => router.push('/admin/produk')}>+ Produk Baru</button>
          </>
        )}
      </div>
    </div>
  )
}
