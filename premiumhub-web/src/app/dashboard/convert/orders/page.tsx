"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, RefreshCcw } from 'lucide-react'

import { getHttpErrorMessage } from '@/lib/httpError'
import { convertService } from '@/services/convertService'
import type { ConvertAssetType, ConvertOrderStatus, ConvertOrderSummary } from '@/types/convert'

const FILTERS: { key: 'all' | ConvertAssetType; label: string; href: string }[] = [
  { key: 'all', label: 'Semua', href: '/dashboard/convert/orders' },
  { key: 'pulsa', label: 'Pulsa', href: '/dashboard/convert/orders?asset=pulsa' },
  { key: 'paypal', label: 'PayPal', href: '/dashboard/convert/orders?asset=paypal' },
  { key: 'crypto', label: 'Crypto', href: '/dashboard/convert/orders?asset=crypto' },
]

const PAGE_SIZE = 10

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function statusMeta(status: ConvertOrderStatus) {
  switch (status) {
    case 'pending_transfer':
      return { label: 'Menunggu Transfer', className: 'bg-amber-100 text-amber-700 border-amber-200' }
    case 'waiting_review':
      return { label: 'Menunggu Review', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
    case 'approved':
      return { label: 'Approved', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    case 'processing':
      return { label: 'Diproses', className: 'bg-sky-100 text-sky-700 border-sky-200' }
    case 'success':
      return { label: 'Sukses', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    case 'failed':
      return { label: 'Gagal', className: 'bg-red-100 text-red-700 border-red-200' }
    case 'expired':
      return { label: 'Expired', className: 'bg-gray-100 text-gray-700 border-gray-200' }
    case 'canceled':
      return { label: 'Dibatalkan', className: 'bg-gray-100 text-gray-700 border-gray-200' }
    default:
      return { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
}

function assetLabel(asset: ConvertAssetType) {
  if (asset === 'pulsa') return 'Pulsa'
  if (asset === 'paypal') return 'PayPal'
  return 'Crypto'
}

export default function DashboardConvertOrdersPage() {
  const searchParams = useSearchParams()
  const currentAsset = (searchParams.get('asset') || 'all') as 'all' | ConvertAssetType

  const [page, setPage] = useState(1)
  const [orders, setOrders] = useState<ConvertOrderSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  useEffect(() => {
    setPage(1)
  }, [currentAsset])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const res = await convertService.listOrders({
          page,
          limit: PAGE_SIZE,
          asset_type: currentAsset === 'all' ? undefined : currentAsset,
        })

        if (!res.success) {
          setError(res.message || 'Gagal memuat riwayat convert')
          return
        }

        setOrders(res.data)
        setTotal(res.meta?.total ?? res.data.length)
      } catch (err: unknown) {
        setError(getHttpErrorMessage(err, 'Gagal memuat riwayat convert'))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [currentAsset, page])

  const refresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      const res = await convertService.listOrders({
        page,
        limit: PAGE_SIZE,
        asset_type: currentAsset === 'all' ? undefined : currentAsset,
      })

      if (!res.success) {
        setError(res.message || 'Gagal memuat riwayat convert')
        return
      }

      setOrders(res.data)
      setTotal(res.meta?.total ?? res.data.length)
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal memuat riwayat convert'))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Riwayat Convert</h1>
          <p className="mt-1 text-sm text-[#888]">Semua order convert lu dikumpulin di sini.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#EBEBEB] bg-white px-3 py-2 text-xs font-bold text-[#555] hover:bg-[#FAFAF8] disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </button>

          <Link
            href="/product/convert"
            className="inline-flex items-center justify-center rounded-lg bg-[#FF5733] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64d2e]"
          >
            Buat Order Baru
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-4 md:p-5">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key}
              href={filter.href}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                currentAsset === filter.key
                  ? 'border-[#FF5733] bg-[#FFF0ED] text-[#FF5733]'
                  : 'border-[#EBEBEB] bg-white text-[#666] hover:border-[#FF5733] hover:text-[#FF5733]'
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</section>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-[#EBEBEB] bg-white p-8 text-center text-sm text-[#888]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat convert...
          </span>
        </section>
      ) : orders.length === 0 ? (
        <section className="rounded-2xl border border-[#EBEBEB] bg-white p-6 text-center">
          <p className="text-sm text-[#666]">Belum ada data order convert untuk filter ini.</p>
          <p className="mt-1 text-xs text-[#888]">Begitu order dibuat, status dan detail akan muncul di halaman ini.</p>
        </section>
      ) : (
        <section className="space-y-2">
          {orders.map((order) => {
            const status = statusMeta(order.status)

            return (
              <Link
                key={order.id}
                href={`/dashboard/convert/orders/${order.id}`}
                className="block rounded-2xl border border-[#EBEBEB] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-[#141414]">{order.id}</span>
                      <span className="rounded-full border border-[#EBEBEB] bg-[#FAFAF8] px-2 py-0.5 text-[10px] font-bold text-[#666]">
                        {assetLabel(order.asset_type)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#888]">{formatDate(order.created_at)}</p>
                    <p className="mt-2 text-sm font-semibold text-[#141414]">
                      {order.source_channel} · {order.source_account}
                    </p>
                    <p className="text-xs text-[#666]">
                      Tujuan: {order.destination_bank} · {order.destination_account_number} a/n {order.destination_account_name}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <div className="text-sm font-bold text-[#141414]">Masuk: {formatRupiah(order.source_amount)}</div>
                    <div className="text-sm font-black text-emerald-600">Terima: {formatRupiah(order.receive_amount)}</div>
                    <span className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              </Link>
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
