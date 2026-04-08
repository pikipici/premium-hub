"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Item = {
  href: string
  label: string
  icon: string
  match?: (pathname: string) => boolean
}

const ITEMS: Item[] = [
  { href: '/admin', label: 'Home', icon: '⌂' },
  { href: '/admin/order', label: 'Order', icon: '◉' },
  { href: '/admin/produk', label: 'Produk', icon: '◈' },
  { href: '/admin/stok', label: 'Stok', icon: '◧' },
  {
    href: '/admin/pengaturan',
    label: 'Lainnya',
    icon: '◫',
    match: (pathname) =>
      pathname.startsWith('/admin/pengaturan') ||
      pathname.startsWith('/admin/pengguna') ||
      pathname.startsWith('/admin/garansi') ||
      pathname.startsWith('/admin/convert'),
  },
]

function isActive(pathname: string, item: Item) {
  if (item.match) return item.match(pathname)
  if (item.href === '/admin') return pathname === '/admin'
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function AdminMobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="admin-mobile-bottom-nav" aria-label="Navigasi admin mobile">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`admin-mobile-bottom-nav-item${isActive(pathname, item) ? ' active' : ''}`}
        >
          <span className="admin-mobile-bottom-nav-icon">{item.icon}</span>
          <span className="admin-mobile-bottom-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
