"use client"

import axios from 'axios'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCcw,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { LOADING_COPY } from '@/lib/copy/loading'
import { statusToneClasses, walletWithdrawalTone } from '@/lib/dashboardStatusPill'
import { formatDate, formatRupiah } from '@/lib/utils'
import { walletWithdrawalService } from '@/services/walletWithdrawalService'
import type { WalletWithdrawal, WithdrawalStatus } from '@/types/walletWithdrawal'

type StatusFilter = 'all' | WithdrawalStatus

const PAGE_LIMIT = 20

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu Review' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'processing', label: 'Diproses' },
  { value: 'paid', label: 'Cair' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'failed', label: 'Gagal' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

export default function WithdrawalListPage() {
  const [items, setItems] = useState<WalletWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    setError('')

    try {
      const res = await walletWithdrawalService.listMine({ page, limit: PAGE_LIMIT })
      if (res.success) {
        setItems(res.data || [])
      } else {
        setError(res.message || 'Gagal memuat riwayat penarikan')
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(message || 'Gagal memuat riwayat penarikan')
      } else {
        setError('Gagal memuat riwayat penarikan')
      }
    } finally {
      if (!silent) setLoading(false)
      if (silent) setRefreshing(false)
    }
  }, [page])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return items
    return items.filter((item) => item.status === statusFilter)
  }, [items, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/wallet"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EBEBEB] bg-white hover:bg-[#F7F7F5] transition-colors"
          aria-label="Kembali ke wallet"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">Riwayat Penarikan</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Pencairan Saldo Pendapatan ke rekening atau e-wallet kamu.</p>
        </div>
        <button
          type="button"
          onClick={() => fetchAll(true)}
          disabled={refreshing || loading}
          className="hidden sm:inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#EBEBEB] bg-white text-xs font-semibold hover:bg-[#F7F7F5] disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
        <Link
          href="/dashboard/wallet/withdrawals/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#141414] text-white text-sm font-extrabold hover:bg-[#2A2A2A] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tarik Saldo
        </Link>
      </div>

      <div className="overflow-x-auto -mx-1">
        <div className="flex gap-2 px-1">
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.value
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
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

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-12 text-center text-sm text-[#6B7280]">
          {LOADING_COPY.generic}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<ArrowDownToLine className="w-8 h-8" />}
          title={statusFilter === 'all' ? 'Belum ada penarikan' : 'Tidak ada penarikan untuk filter ini'}
          hint={
            statusFilter === 'all'
              ? 'Jual akun di marketplace untuk dapetin Saldo Pendapatan, terus tarik ke rekening kamu.'
              : 'Coba ganti filter atau buat penarikan baru.'
          }
          actionLabel="Buat Penarikan"
          actionHref="/dashboard/wallet/withdrawals/new"
        />
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const tone = walletWithdrawalTone(item.status)
            const classes = statusToneClasses(tone.tone)
            return (
              <Link
                key={item.id}
                href={`/dashboard/wallet/withdrawals/${item.id}`}
                className="block rounded-2xl border border-[#EBEBEB] bg-white p-4 hover:border-[#D8D8D5] hover:bg-[#FAFAF8] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${classes.pill}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} />
                        {tone.label}
                      </span>
                      <span className="text-[11px] text-[#6B7280]">{formatDate(item.created_at)}</span>
                    </div>
                    <div className="text-base font-extrabold text-[#141414]">{formatRupiah(item.amount)}</div>
                    <div className="text-xs text-[#6B7280] mt-1 truncate">
                      {item.destination_code.toUpperCase()} · {item.destination_account} ({item.destination_name})
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase font-semibold text-[#A6A6A1]">Cair</div>
                    <div className="text-sm font-bold text-emerald-700">{formatRupiah(item.net_amount)}</div>
                    <ArrowUpRight className="w-4 h-4 text-[#A6A6A1] mt-1 ml-auto" />
                  </div>
                </div>
              </Link>
            )
          })}

          {/* Simple pagination — backend doesn't return total yet, so
              we infer hasNext from result count. */}
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
      )}
    </div>
  )
}
