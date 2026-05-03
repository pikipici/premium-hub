"use client"

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { formatRupiah } from '@/lib/utils'
import { sosmedBundleService } from '@/services/sosmedBundleService'
import { sosmedOrderService } from '@/services/sosmedOrderService'
import type { SosmedBundleOrder } from '@/types/sosmedBundle'
import type { SosmedOrderDetail } from '@/types/sosmedOrder'

function orderStatusText(status?: string) {
  switch (status) {
    case 'processing':
      return 'Diproses'
    case 'partial':
      return 'Sebagian Diproses'
    case 'completed':
    case 'success':
      return 'Sukses'
    case 'failed':
      return 'Gagal'
    case 'cancelled':
    case 'canceled':
      return 'Dibatalkan'
    case 'expired':
      return 'Expired'
    default:
      return 'Pending'
  }
}

export default function SosmedCheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <div className="py-32 text-center text-sm text-[#888]">Memuat status order sosmed...</div>
          <Footer />
        </>
      }
    >
      <SosmedCheckoutSuccessContent />
    </Suspense>
  )
}

function SosmedCheckoutSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderID = searchParams.get('id') || ''
  const bundleOrderNumber = searchParams.get('order') || ''
  const isBundleOrder = searchParams.get('type') === 'bundle' || Boolean(bundleOrderNumber)

  const [detail, setDetail] = useState<SosmedOrderDetail | null>(null)
  const [bundleDetail, setBundleDetail] = useState<SosmedBundleOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isBundleOrder) {
      if (!bundleOrderNumber) {
        router.replace('/product/sosmed')
        return
      }

      let alive = true

      sosmedBundleService
        .getOrderByNumber(bundleOrderNumber)
        .then((res) => {
          if (!alive) return
          if (!res.success) {
            setError(res.message || 'Order bundle sosmed tidak ditemukan')
            return
          }
          setBundleDetail(res.data)
        })
        .catch(() => {
          if (!alive) return
          setError('Gagal memuat detail order bundle sosmed')
        })
        .finally(() => {
          if (alive) setLoading(false)
        })

      return () => {
        alive = false
      }
    }

    if (!orderID) {
      router.replace('/product/sosmed')
      return
    }

    let alive = true

    sosmedOrderService
      .getByID(orderID)
      .then((res) => {
        if (!alive) return
        if (!res.success) {
          setError(res.message || 'Order sosmed tidak ditemukan')
          return
        }
        setDetail(res.data)
      })
      .catch(() => {
        if (!alive) return
        setError('Gagal memuat detail order sosmed')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [bundleOrderNumber, isBundleOrder, orderID, router])

  const order = detail?.order
  const status = useMemo(() => orderStatusText(isBundleOrder ? bundleDetail?.status : order?.order_status), [bundleDetail?.status, isBundleOrder, order?.order_status])

  return (
    <>
      <Navbar />
      <section className="py-12 md:py-16">
        <div className="max-w-xl mx-auto px-4">
          <div className="rounded-2xl border border-[#D6F5DF] bg-[#ECFFF2] p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
            <h1 className="text-2xl font-extrabold text-[#141414]">Pembayaran Wallet Berhasil</h1>
            <p className="mt-2 text-sm text-[#3A7A4A]">
              Yeayy !! Pembelian kamu berhasil, Order kamu akan segera di proses, Mohon menunggu 🙏🙏
            </p>
          </div>

          {loading ? (
            <div className="mt-4 rounded-2xl border border-[#EBEBEB] bg-white p-6 text-center text-sm text-[#888]">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat detail order...
              </span>
            </div>
          ) : error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : bundleDetail ? (
            <div className="mt-4 rounded-2xl border border-[#EBEBEB] bg-white p-6 space-y-3">
              <div className="flex items-center justify-between text-sm gap-4">
                <span className="text-[#888]">Nomor Order</span>
                <span className="font-semibold text-[#141414] text-right">{bundleDetail.order_number}</span>
              </div>
              <div className="flex items-center justify-between text-sm gap-4">
                <span className="text-[#888]">Paket</span>
                <span className="font-semibold text-[#141414] text-right">{bundleDetail.title_snapshot}</span>
              </div>
              <div className="flex items-center justify-between text-sm gap-4">
                <span className="text-[#888]">Target</span>
                <span className="font-semibold text-[#141414] text-right">{bundleDetail.target_link || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm gap-4">
                <span className="text-[#888]">Status</span>
                <span className="font-semibold text-[#141414]">{status}</span>
              </div>
              <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#888]">Item Diproses</p>
                <div className="space-y-2">
                  {(bundleDetail.items || []).map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 text-xs">
                      <span className="font-semibold text-[#444]">{item.service_title_snapshot}</span>
                      <span className="text-right font-bold text-[#141414]">
                        {item.quantity_units.toLocaleString('id-ID')} unit • {orderStatusText(item.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Total</span>
                <span className="text-lg font-extrabold text-[#FF5733]">{formatRupiah(bundleDetail.total_price)}</span>
              </div>
            </div>
          ) : order ? (
            <div className="mt-4 rounded-2xl border border-[#EBEBEB] bg-white p-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Order ID</span>
                <span className="font-semibold text-[#141414]">{order.id}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Layanan</span>
                <span className="font-semibold text-[#141414] text-right">{order.service_title}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Target</span>
                <span className="font-semibold text-[#141414] text-right">{order.target_link || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Status</span>
                <span className="font-semibold text-[#141414]">{status}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Total</span>
                <span className="text-lg font-extrabold text-[#FF5733]">{formatRupiah(order.total_price)}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              href="/dashboard/sosmed/orders"
              className="inline-flex items-center justify-center rounded-full bg-[#141414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#000]"
            >
              Lihat Order Sosmed
            </Link>
            <Link
              href="/product/sosmed"
              className="inline-flex items-center justify-center rounded-full border border-[#141414] px-4 py-2.5 text-sm font-semibold text-[#141414] hover:bg-[#141414] hover:text-white"
            >
              Balik ke Katalog
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}
