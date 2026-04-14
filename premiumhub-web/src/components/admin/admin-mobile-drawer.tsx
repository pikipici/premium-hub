"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import type { AdminSidebarBadgeCounts } from '@/components/admin/admin-sidebar'

type DrawerItem = {
  href: string
  label: string
  icon: string
}

type DrawerSection = {
  label: string
  items: DrawerItem[]
}

const DRAWER_SECTIONS: DrawerSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: '▦' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { href: '/admin/order', label: 'Order', icon: '◉' },
      { href: '/admin/convert', label: 'Control Convert', icon: '⇄' },
      { href: '/admin/garansi', label: 'Klaim Garansi', icon: '◌' },
    ],
  },
  {
    label: 'Katalog',
    items: [
      { href: '/admin/produk', label: 'Produk', icon: '◈' },
      { href: '/admin/stok', label: 'Stok Akun', icon: '◧' },
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

type AdminMobileDrawerProps = {
  open: boolean
  onClose: () => void
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

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminMobileDrawer({
  open,
  onClose,
  badges,
  loadingBadges = false,
}: AdminMobileDrawerProps) {
  const pathname = usePathname()

  useEffect(() => {
    if (!open) return

    onClose()
    // close drawer every time route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [open, onClose])

  return (
    <>
      <button
        type="button"
        aria-label="Tutup menu admin"
        className={`admin-mobile-drawer-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
      />

      <aside className={`admin-mobile-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="admin-mobile-drawer-head">
          <div>
            <div className="admin-mobile-drawer-logo">Digi<span>Market</span></div>
            <div className="admin-mobile-drawer-sub">Admin Menu</div>
          </div>

          <button
            type="button"
            className="admin-mobile-drawer-close"
            aria-label="Tutup menu"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="admin-mobile-drawer-scroll">
          {DRAWER_SECTIONS.map((section) => (
            <div className="admin-mobile-drawer-section" key={section.label}>
              <div className="admin-mobile-drawer-label">{section.label}</div>

              <div className="admin-mobile-drawer-items">
                {section.items.map((item) => {
                  const badgeValue = badgeValueForHref(item.href, badges)
                  const showBadge = loadingBadges
                    ? ['/admin/order', '/admin/stok', '/admin/garansi'].includes(item.href)
                    : badgeValue > 0

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`admin-mobile-drawer-item${isActive(pathname, item.href) ? ' active' : ''}`}
                      onClick={onClose}
                    >
                      <span className="admin-mobile-drawer-icon">{item.icon}</span>
                      <span>{item.label}</span>
                      {showBadge ? (
                        <span className={`admin-mobile-drawer-item-badge${badgeClassNameForHref(item.href)}`}>
                          {loadingBadges ? '…' : badgeValue > 99 ? '99+' : badgeValue}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="admin-mobile-drawer-actions">
          <Link href="/admin/convert/orders" className="admin-mobile-drawer-action" onClick={onClose}>
            Buka Queue Convert
          </Link>
          <Link href="/admin/stok" className="admin-mobile-drawer-action" onClick={onClose}>
            Tambah Stok
          </Link>
        </div>
      </aside>
    </>
  )
}
