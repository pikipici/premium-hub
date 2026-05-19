"use client"

import axios from 'axios'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { LOADING_COPY } from '@/lib/copy/loading'
import { statusToneClasses, walletWithdrawalTone } from '@/lib/dashboardStatusPill'
import { formatDate, formatRupiah } from '@/lib/utils'
import { adminWalletWithdrawalService } from '@/services/adminWalletWithdrawalService'
import type { WalletWithdrawal, WithdrawalStatus } from '@/types/walletWithdrawal'

type StatusFilter = 'all' | WithdrawalStatus

const PAGE_LIMIT = 20

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string; tone?: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid', label: 'Cair' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'failed', label: 'Gagal' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

export default function AdminWithdrawalListPage() {
  const [items, setItems] = useState<WalletWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [page, setPage] = useState(1)
  const [userIdFilter, setUserIdFilter] = useState('')
  const [error, setError] = useState('')

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    setError('')
    try {
      const res = await adminWalletWithdrawalService.list({
        page,
        limit: PAGE_LIMIT,
        status: statusFilter === 'all' ? undefined : statusFilter,
        user_id: userIdFilter.trim() || undefined,
      })
      if (res.success) {
        setItems(res.data || [])
      } else {
        setError(res.message || 'Gagal memuat queue')
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message
        setError(msg || 'Gagal memuat queue')
      } else {
        setError('Gagal memuat queue')
      }
    } finally {
      if (!silent) setLoading(false)
      if (silent) setRefreshing(false)
    }
  }, [page, statusFilter, userIdFilter])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const totals = useMemo(() => {
    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0)
    const totalNet = items.reduce((sum, i) => sum + i.net_amount, 0)
    return { totalAmount, totalNet, count: items.length }
  }, [items])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">Queue Penarikan</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Approve, reject, dan tandai paid permintaan WD user. Auto-approve aktif untuk nominal {'<'} Rp 100.000.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchAll(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#EBEBEB] bg-white text-xs font-semibold hover:bg-[#F7F7F5] disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#EBEBEB] bg-white p-4">
          <div className="text-[11px] font-semibold text-[#6B7280] mb-1">Jumlah Item</div>
          <div className="text-xl font-extrabold text-[#141414]">{totals.count}</div>
        </div>
        <div className="rounded-2xl border border-[#EBEBEB] bg-white p-4">
          <div className="text-[11px] font-semibold text-[#6B7280] mb-1">Total Diminta</div>
          <div className="text-xl font-extrabold text-[#141414]">{formatRupiah(totals.totalAmount)}</div>
        </div>
        <div className="rounded-2xl border border-[#EBEBEB] bg-white p-4">
          <div className="text-[11px] font-semibold text-[#6B7280] mb-1">Total Cair</div>
          <div className="text-xl font-extrabold text-emerald-700">{formatRupiah(totals.totalNet)}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="overflow-x-auto -mx-1">
          <div className="flex gap-2 px-1">
            {STATUS_FILTERS.map((filter) => {
              const active = statusFilter === filter.value
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter.value)
                    setPage(1)
                  }}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#141414] text-white'
                      : 'bg-white border border-[#EBEBEB] text-[#3A3A3A] hover:bg-[#F7F7F5]'
                  }`}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="relative sm:w-64 sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A6A6A1]" />
          <input
            type="text"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                fetchAll()
              }
            }}
            placeholder="Filter user_id (UUID)"
            className="w-full rounded-xl border border-[#EBEBEB] bg-white pl-9 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-[#141414]"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-12 text-center text-sm text-[#6B7280]">
          {LOADING_COPY.generic}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ArrowDownToLine className="w-8 h-8" />}
          title="Queue kosong"
          hint={
            statusFilter === 'pending'
              ? 'Tidak ada permintaan WD yang nunggu review.'
              : 'Tidak ada item untuk filter ini.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F7F7F5] text-[10px] uppercase font-bold text-[#6B7280]">
              <tr>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3 text-right">Cair</th>
                <th className="px-4 py-3 text-left">Tujuan</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBEBEB]">
              {items.map((item) => {
                const tone = walletWithdrawalTone(item.status)
                const classes = statusToneClasses(tone.tone)
                return (
                  <tr key={item.id} className="hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${classes.pill}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} />
                        {tone.label}
                      </span>
                      {item.auto_approved ? (
                        <span className="ml-1 inline-flex items-center rounded-full bg-sky-50 border border-sky-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-700">
                          AUTO
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatRupiah(item.amount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatRupiah(item.net_amount)}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-bold uppercase">{item.destination_code}</div>
                      <div className="text-[#6B7280]">
                        {item.destination_account} <span className="opacity-70">({item.destination_name})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono text-[#6B7280]">{item.user_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/wallet/withdrawals/${item.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-2.5 py-1 text-[11px] font-bold hover:bg-[#F7F7F5]"
                      >
                        Detail
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#EBEBEB] bg-white text-xs font-semibold disabled:opacity-50 hover:bg-[#F7F7F5]"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Sebelumnya
        </button>
        <span className="text-xs text-[#6B7280]">Halaman {page}</span>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          disabled={items.length < PAGE_LIMIT}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#EBEBEB] bg-white text-xs font-semibold disabled:opacity-50 hover:bg-[#F7F7F5]"
        >
          Berikutnya
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
