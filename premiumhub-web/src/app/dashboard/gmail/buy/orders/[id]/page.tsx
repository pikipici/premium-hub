"use client"

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LOADING_COPY } from '@/lib/copy/loading'
import { gmailClaimTone, statusToneClasses } from '@/lib/dashboardStatusPill'
import { formatDate, formatRupiah } from '@/lib/utils'
import { gmailService } from '@/services/gmailService'
import type {
  GmailClaim,
  GmailOrderDetail,
  GmailOrderItemCreds,
} from '@/types/gmail'

const WARRANTY_HOURS = 24

export default function GmailOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  const isFresh = search.get('fresh') === '1'

  const [detail, setDetail] = useState<GmailOrderDetail | null>(null)
  const [claims, setClaims] = useState<GmailClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Claim dialog state.
  const [claimTarget, setClaimTarget] = useState<GmailOrderItemCreds | null>(null)
  const [claimReason, setClaimReason] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimError, setClaimError] = useState('')

  const fetchAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const [d, c] = await Promise.all([
        gmailService.getMyOrder(id),
        gmailService.listClaims(id).catch(() => null),
      ])
      setDetail(d.data ?? null)
      setClaims((c?.data as any)?.items ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat detail order.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Build a quick lookup: gmail_account_id -> claim row.
  const claimByGmail = useMemo(() => {
    const m = new Map<string, GmailClaim>()
    for (const c of claims) m.set(c.gmail_account_id, c)
    return m
  }, [claims])

  const order = detail?.order
  const items = detail?.items ?? []

  // Warranty deadline = order.created_at + 24h. Refunded order =
  // warranty already used (by-design we let warranty be partial too).
  const warrantyDeadline = useMemo(() => {
    if (!order) return null
    return new Date(new Date(order.created_at).getTime() + WARRANTY_HOURS * 60 * 60 * 1000)
  }, [order])
  const stillCoveredOverall = warrantyDeadline ? new Date() < warrantyDeadline : false

  const copyToClipboard = (id: string, text: string) => {
    if (!navigator?.clipboard) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  const submitClaim = async () => {
    if (!claimTarget || !id) return
    if (claimReason.trim().length < 3) {
      setClaimError('Alasan minimal 3 karakter.')
      return
    }
    setClaimLoading(true)
    setClaimError('')
    try {
      await gmailService.createClaim(id, {
        gmail_account_id: claimTarget.gmail_account_id,
        reason: claimReason.trim(),
      })
      setClaimTarget(null)
      setClaimReason('')
      await fetchAll()
    } catch (e: any) {
      setClaimError(e?.response?.data?.message || 'Gagal proses klaim.')
    } finally {
      setClaimLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard/gmail/buy/orders"
          className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5]"
        >
          <ArrowLeft className="h-4 w-4" />
          Order Saya
        </Link>
        <h1 className="text-xl font-semibold text-[#141414]">Detail Order</h1>
      </header>

      {isFresh && (
        <div className="rounded-2xl border border-[#FFE0D6] bg-[#FFF8F4] px-4 py-3 text-sm text-[#A6260F]">
          ⚠ Salin atau screenshot password sekarang. Password tetap bisa
          diakses lewat halaman ini, tapi simpan di tempat aman.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {LOADING_COPY.detail}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-[#FFC3B7] bg-[#FFF1ED] p-6 text-sm text-[#A6260F]">
          {error}
        </div>
      ) : order ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-6">
              <h2 className="text-sm font-semibold text-[#141414]">Akun Gmail</h2>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                {items.length} akun dikirim. Garansi 1×24 jam aktif sampai{' '}
                <span className="font-medium text-[#141414]">
                  {warrantyDeadline ? formatDate(warrantyDeadline.toISOString()) : '—'}
                </span>
                .
              </p>

              <div className="mt-4 space-y-3">
                {items.map((item) => {
                  const claim = claimByGmail.get(item.gmail_account_id)
                  const claimed = !!claim
                  const canClaim = stillCoveredOverall && !claimed
                  return (
                    <div
                      key={item.gmail_account_id}
                      className="rounded-2xl border border-[#EBEBEB] bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-[#F7F7F5] px-2 py-1 text-xs font-mono text-[#141414]">
                              {item.email}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`email-${item.gmail_account_id}`, item.email)}
                              className="rounded-full p-1 text-[#6B6B6B] hover:bg-[#F7F7F5]"
                              title="Copy email"
                            >
                              <ClipboardCopy className="h-3 w-3" />
                            </button>
                            {copiedId === `email-${item.gmail_account_id}` && (
                              <span className="text-xs text-[#10A37F]">Copied!</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-[#F7F7F5] px-2 py-1 text-xs font-mono text-[#141414]">
                              {item.password}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`pwd-${item.gmail_account_id}`, item.password)}
                              className="rounded-full p-1 text-[#6B6B6B] hover:bg-[#F7F7F5]"
                              title="Copy password"
                            >
                              <ClipboardCopy className="h-3 w-3" />
                            </button>
                            {copiedId === `pwd-${item.gmail_account_id}` && (
                              <span className="text-xs text-[#10A37F]">Copied!</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-stretch gap-2 sm:items-end">
                          {claimed ? (
                            <ClaimBadge status={claim.status} />
                          ) : canClaim ? (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimTarget(item)
                                setClaimReason('')
                                setClaimError('')
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-xs font-medium text-[#141414] hover:bg-[#F7F7F5]"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Klaim Garansi
                            </button>
                          ) : (
                            <span className="text-xs text-[#6B6B6B]">Garansi expired</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {claims.length > 0 && (
              <div className="rounded-3xl border border-[#EBEBEB] bg-white p-6">
                <h2 className="text-sm font-semibold text-[#141414]">Riwayat Klaim</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {claims.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-col gap-1 rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-0.5">
                        <ClaimBadge status={c.status} />
                        <div className="text-xs text-[#6B6B6B]">
                          {c.reason} · {formatDate(c.resolved_at)}
                        </div>
                      </div>
                      {c.resolution_type === 'refunded' && (
                        <div className="text-xs font-medium text-[#10A37F]">
                          +{formatRupiah(c.refund_amount)} Saldo Utama
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                Total Bayar
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#141414]">
                {formatRupiah(order.net_amount)}
              </div>
              <div className="text-xs text-[#6B6B6B]">{formatDate(order.created_at)}</div>
            </div>
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                Rincian
              </div>
              <ul className="mt-3 space-y-1 text-sm text-[#141414]">
                <li className="flex justify-between">
                  <span className="text-[#6B6B6B]">Quantity</span>
                  <span>{order.quantity} akun</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#6B6B6B]">Harga / akun</span>
                  <span>{formatRupiah(order.unit_price)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#6B6B6B]">Subtotal</span>
                  <span>{formatRupiah(order.gross_amount)}</span>
                </li>
                {order.discount_amount > 0 && (
                  <li className="flex justify-between">
                    <span className="text-[#6B6B6B]">Diskon</span>
                    <span className="text-[#10A37F]">-{formatRupiah(order.discount_amount)}</span>
                  </li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!claimTarget}
        onCancel={() => {
          if (claimLoading) return
          setClaimTarget(null)
          setClaimError('')
        }}
        title="Klaim Garansi"
        description={
          claimTarget
            ? `Akun ${claimTarget.email}. Auto-resolve: kalo stok ada, kita kasih ganti. Kalo kosong, refund Saldo Utama.`
            : ''
        }
        confirmLabel="Submit Klaim"
        onConfirm={submitClaim}
        loading={claimLoading}
        preview={
          <div className="space-y-2 text-left">
            <label className="text-sm font-medium text-[#141414]">Alasan klaim</label>
            <textarea
              value={claimReason}
              onChange={(e) => setClaimReason(e.target.value)}
              rows={3}
              maxLength={255}
              placeholder="Akun banned dalam 5 menit setelah login pertama"
              className="w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-3 text-sm focus:border-[#141414] focus:outline-none"
            />
            {claimError && (
              <div className="flex items-center gap-2 text-xs text-[#A6260F]">
                <AlertTriangle className="h-3.5 w-3.5" />
                {claimError}
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}

function ClaimBadge({ status }: { status: string }) {
  const t = gmailClaimTone(status)
  const classes = statusToneClasses(t.tone)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${classes.pill}`}
    >
      <CheckCircle2 className="h-3 w-3" />
      {t.label}
    </span>
  )
}
