"use client"

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, CircleDashed, Clock3, Link2, Loader2, RefreshCcw, XCircle } from 'lucide-react'

import { buildUserSosmedOrderDisplay } from '@/lib/sosmedOrderDisplay'
import { buildSosmedOrderTimeline, formatSosmedTimelineDate, shortSosmedOrderID } from '@/lib/sosmedOrderTimeline'
import { formatRupiah } from '@/lib/utils'
import { sosmedOrderService } from '@/services/sosmedOrderService'
import type { SosmedOrderDetail } from '@/types/sosmedOrder'

function compactTarget(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return '-'
  return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}

function statusLabel(status?: string) {
  switch (status) {
    case 'success': return 'Selesai'
    case 'processing': return 'Diproses'
    case 'failed': return 'Gagal'
    case 'canceled': return 'Dibatalkan'
    case 'expired': return 'Expired'
    default: return 'Menunggu Bayar'
  }
}

function timelineIcon(status: string) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4" />
  if (status === 'danger') return <XCircle className="h-4 w-4" />
  if (status === 'active') return <Clock3 className="h-4 w-4" />
  return <CircleDashed className="h-4 w-4" />
}

function timelineTone(status: string) {
  if (status === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'danger') return 'border-red-200 bg-red-50 text-red-700'
  if (status === 'active') return 'border-[#FFB29F] bg-[#FFF3EF] text-[#FF5733]'
  return 'border-[#E7E7E1] bg-white text-[#999]'
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

  return (
    <main className="min-h-screen bg-[#F7F4EF] px-4 py-6 text-[#141414] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-4 rounded-3xl border border-[#E7E1D8] bg-white/90 p-5 shadow-[0_18px_60px_rgba(35,28,20,0.07)] sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/dashboard/sosmed/orders" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#FF5733] hover:text-[#d84b2d]">
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke order
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#141414] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">
                {shortSosmedOrderID(orderID || '')}
              </span>
              {order ? (
                <span className="rounded-full border border-[#E9E4DC] bg-[#FAFAF8] px-3 py-1 text-xs font-bold text-[#666]">
                  {statusLabel(order.order_status)}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">Detail Order Sosmed</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#666]">
              Timeline ini pakai bahasa ringkas biar lu bisa cek posisi order tanpa istilah teknis supplier.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDetail(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E7E1D8] bg-[#FAFAF8] px-4 py-2 text-sm font-black text-[#333] hover:bg-white disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </header>

        {error ? <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</section> : null}

        {loading ? (
          <section className="rounded-3xl border border-[#E7E1D8] bg-white p-8 text-center text-sm text-[#777]">
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Memuat detail order...</span>
          </section>
        ) : order && display ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-3xl border border-[#E7E1D8] bg-white p-5 shadow-[0_14px_45px_rgba(35,28,20,0.05)]">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-[#999]">Layanan</div>
                <h2 className="mt-2 text-xl font-black text-[#141414]">{display.productTitle}</h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#EFEFEA] bg-[#FAFAF8] px-3 py-2 text-sm text-[#555]">
                    <div className="text-[11px] font-black uppercase tracking-[0.1em] text-[#999]">Target</div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 font-bold text-[#141414]"><Link2 className="h-3.5 w-3.5 text-[#FF5733]" /><span className="truncate">{compactTarget(order.target_link)}</span></div>
                  </div>
                  <div className="rounded-2xl border border-[#EFEFEA] bg-[#FAFAF8] px-3 py-2 text-sm text-[#555]">
                    <div className="text-[11px] font-black uppercase tracking-[0.1em] text-[#999]">Jumlah</div>
                    <div className="mt-1 font-bold text-[#141414]">{display.quantityLabel}</div>
                  </div>
                  {display.startCountLabel ? (
                    <div className="rounded-2xl border border-[#EFEFEA] bg-[#FAFAF8] px-3 py-2 text-sm text-[#555]">
                      <div className="text-[11px] font-black uppercase tracking-[0.1em] text-[#999]">Start Count</div>
                      <div className="mt-1 font-bold text-[#141414]">{display.startCountLabel}</div>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-[#EFEFEA] bg-[#FAFAF8] px-3 py-2 text-sm text-[#555]">
                    <div className="text-[11px] font-black uppercase tracking-[0.1em] text-[#999]">Dibuat</div>
                    <div className="mt-1 font-bold text-[#141414]">{formatSosmedTimelineDate(order.created_at)}</div>
                  </div>
                </div>
              </div>

              <aside className="rounded-3xl border border-[#E7E1D8] bg-[#141414] p-5 text-white shadow-[0_14px_45px_rgba(20,20,20,0.12)]">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Total Bayar</div>
                <div className="mt-2 text-3xl font-black">{formatRupiah(order.total_price)}</div>
                <div className="mt-2 text-sm font-semibold text-white/65">{order.payment_status === 'paid' ? 'Sudah dibayar' : order.payment_status} via {order.payment_method || '-'}</div>
                <Link href="/product/sosmed" className="mt-5 inline-flex w-full justify-center rounded-2xl bg-[#FF5733] px-4 py-3 text-sm font-black text-white hover:bg-[#e64d2e]">
                  Order Lagi
                </Link>
              </aside>
            </section>

            <section className="rounded-3xl border border-[#E7E1D8] bg-white p-5 shadow-[0_14px_45px_rgba(35,28,20,0.05)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[#999]">Timeline</div>
                  <h2 className="mt-1 text-xl font-black text-[#141414]">Perjalanan Order</h2>
                </div>
                <span className="rounded-full border border-[#E9E4DC] bg-[#FAFAF8] px-3 py-1 text-xs font-bold text-[#666]">{timeline.length} update</span>
              </div>

              <div className="mt-5 space-y-3">
                {timeline.map((item, index) => (
                  <div key={item.key} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3">
                    <div className="relative flex justify-center">
                      {index < timeline.length - 1 ? <span className="absolute bottom-[-14px] top-9 w-px bg-[#E7E1D8]" /> : null}
                      <span className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border ${timelineTone(item.status)}`}>{timelineIcon(item.status)}</span>
                    </div>
                    <div className="rounded-2xl border border-[#EFEFEA] bg-[#FCFCFA] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-black text-[#141414]">{item.title}</h3>
                        {item.timestamp ? <span className="text-xs font-semibold text-[#888]">{formatSosmedTimelineDate(item.timestamp)}</span> : null}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[#666]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
