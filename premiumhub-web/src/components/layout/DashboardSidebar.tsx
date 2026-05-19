"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import {
  Bell,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react'

import {
  userSidebarMenuSettingService,
  type UserSidebarMenuSettingKey,
} from '@/services/userSidebarMenuSettingService'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

type DashboardSidebarProps = {
  collapsed?: boolean
  onToggle?: () => void
  /** Mobile drawer open state */
  mobileOpen?: boolean
  /** Mobile drawer close handler */
  onMobileClose?: () => void
}

const MENU = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/dashboard/convert/orders', icon: RefreshCw, label: 'Riwayat Convert', settingKey: 'convert_history' },
  { href: '/dashboard/sosmed/orders', icon: Megaphone, label: 'Order DigiSosmed' },
  { href: '/dashboard/digiconnect', icon: Network, label: 'DigiConnect' },
  { href: '/dashboard/gmail', icon: Mail, label: 'Gmail' },
  { href: '/dashboard/akun-aktif', icon: ShoppingBag, label: 'Akun Aktif', settingKey: 'active_accounts' },
  { href: '/dashboard/riwayat-order', icon: History, label: 'Riwayat Order', settingKey: 'order_history' },
  { href: '/dashboard/klaim-garansi', icon: ShieldCheck, label: 'Klaim Garansi', settingKey: 'warranty_claim' },
  { href: '/dashboard/chat', icon: MessageCircle, label: 'Chat Support' },
  { href: '/dashboard/notifikasi', icon: Bell, label: 'Notifikasi' },
] satisfies Array<{
  href: string
  icon: ComponentType<{ className?: string }>
  label: string
  settingKey?: UserSidebarMenuSettingKey
}>

function useMenuItems() {
  const [visibleByKey, setVisibleByKey] =
    useState<Partial<Record<UserSidebarMenuSettingKey, boolean>> | null>()

  useEffect(() => {
    let alive = true
    const loadVisibility = async () => {
      try {
        const res = await userSidebarMenuSettingService.list()
        if (!alive || !res.success) return
        setVisibleByKey(
          (res.data || []).reduce<Partial<Record<UserSidebarMenuSettingKey, boolean>>>((acc, item) => {
            acc[item.key] = item.is_visible
            return acc
          }, {})
        )
      } catch {
        if (alive) setVisibleByKey(null)
      }
    }
    void loadVisibility()
    return () => {
      alive = false
    }
  }, [])

  return useMemo(
    () =>
      MENU.filter((item) => {
        if (!item.settingKey) return true
        if (visibleByKey === undefined) return false
        if (visibleByKey === null) return true
        return visibleByKey[item.settingKey] !== false
      }),
    [visibleByKey]
  )
}

export default function DashboardSidebar({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { logout } = useAuthStore()
  const menuItems = useMenuItems()

  // Auto-close mobile drawer on route change
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Lock body scroll while drawer open
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (mobileOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [mobileOpen])

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-[#EBEBEB] bg-white px-3 py-4 transition-all duration-200 md:sticky md:top-14 md:flex md:h-[calc(100vh-56px)] md:flex-col md:self-start md:overflow-y-auto ${
          collapsed ? 'w-[84px]' : 'w-64'
        }`}
        aria-label="Navigasi dashboard"
      >
        <SidebarHeader collapsed={collapsed} onToggle={onToggle} />
        <SidebarMenu menuItems={menuItems} pathname={pathname} collapsed={collapsed} />
        <SidebarLogout collapsed={collapsed} onLogout={logout} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <MobileDrawer onClose={onMobileClose ?? (() => {})}>
          <SidebarMenu menuItems={menuItems} pathname={pathname} collapsed={false} />
          <SidebarLogout collapsed={false} onLogout={logout} />
        </MobileDrawer>
      ) : null}
    </>
  )
}

function SidebarHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle?: () => void
}) {
  return (
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E5E1] bg-white text-[#6B7280] transition-colors hover:bg-[#F4F4F1]"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>
    </div>
  )
}

function SidebarMenu({
  menuItems,
  pathname,
  collapsed,
}: {
  menuItems: typeof MENU
  pathname: string
  collapsed: boolean
}) {
  return (
    <nav className="flex-1 space-y-1">
      {menuItems.map((item) => {
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
                : 'text-[#6B7280] hover:bg-[#F7F7F5] hover:text-[#141414]'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>{item.label}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarLogout({
  collapsed,
  onLogout,
}: {
  collapsed: boolean
  onLogout: () => void
}) {
  return (
    <button
      type="button"
      onClick={onLogout}
      title={collapsed ? 'Logout' : undefined}
      className={`mt-2 flex items-center rounded-xl text-sm font-medium text-[#6B7280] transition-all hover:bg-rose-50 hover:text-rose-600 ${
        collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'
      }`}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {!collapsed ? <span>Logout</span> : null}
    </button>
  )
}

function MobileDrawer({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  const drawerRef = useRef<HTMLDivElement | null>(null)
  useFocusTrap(drawerRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi dashboard">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <aside
        ref={drawerRef}
        className="absolute inset-y-0 left-0 flex w-[78%] max-w-[300px] flex-col bg-white px-3 py-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#A6A6A1]">Menu User</div>
            <div className="text-sm font-semibold text-[#141414]">Dashboard</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#EBEBEB] bg-white text-[#6B7280] hover:bg-[#F4F4F1]"
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}
