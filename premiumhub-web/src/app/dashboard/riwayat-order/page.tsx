"use client"

import { useCallback, useEffect, useState, type SVGProps } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { formatRupiah } from '@/lib/utils'
import { activityService } from '@/services/activityService'
import type { ActivityHistoryItem } from '@/types/activity'

const PAGE_LIMIT = 20

function TransactionDollarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.8 13a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1" />
      <path d="M18 11v10" />
      <path d="M3 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M15 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M7 5h8" />
      <path d="M7 5v8a3 3 0 0 0 3 3h1" />
    </svg>
  )
}

function formatActivityDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function amountText(item: ActivityHistoryItem) {
  const amount = formatRupiah(item.amount)
  return item.direction === 'credit' ? `+${amount}` : `-${amount}`
}

function amountClass(item: ActivityHistoryItem) {
  return item.direction === 'credit' ? 'text-green-600' : 'text-[#141414]'
}

export default function RiwayatOrderPage() {
  const [items, setItems] = useState<ActivityHistoryItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const res = await activityService.listHistory({ page, limit: PAGE_LIMIT })
      if (!res.success) {
        setError(res.message || 'Gagal memuat riwayat aktivitas')
        return
      }

      setItems(res.data)
      setTotal(res.meta?.total ?? res.data.length)
      setTotalPages(Math.max(1, res.meta?.total_pages ?? 1))
    } catch {
      setError('Gagal memuat riwayat aktivitas')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-extrabold">
        <TransactionDollarIcon className="h-6 w-6" /> Riwayat Order
      </h1>
      <p className="mb-6 text-sm text-[#888]">Aktivitas gabungan semua produk, diurutkan dari yang paling baru.</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <Loader2 className="h-3.5 w-3.5" /> Coba lagi
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[#EBEBEB] bg-white p-10 text-center">
          <p className="text-sm text-[#888]">Belum ada riwayat aktivitas.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[#EBEBEB] bg-white p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="text-2xl">{item.icon || '📦'}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[#141414]">{item.title}</div>
                    {item.subtitle ? <div className="truncate text-xs text-[#888]">{item.subtitle}</div> : null}
                    <div className="mt-1 text-xs text-[#888]">{formatActivityDate(item.occurred_at)}</div>
                  </div>
                </div>

                <div className="ml-3 shrink-0 text-right">
                  <div className={`mb-1 text-sm font-bold ${amountClass(item)}`}>{amountText(item)}</div>
                  <span className="rounded-full bg-[#F3F3F1] px-2.5 py-1 text-[10px] font-bold text-[#555]">{item.source_label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#EBEBEB] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#888]">
              Menampilkan halaman <span className="font-semibold text-[#141414]">{page}</span> dari{' '}
              <span className="font-semibold text-[#141414]">{totalPages}</span> • total {total} aktivitas
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-[#E2E2E2] px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-[#E2E2E2] px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Selanjutnya <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
