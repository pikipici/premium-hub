"use client"

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, CircleDashed, Clock3, Link2, Loader2, RefreshCcw, XCircle } from 'lucide-react'

import { buildUserSosmedOrderDisplay } from '@/lib/sosmedOrderDisplay'
import { buildSosmedOrderTimeline, formatSosmedTimelineDate, shortSosmedOrderID } from '@/lib/sosmedOrderTimeline'
import { sosmedOrderTone, statusToneClasses } from '@/lib/dashboardStatusPill'
import { formatRupiah } from '@/lib/utils'
import { sosmedOrderService } from '@/services/sosmedOrderService'
import { LOADING_COPY } from '@/lib/copy/loading'
import type { SosmedOrderDetail } from '@/types/sosmedOrder'

function compactTarget(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return '-'
  return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}

function timelineIcon(status: string) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4" />
  if (status === 'danger') return <XCircle className="h-4 w-4" />
  if (status === 'active') return <Clock3 className="h-4 w-4" />
  return <CircleDashed className="h-4 w-4" />
}

function timelineTone(status: string) {
  if (status === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'danger') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'active') return 'border-[#FFD9CF] bg-[#FFF3EF] text-[#FF5733]'
  return 'border-[#EBEBEB] bg-white text-[#A6A6A1]'
}

export default function SosmedOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const orderID = params?.id
  const [detail, setDetail] = useState<SosmedOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadDetail = useCallback(async (silent = false) => {
    if (!orderID) return
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const res = await sosmedOrderService.getByID(orderID)
      setDetail(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat detail order')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [orderID])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const order = detail?.order
  const display = useMemo(() => (order ? buildUserSosmedOrderDisplay(order) : null), [order])
  const timeline = useMemo(() => (order ? buildSosmedOrderTimeline(order, detail?.events || []) : []), [order, detail?.events])

  const orderStatusPill = order ? sosmedOrderTone(order.order_status || 'pending') : null

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-col gap-4 rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/sosmed/orders"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FF5733] hover:text-[#d84b2d]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke order
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#141414] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white">
              {shortSosmedOrderID(orderID || '')}
            </span>
            {orderStatusPill ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusToneClasses(orderStatusPill.tone).pill}`}
              >
                {orderStatusPill.label}
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight text-[#141414] sm:text-3xl">Detail Order DigiSosmed</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6B7280]">
            Timeline ini pakai bahasa ringkas biar lu bisa cek posisi order tanpa istilah teknis supplier.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDetail(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-4 py-2 text-sm font-bold text-[#141414] transition-colors hover:bg-[#F7F7F5] disabled:opacity-60"
          aria-label="Refresh detail order"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </button>
      </header>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-3xl border border-[#EBEBEB] bg-white p-8 text-center text-sm text-[#6B7280]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {LOADING_COPY.detail}
          </span>
        </section>
      ) : order && display ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)]">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#A6A6A1]">Layanan</div>
              <h2 className="mt-2 text-xl font-extrabold text-[#141414]">{display.productTitle}</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-2 text-sm text-[#3A3A3A]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A6A6A1]">Target</div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 font-bold text-[#141414]">
                    <Link2 className="h-3.5 w-3.5 text-[#FF5733]" />
                    <span className="truncate">{compactTarget(order.target_link)}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-2 text-sm text-[#3A3A3A]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A6A6A1]">Jumlah</div>
                  <div className="mt-1 font-bold text-[#141414]">{display.quantityLabel}</div>
                </div>
                {display.startCountLabel ? (
                  <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-2 text-sm text-[#3A3A3A]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A6A6A1]">Start Count</div>
                    <div className="mt-1 font-bold text-[#141414]">{display.startCountLabel}</div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-2 text-sm text-[#3A3A3A]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A6A6A1]">Dibuat</div>
                  <div className="mt-1 font-bold text-[#141414]">{formatSosmedTimelineDate(order.created_at)}</div>
                </div>
              </div>
            </div>

            <aside className="relative overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)]">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#FFE0D5] blur-2xl" />
              <div className="relative">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#A6A6A1]">Total Bayar</div>
                <div className="mt-2 text-3xl font-extrabold text-[#141414]">{formatRupiah(order.total_price)}</div>
                <div className="mt-2 text-sm font-semibold text-[#6B7280]">
                  {order.payment_status === 'paid' ? 'Sudah dibayar' : order.payment_status} via {order.payment_method || '-'}
                </div>
                <Link
                  href="/product/sosmed"
                  className="mt-5 inline-flex w-full justify-center rounded-full bg-[#141414] px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#2A2A2A]"
                >
                  Order Lagi
                </Link>
              </div>
            </aside>
          </section>

          <section className="rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#A6A6A1]">Timeline</div>
                <h2 className="mt-1 text-xl font-extrabold text-[#141414]">Perjalanan Order</h2>
              </div>
              <span className="rounded-full border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-1 text-xs font-bold text-[#3A3A3A]">
                {timeline.length} update
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {timeline.map((item, index) => (
                <div key={item.key} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3">
                  <div className="relative flex justify-center">
                    {index < timeline.length - 1 ? (
                      <span className="absolute bottom-[-14px] top-9 w-px bg-[#EBEBEB]" />
                    ) : null}
                    <span
                      className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border ${timelineTone(item.status)}`}
                    >
                      {timelineIcon(item.status)}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-bold text-[#141414]">{item.title}</h3>
                      {item.timestamp ? (
                        <span className="text-xs font-semibold text-[#6B7280]">{formatSosmedTimelineDate(item.timestamp)}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[#3A3A3A]">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
