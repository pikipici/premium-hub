"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: string
  badge?: string
  badgeClassName?: string
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
      { href: '/admin/stok', label: 'Stok Akun', icon: '◧', badge: '3', badgeClassName: ' yellow' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { href: '/admin/order', label: 'Order', icon: '◉', badge: '5' },
      { href: '/admin/convert', label: 'Control Convert', icon: '⇄', badge: '14', badgeClassName: ' yellow' },
      { href: '/admin/garansi', label: 'Klaim Garansi', icon: '◌', badge: '2' },
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
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-text">Digi<span>Market</span></div>
        <div className="admin-tag">Admin Panel</div>
      </div>

      {NAV_SECTIONS.map((section) => (
        <div className="nav-section" key={section.label}>
          <span className="nav-section-label">{section.label}</span>

          {section.items.map((item) => {
            const active = isNavActive(pathname, item.href)
            return (
              <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`}>
                <span className="nav-icon">{item.icon}</span> {item.label}
                {item.badge && <span className={`nav-badge${item.badgeClassName ?? ''}`}>{item.badge}</span>}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="sidebar-bottom">
        <div className="admin-profile">
          <div className="admin-avatar">A</div>
          <div>
            <div className="admin-name">Admin</div>
            <div className="admin-role">Super Admin</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
