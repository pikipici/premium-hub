"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Loader2, RefreshCcw, Search } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { LOADING_COPY } from '@/lib/copy/loading'
import { useVisibilityRefresh } from '@/lib/hooks/useVisibilityRefresh'
import { formatDateTime, formatRupiah } from '@/lib/utils'
import { gmailAdminService } from '@/services/gmailAdminService'
import type { GmailAccount, GmailInventoryStatus } from '@/types/gmailAdmin'

const STATUS_OPTIONS: Array<{ value: '' | GmailInventoryStatus; label: string }> = [
  { value: '', label: 'Semua' },
  { value: 'pending_create', label: 'Pending Create' },
  { value: 'pending_verify', label: 'Pending Verify' },
  { value: 'verified', label: 'Verified' },
  { value: 'sold', label: 'Sold' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'disposed', label: 'Disposed' },
]

const PAGE_LIMIT = 20

export default function AdminGmailInventoryPage() {
  const [items, setItems] = useState<GmailAccount[]>([])
  const [counts, setCounts] = useState<Partial<Record<GmailInventoryStatus, number>>>({})
  const [status, setStatus] = useState<'' | GmailInventoryStatus>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await gmailAdminService.listInventory({
        status: status || undefined,
        page,
        limit: PAGE_LIMIT,
      })
      const data = res.data
      setItems(data?.items ?? [])
      setCounts(data?.counts ?? {})
      const meta = (res as any).meta
      setTotal(meta?.total ?? 0)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat inventory.')
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useVisibilityRefresh(fetchAll, 60_000)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div className="space-y-6">
      {/* Counts breakdown */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {(['pending_create', 'pending_verify', 'verified', 'sold', 'rejected', 'expired', 'disposed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            className={`rounded-2xl border p-3 text-left transition ${
              status === s
                ? 'border-[#141414] bg-[#141414] text-white'
                : 'border-[#EBEBEB] bg-white text-[#141414] hover:bg-[#F7F7F5]'
            }`}
          >
            <div className="text-xs uppercase tracking-wide opacity-70">{s.replace('_', ' ')}</div>
            <div className="mt-1 text-xl font-semibold">{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      {/* Filter + refresh */}
      <header className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any)
              setPage(1)
            }}
            className="w-full appearance-none rounded-full border border-[#EBEBEB] bg-white px-4 py-2 pr-10 text-sm text-[#141414] focus:border-[#141414] focus:outline-none sm:w-auto"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Status: {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-4 py-2 text-sm font-medium text-[#141414] hover:bg-[#F7F7F5] disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          className="rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]"
          role="alert"
        >
          <p className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div
          className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]"
          role="status"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {LOADING_COPY.list}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Tidak ada data" hint="Coba ganti filter status." />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#EBEBEB] bg-[#F7F7F5] text-xs uppercase tracking-wide text-[#6B6B6B]">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Buy</th>
                <th className="px-4 py-3">Sell</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Sold At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBEBEB]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-3 font-mono text-xs">{item.email}</td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3">{item.buy_price ? formatRupiah(item.buy_price) : '—'}</td>
                  <td className="px-4 py-3">{item.sold_price ? formatRupiah(item.sold_price) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#6B6B6B]">{formatDateTime(item.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-[#6B6B6B]">
                    {item.sold_at ? formatDateTime(item.sold_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#EBEBEB] px-4 py-3 text-sm">
              <span className="text-[#6B6B6B]">
                Halaman {page} dari {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-full border border-[#EBEBEB] bg-white px-3 py-1 hover:bg-[#F7F7F5] disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-full border border-[#EBEBEB] bg-white px-3 py-1 hover:bg-[#F7F7F5] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
