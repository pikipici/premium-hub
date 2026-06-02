"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: string
  hint?: string
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'DB', hint: 'Ringkasan' },
    ],
  },
  {
    label: 'Katalog',
    items: [
      { href: '/admin/produk', label: 'Produk', icon: 'PR', hint: 'DigiProduct' },
      { href: '/admin/sosmed', label: 'DigiSosmed', icon: 'SM', hint: 'Layanan sosial' },
      { href: '/admin/stok', label: 'Stok Akun', icon: 'ST', hint: 'Inventory' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { href: '/admin/order', label: 'Order', icon: 'OR', hint: 'DigiProduct' },
      { href: '/admin/sosmed/orders', label: 'Order Sosmed', icon: 'OS', hint: 'JAP/provider' },
      { href: '/admin/wallet-reconciliation', label: 'Rekon Wallet', icon: 'RW', hint: 'Saldo & mutasi' },
      { href: '/admin/wallet/withdrawals', label: 'Penarikan', icon: 'WD', hint: 'Withdraw' },
      { href: '/admin/digiconnect', label: 'DigiConnect', icon: 'DC', hint: 'API usage' },
      { href: '/admin/convert', label: 'Convert', icon: 'CV', hint: 'Queue & pricing' },
      { href: '/admin/garansi', label: 'Klaim Garansi', icon: 'KG', hint: 'Refund/reissue' },
    ],
  },
  {
    label: 'Gmail',
    items: [
      { href: '/admin/gmail/verifikasi', label: 'Verifikasi', icon: 'GV', hint: 'Setoran Gmail' },
      { href: '/admin/gmail/inventory', label: 'Inventory', icon: 'GI', hint: 'Stok Gmail' },
      { href: '/admin/gmail/pricing', label: 'Pricing', icon: 'GP', hint: 'Harga Gmail' },
      { href: '/admin/gmail/strikes', label: 'Strike Users', icon: 'GS', hint: 'Fraud control' },
      { href: '/admin/gmail/analytics', label: 'Analytics', icon: 'GA', hint: 'Performa Gmail' },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/admin/chat', label: 'Chat Support', icon: 'CS', hint: 'Inbox bantuan' },
    ],
  },
  {
    label: 'Akun',
    items: [
      { href: '/admin/pengguna', label: 'Pengguna', icon: 'US', hint: 'User account' },
      { href: '/admin/pengaturan', label: 'Pengaturan', icon: 'PG', hint: 'Konfigurasi' },
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
                <span className="nav-text-wrap">
                  <span className="nav-text">{item.label}</span>
                  {item.hint ? <span className="nav-hint">{item.hint}</span> : null}
                </span>
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
