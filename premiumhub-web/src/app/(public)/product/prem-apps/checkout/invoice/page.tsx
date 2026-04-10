"use client"

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { paymentService } from '@/services/paymentService'
import { formatDate, formatRupiah } from '@/lib/utils'
import { CheckCircle, Copy, RefreshCcw } from 'lucide-react'

export default function CheckoutInvoicePage() {
  return (
    <Suspense fallback={<><Navbar /><div className="py-32 text-center text-[#888]">Loading...</div><Footer /></>}>
      <CheckoutInvoiceContent />
    </Suspense>
  )
}

function CheckoutInvoiceContent() {
  const router = useRouter()
  const search = useSearchParams()

  const orderId = search.get('id') || ''
  const paymentNumber = search.get('paymentNumber') || ''
  const paymentMethod = search.get('paymentMethod') || '-'
  const gatewayOrderId = search.get('gatewayOrderId') || '-'
  const expiresAt = search.get('expiresAt') || ''
  const amount = Number(search.get('amount') || 0)

  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const expireText = useMemo(() => {
    if (!expiresAt) return '-'
    return formatDate(expiresAt)
  }, [expiresAt])

  const handleCopy = async () => {
    if (!paymentNumber) return
    await navigator.clipboard.writeText(paymentNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleCheckStatus = async () => {
    if (!orderId) return
    setChecking(true)
    setError('')
    try {
      const res = await paymentService.getStatus(orderId)
      if (!res.success) {
        setError(res.message || 'Gagal cek status pembayaran')
        return
      }

      if (res.data.payment_status === 'paid' || res.data.order_status === 'active') {
        router.push(`/product/prem-apps/checkout/success?id=${orderId}`)
        return
      }

      setError('Pembayaran belum masuk. Coba cek lagi beberapa saat.')
    } catch {
      setError('Gagal cek status pembayaran')
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <Navbar />
      <section className="py-12 md:py-16">
        <div className="max-w-xl mx-auto px-4 space-y-4">
          <h1 className="text-2xl font-extrabold text-center">Invoice Pembayaran</h1>
          <p className="text-sm text-[#777] text-center">Selesaikan pembayaran dulu, lalu cek status untuk aktivasi order.</p>

          <div className="rounded-2xl border border-[#EBEBEB] bg-white p-5 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Order ID</span>
              <span className="font-semibold">{orderId || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Gateway Ref</span>
              <span className="font-semibold">{gatewayOrderId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Metode</span>
              <span className="font-semibold uppercase">{paymentMethod}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Total dibayar</span>
              <span className="font-bold text-[#141414]">{amount > 0 ? formatRupiah(amount) : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888]">Kadaluarsa</span>
              <span className="font-semibold">{expireText}</span>
            </div>

            <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-3">
              <div className="text-xs text-[#777] mb-1">Payment Number / QR String</div>
              <div className="font-mono text-xs break-all text-[#141414]">{paymentNumber || '-'}</div>
              {paymentNumber ? (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-[#E2E2E2] hover:bg-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Tersalin' : 'Copy'}
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 text-red-600 text-sm px-3 py-2 text-center">{error}</div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={checking || !orderId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF5733] px-4 py-3 text-sm font-bold text-white hover:bg-[#e64d2e] disabled:opacity-60"
            >
              {checking ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Cek Status Pembayaran
            </button>
            <Link
              href="/dashboard/riwayat-order"
              className="inline-flex items-center justify-center rounded-xl border border-[#E2E2E2] px-4 py-3 text-sm font-semibold hover:bg-[#F7F7F5]"
            >
              Lihat Riwayat Order
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}
