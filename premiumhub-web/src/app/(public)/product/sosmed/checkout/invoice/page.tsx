"use client"

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PakasirPaymentDisplay from '@/components/payment/PakasirPaymentDisplay'
import { formatRupiah } from '@/lib/utils'
import { sosmedOrderService } from '@/services/sosmedOrderService'

function parseExpiresAt(raw: string | null) {
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export default function SosmedInvoicePage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <div className="py-32 text-center text-sm text-[#888]">Memuat invoice sosmed...</div>
          <Footer />
        </>
      }
    >
      <SosmedInvoiceContent />
    </Suspense>
  )
}

function SosmedInvoiceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderID = searchParams.get('id') || ''
  const paymentNumber = searchParams.get('paymentNumber') || ''
  const paymentMethod = searchParams.get('paymentMethod') || 'qris'
  const gatewayOrderID = searchParams.get('gatewayOrderId') || ''
  const amount = Number(searchParams.get('amount') || '0') || 0
  const expiresAt = parseExpiresAt(searchParams.get('expiresAt'))

  const [checking, setChecking] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed' | 'expired'>('pending')
  const [orderStatus, setOrderStatus] = useState('pending_payment')

  useEffect(() => {
    if (!orderID) {
      router.replace('/product/sosmed')
      return
    }

    let canceled = false

    const checkStatus = async () => {
      if (canceled) return
      setChecking(true)
      try {
        const res = await sosmedOrderService.getPaymentStatus(orderID)
        if (!res.success) return

        const nextPaymentStatus = (res.data.payment_status || 'pending') as 'pending' | 'paid' | 'failed' | 'expired'
        const nextOrderStatus = res.data.order_status || 'pending_payment'

        setPaymentStatus(nextPaymentStatus)
        setOrderStatus(nextOrderStatus)

        if (nextPaymentStatus === 'paid') {
          router.replace(`/product/sosmed/checkout/success?id=${encodeURIComponent(orderID)}`)
        }
      } finally {
        if (!canceled) setChecking(false)
      }
    }

    void checkStatus()

    const interval = setInterval(() => {
      void checkStatus()
    }, 12000)

    return () => {
      canceled = true
      clearInterval(interval)
    }
  }, [orderID, router])

  const statusText = useMemo(() => {
    if (paymentStatus === 'paid') return 'Pembayaran terkonfirmasi'
    if (paymentStatus === 'failed') return 'Pembayaran gagal'
    if (paymentStatus === 'expired') return 'Invoice expired'
    if (orderStatus === 'processing') return 'Order diproses'
    return 'Menunggu pembayaran'
  }, [orderStatus, paymentStatus])

  return (
    <>
      <Navbar />
      <section className="py-12 md:py-16">
        <div className="max-w-xl mx-auto px-4">
          <h1 className="text-2xl font-extrabold mb-2 text-center">Invoice Sosmed</h1>
          <p className="text-center text-sm text-[#888] mb-8">Selesaikan pembayaran biar order langsung masuk ke antrean proses.</p>

          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-5 mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#888]">Order ID</span>
              <span className="font-semibold">{orderID}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#888]">Status</span>
              <span className="font-semibold">{statusText}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2 gap-4">
              <span className="text-[#888]">Gateway Ref</span>
              <span className="font-mono text-xs text-right break-all">{gatewayOrderID || '-'}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#888]">Berlaku sampai</span>
              <span className="font-semibold">
                {expiresAt
                  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(expiresAt)
                  : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#888]">Total Bayar</span>
              <span className="text-lg font-extrabold text-[#FF5733]">{formatRupiah(amount)}</span>
            </div>
          </div>

          <PakasirPaymentDisplay
            paymentNumber={paymentNumber}
            paymentMethod={paymentMethod}
          />

          <div className="mt-4 rounded-xl border border-[#EBEBEB] bg-white px-4 py-3 text-xs text-[#666]">
            {checking ? 'Sync status pembayaran...' : 'Status pembayaran dicek otomatis tiap 12 detik.'}
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}
