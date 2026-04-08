"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Database, ShoppingCart, ShieldCheck, Users, Settings, LogOut, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const MENU = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/produk', icon: Package, label: 'Produk' },
  { href: '/admin/stok', icon: Database, label: 'Stok' },
  { href: '/admin/order', icon: ShoppingCart, label: 'Order' },
  { href: '/admin/convert/orders', icon: RefreshCw, label: 'Konversi Pulsa' },
  { href: '/admin/garansi', icon: ShieldCheck, label: 'Garansi' },
  { href: '/admin/pengguna', icon: Users, label: 'Pengguna' },
  { href: '/admin/pengaturan', icon: Settings, label: 'Pengaturan' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { logout } = useAuthStore()

  return (
    <aside className="w-64 bg-[#141414] min-h-screen py-6 px-4 hidden md:block">
      <div className="mb-8 px-4">
        <span className="text-white text-lg font-extrabold">Admin Panel</span>
      </div>
      <nav className="space-y-1">
        {MENU.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
        <button onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full mt-4">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </nav>
    </aside>
  )
}
