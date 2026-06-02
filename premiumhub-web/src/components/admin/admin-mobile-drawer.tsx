"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import type { AdminSidebarBadgeCounts } from '@/components/admin/admin-sidebar'

type DrawerItem = {
  href: string
  label: string
  icon: string
  hint?: string
}

type DrawerSection = {
  label: string
  items: DrawerItem[]
}

const DRAWER_OPEN_STORAGE_KEY = 'premiumhub-admin-mobile-drawer-open-sections'

const DRAWER_SECTIONS: DrawerSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'DB', hint: 'Ringkasan' },
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
      { href: '/admin/garansi', label: 'Klaim Garansi', icon: 'KG', hint: 'Refund/reissue' },
    ],
  },
  {
    label: 'Convert',
    items: [
      { href: '/admin/convert', label: 'Dashboard', icon: 'CV', hint: 'Ringkasan' },
      { href: '/admin/convert/orders', label: 'Order Convert', icon: 'CO', hint: 'Queue order' },
      { href: '/admin/convert/pricing', label: 'Pricing', icon: 'CP', hint: 'Rate & margin' },
      { href: '/admin/convert/limits', label: 'Limit', icon: 'CL', hint: 'Batas transaksi' },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/admin/chat', label: 'Chat Support', icon: 'CS', hint: 'Inbox bantuan' },
    ],
  },
  {
    label: 'Gmail',
    items: [
      { href: '/admin/gmail', label: 'Dashboard', icon: 'GM', hint: 'Ringkasan' },
      { href: '/admin/gmail/verifikasi', label: 'Verifikasi', icon: 'GV', hint: 'Setoran Gmail' },
      { href: '/admin/gmail/inventory', label: 'Inventory', icon: 'GI', hint: 'Stok Gmail' },
      { href: '/admin/gmail/pricing', label: 'Pricing', icon: 'GP', hint: 'Harga Gmail' },
      { href: '/admin/gmail/strikes', label: 'Strike Users', icon: 'GS', hint: 'Fraud control' },
      { href: '/admin/gmail/analytics', label: 'Analytics', icon: 'GA', hint: 'Performa Gmail' },
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
    label: 'Akun',
    items: [
      { href: '/admin/pengguna', label: 'Pengguna', icon: 'US', hint: 'User account' },
      { href: '/admin/pengaturan', label: 'Pengaturan', icon: 'PG', hint: 'Konfigurasi' },
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
  if (href === '/admin/sosmed') return pathname === '/admin/sosmed'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminMobileDrawer({
  open,
  onClose,
  badges,
  loadingBadges = false,
}: AdminMobileDrawerProps) {
  const pathname = usePathname()
  const activeSectionLabels = useMemo(
    () => DRAWER_SECTIONS
      .filter((section) => section.items.some((item) => isActive(pathname, item.href)))
      .map((section) => section.label),
    [pathname],
  )
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const initialOpenSections = new Set(activeSectionLabels)
    if (typeof window === 'undefined') return initialOpenSections

    try {
      const saved = window.localStorage.getItem(DRAWER_OPEN_STORAGE_KEY)
      if (!saved) return initialOpenSections

      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return initialOpenSections

      parsed
        .filter((value) => typeof value === 'string')
        .forEach((label) => initialOpenSections.add(label))
    } catch {
      // Ignore malformed local drawer preferences.
    }

    return initialOpenSections
  })

  const toggleSection = (label: string) => {
    setOpenSections((current) => {
      const next = new Set(current)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }

      window.localStorage.setItem(DRAWER_OPEN_STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

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
          {DRAWER_SECTIONS.map((section) => {
            const sectionActive = section.items.some((item) => isActive(pathname, item.href))
            const sectionOpen = openSections.has(section.label) || sectionActive

            return (
              <div className="admin-mobile-drawer-section" key={section.label}>
                <button
                  type="button"
                  className={`admin-mobile-drawer-section-toggle${sectionOpen ? ' open' : ''}`}
                  aria-expanded={sectionOpen}
                  onClick={() => toggleSection(section.label)}
                >
                  <span>{section.label}</span>
                  <span className="admin-mobile-drawer-chevron">▾</span>
                </button>

                <div className={`admin-mobile-drawer-items${sectionOpen ? ' open' : ''}`}>
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
                        <span className="admin-mobile-drawer-copy">
                          <span>{item.label}</span>
                          {item.hint ? <span>{item.hint}</span> : null}
                        </span>
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
            )
          })}
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
