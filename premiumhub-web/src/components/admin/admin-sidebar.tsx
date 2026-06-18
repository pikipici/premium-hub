"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Box,
  Cpu,
  Database,
  Image,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShieldOff,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  CheckCircle2,
  DollarSign,
} from 'lucide-react'

import { isDigiConnectFrontendEnabled, isDigiConnectHref } from '@/lib/featureFlags'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Katalog',
    items: [
      { href: '/admin/produk', label: 'Produk', icon: Package },
      { href: '/admin/sosmed', label: 'DigiSosmed', icon: Megaphone },
      { href: '/admin/stok', label: 'Stok Produk', icon: Database },
      { href: '/admin/banners', label: 'Banner & Flash Sale', icon: Image },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { href: '/admin/order', label: 'Order', icon: ShoppingCart },
      { href: '/admin/sosmed/orders', label: 'Order DigiSosmed', icon: Megaphone },
      { href: '/admin/wallet-reconciliation', label: 'Rekon Wallet', icon: Wallet },
      { href: '/admin/wallet/withdrawals', label: 'Penarikan', icon: DollarSign },
      { href: '/admin/digiconnect', label: 'DigiConnect', icon: Cpu },
      { href: '/admin/convert', label: 'Control Convert', icon: RefreshCw },
      { href: '/admin/garansi', label: 'Klaim Garansi', icon: ShieldCheck },
    ],
  },
  {
    label: 'Gmail',
    items: [
      { href: '/admin/gmail/verifikasi', label: 'Verifikasi Setoran', icon: CheckCircle2 },
      { href: '/admin/gmail/inventory', label: 'Inventory', icon: Box },
      { href: '/admin/gmail/pricing', label: 'Pricing', icon: DollarSign },
      { href: '/admin/gmail/strikes', label: 'Strike Users', icon: ShieldOff },
      { href: '/admin/gmail/analytics', label: 'Analytics', icon: TrendingUp },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/admin/chat', label: 'Chat Support', icon: MessageCircle },
    ],
  },
  {
    label: 'Akun',
    items: [
      { href: '/admin/pengguna', label: 'Pengguna', icon: Users },
      { href: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
    ],
  },
]

const VISIBLE_NAV_SECTIONS: NavSection[] = NAV_SECTIONS.map((section) => ({
  ...section,
  items: section.items.filter((item) => isDigiConnectFrontendEnabled() || !isDigiConnectHref(item.href)),
})).filter((section) => section.items.length > 0)

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

      <nav className="sidebar-nav" aria-label="Navigasi admin">
        {VISIBLE_NAV_SECTIONS.map((section) => (
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
                  <span className="nav-icon">
                    <item.icon className="nav-icon-svg" />
                  </span>
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
      </nav>

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
