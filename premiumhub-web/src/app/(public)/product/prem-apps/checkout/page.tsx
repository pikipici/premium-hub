"use client"

import axios from 'axios'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Landmark, QrCode, ShieldCheck, Wallet, Zap } from 'lucide-react'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { formatRupiah } from '@/lib/utils'
import { orderService } from '@/services/orderService'
import { paymentService } from '@/services/paymentService'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'

type PakasirMethod = 'qris' | 'bri_va' | 'bni_va' | 'permata_va'
type CheckoutMethod = 'pakasir' | 'wallet'

const PAKASIR_METHOD_OPTIONS: Array<{ key: PakasirMethod; label: string; hint: string; icon: ReactNode }> = [
  { key: 'qris', label: 'QRIS', hint: 'Scan QRIS dari aplikasi e-wallet atau m-banking', icon: <QrCode className="w-4 h-4" /> },
  { key: 'bri_va', label: 'BRI Virtual Account', hint: 'Bayar via transfer VA BRI', icon: <Landmark className="w-4 h-4" /> },
  { key: 'bni_va', label: 'BNI Virtual Account', hint: 'Bayar via transfer VA BNI', icon: <Landmark className="w-4 h-4" /> },
  { key: 'permata_va', label: 'Permata Virtual Account', hint: 'Bayar via transfer VA Permata', icon: <Landmark className="w-4 h-4" /> },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { item, clearCart } = useCartStore()
  const { isAuthenticated, hasHydrated, walletBalance, setWalletBalance } = useAuthStore()

  const [checkoutMethod, setCheckoutMethod] = useState<CheckoutMethod>('pakasir')
  const [pakasirMethod, setPakasirMethod] = useState<PakasirMethod>('qris')
  const [walletLoading, setWalletLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasHydrated) return

    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    if (!item) {
      router.replace('/product/prem-apps')
    }
  }, [hasHydrated, isAuthenticated, item, router])

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return

    let cancelled = false
    setWalletLoading(true)

    walletService.getBalance()
      .then((res) => {
        if (cancelled || !res.success) return
        setWalletBalance(res.data.balance)
      })
      .catch(() => {
        // keep silent; checkout still can proceed via gateway
      })
      .finally(() => {
        if (!cancelled) {
          setWalletLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [hasHydrated, isAuthenticated, setWalletBalance])

  const walletSufficient = useMemo(() => {
    if (!item) return false
    return walletBalance >= item.price
  }, [item, walletBalance])

  const handleCheckout = async () => {
    if (!item) return

    if (checkoutMethod === 'wallet' && (!walletSufficient || walletLoading)) {
      setError('Saldo wallet belum cukup buat checkout ini. Topup dulu ya.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const orderRes = await orderService.create({
        price_id: item.priceId,
        payment_method: checkoutMethod,
      })
      if (!orderRes.success) {
        setError(orderRes.message)
        return
      }

      const payRes = await paymentService.create({
        order_id: orderRes.data.id,
        payment_method: checkoutMethod === 'wallet' ? 'wallet' : pakasirMethod,
      })
      if (!payRes.success) {
        setError(payRes.message)
        return
      }

      const payment = payRes.data

      if (payment.provider === 'wallet' || payment.payment_method === 'wallet') {
        if (typeof payment.wallet_balance_after === 'number') {
          setWalletBalance(payment.wallet_balance_after)
        }
        clearCart()
        router.push(`/product/prem-apps/checkout/success?id=${orderRes.data.id}`)
        return
      }

      clearCart()
      const query = new URLSearchParams({
        id: orderRes.data.id,
        paymentNumber: payment.payment_number || '',
        paymentMethod: payment.payment_method || pakasirMethod,
        gatewayOrderId: payment.gateway_order_id || '',
        amount: String(payment.total_payment || payment.amount || item.price),
        expiresAt: payment.expires_at || '',
      })
      router.push(`/product/prem-apps/checkout/invoice?${query.toString()}`)
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

          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 mb-6 space-y-3">
            <h3 className="text-sm font-bold mb-1">Metode Pembayaran</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCheckoutMethod('pakasir')}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  checkoutMethod === 'pakasir' ? 'border-[#FF5733] bg-[#FFF3EF]' : 'border-[#EBEBEB] bg-white hover:border-[#D8D8D8]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F7F7F5] flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-[#141414]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Pakasir Gateway</div>
                    <div className="text-xs text-[#888]">QRIS / Virtual Account otomatis via Pakasir</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCheckoutMethod('wallet')}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  checkoutMethod === 'wallet' ? 'border-[#FF5733] bg-[#FFF3EF]' : 'border-[#EBEBEB] bg-white hover:border-[#D8D8D8]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F7F7F5] flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-[#141414]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Wallet Balance</div>
                    <div className="text-xs text-[#888]">
                      {walletLoading ? 'Memuat saldo wallet...' : `Saldo: ${formatRupiah(walletBalance)}`}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {checkoutMethod === 'pakasir' ? (
              <div className="rounded-xl border border-[#EBEBEB] p-3 bg-[#FAFAF8] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#777]">Pilih channel Pakasir</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PAKASIR_METHOD_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPakasirMethod(option.key)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        pakasirMethod === option.key
                          ? 'border-[#141414] bg-white'
                          : 'border-[#E5E5E5] bg-white/70 hover:border-[#CFCFCF]'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#141414]">
                        {option.icon}
                        {option.label}
                      </div>
                      <div className="text-[11px] text-[#888] mt-1">{option.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className={`text-xs rounded-xl px-3 py-2 ${walletSufficient ? 'bg-[#F1FAF4] text-[#1B7A35]' : 'bg-[#FFF3EF] text-[#B7482A]'}`}>
                {walletLoading
                  ? 'Lagi cek saldo wallet...'
                  : walletSufficient
                    ? 'Saldo cukup. Checkout wallet akan langsung potong saldo dan aktifkan order.'
                    : 'Saldo wallet belum cukup. Topup dulu sebelum lanjut checkout.'}
              </p>
            )}
          </div>

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
            disabled={loading || (checkoutMethod === 'wallet' && (walletLoading || !walletSufficient))}
            className="w-full py-4 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 text-sm"
          >
            {loading
              ? checkoutMethod === 'wallet'
                ? 'Memproses Pembayaran Wallet...'
                : 'Memproses Pembayaran...'
              : checkoutMethod === 'wallet'
                ? `Bayar via Wallet ${formatRupiah(item.price)}`
                : `Buat Invoice ${formatRupiah(item.price)}`}
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
