"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleDashed, Clock3, Link2, Loader2, RefreshCcw, RotateCcw } from 'lucide-react'

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

function refillMeta(order: SosmedOrder) {
  if (!order.refill_eligible) return null

  const status = (order.refill_status || 'none').toLowerCase()
  const deadlineStr = order.refill_deadline
  const isExpired = deadlineStr ? new Date(deadlineStr) < new Date() : false

  if (status === 'requested' || status === 'processing') {
    return { label: 'Refill Diproses', className: 'bg-sky-50 text-sky-600 border-sky-200', canClaim: false }
  }
  if (status === 'completed') {
    return { label: 'Refill Selesai', className: 'bg-emerald-50 text-emerald-600 border-emerald-200', canClaim: false }
  }
  if (status === 'rejected') {
    return { label: 'Refill Ditolak', className: 'bg-red-50 text-red-600 border-red-200', canClaim: false }
  }
  if (isExpired) {
    return { label: 'Refill Expired', className: 'bg-gray-50 text-gray-500 border-gray-200', canClaim: false }
  }
  if (!deadlineStr) {
    return { label: 'Refill Perlu Dicek Admin', className: 'bg-amber-50 text-amber-600 border-amber-200', canClaim: false }
  }

  // Eligible & can claim (status is none or failed)
  const canClaim = order.order_status === 'success' && !isExpired
  if (status === 'failed') {
    return { label: 'Refill Gagal', className: 'bg-red-50 text-red-600 border-red-200', canClaim }
  }
  return { label: `Refill ${order.refill_period_days || ''}${order.refill_period_days ? ' Hari' : ''}`, className: 'bg-violet-50 text-violet-600 border-violet-200', canClaim }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatDeadline(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

function shortOrderID(id: string) {
  return id ? `#${id.slice(0, 8).toUpperCase()}` : '#ORDER'
}

function compactTarget(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return '-'

  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
}

function paymentLabel(value: SosmedOrder['payment_status']) {
  switch (value) {
    case 'paid':
      return 'Paid'
    case 'pending':
      return 'Menunggu Bayar'
    case 'failed':
      return 'Gagal Bayar'
    case 'expired':
      return 'Expired'
    default:
      return value || '-'
  }
}

function progressSteps(order: SosmedOrder) {
  const paid = order.payment_status === 'paid'
  const processing = order.order_status === 'processing'
  const success = order.order_status === 'success'
  const failed = order.order_status === 'failed' || order.order_status === 'canceled' || order.order_status === 'expired'

  return [
    {
      key: 'paid',
      label: 'Dibayar',
      done: paid,
      active: !paid && !failed,
    },
    {
      key: 'process',
      label: 'Diproses',
      done: success,
      active: paid && processing,
    },
    {
      key: 'done',
      label: success ? 'Selesai' : failed ? 'Tertahan' : 'Selesai',
      done: success,
      active: failed,
      danger: failed,
    },
  ]
}

function refillTitle(status?: string) {
  const value = (status || 'none').toLowerCase()
  if (value === 'requested' || value === 'processing') return 'Refill Sedang Diproses'
  if (value === 'completed') return 'Refill Sudah Selesai'
  if (value === 'failed') return 'Refill Belum Berhasil'
  if (value === 'rejected') return 'Refill Ditolak Supplier'
  return 'Garansi Refill Aktif'
}

function refillDescription(order: SosmedOrder) {
  const status = (order.refill_status || 'none').toLowerCase()
  if (status === 'requested' || status === 'processing') {
    return 'Permintaan refill udah masuk ke supplier. Tinggal tunggu prosesnya jalan.'
  }
  if (status === 'completed') {
    return order.refill_completed_at
      ? `Selesai diproses pada ${formatDate(order.refill_completed_at)}.`
      : 'Refill udah selesai diproses.'
  }
  if (status === 'failed') {
    return 'Refill belum berhasil dikirim. Lu bisa coba klaim ulang kalau tombolnya masih aktif.'
  }
  if (status === 'rejected') {
    return 'Supplier menolak refill ini. Kalau perlu, hubungi admin buat dicek manual.'
  }
  if (!order.refill_deadline) {
    return 'Garansi refill perlu dicek admin dulu sebelum bisa diklaim.'
  }
  return `Bisa klaim sampai ${formatDeadline(order.refill_deadline)}.`
}

export default function DashboardSosmedOrdersPage() {
  const [orders, setOrders] = useState<SosmedOrder[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refillLoading, setRefillLoading] = useState<string | null>(null)

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

  const handleRefill = async (order: SosmedOrder) => {
    const confirmed = window.confirm(
      `Klaim refill untuk order "${order.service_title}"?\n\nRefill akan dikirim ke supplier untuk link:\n${order.target_link || '-'}`
    )
    if (!confirmed) return

    setRefillLoading(order.id)
    setError('')

    try {
      const res = await sosmedOrderService.requestRefill(order.id)
      if (!res.success) {
        setError(res.message || 'Gagal mengklaim refill')
        return
      }
      await loadOrders(true)
    } catch {
      setError('Gagal mengklaim refill')
    } finally {
      setRefillLoading(null)
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
            const refill = refillMeta(order)
            const steps = progressSteps(order)
            const target = compactTarget(order.target_link)

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white shadow-[0_10px_35px_rgba(20,20,20,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(20,20,20,0.06)]"
              >
                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#141414] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                            {shortOrderID(order.id)}
                          </span>
                          <span className="text-xs font-semibold text-[#888]">{formatDate(order.created_at)}</span>
                        </div>
                        <h2 className="mt-2 text-base font-black leading-tight text-[#141414] sm:text-lg">
                          {order.service_title}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>
                        {status.label}
                      </span>
                      {refill ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${refill.className}`}>
                          {refill.label}
                        </span>
                      ) : null}
                      </div>
                    </div>

                    <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-[#EFEFEA] bg-[#FAFAF8] px-3 py-2 text-xs text-[#555]">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-[#FF5733]" />
                      <span className="min-w-0 truncate">
                        Target: <span className="font-bold text-[#141414]">{target}</span>
                      </span>
                    </div>

                    <div className="rounded-2xl border border-[#EFEFEA] bg-[#FCFCFA] px-4 py-3">
                      <div className="grid grid-cols-3 items-start gap-2">
                        {steps.map((step, index) => (
                          <div key={step.key} className="relative min-w-0">
                            {index < steps.length - 1 ? (
                              <div
                                className={`absolute left-[calc(50%+14px)] right-[calc(-50%+14px)] top-4 h-0.5 ${
                                  step.done ? 'bg-emerald-300' : 'bg-[#E8E8E2]'
                                }`}
                              />
                            ) : null}

                            <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
                              <span
                                className={`grid h-8 w-8 place-items-center rounded-full border text-xs ${
                                  step.done
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                    : step.danger
                                      ? 'border-red-200 bg-red-50 text-red-600'
                                      : step.active
                                        ? 'border-[#FFB29F] bg-[#FFF3EF] text-[#FF5733]'
                                        : 'border-[#E5E5E0] bg-white text-[#AAA]'
                                }`}
                              >
                                {step.done ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : step.active ? (
                                  <Clock3 className="h-4 w-4" />
                                ) : (
                                  <CircleDashed className="h-4 w-4" />
                                )}
                              </span>
                              <span
                                className={`text-[11px] font-bold ${
                                  step.done
                                    ? 'text-emerald-700'
                                    : step.danger
                                      ? 'text-red-600'
                                      : step.active
                                        ? 'text-[#FF5733]'
                                        : 'text-[#999]'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {refill ? (
                      <div
                        className={`rounded-2xl border px-3.5 py-3 ${
                          refill.canClaim
                            ? 'border-violet-200 bg-violet-50'
                            : order.refill_status === 'completed'
                              ? 'border-emerald-200 bg-emerald-50'
                              : order.refill_status === 'failed' || order.refill_status === 'rejected'
                                ? 'border-red-200 bg-red-50'
                                : 'border-sky-200 bg-sky-50'
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-xs font-black text-[#141414]">{refillTitle(order.refill_status)}</div>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#666]">{refillDescription(order)}</p>
                          </div>

                          {refill.canClaim ? (
                            <button
                              type="button"
                              onClick={() => void handleRefill(order)}
                              disabled={refillLoading === order.id}
                              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
                            >
                              {refillLoading === order.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              Klaim Refill
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <aside className="flex flex-col justify-between rounded-2xl border border-[#EFEFEA] bg-[#FAFAF8] p-4 lg:items-end">
                    <div className="space-y-1 lg:text-right">
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999]">Total Bayar</div>
                      <div className="text-xl font-black text-[#141414]">{formatRupiah(order.total_price)}</div>
                      <div className="text-xs font-semibold text-[#666]">{paymentLabel(order.payment_status)} via {order.payment_method || '-'}</div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
                      <Link
                        href="/product/sosmed"
                        className="rounded-xl border border-[#DDD] bg-white px-3 py-2 text-[11px] font-black text-[#141414] hover:bg-[#F7F7F5]"
                      >
                        Order Lagi
                      </Link>

                      {order.order_status === 'pending_payment' ? (
                        <button
                          type="button"
                          onClick={() => void handleCancel(order)}
                          className="rounded-xl border border-red-200 bg-white px-3 py-2 text-[11px] font-black text-red-600 hover:bg-red-50"
                        >
                          Batalkan
                        </button>
                      ) : null}
                    </div>
                  </aside>
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
