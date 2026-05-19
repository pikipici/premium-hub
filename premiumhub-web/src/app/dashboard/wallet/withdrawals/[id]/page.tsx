"use client"

import axios from 'axios'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock,
  Copy,
  Loader2,
  RefreshCcw,
  XCircle,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LOADING_COPY } from '@/lib/copy/loading'
import { statusToneClasses, walletWithdrawalTone } from '@/lib/dashboardStatusPill'
import { formatDate, formatRupiah } from '@/lib/utils'
import { walletWithdrawalService } from '@/services/walletWithdrawalService'
import type { WalletWithdrawal } from '@/types/walletWithdrawal'

// Status timeline — derives a 4-step progress visualization from the
// 7-state status enum. Cancelled / rejected / failed all collapse to
// "ended" with a fail visual at the appropriate step.
type Step = { key: string; label: string; reachedAt?: string | null }

function buildTimeline(w: WalletWithdrawal): Step[] {
  return [
    { key: 'submitted', label: 'Permintaan dibuat', reachedAt: w.created_at },
    { key: 'reviewed', label: 'Disetujui admin', reachedAt: w.approved_at },
    { key: 'processing', label: 'Diproses ke bank', reachedAt: w.status === 'processing' || w.status === 'paid' || w.status === 'failed' ? w.updated_at : null },
    { key: 'paid', label: 'Dana cair', reachedAt: w.paid_at },
  ]
}

export default function WithdrawalDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id as string

  const [item, setItem] = useState<WalletWithdrawal | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const fetchItem = useCallback(async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    setError('')

    try {
      const res = await walletWithdrawalService.getById(id)
      if (res.success) {
        setItem(res.data)
      } else {
        setError(res.message || 'Gagal memuat detail penarikan')
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message
        setError(msg || 'Gagal memuat detail penarikan')
      } else {
        setError('Gagal memuat detail penarikan')
      }
    } finally {
      if (!silent) setLoading(false)
      if (silent) setRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    fetchItem()
  }, [fetchItem])

  const handleCancel = async () => {
    if (!item) return
    setCancelling(true)
    setError('')
    try {
      const res = await walletWithdrawalService.cancel(item.id)
      if (res.success) {
        setItem(res.data)
      } else {
        setError(res.message || 'Gagal membatalkan penarikan')
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message
        setError(msg || 'Gagal membatalkan penarikan')
      } else {
        setError('Gagal membatalkan penarikan')
      }
    } finally {
      setCancelling(false)
      setConfirmOpen(false)
    }
  }

  const handleCopyId = async () => {
    if (!item) return
    try {
      await navigator.clipboard.writeText(item.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore — clipboard may be blocked in non-https contexts
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-[#EBEBEB] bg-white p-12 text-center text-sm text-[#6B7280]">
        {LOADING_COPY.generic}
      </div>
    )
  }

  if (!item) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/wallet/withdrawals"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EBEBEB] bg-white hover:bg-[#F7F7F5]"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight">Detail Penarikan</h1>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error || 'Data penarikan tidak ditemukan.'}
        </div>
      </div>
    )
  }

  const tone = walletWithdrawalTone(item.status)
  const classes = statusToneClasses(tone.tone)
  const timeline = buildTimeline(item)
  const canCancel = item.status === 'pending'
  const isFailed = item.status === 'rejected' || item.status === 'failed' || item.status === 'cancelled'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/wallet/withdrawals"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EBEBEB] bg-white hover:bg-[#F7F7F5] transition-colors"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">Detail Penarikan</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">{formatDate(item.created_at)}</p>
        </div>
        <button
          type="button"
          onClick={() => fetchItem(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EBEBEB] bg-white hover:bg-[#F7F7F5] disabled:opacity-50"
          aria-label="Refresh"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
        </button>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase ${classes.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} />
            {tone.label}
          </span>
          <button
            type="button"
            onClick={handleCopyId}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#EBEBEB] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#6B7280] hover:bg-[#F7F7F5]"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Tersalin' : `ID ${item.id.slice(0, 8)}…`}
          </button>
        </div>

        <div className="space-y-1 mb-5">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[#A6A6A1]">Nominal Diminta</div>
          <div className="text-3xl font-extrabold tracking-tight text-[#141414]">{formatRupiah(item.amount)}</div>
          <div className="text-xs text-[#6B7280]">
            Diterima setelah biaya: <span className="font-bold text-emerald-700">{formatRupiah(item.net_amount)}</span>{' '}
            (biaya {formatRupiah(item.fee)})
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F7F7F5] p-3">
            <div className="text-[11px] font-semibold text-[#6B7280] mb-1">Tujuan</div>
            <div className="text-sm font-bold text-[#141414] capitalize">{item.destination_type}</div>
            <div className="text-xs text-[#3A3A3A] mt-0.5">{item.destination_code.toUpperCase()}</div>
          </div>
          <div className="rounded-2xl bg-[#F7F7F5] p-3">
            <div className="text-[11px] font-semibold text-[#6B7280] mb-1">Rekening / Akun</div>
            <div className="text-sm font-bold text-[#141414]">{item.destination_account}</div>
            <div className="text-xs text-[#3A3A3A] mt-0.5">a/n {item.destination_name}</div>
          </div>
        </div>

        {item.auto_approved ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
            <CheckCircle2 className="w-3 h-3" />
            Disetujui otomatis (di bawah threshold)
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <h2 className="text-sm font-bold mb-4">Progres</h2>
        <ol className="space-y-4">
          {timeline.map((step, idx) => {
            const reached = !!step.reachedAt
            const isLast = idx === timeline.length - 1
            return (
              <li key={step.key} className="flex gap-3 relative">
                {!isLast ? (
                  <div
                    className={`absolute left-3.5 top-8 h-[calc(100%-0.5rem)] w-px ${
                      reached ? 'bg-emerald-300' : 'bg-[#EBEBEB]'
                    }`}
                  />
                ) : null}
                <div
                  className={`relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    reached ? 'bg-emerald-500 text-white' : 'bg-[#F0F0EE] text-[#A6A6A1]'
                  }`}
                >
                  {reached ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className={`text-sm font-semibold ${reached ? 'text-[#141414]' : 'text-[#A6A6A1]'}`}>
                    {step.label}
                  </div>
                  {step.reachedAt ? (
                    <div className="text-xs text-[#6B7280] mt-0.5">{formatDate(step.reachedAt)}</div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>

        {isFailed && (item.failure_reason || item.admin_note) ? (
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold mb-0.5">
                {item.status === 'rejected' ? 'Ditolak admin' : item.status === 'cancelled' ? 'Dibatalkan' : 'Gagal diproses'}
              </div>
              <div>{item.failure_reason || item.admin_note}</div>
            </div>
          </div>
        ) : null}

        {item.payout_rail_ref ? (
          <div className="mt-3 rounded-2xl bg-[#F7F7F5] p-3 text-xs">
            <div className="font-semibold text-[#6B7280] mb-0.5">Referensi Payout</div>
            <div className="font-mono font-bold text-[#141414] break-all">{item.payout_rail_ref}</div>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {canCancel ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={cancelling}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-rose-200 bg-white text-sm font-extrabold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
        >
          {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          Batalkan Penarikan
        </button>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Batalkan Penarikan?"
        description={
          <div>
            Penarikan {formatRupiah(item.amount)} akan dibatalkan dan saldo dikembalikan ke Saldo Pendapatan kamu.
          </div>
        }
        confirmLabel="Ya, Batalkan"
        cancelLabel="Tetap Lanjut"
        destructive
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
