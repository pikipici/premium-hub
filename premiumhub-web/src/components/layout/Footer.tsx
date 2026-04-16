import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'

export default function Footer() {
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
              Platform marketplace akun premium terpercaya dengan garansi 30 hari.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Produk</h4>
            <div className="space-y-2">
              <Link href="/product/prem-apps" className="block text-sm text-gray-400 hover:text-white transition-colors">Apps Premium</Link>
              <Link href="/product/nokos" className="block text-sm text-gray-400 hover:text-white transition-colors">Nomor Virtual OTP</Link>
              <Link href="/product/sosmed" className="block text-sm text-gray-400 hover:text-white transition-colors">Sosmed SMM</Link>
              <Link href="/product/convert" className="block text-sm text-gray-400 hover:text-white transition-colors">Convert Aset</Link>
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
              <span className="block text-sm text-gray-400">Syarat & Ketentuan</span>
              <span className="block text-sm text-gray-400">Kebijakan Privasi</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">© 2026 DigiMarket. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="text-sm text-gray-500">🇮🇩 Indonesia</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
