"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Clock, RefreshCcw } from 'lucide-react'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import GatewayPaymentDisplay from '@/components/payment/GatewayPaymentDisplay'
import { sosmedOrderService } from '@/services/sosmedOrderService'

export default function SosmedCheckoutWaitingPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <div className="py-32 text-center text-[#888] text-sm">Memuat invoice...</div>
          <Footer />
        </>
      }
    >
      <SosmedCheckoutWaitingContent />
    </Suspense>
  )
}

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) return
    const target = new Date(expiresAt).getTime()
    if (isNaN(target)) return

    const tick = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000))
      setRemaining(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return remaining
}

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return '-'
  if (seconds <= 0) return 'Kadaluarsa'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function SosmedCheckoutWaitingContent() {
  const router = useRouter()
  const search = useSearchParams()

  const orderId = search.get('order') || ''
  const paymentUrl = search.get('payment_url') || ''
  const paymentNumber = search.get('payment_number') || ''
  const expiresAt = search.get('expires_at') || ''
  const method = search.get('method') || 'qris'

  const remaining = useCountdown(expiresAt || null)
  const isExpired = remaining !== null && remaining <= 0

  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [paid, setPaid] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleCheckStatus = async () => {
    if (!orderId) return
    setChecking(true)
    setError('')
    try {
      const res = await sosmedOrderService.getPaymentStatus(orderId)
      if (!res.success) {
        setError(res.message || 'Gagal cek status pembayaran')
        return
      }
      if (res.data.payment_status === 'paid' || res.data.order_status === 'processing' || res.data.order_status === 'success') {
        setPaid(true)
        setTimeout(() => {
          router.push(`/product/sosmed/checkout/success?id=${encodeURIComponent(orderId)}`)
        }, 1500)
        return
      }
      setError('Pembayaran belum masuk. Coba cek lagi beberapa saat.')
    } catch {
      setError('Gagal cek status pembayaran')
    } finally {
      setChecking(false)
    }
  }

  // Auto-polling setiap 8 detik
  useEffect(() => {
    if (!orderId || isExpired || paid) return
    pollingRef.current = setInterval(() => {
      sosmedOrderService.getPaymentStatus(orderId).then((res) => {
        if (!res.success) return
        if (res.data.payment_status === 'paid' || res.data.order_status === 'processing' || res.data.order_status === 'success') {
          setPaid(true)
          router.push(`/product/sosmed/checkout/success?id=${encodeURIComponent(orderId)}`)
        }
      }).catch(() => {})
    }, 8000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [orderId, isExpired, paid, router])

  const methodLabel = useMemo(() => {
    const m = method.toLowerCase()
    if (m.includes('qris')) return 'QRIS'
    if (m.includes('bca')) return 'BCA Virtual Account'
    if (m.includes('bni')) return 'BNI Virtual Account'
    if (m.includes('bri')) return 'BRI Virtual Account'
    if (m.includes('mandiri')) return 'Mandiri Virtual Account'
    if (m.includes('dana')) return 'DANA'
    if (m.includes('ovo')) return 'OVO'
    if (m.includes('shopeepay')) return 'ShopeePay'
    return method.toUpperCase()
  }, [method])

  if (!orderId) {
    return (
      <>
        <Navbar />
        <section className="py-16">
          <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <h1 className="text-lg font-extrabold text-red-700">Invoice tidak ditemukan</h1>
            <p className="mt-2 text-sm text-red-600">Parameter order tidak valid.</p>
            <Link href="/product/sosmed" className="mt-4 inline-block text-sm font-semibold text-[#FF5733] hover:underline">
              Kembali ke Katalog
            </Link>
          </div>
        </section>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-xl px-4 space-y-5">

          {paid ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
              <CheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
              <h1 className="text-xl font-extrabold text-emerald-700">Pembayaran Dikonfirmasi!</h1>
              <p className="text-sm text-emerald-600">Mengarahkan ke halaman sukses...</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-extrabold">Invoice Pembayaran</h1>
                <p className="text-sm text-[#777]">
                  Selesaikan pembayaran menggunakan <span className="font-semibold">{methodLabel}</span>.
                  Order diproses otomatis setelah pembayaran dikonfirmasi.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#888]">Order ID</span>
                  <span className="font-mono text-xs font-semibold truncate max-w-[200px]">{orderId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#888]">Metode</span>
                  <span className="font-semibold">{methodLabel}</span>
                </div>
                {expiresAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#888]">Sisa waktu</span>
                    <span className={`font-bold tabular-nums ${
                      isExpired ? 'text-red-600' : remaining !== null && remaining < 120 ? 'text-amber-600' : 'text-[#141414]'
                    }`}>
                      <Clock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                      {formatCountdown(remaining)}
                    </span>
                  </div>
                )}
              </div>

              {isExpired ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                  Invoice sudah kadaluarsa. Buat order baru untuk melanjutkan pembelian.
                </div>
              ) : (
                <GatewayPaymentDisplay
                  paymentMethod={method}
                  paymentNumber={paymentNumber}
                  paymentUrl={paymentUrl}
                />
              )}

              {error && (
                <div className="rounded-xl bg-red-50 text-red-600 text-sm px-3 py-2 text-center">{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={checking || isExpired}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF5733] px-4 py-3 text-sm font-bold text-white hover:bg-[#e64d2e] disabled:opacity-60"
                >
                  {checking
                    ? <RefreshCcw className="w-4 h-4 animate-spin" />
                    : <CheckCircle className="w-4 h-4" />}
                  Cek Status Pembayaran
                </button>
                <Link
                  href="/dashboard/sosmed/orders"
                  className="inline-flex items-center justify-center rounded-xl border border-[#E2E2E2] px-4 py-3 text-sm font-semibold hover:bg-[#F7F7F5]"
                >
                  Lihat Riwayat Order
                </Link>
              </div>

              <p className="text-center text-xs text-[#999]">
                Halaman ini otomatis mengecek status pembayaran setiap beberapa detik.
              </p>
            </>
          )}

        </div>
      </section>
      <Footer />
    </>
  )
}
