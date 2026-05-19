"use client"

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  ShieldAlert,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LOADING_COPY } from '@/lib/copy/loading'
import { gmailSlotTone, statusToneClasses } from '@/lib/dashboardStatusPill'
import { formatDate, formatRupiah } from '@/lib/utils'
import { gmailService } from '@/services/gmailService'
import type { GmailSlot, GmailSlotResponse } from '@/types/gmail'

// One-time creds storage key — slot id keyed. Used so password
// stays accessible during refresh after first generation. Cleared
// once user submits.
const credsKey = (id: string) => `gmail-slot-creds:${id}`

interface FreshCreds {
  email: string
  password: string
}

export default function GmailSlotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  const isFresh = search.get('fresh') === '1'

  const [slot, setSlot] = useState<GmailSlot | null>(null)
  const [creds, setCreds] = useState<FreshCreds | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Submit dialog state.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const fetchSlot = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const res = await gmailService.getMySlot(id)
      const data = res.data as GmailSlot | null
      setSlot(data ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat slot.')
    } finally {
      setLoading(false)
    }
  }, [id])

  // On mount: try to read fresh creds from sessionStorage if this is
  // the first view post-RequestSlot. Backend doesn't return password
  // on subsequent fetches — we cache locally so refresh doesn't lose
  // the one-time view.
  useEffect(() => {
    if (!id) return
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem(credsKey(id))
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as FreshCreds
          setCreds(parsed)
        } catch {
          // ignore
        }
      }
    }
  }, [id])

  // After fetching slot, if backend response includes plain password
  // (only on freshly-created slot, server-side), persist it.
  useEffect(() => {
    if (!slot || !id) return
    const pwd = (slot as any).password
    if (pwd && !creds) {
      const c: FreshCreds = { email: slot.email, password: pwd }
      setCreds(c)
      try {
        sessionStorage.setItem(credsKey(id), JSON.stringify(c))
      } catch {
        // ignore
      }
    }
  }, [slot, id, creds])

  useEffect(() => {
    fetchSlot()
  }, [fetchSlot])

  // Tick countdown every second when in pending_create.
  useEffect(() => {
    if (!slot || slot.status !== 'pending_create') return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [slot])

  const expiry = slot?.slot_expires_at ? new Date(slot.slot_expires_at) : null
  const expired = expiry ? now >= expiry : false
  const remaining = useMemo(() => {
    if (!expiry) return null
    const diff = Math.max(0, expiry.getTime() - now.getTime())
    const totalSec = Math.floor(diff / 1000)
    const hours = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    return `${hours}j ${mins}m ${secs}d`
  }, [expiry, now])

  const copy = (key: string, text: string) => {
    if (!navigator?.clipboard) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(null), 1500)
  }

  const submit = async () => {
    if (!id || !slot) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await gmailService.submitSlot(id)
      // Clear cached creds — slot now in pending_verify, no longer
      // editable from user side.
      try {
        sessionStorage.removeItem(credsKey(id))
      } catch {
        // ignore
      }
      setCreds(null)
      setConfirmOpen(false)
      await fetchSlot()
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || 'Gagal submit slot.')
    } finally {
      setSubmitting(false)
    }
  }

  const tone = slot ? gmailSlotTone(slot.status) : null
  const toneClasses = tone ? statusToneClasses(tone.tone) : null

  // Display password: prefer fresh from cache, fallback to slot
  // response if present (covers same-session refresh).
  const displayPassword =
    creds?.password ?? (slot as any)?.password ?? null
  const displayEmail = slot?.email ?? creds?.email ?? null

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard/gmail/sell"
          className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5]"
        >
          <ArrowLeft className="h-4 w-4" />
          Slot Saya
        </Link>
        <h1 className="text-xl font-semibold text-[#141414]">Detail Slot</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {LOADING_COPY.detail}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-[#FFC3B7] bg-[#FFF1ED] p-6 text-sm text-[#A6260F]">
          {error}
        </div>
      ) : slot ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            {/* Status pill + email */}
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {tone && toneClasses && (
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${toneClasses.pill}`}
                  >
                    {tone.label}
                  </span>
                )}
                <div className="text-xs text-[#6B6B6B]">
                  Dibuat {formatDate(slot.created_at)}
                </div>
              </div>

              {slot.status === 'pending_create' && (
                <>
                  {isFresh && (
                    <div className="mt-4 rounded-2xl border border-[#FFE0D6] bg-[#FFF8F4] px-4 py-3 text-sm text-[#A6260F]">
                      ⚠ Salin atau screenshot password ini sekarang. Password
                      cuma muncul sekali — kalau lu kehilangan, request slot
                      baru.
                    </div>
                  )}

                  {/* Countdown */}
                  {remaining && (
                    <div className="mt-4 rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                        Sisa waktu
                      </div>
                      <div className={`mt-1 text-2xl font-semibold ${expired ? 'text-[#A6260F]' : 'text-[#141414]'}`}>
                        {expired ? 'Expired' : remaining}
                      </div>
                      <div className="text-xs text-[#6B6B6B]">
                        Slot expired {expiry ? formatDate(expiry.toISOString()) : '—'}
                      </div>
                    </div>
                  )}

                  {/* Creds box */}
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                      Kredensial
                    </div>
                    <div className="rounded-2xl border border-[#EBEBEB] bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-[10px] font-medium uppercase text-[#6B6B6B]">Email</div>
                          <div className="font-mono text-sm text-[#141414]">{displayEmail || '—'}</div>
                        </div>
                        {displayEmail && (
                          <button
                            type="button"
                            onClick={() => copy('email', displayEmail)}
                            className="rounded-full p-2 text-[#6B6B6B] hover:bg-[#F7F7F5]"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {copiedKey === 'email' && (
                        <span className="text-xs text-[#10A37F]">Copied!</span>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[#EBEBEB] bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-[10px] font-medium uppercase text-[#6B6B6B]">Password</div>
                          <div className="font-mono text-sm text-[#141414]">
                            {displayPassword || '—'}
                          </div>
                        </div>
                        {displayPassword && (
                          <button
                            type="button"
                            onClick={() => copy('pwd', displayPassword)}
                            className="rounded-full p-2 text-[#6B6B6B] hover:bg-[#F7F7F5]"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {copiedKey === 'pwd' && (
                        <span className="text-xs text-[#10A37F]">Copied!</span>
                      )}
                    </div>
                  </div>

                  {/* Step-by-step guide */}
                  <div className="mt-6 rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4">
                    <div className="text-sm font-semibold text-[#141414]">Cara setor</div>
                    <ol className="mt-3 space-y-2 text-sm text-[#141414]">
                      <li className="flex gap-2">
                        <span className="font-semibold">1.</span>
                        <span>
                          Klik tombol <span className="font-medium">Buka Google Signup</span> di bawah (buka di tab baru).
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold">2.</span>
                        <span>Bikin akun pakai <span className="font-medium">email + password</span> di atas. Wajib persis sama.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold">3.</span>
                        <span>Isi nama, tanggal lahir, dan nomor telepon (kalau diminta).</span>
                      </li>
                      <li className="flex gap-2 text-[#A6260F]">
                        <span className="font-semibold">4.</span>
                        <span>
                          <span className="font-semibold">JANGAN</span> set recovery email atau recovery phone.
                          Skip kalau ada opsi.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold">5.</span>
                        <span>Setelah akun jadi dan bisa login, balik ke halaman ini → klik <span className="font-medium">Saya Sudah Selesai</span>.</span>
                      </li>
                    </ol>

                    <a
                      href="https://accounts.google.com/signup"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-4 py-2 text-sm font-medium text-[#141414] hover:bg-[#F7F7F5]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Buka Google Signup
                    </a>
                  </div>

                  {/* Action */}
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-[#6B6B6B]">
                      Setelah submit, akun masuk ke antrian admin verify (max 24 jam).
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={expired}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Saya Sudah Selesai
                    </button>
                  </div>
                </>
              )}

              {slot.status === 'pending_verify' && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4">
                    <div className="text-sm font-medium text-[#141414]">Menunggu admin verify</div>
                    <p className="mt-1 text-xs text-[#6B6B6B]">
                      Admin akan login ke akun lu, cek freshness, ganti password (anti-hackback), lalu mark verified. Estimasi max 24 jam.
                    </p>
                  </div>
                  <ul className="text-sm text-[#141414]">
                    <li className="flex justify-between border-b border-[#EBEBEB] py-2">
                      <span className="text-[#6B6B6B]">Email</span>
                      <span className="font-mono text-xs">{slot.email}</span>
                    </li>
                    <li className="flex justify-between py-2">
                      <span className="text-[#6B6B6B]">Submitted</span>
                      <span className="text-xs">{slot.submitted_at ? formatDate(slot.submitted_at) : '—'}</span>
                    </li>
                  </ul>
                </div>
              )}

              {slot.status === 'verified' && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-[#D1FADF] bg-[#ECFDF5] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0F705C]">
                      <CheckCircle2 className="h-4 w-4" />
                      Akun diterima!
                    </div>
                    <p className="mt-1 text-xs text-[#0F705C]">
                      Komisi {formatRupiah(slot.seller_payout_amount ?? 0)} udah masuk Saldo Pendapatan lu.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/wallet"
                    className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-4 py-2 text-sm font-medium text-[#141414] hover:bg-[#F7F7F5]"
                  >
                    Lihat Saldo Pendapatan
                  </Link>
                </div>
              )}

              {slot.status === 'rejected' && (
                <div className="mt-4 rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#A6260F]">
                    <ShieldAlert className="h-4 w-4" />
                    Setoran ditolak
                  </div>
                  <p className="mt-1 text-xs text-[#A6260F]">
                    Alasan: <span className="font-medium">{slot.reject_reason || '—'}</span>
                    {slot.reject_note && <> — {slot.reject_note}</>}
                  </p>
                  <p className="mt-2 text-xs text-[#A6260F]">
                    Akun yang ditolak terhitung 1 strike. 3 strike dalam 30 hari = ban 30 hari.
                  </p>
                </div>
              )}

              {slot.status === 'expired' && (
                <div className="mt-4 rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#141414]">
                    <AlertTriangle className="h-4 w-4" />
                    Slot expired
                  </div>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    Lu gak submit dalam 6 jam. Slot expired gak ngitung strike — request slot baru kalau mau lanjut.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                Komisi
              </div>
              <div className="mt-2 text-base font-medium text-[#141414]">
                {slot.seller_payout_amount && slot.seller_payout_amount > 0
                  ? formatRupiah(slot.seller_payout_amount)
                  : 'Cair saat verify'}
              </div>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Masuk ke Saldo Pendapatan, bisa di-transfer ke Saldo Utama atau ditarik.
              </p>
            </div>
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                Aturan Singkat
              </div>
              <ul className="mt-2 space-y-1 text-xs text-[#141414]">
                <li>• Pakai creds yang kita kasih</li>
                <li>• Jangan set recovery</li>
                <li>• Selesai sebelum expired</li>
              </ul>
            </div>
          </aside>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => {
          if (submitting) return
          setConfirmOpen(false)
          setSubmitError('')
        }}
        title="Submit Slot"
        description="Pastikan akun udah jadi dan bisa login. Setelah submit, lu gak bisa edit lagi."
        confirmLabel={submitting ? 'Submitting…' : 'Submit'}
        onConfirm={submit}
        loading={submitting}
        preview={
          submitError ? (
            <div className="flex items-center gap-2 text-xs text-[#A6260F]">
              <AlertTriangle className="h-3.5 w-3.5" />
              {submitError}
            </div>
          ) : undefined
        }
      />
    </div>
  )
}
