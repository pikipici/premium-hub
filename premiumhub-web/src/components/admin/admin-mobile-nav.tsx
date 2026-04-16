"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type MobileItem = {
  href: string
  label: string
}

const MOBILE_ITEMS: MobileItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/produk', label: 'Produk' },
  { href: '/admin/sosmed', label: 'Sosmed' },
  { href: '/admin/stok', label: 'Stok' },
  { href: '/admin/order', label: 'Order' },
  { href: '/admin/garansi', label: 'Garansi' },
  { href: '/admin/pengguna', label: 'Pengguna' },
  { href: '/admin/pengaturan', label: 'Pengaturan' },
]

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminMobileNav() {
  const pathname = usePathname()

  return (
    <nav className="admin-mobile-nav" aria-label="Admin mobile navigation">
      {MOBILE_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`admin-mobile-nav-item${isActive(pathname, item.href) ? ' active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
