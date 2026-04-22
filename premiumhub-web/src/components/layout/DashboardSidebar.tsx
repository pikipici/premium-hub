"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import {
  Bell,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Wallet,
} from 'lucide-react'

type DashboardSidebarProps = {
  collapsed?: boolean
  onToggle?: () => void
}

const MENU = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/dashboard/convert/orders', icon: RefreshCw, label: 'Riwayat Convert' },
  { href: '/dashboard/sosmed/orders', icon: Megaphone, label: 'Order Sosmed' },
  { href: '/dashboard/nokos', icon: Smartphone, label: 'Nomor Virtual' },
  { href: '/dashboard/akun-aktif', icon: ShoppingBag, label: 'Akun Aktif' },
  { href: '/dashboard/riwayat-order', icon: History, label: 'Riwayat Order' },
  { href: '/dashboard/klaim-garansi', icon: ShieldCheck, label: 'Klaim Garansi' },
  { href: '/dashboard/notifikasi', icon: Bell, label: 'Notifikasi' },
]

export default function DashboardSidebar({ collapsed = false, onToggle }: DashboardSidebarProps) {
  const pathname = usePathname()
  const { logout } = useAuthStore()

  return (
    <aside
      className={`hidden shrink-0 border-r border-[#EBEBEB] bg-white px-3 py-4 transition-all duration-200 md:sticky md:top-14 md:flex md:h-[calc(100vh-56px)] md:flex-col md:self-start md:overflow-y-auto ${
        collapsed ? 'w-[84px]' : 'w-64'
      }`}
    >
      <div
        className={`mb-3 flex items-center px-1 ${
          collapsed ? 'justify-center' : 'justify-between gap-2'
        }`}
      >
        {!collapsed ? (
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#A6A6A1]">Menu User</div>
            <div className="text-sm font-semibold text-[#141414]">Dashboard</div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E5E1] bg-white text-[#6E6D69] transition-colors hover:bg-[#F4F4F1]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {MENU.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center rounded-xl text-sm font-medium transition-all ${
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'
              } ${
                active
                  ? 'bg-[#FFF3EF] text-[#FF5733]'
                  : 'text-[#777772] hover:bg-[#F7F7F5] hover:text-[#141414]'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={logout}
        title={collapsed ? 'Logout' : undefined}
        className={`mt-2 flex items-center rounded-xl text-sm font-medium text-[#8A8985] transition-all hover:bg-red-50 hover:text-red-600 ${
          collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'
        }`}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed ? <span>Logout</span> : null}
      </button>
    </aside>
  )
}
