"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { LayoutDashboard, ShoppingBag, History, ShieldCheck, Bell, UserCircle, LogOut, Wallet, Smartphone } from 'lucide-react'

const MENU = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/dashboard/nomor-virtual', icon: Smartphone, label: 'Nomor Virtual' },
  { href: '/dashboard/akun-aktif', icon: ShoppingBag, label: 'Akun Aktif' },
  { href: '/dashboard/riwayat-order', icon: History, label: 'Riwayat Order' },
  { href: '/dashboard/klaim-garansi', icon: ShieldCheck, label: 'Klaim Garansi' },
  { href: '/dashboard/notifikasi', icon: Bell, label: 'Notifikasi' },
  { href: '/dashboard/profil', icon: UserCircle, label: 'Profil' },
]

export default function DashboardSidebar() {
  const pathname = usePathname()
  const { logout } = useAuthStore()

  return (
    <aside className="w-64 bg-white border-r border-[#EBEBEB] min-h-screen py-6 px-4 hidden md:block">
      <nav className="space-y-1">
        {MENU.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active ? 'bg-[#FFF3EF] text-[#FF5733]' : 'text-[#888] hover:bg-[#F7F7F5] hover:text-[#141414]'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#888] hover:bg-red-50 hover:text-red-500 transition-all w-full"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </nav>
    </aside>
  )
}
