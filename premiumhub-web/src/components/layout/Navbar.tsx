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
  UserCircle,
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

type MobileSectionKey = 'nav' | 'account' | 'admin'

type MobileSectionState = Record<MobileSectionKey, boolean>

const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { href: '/product/prem-apps', label: 'Apps' },
  { href: '/product/convert', label: 'Convert Aset' },
  { href: '/product/nokos', label: 'Nomor Virtual' },
  { href: '/product/sosmed', label: 'Sosmed' },
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
  const { user, isAuthenticated, logout, hasHydrated, isBootstrapped } = useAuthStore()

  const [open, setOpen] = useState(false)
  const [logouting, setLogouting] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState<MobileSectionState>({
    nav: true,
    account: false,
    admin: false,
  })

  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const authReady = hasHydrated && isBootstrapped
  const showAuthenticated = authReady && isAuthenticated
  const isAdminUser = showAuthenticated && user?.role === 'admin'
  const isDashboardSurface =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')

  const getInitialMobileSections = (): MobileSectionState => ({
    nav: true,
    account: isActivePath(pathname, '/dashboard'),
    admin: user?.role === 'admin' ? isActivePath(pathname, '/admin') : false,
  })

  const toggleMobileSection = (section: MobileSectionKey) => {
    setMobileSectionsOpen((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleToggleMobileMenu = () => {
    if (open) {
      setOpen(false)
      return
    }

    setMobileSectionsOpen(getInitialMobileSections())
    setOpen(true)
    setAccountMenuOpen(false)
  }

  useEffect(() => {
    setOpen(false)
    setAccountMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const originalBodyOverflow = document.body.style.overflow
    const originalBodyPaddingRight = document.body.style.paddingRight
    const originalHtmlOverflow = document.documentElement.style.overflow
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleEsc)

    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = originalBodyOverflow
      document.body.style.paddingRight = originalBodyPaddingRight
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [open])

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
    <>
      <nav className="sticky top-0 z-50 border-b border-[#EBEBEB] bg-white/85 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF5733]">
                <ShoppingBag className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-extrabold">
                Digi<span className="text-[#FF5733]">Market</span>
              </span>
            </Link>

            <div className="hidden min-w-0 items-center justify-center md:flex">
              <div className="flex h-11 items-center gap-1">
                {PUBLIC_NAV_ITEMS.map((item) => {
                  const active = isActivePath(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors ${
                        active
                          ? 'border-[#FF5733] text-[#141414]'
                          : 'border-transparent text-[#888] hover:text-[#141414]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
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
                        aria-label="Buka menu akun"
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
                            {!isDashboardSurface ? (
                              <Link
                                href="/dashboard"
                                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#333] hover:bg-[#F7F7F5]"
                              >
                                <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                              </Link>
                            ) : null}

                            <Link
                              href="/dashboard/profil"
                              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#333] hover:bg-[#F7F7F5]"
                            >
                              <UserCircle className="h-3.5 w-3.5" /> Profil
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

              <button
                onClick={handleToggleMobileMenu}
                className="p-2 md:hidden"
                aria-label="Toggle menu"
                aria-expanded={open}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-[90] md:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/35"
          />

          <div className="relative ml-auto flex h-full w-full min-h-0 flex-col overflow-hidden bg-white">
            <div className="flex items-center justify-between border-b border-[#EBEBEB] px-4 py-3">
              <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF5733]">
                  <ShoppingBag className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-extrabold">
                  Digi<span className="text-[#FF5733]">Market</span>
                </span>
              </Link>

              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EBEBEB]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              <div className="space-y-3 pb-6">
                {isAdminUser ? (
                  <section>
                    <button
                      type="button"
                      onClick={() => toggleMobileSection('nav')}
                      aria-expanded={mobileSectionsOpen.nav}
                      className="flex w-full items-center justify-between rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2.5"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#666]">Navigasi</span>
                      <ChevronDown
                        className={`h-4 w-4 text-[#888] transition-transform ${mobileSectionsOpen.nav ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {mobileSectionsOpen.nav ? (
                      <div className="mt-2 space-y-2">
                        {PUBLIC_NAV_ITEMS.map((item) => {
                          const active = isActivePath(pathname, item.href)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                                active
                                  ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                                  : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                              }`}
                              onClick={() => setOpen(false)}
                            >
                              <span>{item.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <section>
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#666]">Navigasi</p>
                    <div className="mt-2 space-y-2">
                      {PUBLIC_NAV_ITEMS.map((item) => {
                        const active = isActivePath(pathname, item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                              active
                                ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                                : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                            }`}
                            onClick={() => setOpen(false)}
                          >
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </section>
                )}

                {showAuthenticated ? (
                  isAdminUser ? (
                    <section>
                      <button
                        type="button"
                        onClick={() => toggleMobileSection('account')}
                        aria-expanded={mobileSectionsOpen.account}
                        className="flex w-full items-center justify-between rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2.5"
                      >
                        <div className="text-left">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[#666]">Akun</p>
                          <p className="max-w-[210px] truncate text-xs font-semibold text-[#333]">{firstName(user?.name)}</p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-[#888] transition-transform ${mobileSectionsOpen.account ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {mobileSectionsOpen.account ? (
                        <div className="mt-2 space-y-2">
                          <div className="rounded-xl border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-2.5">
                            <p className="truncate text-sm font-semibold text-[#141414]">{user?.name || 'User'}</p>
                            <p className="truncate text-xs text-[#888]">{user?.email || '-'}</p>
                          </div>

                          <Link
                            href="/dashboard"
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                              isActivePath(pathname, '/dashboard')
                                ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                                : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                            }`}
                            onClick={() => setOpen(false)}
                          >
                            <LayoutDashboard className="h-4 w-4" /> Dashboard
                          </Link>

                          <Link
                            href="/dashboard/wallet"
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                              isActivePath(pathname, '/dashboard/wallet')
                                ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                                : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                            }`}
                            onClick={() => setOpen(false)}
                          >
                            <Wallet className="h-4 w-4" /> Wallet
                          </Link>

                          <Link
                            href="/dashboard/convert/orders"
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                              isActivePath(pathname, '/dashboard/convert')
                                ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                                : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                            }`}
                            onClick={() => setOpen(false)}
                          >
                            <RefreshCw className="h-4 w-4" /> Riwayat Convert
                          </Link>

                          <Link
                            href="/dashboard/nokos"
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                              isActivePath(pathname, '/dashboard/nokos')
                                ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                                : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                            }`}
                            onClick={() => setOpen(false)}
                          >
                            <Smartphone className="h-4 w-4" /> Nomor Virtual
                          </Link>
                        </div>
                      ) : null}
                    </section>
                  ) : (
                    <section>
                      <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#666]">Akun</p>
                      <div className="mt-2 space-y-2">
                        <div className="rounded-xl border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-2.5">
                          <p className="truncate text-sm font-semibold text-[#141414]">{user?.name || 'User'}</p>
                          <p className="truncate text-xs text-[#888]">{user?.email || '-'}</p>
                        </div>

                        <Link
                          href="/dashboard"
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                            isActivePath(pathname, '/dashboard')
                              ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                              : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                          }`}
                          onClick={() => setOpen(false)}
                        >
                          <LayoutDashboard className="h-4 w-4" /> Dashboard
                        </Link>

                        <Link
                          href="/dashboard/wallet"
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                            isActivePath(pathname, '/dashboard/wallet')
                              ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                              : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                          }`}
                          onClick={() => setOpen(false)}
                        >
                          <Wallet className="h-4 w-4" /> Wallet
                        </Link>

                        <Link
                          href="/dashboard/convert/orders"
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                            isActivePath(pathname, '/dashboard/convert')
                              ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                              : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                          }`}
                          onClick={() => setOpen(false)}
                        >
                          <RefreshCw className="h-4 w-4" /> Riwayat Convert
                        </Link>

                        <Link
                          href="/dashboard/nokos"
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                            isActivePath(pathname, '/dashboard/nokos')
                              ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                              : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                          }`}
                          onClick={() => setOpen(false)}
                        >
                          <Smartphone className="h-4 w-4" /> Nomor Virtual
                        </Link>
                      </div>
                    </section>
                  )
                ) : null}

                {isAdminUser ? (
                  <section>
                    <button
                      type="button"
                      onClick={() => toggleMobileSection('admin')}
                      aria-expanded={mobileSectionsOpen.admin}
                      className="flex w-full items-center justify-between rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2.5"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#666]">Admin</span>
                      <ChevronDown
                        className={`h-4 w-4 text-[#888] transition-transform ${mobileSectionsOpen.admin ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {mobileSectionsOpen.admin ? (
                      <div className="mt-2">
                        <Link
                          href="/admin"
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                            isActivePath(pathname, '/admin')
                              ? 'border-[#FFD5C8] bg-[#FFF3EF] text-[#FF5733]'
                              : 'border-[#EBEBEB] text-[#141414] hover:bg-[#F7F7F5]'
                          }`}
                          onClick={() => setOpen(false)}
                        >
                          <Shield className="h-4 w-4" /> Admin Mode
                        </Link>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            </div>

            <div className="border-t border-[#EBEBEB] bg-white px-4 py-3">
              {showAuthenticated ? (
                <button
                  onClick={handleLogout}
                  disabled={logouting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#141414] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" /> {logouting ? 'Keluar...' : 'Keluar'}
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/login"
                    className="rounded-full border border-[#EBEBEB] py-2.5 text-center text-sm font-semibold"
                    onClick={() => setOpen(false)}
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-full bg-[#FF5733] py-2.5 text-center text-sm font-semibold text-white"
                    onClick={() => setOpen(false)}
                  >
                    Daftar
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
