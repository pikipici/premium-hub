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
import { adminWalletWithdrawalService } from '@/services/adminWalletWithdrawalService'
import type { WalletWithdrawal } from '@/types/walletWithdrawal'

// Action map — what's allowed per status. Drives which buttons render
// at the bottom of the detail page. Keep in sync with backend
// adminTransition state machine.
type ActionKey = 'approve' | 'reject' | 'mark-processing' | 'mark-paid' | 'mark-failed'

const ACTIONS_BY_STATUS: Record<string, ActionKey[]> = {
  pending: ['approve', 'reject'],
  approved: ['mark-processing', 'mark-paid', 'mark-failed'],
  processing: ['mark-paid', 'mark-failed'],
  // Terminal — no further actions:
  paid: [],
  rejected: [],
  failed: [],
  cancelled: [],
}

interface ActionConfig {
  label: string
  destructive?: boolean
  // Optional input fields for the confirm dialog. Approve/markPaid
  // accept optional notes; reject/markFailed require a reason.
  needsReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
  notesLabel?: string
}

const ACTION_CONFIG: Record<ActionKey, ActionConfig> = {
  approve: {
    label: 'Approve',
    notesLabel: 'Catatan (opsional)',
  },
  reject: {
    label: 'Reject',
    destructive: true,
    needsReason: true,
    reasonLabel: 'Alasan penolakan (wajib)',
    reasonPlaceholder: 'Contoh: Nama rekening tidak sesuai',
  },
  'mark-processing': {
    label: 'Mark Processing',
  },
  'mark-paid': {
    label: 'Mark Paid',
    notesLabel: 'Ref payout (opsional)',
  },
  'mark-failed': {
    label: 'Mark Failed',
    destructive: true,
    needsReason: true,
    reasonLabel: 'Alasan gagal (wajib)',
    reasonPlaceholder: 'Contoh: Bank reject — nomor rekening tidak valid',
  },
}

export default function AdminWithdrawalDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id as string

  const [item, setItem] = useState<WalletWithdrawal | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Action dialog state
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItem = useCallback(async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    setError('')

    try {
      const res = await adminWalletWithdrawalService.getById(id)
      if (res.success) {
        setItem(res.data)
      } else {
        setError(res.message || 'Gagal memuat detail')
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message
        setError(msg || 'Gagal memuat detail')
      } else {
        setError('Gagal memuat detail')
      }
    } finally {
      if (!silent) setLoading(false)
      if (silent) setRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    fetchItem()
  }, [fetchItem])

  const handleSubmit = async () => {
    if (!item || !activeAction) return
    const cfg = ACTION_CONFIG[activeAction]
    if (cfg.needsReason && !reason.trim()) {
      setError(`${cfg.reasonLabel} wajib diisi`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      let res
      switch (activeAction) {
        case 'approve':
          res = await adminWalletWithdrawalService.approve(item.id, notes.trim() || undefined)
          break
        case 'reject':
          res = await adminWalletWithdrawalService.reject(item.id, reason.trim())
          break
        case 'mark-processing':
          res = await adminWalletWithdrawalService.markProcessing(item.id)
          break
        case 'mark-paid':
          res = await adminWalletWithdrawalService.markPaid(item.id, undefined, notes.trim() || undefined)
          break
        case 'mark-failed':
          res = await adminWalletWithdrawalService.markFailed(item.id, reason.trim())
          break
      }
      if (!res?.success) {
        setError(res?.message || 'Aksi gagal')
        return
      }
      setItem(res.data)
      setActiveAction(null)
      setReason('')
      setNotes('')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message
        setError(msg || 'Aksi gagal')
      } else {
        setError('Aksi gagal')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyId = async () => {
    if (!item) return
    try {
      await navigator.clipboard.writeText(item.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
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
            href="/admin/wallet/withdrawals"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EBEBEB] bg-white hover:bg-[#F7F7F5]"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight">Detail Penarikan</h1>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error || 'Data tidak ditemukan.'}
        </div>
      </div>
    )
  }

  const tone = walletWithdrawalTone(item.status)
  const classes = statusToneClasses(tone.tone)
  const allowedActions = ACTIONS_BY_STATUS[item.status] || []
  const isFailed = item.status === 'rejected' || item.status === 'failed' || item.status === 'cancelled'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/wallet/withdrawals"
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
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase ${classes.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} />
              {tone.label}
            </span>
            {item.auto_approved ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                <CheckCircle2 className="w-3 h-3" />
                Auto-approved
              </span>
            ) : null}
          </div>
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
            Ke pengguna: <span className="font-bold text-emerald-700">{formatRupiah(item.net_amount)}</span> · Biaya:{' '}
            {formatRupiah(item.fee)}
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
          <div className="rounded-2xl bg-[#F7F7F5] p-3">
            <div className="text-[11px] font-semibold text-[#6B7280] mb-1">User ID</div>
            <div className="text-xs font-mono break-all text-[#141414]">{item.user_id}</div>
          </div>
          <div className="rounded-2xl bg-[#F7F7F5] p-3">
            <div className="text-[11px] font-semibold text-[#6B7280] mb-1">Payout Rail</div>
            <div className="text-sm font-bold text-[#141414] uppercase">{item.payout_rail_kind || '—'}</div>
            {item.payout_rail_ref ? (
              <div className="text-[10px] font-mono text-[#3A3A3A] mt-0.5 break-all">{item.payout_rail_ref}</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <h2 className="text-sm font-bold mb-4">Audit Trail</h2>
        <ul className="space-y-3 text-xs">
          <li className="flex gap-3">
            <Clock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Submitted:</span> {formatDate(item.created_at)}
            </div>
          </li>
          {item.approved_at ? (
            <li className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Approved:</span> {formatDate(item.approved_at)}
                {item.admin_id ? <span className="ml-2 font-mono text-[#6B7280]">by {item.admin_id.slice(0, 8)}…</span> : null}
              </div>
            </li>
          ) : null}
          {item.rejected_at ? (
            <li className="flex gap-3">
              <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Rejected:</span> {formatDate(item.rejected_at)}
              </div>
            </li>
          ) : null}
          {item.cancelled_at ? (
            <li className="flex gap-3">
              <XCircle className="w-4 h-4 text-stone-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Cancelled by user:</span> {formatDate(item.cancelled_at)}
              </div>
            </li>
          ) : null}
          {item.paid_at ? (
            <li className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Paid:</span> {formatDate(item.paid_at)}
              </div>
            </li>
          ) : null}
        </ul>

        {(item.admin_note || item.failure_reason) && isFailed ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold mb-0.5">Note:</div>
              <div>{item.failure_reason || item.admin_note}</div>
            </div>
          </div>
        ) : item.admin_note ? (
          <div className="mt-4 rounded-2xl bg-[#F7F7F5] p-3 text-xs">
            <div className="font-semibold text-[#6B7280] mb-0.5">Admin Note:</div>
            <div className="text-[#141414]">{item.admin_note}</div>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {allowedActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allowedActions.map((actionKey) => {
            const cfg = ACTION_CONFIG[actionKey]
            return (
              <button
                key={actionKey}
                type="button"
                onClick={() => {
                  setActiveAction(actionKey)
                  setReason('')
                  setNotes('')
                  setError('')
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-extrabold transition-colors ${
                  cfg.destructive
                    ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
                    : 'bg-[#141414] text-white hover:bg-[#2A2A2A]'
                }`}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-3 text-xs text-[#6B7280]">
          Status terminal — tidak ada aksi lebih lanjut.
        </div>
      )}

      <ConfirmDialog
        open={!!activeAction}
        title={activeAction ? ACTION_CONFIG[activeAction].label : ''}
        destructive={activeAction ? ACTION_CONFIG[activeAction].destructive : false}
        loading={submitting}
        confirmLabel={activeAction ? ACTION_CONFIG[activeAction].label : 'Konfirmasi'}
        cancelLabel="Batal"
        onConfirm={handleSubmit}
        onCancel={() => {
          if (!submitting) {
            setActiveAction(null)
            setReason('')
            setNotes('')
            setError('')
          }
        }}
        description={
          <div className="space-y-3">
            <div>
              {activeAction === 'approve' && (
                <span>
                  Approve permintaan <strong>{formatRupiah(item.amount)}</strong>? Setelah disetujui, dana akan
                  diproses ke {item.destination_code.toUpperCase()} {item.destination_account}.
                </span>
              )}
              {activeAction === 'reject' && (
                <span>
                  Reject permintaan ini? Saldo Pendapatan user akan dikembalikan{' '}
                  <strong className="text-emerald-700">{formatRupiah(item.amount)}</strong>.
                </span>
              )}
              {activeAction === 'mark-processing' && (
                <span>Tandai sedang diproses. Status flip approved → processing.</span>
              )}
              {activeAction === 'mark-paid' && (
                <span>
                  Konfirmasi dana <strong className="text-emerald-700">{formatRupiah(item.net_amount)}</strong>{' '}
                  sudah di-transfer ke {item.destination_code.toUpperCase()} {item.destination_account}?
                </span>
              )}
              {activeAction === 'mark-failed' && (
                <span>
                  Tandai gagal? Saldo Pendapatan user akan dikembalikan{' '}
                  <strong className="text-emerald-700">{formatRupiah(item.amount)}</strong>.
                </span>
              )}
            </div>

            {activeAction && ACTION_CONFIG[activeAction].needsReason ? (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-1.5 block">
                  {ACTION_CONFIG[activeAction].reasonLabel}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={ACTION_CONFIG[activeAction].reasonPlaceholder}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2 text-sm focus:outline-none focus:border-[#141414]"
                />
              </div>
            ) : activeAction && ACTION_CONFIG[activeAction].notesLabel ? (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-1.5 block">
                  {ACTION_CONFIG[activeAction].notesLabel}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2 text-sm focus:outline-none focus:border-[#141414]"
                />
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  )
}
