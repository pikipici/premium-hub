"use client"

import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { useState } from 'react'
import { Menu, X, ShoppingBag, User, LogOut, LayoutDashboard, Shield } from 'lucide-react'
import WalletBadge from '@/components/shared/WalletBadge'
import { authService } from '@/services/authService'

export default function Navbar() {
  const { user, isAuthenticated, logout, hasHydrated } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [logouting, setLogouting] = useState(false)

  const showAuthenticated = hasHydrated && isAuthenticated

  const handleLogout = async () => {
    if (logouting) return
    setLogouting(true)
    try {
      await authService.logout()
    } catch {
      // Ignore API logout failure, local state still needs to be cleared.
    } finally {
      logout()
      setOpen(false)
      setLogouting(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[#EBEBEB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF5733] rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-extrabold">Digi<span className="text-[#FF5733]">Market</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/product/prem-apps" className="text-sm font-medium text-[#888] hover:text-[#141414] transition-colors">Apps</Link>
            <Link href="/product/convert" className="text-sm font-medium text-[#888] hover:text-[#141414] transition-colors">Convert Aset</Link>
            <Link href="/faq" className="text-sm font-medium text-[#888] hover:text-[#141414] transition-colors">FAQ</Link>
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {showAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link href="/admin" className="flex items-center gap-1.5 text-sm font-medium text-[#888] hover:text-[#141414] transition-colors">
                    <Shield className="w-4 h-4" /> Admin
                  </Link>
                )}
                <Link href="/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-[#888] hover:text-[#141414] transition-colors">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <WalletBadge />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F7F7F5] rounded-full">
                  <User className="w-4 h-4 text-[#888]" />
                  <span className="text-sm font-medium">{user?.name}</span>
                </div>
                <button onClick={handleLogout} className="p-2 text-[#888] hover:text-red-500 transition-colors" disabled={logouting}>
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-semibold text-[#141414] hover:text-[#FF5733] transition-colors px-4 py-2">
                  Masuk
                </Link>
                <Link href="/register" className="text-sm font-semibold text-white bg-[#FF5733] hover:bg-[#e64d2e] px-5 py-2.5 rounded-full transition-colors">
                  Daftar
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setOpen(!open)} className="md:hidden p-2">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 border-t border-[#EBEBEB] mt-2 pt-4 space-y-3">
            <Link href="/product/prem-apps" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>Apps</Link>
            <Link href="/product/convert" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>Convert Aset</Link>
            <Link href="/faq" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>FAQ</Link>
            {showAuthenticated ? (
              <>
                <Link href="/dashboard" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>Dashboard</Link>
                <Link href="/dashboard/wallet" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>Wallet</Link>
                <Link href="/dashboard/convert/orders" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>Convert</Link>
                <Link href="/dashboard/nokos" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>Nomor Virtual</Link>
                {user?.role === 'admin' && <Link href="/admin" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>Admin Panel</Link>}
                <button onClick={handleLogout} className="block text-sm font-medium text-red-500 py-2" disabled={logouting}>Logout</button>
              </>
            ) : (
              <div className="flex gap-3 pt-2">
                <Link href="/login" className="flex-1 text-center text-sm font-semibold py-2.5 border border-[#EBEBEB] rounded-full" onClick={() => setOpen(false)}>Masuk</Link>
                <Link href="/register" className="flex-1 text-center text-sm font-semibold text-white bg-[#FF5733] py-2.5 rounded-full" onClick={() => setOpen(false)}>Daftar</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
