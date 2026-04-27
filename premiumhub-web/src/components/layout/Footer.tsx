"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'

import { DEFAULT_PUBLIC_NAV_ITEMS, type PublicNavItem } from '@/lib/publicNavItems'
import {
  getNavbarMenuMemoryCache,
  NAVBAR_MENU_CACHE_EVENT,
  normalizeNavbarMenuItems,
  readNavbarMenuCache,
  writeNavbarMenuCache,
} from '@/lib/navbarMenuCache'
import { navbarMenuSettingService } from '@/services/navbarMenuSettingService'

const FOOTER_PRODUCT_LABEL_BY_HREF: Record<string, string> = {
  '/product/prem-apps': 'Apps Premium',
  '/product/nokos': 'Nomor Virtual OTP',
  '/product/sosmed': 'Sosmed SMM',
  '/product/convert': 'Convert Aset',
}

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const [productNavItems, setProductNavItems] = useState<PublicNavItem[]>(
    () => getNavbarMenuMemoryCache() || []
  )

  useEffect(() => {
    let cancelled = false

    const loadProductMenu = async () => {
      const cachedItems = readNavbarMenuCache()
      if (cachedItems !== null) {
        setProductNavItems(cachedItems)
      }

      try {
        const res = await navbarMenuSettingService.publicList()
        if (cancelled) return
        if (!res.success) {
          if (readNavbarMenuCache() === null) {
            setProductNavItems(DEFAULT_PUBLIC_NAV_ITEMS)
          }
          return
        }

        const visibleItems = normalizeNavbarMenuItems(res.data || [])
        writeNavbarMenuCache(visibleItems)
        setProductNavItems(visibleItems)
      } catch {
        if (!cancelled && readNavbarMenuCache() === null) {
          setProductNavItems(DEFAULT_PUBLIC_NAV_ITEMS)
        }
      }
    }

    void loadProductMenu()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleNavbarMenuCacheUpdate = () => {
      const cachedItems = readNavbarMenuCache()
      if (cachedItems !== null) {
        setProductNavItems(cachedItems)
      }
    }

    window.addEventListener(NAVBAR_MENU_CACHE_EVENT, handleNavbarMenuCacheUpdate)
    return () => {
      window.removeEventListener(NAVBAR_MENU_CACHE_EVENT, handleNavbarMenuCacheUpdate)
    }
  }, [])

  return (
    <footer className="bg-[#141414] text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#FF5733] rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-extrabold">Digi<span className="text-[#FF5733]">Market</span></span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Platform nomor virtual OTP dan jasa untuk bantu naikin follower, viewer, dan engagement akun media sosial Termurah dan Terpercaya No. 1 di Indonesia.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Produk</h4>
            <div className="space-y-2">
              {productNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {FOOTER_PRODUCT_LABEL_BY_HREF[item.href] ?? item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Bantuan</h4>
            <div className="space-y-2">
              <Link href="/faq" className="block text-sm text-gray-400 hover:text-white transition-colors">FAQ</Link>
              <Link href="/lupa-password" className="block text-sm text-gray-400 hover:text-white transition-colors">Lupa Password</Link>
              <Link href="/login" className="block text-sm text-gray-400 hover:text-white transition-colors">Masuk Akun</Link>
              <Link href="/register" className="block text-sm text-gray-400 hover:text-white transition-colors">Daftar Akun</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Legal</h4>
            <div className="space-y-2">
              <Link href="/legal/syarat-ketentuan" className="block text-sm text-gray-400 hover:text-white transition-colors">Syarat & Ketentuan</Link>
              <Link href="/legal/kebijakan-privasi" className="block text-sm text-gray-400 hover:text-white transition-colors">Kebijakan Privasi</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">© {currentYear} DigiMarket. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="text-sm text-gray-500">🇮🇩 Indonesia</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
