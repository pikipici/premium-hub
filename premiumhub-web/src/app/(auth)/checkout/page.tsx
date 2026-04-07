"use client"

import axios from 'axios'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/utils'
import { orderService } from '@/services/orderService'
import { paymentService } from '@/services/paymentService'
import { walletService } from '@/services/walletService'
import { useState, useEffect } from 'react'
import { ShieldCheck, CreditCard, Zap, Wallet } from 'lucide-react'

type CheckoutPaymentMethod = 'midtrans' | 'wallet'

export default function CheckoutPage() {
  const router = useRouter()
  const { item, clearCart } = useCartStore()
  const { isAuthenticated, hasHydrated } = useAuthStore()

  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('midtrans')
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletLoading, setWalletLoading] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasHydrated) return

    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    if (!item) {
      router.replace('/katalog')
    }
  }, [hasHydrated, isAuthenticated, item, router])

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return

    walletService.getBalance()
      .then((res) => {
        if (res.success) setWalletBalance(res.data.balance)
      })
      .catch(() => {})
      .finally(() => setWalletLoading(false))
  }, [hasHydrated, isAuthenticated])

  const hasEnoughWallet = item ? walletBalance >= item.price : false

  const handleCheckout = async () => {
    if (!item) return

    if (paymentMethod === 'wallet' && !hasEnoughWallet) {
      setError(`Saldo wallet kurang ${formatRupiah(item.price - walletBalance)}. Topup dulu, bos.`)
      return
    }

    setLoading(true)
    setError('')

    try {
      // Create order (payment_method disiapin, backend tinggal nyalain logic wallet-nya)
      const orderRes = await orderService.create({
        price_id: item.priceId,
        payment_method: paymentMethod,
      })
      if (!orderRes.success) {
        setError(orderRes.message)
        return
      }

      // Wallet mode: kalau backend sudah aktif, order harus langsung paid/active
      if (paymentMethod === 'wallet') {
        if (orderRes.data.payment_status === 'paid' || orderRes.data.order_status === 'active') {
          clearCart()
          router.push(`/order-sukses?id=${orderRes.data.id}`)
          return
        }

        // Safety net: kalau backend belum aktif wallet flow, jangan ninggalin pending order nyampah.
        await orderService.cancel(orderRes.data.id).catch(() => {})
        setError('Flow wallet order belum aktif penuh di backend. Struktur FE sudah siap, tinggal backend wallet checkout di-enable.')
        return
      }

      // Midtrans flow existing
      const payRes = await paymentService.create({ order_id: orderRes.data.id })
      if (!payRes.success) {
        setError(payRes.message)
        return
      }

      // Simulate payment (dev mode)
      await paymentService.simulate(orderRes.data.id)

      clearCart()
      router.push(`/order-sukses?id=${orderRes.data.id}`)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(message || 'Checkout gagal')
      } else {
        setError('Checkout gagal')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!hasHydrated || !item) return null

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

          {/* Payment Method */}
          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 mb-6">
            <h3 className="text-sm font-bold mb-4">Metode Pembayaran</h3>
            <div className="space-y-3">
              <div
                role="button"
                tabIndex={0}
                onClick={() => hasEnoughWallet && setPaymentMethod('wallet')}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && hasEnoughWallet) {
                    e.preventDefault()
                    setPaymentMethod('wallet')
                  }
                }}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  paymentMethod === 'wallet' && hasEnoughWallet
                    ? 'border-[#FF5733] bg-[#FFF3EF]'
                    : 'border-[#EBEBEB] bg-white'
                } ${!hasEnoughWallet ? 'opacity-80 cursor-default' : 'hover:bg-[#F7F7F5] cursor-pointer'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#F7F7F5] flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-[#141414]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Saldo Wallet</div>
                      <div className={`text-xs ${hasEnoughWallet ? 'text-[#888]' : 'text-red-600'}`}>
                        {walletLoading
                          ? 'Memuat saldo...'
                          : hasEnoughWallet
                            ? `Saldo kamu: ${formatRupiah(walletBalance)}`
                            : `Kurang ${formatRupiah(item.price - walletBalance)}`}
                      </div>
                    </div>
                  </div>

                  {!hasEnoughWallet ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push('/dashboard/wallet')
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#EBEBEB] hover:bg-[#F7F7F5]"
                    >
                      Top Up
                    </button>
                  ) : (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-bold">Instan</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPaymentMethod('midtrans')}
                className={`w-full rounded-xl border p-4 text-left hover:bg-[#F7F7F5] transition-colors ${
                  paymentMethod === 'midtrans' ? 'border-[#FF5733] bg-[#FFF3EF]' : 'border-[#EBEBEB] bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F7F7F5] flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-[#141414]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">QRIS / Virtual Account</div>
                    <div className="text-xs text-[#888]">Flow normal via Midtrans</div>
                  </div>
                </div>
              </button>
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
            {loading
              ? 'Memproses Pembayaran...'
              : paymentMethod === 'wallet'
                ? `Bayar Pakai Wallet ${formatRupiah(item.price)}`
                : `Bayar ${formatRupiah(item.price)}`}
          </button>

          <p className="text-xs text-center text-[#888] mt-4">
            Dengan melanjutkan, kamu menyetujui syarat dan ketentuan DigiMarket.
          </p>
        </div>
      </section>
      <Footer />
    </>
  )
}
