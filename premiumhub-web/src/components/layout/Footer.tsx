import { ShoppingBag } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-[#141414] text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8">
          <div>
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
