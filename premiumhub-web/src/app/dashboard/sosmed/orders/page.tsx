"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'

import { formatRupiah } from '@/lib/utils'
import { sosmedOrderService } from '@/services/sosmedOrderService'
import type { SosmedOrder } from '@/types/sosmedOrder'

const PAGE_SIZE = 10

function statusMeta(order: SosmedOrder) {
  if (order.order_status === 'success') {
    return { label: 'Sukses', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  }
  if (order.order_status === 'processing') {
    return { label: 'Diproses', className: 'bg-sky-100 text-sky-700 border-sky-200' }
  }
  if (order.order_status === 'failed') {
    return { label: 'Gagal', className: 'bg-red-100 text-red-700 border-red-200' }
  }
  if (order.order_status === 'canceled') {
    return { label: 'Dibatalkan', className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
  if (order.order_status === 'expired') {
    return { label: 'Expired', className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
  return { label: 'Menunggu Bayar', className: 'bg-amber-100 text-amber-700 border-amber-200' }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function DashboardSosmedOrdersPage() {
  const [orders, setOrders] = useState<SosmedOrder[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const loadOrders = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const res = await sosmedOrderService.list({ page, limit: PAGE_SIZE })
      if (!res.success) {
        setError(res.message || 'Gagal memuat order sosmed')
        return
      }

      setOrders(res.data || [])
      setTotal(res.meta?.total ?? (res.data || []).length)
    } catch {
      setError('Gagal memuat order sosmed')
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleCancel = async (order: SosmedOrder) => {
    if (order.order_status !== 'pending_payment') return

    const confirmed = window.confirm(`Batalkan order ${order.id}?`)
    if (!confirmed) return

    setRefreshing(true)
    setError('')

    try {
      const res = await sosmedOrderService.cancel(order.id)
      if (!res.success) {
        setError(res.message || 'Gagal membatalkan order sosmed')
        return
      }
      await loadOrders(true)
    } catch {
      setError('Gagal membatalkan order sosmed')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Order Sosmed</h1>
          <p className="mt-1 text-sm text-[#888]">Pantau status pembayaran dan progres layanan sosmed lu.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadOrders(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#EBEBEB] bg-white px-3 py-2 text-xs font-bold text-[#555] hover:bg-[#FAFAF8] disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>

          <Link
            href="/product/sosmed"
            className="inline-flex items-center justify-center rounded-lg bg-[#FF5733] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64d2e]"
          >
            Order Baru
          </Link>
        </div>
      </header>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</section>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-[#EBEBEB] bg-white p-8 text-center text-sm text-[#888]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat order sosmed...
          </span>
        </section>
      ) : orders.length === 0 ? (
        <section className="rounded-2xl border border-[#EBEBEB] bg-white p-6 text-center">
          <p className="text-sm text-[#666]">Belum ada order sosmed.</p>
          <p className="mt-1 text-xs text-[#888]">Begitu lu checkout dari katalog, order akan muncul di sini.</p>
        </section>
      ) : (
        <section className="space-y-2">
          {orders.map((order) => {
            const status = statusMeta(order)

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-[#EBEBEB] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-[#141414]">{order.id}</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#888]">{formatDate(order.created_at)}</p>
                    <p className="mt-2 text-sm font-semibold text-[#141414]">{order.service_title}</p>
                    <p className="text-xs text-[#666]">Target: {order.target_link || '-'}</p>
                  </div>

                  <div className="text-left md:text-right">
                    <div className="text-sm font-bold text-[#141414]">{formatRupiah(order.total_price)}</div>
                    <div className="text-xs text-[#666]">Payment: {order.payment_status}</div>
                    {order.order_status === 'pending_payment' ? (
                      <button
                        type="button"
                        onClick={() => void handleCancel(order)}
                        className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50"
                      >
                        Batalkan
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {!loading && total > 0 ? (
        <section className="rounded-2xl border border-[#EBEBEB] bg-white p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#666]">
              Menampilkan <span className="font-bold text-[#141414]">{orders.length}</span> item dari total{' '}
              <span className="font-bold text-[#141414]">{total}</span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-lg border border-[#EBEBEB] px-3 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:opacity-60"
              >
                ← Prev
              </button>
              <span className="text-xs font-semibold text-[#666]">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-lg border border-[#EBEBEB] px-3 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:opacity-60"
              >
                Next →
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
