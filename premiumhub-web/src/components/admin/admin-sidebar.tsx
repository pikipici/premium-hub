"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: string
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: '▦' },
    ],
  },
  {
    label: 'Katalog',
    items: [
      { href: '/admin/produk', label: 'Produk', icon: '◈' },
      { href: '/admin/sosmed', label: 'Layanan Sosmed', icon: '◍' },
      { href: '/admin/stok', label: 'Stok Akun', icon: '◧' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { href: '/admin/order', label: 'Order', icon: '◉' },
      { href: '/admin/sosmed/orders', label: 'Order Sosmed', icon: '◎' },
      { href: '/admin/convert', label: 'Control Convert', icon: '⇄' },
      { href: '/admin/garansi', label: 'Klaim Garansi', icon: '◌' },
    ],
  },
  {
    label: 'Akun',
    items: [
      { href: '/admin/pengguna', label: 'Pengguna', icon: '◎' },
      { href: '/admin/pengaturan', label: 'Pengaturan', icon: '◫' },
    ],
  },
]

function isNavActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  if (href === '/admin/sosmed') return pathname === '/admin/sosmed'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export type AdminSidebarBadgeCounts = {
  orderPending: number
  stockCritical: number
  claimPending: number
}

type AdminSidebarProps = {
  collapsed?: boolean
  badges?: AdminSidebarBadgeCounts
  loadingBadges?: boolean
}

function badgeValueForHref(href: string, badges?: AdminSidebarBadgeCounts) {
  if (!badges) return 0

  if (href === '/admin/order') return badges.orderPending
  if (href === '/admin/stok') return badges.stockCritical
  if (href === '/admin/garansi') return badges.claimPending
  return 0
}

function badgeClassNameForHref(href: string) {
  if (href === '/admin/stok') return ' yellow'
  if (href === '/admin/garansi') return ' red'
  return ''
}

export default function AdminSidebar({ collapsed = false, badges, loadingBadges = false }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-text">
          {collapsed ? (
            'DM'
          ) : (
            <>
              Digi<span>Market</span>
            </>
          )}
        </div>
        {!collapsed ? <div className="admin-tag">Admin Panel</div> : null}
      </div>

      {NAV_SECTIONS.map((section) => (
        <div className="nav-section" key={section.label}>
          <span className="nav-section-label">{section.label}</span>

          {section.items.map((item) => {
            const active = isNavActive(pathname, item.href)
            const badgeValue = badgeValueForHref(item.href, badges)
            const showBadge = loadingBadges
              ? ['/admin/order', '/admin/stok', '/admin/garansi'].includes(item.href)
              : badgeValue > 0

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${active ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">{item.label}</span>
                {showBadge ? (
                  <span className={`nav-badge${badgeClassNameForHref(item.href)}`}>
                    {loadingBadges ? '…' : badgeValue > 99 ? '99+' : badgeValue}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="sidebar-bottom">
        <div className="admin-profile" title={collapsed ? 'Admin - Super Admin' : undefined}>
          <div className="admin-avatar">A</div>
          <div className="admin-profile-meta">
            <div className="admin-name">Admin</div>
            <div className="admin-role">Super Admin</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
