"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Shield,
  ShoppingBag,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react'

import WalletBadge from '@/components/shared/WalletBadge'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

type PublicNavItem = {
  href: string
  label: string
}

const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { href: '/product/prem-apps', label: 'Apps' },
  { href: '/product/convert', label: 'Convert Aset' },
  { href: '/faq', label: 'FAQ' },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function firstName(name?: string | null) {
  if (!name) return 'Akun'
  const trimmed = name.trim()
  if (!trimmed) return 'Akun'
  return trimmed.split(/\s+/)[0] || 'Akun'
}

export default function Navbar() {
  const pathname = usePathname()
  const { user, isAuthenticated, logout, hasHydrated } = useAuthStore()

  const [open, setOpen] = useState(false)
  const [logouting, setLogouting] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const showAuthenticated = hasHydrated && isAuthenticated

  useEffect(() => {
    setOpen(false)
    setAccountMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!accountMenuOpen) return

    const handleOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current) return
      if (!accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false)
      }
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)

    return () => {
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [accountMenuOpen])

  const handleLogout = async () => {
    if (logouting) return

    setLogouting(true)
    try {
      await authService.logout()
    } catch {
      // ignore API logout errors; local logout should still happen
    } finally {
      logout()
      setAccountMenuOpen(false)
      setOpen(false)
      setLogouting(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[#EBEBEB] bg-white/80 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF5733]">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-extrabold">
              Digi<span className="text-[#FF5733]">Market</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {PUBLIC_NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative text-sm font-semibold transition-colors ${
                    active ? 'text-[#141414]' : 'text-[#888] hover:text-[#141414]'
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-[21px] left-0 h-[2px] rounded-full bg-[#FF5733] transition-all ${
                      active ? 'w-full opacity-100' : 'w-0 opacity-0'
                    }`}
                  />
                </Link>
              )
            })}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {showAuthenticated ? (
              <>
                {user?.role === 'admin' ? (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#FFD5C8] bg-[#FFF3EF] px-3 py-1.5 text-xs font-bold text-[#FF5733] transition-colors hover:bg-[#FFE6DD]"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Admin Mode
                  </Link>
                ) : null}

                <WalletBadge />

                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-[#F7F7F5] px-2.5 py-1.5 text-sm font-semibold text-[#141414] transition-colors hover:border-[#D9D9D6]"
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="menu"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#FF5733] text-[11px] font-bold text-white">
                      {firstName(user?.name).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="max-w-[100px] truncate text-xs font-semibold text-[#333]">
                      {firstName(user?.name)}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-[#777] transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {accountMenuOpen ? (
                    <div className="absolute right-0 top-[42px] z-[70] w-56 overflow-hidden rounded-xl border border-[#EBEBEB] bg-white shadow-[0_14px_30px_rgba(20,20,20,.12)]">
                      <div className="border-b border-[#F1F1EE] px-3 py-2.5">
                        <p className="truncate text-sm font-semibold text-[#141414]">{user?.name || 'User'}</p>
                        <p className="truncate text-xs text-[#888]">{user?.email || '-'}</p>
                      </div>

                      <div className="p-1.5">
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#333] hover:bg-[#F7F7F5]"
                        >
                          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                        </Link>

                        <Link
                          href="/dashboard/wallet"
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#333] hover:bg-[#F7F7F5]"
                        >
                          <Wallet className="h-3.5 w-3.5" /> Wallet
                        </Link>

                        <Link
                          href="/dashboard/convert/orders"
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#333] hover:bg-[#F7F7F5]"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Riwayat Convert
                        </Link>

                        <Link
                          href="/dashboard/nokos"
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#333] hover:bg-[#F7F7F5]"
                        >
                          <Smartphone className="h-3.5 w-3.5" /> Nomor Virtual
                        </Link>
                      </div>

                      <div className="border-t border-[#F1F1EE] p-1.5">
                        <button
                          onClick={handleLogout}
                          disabled={logouting}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          <LogOut className="h-3.5 w-3.5" /> {logouting ? 'Keluar...' : 'Keluar'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-semibold text-[#141414] transition-colors hover:text-[#FF5733]"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-[#FF5733] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e64d2e]"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setOpen((prev) => !prev)} className="p-2 md:hidden" aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open ? (
          <div className="mt-2 space-y-3 border-t border-[#EBEBEB] pb-4 pt-4 md:hidden">
            <div>
              <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#999]">Navigasi</p>
              <div className="mt-2 space-y-1">
                {PUBLIC_NAV_ITEMS.map((item) => {
                  const active = isActivePath(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-xl px-3 py-2 text-sm font-semibold ${
                        active ? 'bg-[#FFF3EF] text-[#FF5733]' : 'text-[#141414] hover:bg-[#F7F7F5]'
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            {showAuthenticated ? (
              <>
                <div>
                  <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#999]">Akun</p>
                  <div className="mt-2 rounded-xl border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-[#141414]">{user?.name || 'User'}</p>
                    <p className="truncate text-xs text-[#888]">{user?.email || '-'}</p>
                  </div>

                  <div className="mt-2 space-y-1">
                    <Link href="/dashboard" className="block rounded-xl px-3 py-2 text-sm font-semibold text-[#141414] hover:bg-[#F7F7F5]" onClick={() => setOpen(false)}>
                      Dashboard
                    </Link>
                    <Link href="/dashboard/wallet" className="block rounded-xl px-3 py-2 text-sm font-semibold text-[#141414] hover:bg-[#F7F7F5]" onClick={() => setOpen(false)}>
                      Wallet
                    </Link>
                    <Link href="/dashboard/convert/orders" className="block rounded-xl px-3 py-2 text-sm font-semibold text-[#141414] hover:bg-[#F7F7F5]" onClick={() => setOpen(false)}>
                      Riwayat Convert
                    </Link>
                    <Link href="/dashboard/nokos" className="block rounded-xl px-3 py-2 text-sm font-semibold text-[#141414] hover:bg-[#F7F7F5]" onClick={() => setOpen(false)}>
                      Nomor Virtual
                    </Link>
                  </div>
                </div>

                {user?.role === 'admin' ? (
                  <div>
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#999]">Admin</p>
                    <Link
                      href="/admin"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#FFD5C8] bg-[#FFF3EF] px-3 py-2.5 text-sm font-bold text-[#FF5733]"
                      onClick={() => setOpen(false)}
                    >
                      <Shield className="h-4 w-4" /> Masuk Admin Mode
                    </Link>
                  </div>
                ) : null}

                <button
                  onClick={handleLogout}
                  disabled={logouting}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {logouting ? 'Keluar...' : 'Keluar'}
                </button>
              </>
            ) : (
              <div className="flex gap-3 pt-1">
                <Link
                  href="/login"
                  className="flex-1 rounded-full border border-[#EBEBEB] py-2.5 text-center text-sm font-semibold"
                  onClick={() => setOpen(false)}
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="flex-1 rounded-full bg-[#FF5733] py-2.5 text-center text-sm font-semibold text-white"
                  onClick={() => setOpen(false)}
                >
                  Daftar
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </nav>
  )
}
