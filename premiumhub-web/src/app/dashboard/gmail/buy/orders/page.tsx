"use client"

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  ShoppingBag,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { LOADING_COPY } from '@/lib/copy/loading'
import { gmailOrderTone, statusToneClasses } from '@/lib/dashboardStatusPill'
import { formatDate, formatRupiah } from '@/lib/utils'
import { gmailService } from '@/services/gmailService'
import type { GmailOrder } from '@/types/gmail'

const PAGE_LIMIT = 20

export default function GmailOrdersListPage() {
  const [items, setItems] = useState<GmailOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    setError('')
    try {
      const res = await gmailService.listMyOrders({ page, limit: PAGE_LIMIT })
      const data = res.data as any
      // Backend returns SuccessWithMeta — items in data.items.
      setItems(data?.items ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat order.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/gmail"
            className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5]"
          >
            <ArrowLeft className="h-4 w-4" />
            Gmail
          </Link>
          <h1 className="text-xl font-semibold text-[#141414]">Order Saya</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5] disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/dashboard/gmail/buy"
            className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" />
            Beli Lagi
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {LOADING_COPY.orders}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum ada order"
          hint="Beli akun gmail pertama lu sekarang."
          actionLabel="Beli Sekarang"
          actionHref="/dashboard/gmail/buy"
        />
      ) : (
        <div className="space-y-3">
          {items.map((order) => {
            const t = gmailOrderTone(order.status)
            const classes = statusToneClasses(t.tone)
            return (
              <Link
                key={order.id}
                href={`/dashboard/gmail/buy/orders/${order.id}`}
                className="block rounded-3xl border border-[#EBEBEB] bg-white p-4 hover:bg-[#F7F7F5]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${classes.pill}`}>
                        {t.label}
                      </span>
                      <span className="text-xs text-[#6B6B6B]">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-[#141414]">
                      {order.quantity} akun · {formatRupiah(order.unit_price)} per akun
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold text-[#141414]">
                      {formatRupiah(order.net_amount)}
                    </div>
                    {order.discount_amount > 0 && (
                      <div className="text-xs text-[#10A37F]">
                        -{formatRupiah(order.discount_amount)} hemat
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}

          {items.length >= PAGE_LIMIT || page > 1 ? (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5] disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="text-sm text-[#6B6B6B]">Halaman {page}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={items.length < PAGE_LIMIT}
                className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5] disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
