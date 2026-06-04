"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { orderService } from '@/services/orderService'
import type { GuestOrderStatus } from '@/services/orderService'
import { formatRupiah } from '@/lib/utils'
import { useState } from 'react'
import { Loader2, Search, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

function statusBadge(status: string) {
  switch (status) {
    case 'paid':
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Lunas', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'active':
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Aktif', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'completed':
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Selesai', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'pending':
      return { icon: <Clock className="h-3.5 w-3.5" />, label: 'Menunggu Bayar', bg: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'failed':
      return { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Gagal', bg: 'bg-rose-50 text-rose-700 border-rose-200' }
    default:
      return { icon: <AlertCircle className="h-3.5 w-3.5" />, label: status, bg: 'bg-stone-50 text-stone-600 border-stone-200' }
  }
}

function formatDate(ts?: string | null) {
  if (!ts) return '-'
  try {
    return new Date(ts).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ts
  }
}

export default function LacakPesananPage() {
  const [orderID, setOrderID] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<GuestOrderStatus | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = orderID.trim()
    if (!id) {
      setError('Masukkan Order ID dari invoice kamu.')
      return
    }

    setLoading(true)
    setError('')
    setStatus(null)

    try {
      const res = await orderService.getGuestOrderStatus(id)
      if (res.success && res.data) {
        setStatus(res.data)
      } else {
        setError(res.message || 'Pesanan tidak ditemukan. Periksa kembali Order ID kamu.')
      }
    } catch {
      setError('Pesanan tidak ditemukan. Periksa kembali Order ID kamu.')
    } finally {
      setLoading(false)
    }
  }

  const orderStatus = status ? statusBadge(status.payment_status) : null
  const shortID = status?.order_id ? status.order_id.split('-')[0]?.toUpperCase() : ''

  return (
    <>
      <Navbar />

      <section className="py-12 md:py-16">
        <div className="max-w-lg mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#F7F7F5] border border-[#EBEBEB] mb-4">
              <Search className="h-6 w-6 text-[#FF5733]" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Lacak Pesanan</h1>
            <p className="mt-2 text-sm text-[#888] max-w-sm mx-auto">
              Masukkan Order ID dari invoice untuk cek status pesanan kamu.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#EBEBEB] bg-white p-6 space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#555] mb-1">
                <Search className="h-3.5 w-3.5" />
                Order ID / No. Invoice
              </label>
              <input
                type="text"
                value={orderID}
                onChange={(e) => setOrderID(e.target.value)}
                placeholder="d8a1b2c3-e456-..."
                className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733] font-mono"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 text-xs font-semibold text-[#B91C1C]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#141414] px-6 py-3 text-sm font-bold text-white hover:bg-[#2A2A2A] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Mengecek...</>
              ) : (
                'Cek Status'
              )}
            </button>
          </form>

          {/* Status card */}
          {status && orderStatus && (
            <div className="mt-6 rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
              <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#EBEBEB] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#888]">Order ID</div>
                  <div className="text-sm font-mono font-semibold text-[#141414]">{shortID || '-'}</div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${orderStatus.bg}`}>
                  {orderStatus.icon}
                  {orderStatus.label}
                </span>
              </div>

              <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#888]">Produk</span>
                  <span className="font-semibold text-[#141414]">{status.product_name || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#888]">Total</span>
                  <span className="font-semibold text-[#141414]">{formatRupiah(status.total_price || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#888]">Tanggal Order</span>
                  <span className="text-[#141414]">{formatDate(status.created_at)}</span>
                </div>
                {status.paid_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#888]">Tanggal Bayar</span>
                    <span className="text-[#141414]">{formatDate(status.paid_at)}</span>
                  </div>
                )}
              </div>

              {status.payment_status === 'paid' && (
                <div className="mx-5 h-px bg-[#EEEEEA] sm:mx-6" />
              )}
              {status.payment_status === 'paid' && (
                <div className="px-5 py-3 sm:px-6 sm:py-4 text-center">
                  <p className="text-xs text-[#888]">
                    Cek email yang dipakai saat checkout untuk link detail pesanan lengkap.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  )
}
