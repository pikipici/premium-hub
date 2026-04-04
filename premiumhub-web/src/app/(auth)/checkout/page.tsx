"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/utils'
import { orderService } from '@/services/orderService'
import { paymentService } from '@/services/paymentService'
import { useState, useEffect } from 'react'
import { ShieldCheck, CreditCard, Zap } from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const { item, clearCart } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
    if (!item) router.push('/katalog')
  }, [isAuthenticated, item, router])

  const handleCheckout = async () => {
    if (!item) return
    setLoading(true)
    setError('')
    try {
      // Create order
      const orderRes = await orderService.create({ price_id: item.priceId })
      if (!orderRes.success) { setError(orderRes.message); return }

      // Create payment
      const payRes = await paymentService.create({ order_id: orderRes.data.id })
      if (!payRes.success) { setError(payRes.message); return }

      // Simulate payment (dev mode)
      await paymentService.simulate(orderRes.data.id)

      clearCart()
      router.push(`/order-sukses?id=${orderRes.data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Checkout gagal')
    } finally {
      setLoading(false)
    }
  }

  if (!item) return null

  return (
    <>
      <Navbar />
      <section className="py-12 md:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-2xl font-extrabold mb-8 text-center">Checkout</h1>

          {/* Order Summary */}
          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 mb-6">
            <h3 className="text-sm font-bold mb-4">Ringkasan Order</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#888]">Produk</span>
                <span className="font-semibold">{item.productName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#888]">Tipe Akun</span>
                <span className="font-semibold capitalize">{item.accountType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#888]">Durasi</span>
                <span className="font-semibold">{item.duration} Bulan</span>
              </div>
              <div className="border-t border-[#EBEBEB] pt-3 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="text-xl font-extrabold text-[#FF5733]">{formatRupiah(item.price)}</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-[#F7F7F5] rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { icon: <Zap className="w-5 h-5" />, text: 'Pengiriman Instan' },
                { icon: <ShieldCheck className="w-5 h-5" />, text: 'Garansi 30 Hari' },
                { icon: <CreditCard className="w-5 h-5" />, text: 'Pembayaran Aman' },
              ].map((f, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="text-[#FF5733]">{f.icon}</div>
                  <span className="text-xs font-medium text-[#888]">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-6 text-center font-medium">{error}</div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-4 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'Memproses Pembayaran...' : `Bayar ${formatRupiah(item.price)}`}
          </button>

          <p className="text-xs text-center text-[#888] mt-4">
            Dengan melanjutkan, kamu menyetujui syarat dan ketentuan PremiumHub.
          </p>
        </div>
      </section>
      <Footer />
    </>
  )
}
