"use client"

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ClipboardCopy,
  Eye,
  EyeOff,
  Loader2,
  RefreshCcw,
  XCircle,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { LOADING_COPY } from '@/lib/copy/loading'
import { useVisibilityRefresh } from '@/lib/hooks/useVisibilityRefresh'
import { formatDateTime, formatRupiah } from '@/lib/utils'
import { gmailAdminService } from '@/services/gmailAdminService'
import type { GmailAccount } from '@/types/gmailAdmin'

const REJECT_REASONS = [
  { value: 'login_fail', label: 'Login Fail (creds salah)' },
  { value: 'has_recovery', label: 'Ada Recovery (email/phone)' },
  { value: 'phone_verification', label: 'Akun butuh verif phone' },
  { value: 'other', label: 'Lainnya (tulis di note)' },
]

const PAGE_LIMIT = 20

export default function AdminGmailVerifikasiPage() {
  const [items, setItems] = useState<GmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Detail panel state — selected account.
  const [selected, setSelected] = useState<GmailAccount | null>(null)
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)
  const [credsLoading, setCredsLoading] = useState(false)
  const [credsRevealed, setCredsRevealed] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Verify form state.
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  // Reject form state.
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('login_fail')
  const [rejectNote, setRejectNote] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  const [rejectError, setRejectError] = useState('')

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await gmailAdminService.listPendingVerify({ page, limit: PAGE_LIMIT })
      const data = res.data as any
      setItems(data?.items ?? [])
      const meta = (res as any).meta
      setTotal(meta?.total ?? 0)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat antrian.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  useVisibilityRefresh(fetchQueue, 30_000)

  const selectAccount = async (item: GmailAccount) => {
    setSelected(item)
    setCreds(null)
    setCredsRevealed(false)
    setCredsLoading(true)
    try {
      const res = await gmailAdminService.getCredentials(item.id)
      setCreds(res.data ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal load credentials.')
    } finally {
      setCredsLoading(false)
    }
  }

  const copy = (key: string, text: string) => {
    if (!navigator?.clipboard) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(null), 1500)
  }

  const submitVerify = async () => {
    if (!selected) return
    if (newPassword.length < 8) {
      setVerifyError('Password minimal 8 karakter.')
      return
    }
    setVerifyLoading(true)
    setVerifyError('')
    try {
      await gmailAdminService.verify(selected.id, { new_password: newPassword })
      setVerifyOpen(false)
      setNewPassword('')
      setSelected(null)
      setCreds(null)
      await fetchQueue()
    } catch (e: any) {
      setVerifyError(e?.response?.data?.message || 'Gagal verify.')
    } finally {
      setVerifyLoading(false)
    }
  }

  const submitReject = async () => {
    if (!selected) return
    if (rejectReason === 'other' && rejectNote.trim().length < 3) {
      setRejectError('Note wajib diisi untuk reason "Lainnya".')
      return
    }
    setRejectLoading(true)
    setRejectError('')
    try {
      await gmailAdminService.reject(selected.id, {
        reason: rejectReason,
        note: rejectNote.trim() || undefined,
      })
      setRejectOpen(false)
      setRejectReason('login_fail')
      setRejectNote('')
      setSelected(null)
      setCreds(null)
      await fetchQueue()
    } catch (e: any) {
      setRejectError(e?.response?.data?.message || 'Gagal reject.')
    } finally {
      setRejectLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Queue list */}
        <section className="space-y-3 lg:col-span-1">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#141414]">
              Antrian ({total})
            </h2>
            <button
              type="button"
              onClick={fetchQueue}
              disabled={loading}
              aria-label="Refresh antrian"
              className="rounded-full border border-[#EBEBEB] bg-white p-2 text-[#141414] hover:bg-[#F7F7F5] disabled:opacity-60"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </header>

          {loading ? (
            <div
              className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-12 text-sm text-[#6B6B6B]"
              role="status"
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {LOADING_COPY.list}
            </div>
          ) : items.length === 0 ? (
            <EmptyState title="Antrian kosong" hint="Tidak ada akun yang menunggu verifikasi." />
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const active = selected?.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectAccount(item)}
                    className={`block w-full rounded-3xl border p-3 text-left transition ${
                      active ? 'border-[#141414] bg-[#141414] text-white' : 'border-[#EBEBEB] bg-white hover:bg-[#F7F7F5]'
                    }`}
                  >
                    <div className="font-mono text-xs">{item.email}</div>
                    <div className={`mt-1 text-[10px] ${active ? 'opacity-80' : 'text-[#6B6B6B]'}`}>
                      Submitted {item.submitted_at ? formatDateTime(item.submitted_at) : '—'}
                    </div>
                  </button>
                )
              })}

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-full border border-[#EBEBEB] bg-white px-2.5 py-1 hover:bg-[#F7F7F5] disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-[#6B6B6B]">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-full border border-[#EBEBEB] bg-white px-2.5 py-1 hover:bg-[#F7F7F5] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Detail + actions */}
        <section className="lg:col-span-2">
          {!selected ? (
            <EmptyState
              title="Pilih akun untuk diverifikasi"
              hint="Klik salah satu akun di antrian untuk lihat detail + login test + verify/reject."
            />
          ) : (
            <div className="space-y-4 rounded-3xl border border-[#EBEBEB] bg-white p-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null)
                    setCreds(null)
                  }}
                  className="rounded-full border border-[#EBEBEB] bg-white p-1.5 text-[#141414] hover:bg-[#F7F7F5] lg:hidden"
                  aria-label="Tutup detail"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="text-base font-semibold text-[#141414]">{selected.email}</h3>
              </div>

              <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4">
                <div className="text-xs uppercase tracking-wide text-[#6B6B6B]">Submitted</div>
                <div className="mt-1 text-sm text-[#141414]">
                  {selected.submitted_at ? formatDateTime(selected.submitted_at) : '—'}
                </div>
                <div className="mt-3 text-xs uppercase tracking-wide text-[#6B6B6B]">Komisi seller (saat verify)</div>
                <div className="mt-1 text-sm text-[#141414]">
                  {selected.seller_payout_amount ? formatRupiah(selected.seller_payout_amount) : '—'}
                </div>
              </div>

              {/* Credentials */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
                  Credentials (untuk login test)
                </div>
                {credsLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#6B6B6B]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat credentials…
                  </div>
                ) : creds ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#F7F7F5] px-2 py-1 font-mono text-xs">{creds.email}</span>
                      <button
                        type="button"
                        onClick={() => copy('email', creds.email)}
                        aria-label="Salin email"
                        className="rounded-full p-1 text-[#6B6B6B] hover:bg-[#F7F7F5]"
                      >
                        <ClipboardCopy className="h-3 w-3" />
                      </button>
                      {copiedKey === 'email' && <span className="text-xs text-[#10A37F]">Copied!</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#F7F7F5] px-2 py-1 font-mono text-xs">
                        {credsRevealed ? creds.password : '••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCredsRevealed((v) => !v)}
                        aria-label={credsRevealed ? 'Sembunyikan password' : 'Tampilkan password'}
                        className="rounded-full p-1 text-[#6B6B6B] hover:bg-[#F7F7F5]"
                      >
                        {credsRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copy('pwd', creds.password)}
                        aria-label="Salin password"
                        className="rounded-full p-1 text-[#6B6B6B] hover:bg-[#F7F7F5]"
                      >
                        <ClipboardCopy className="h-3 w-3" />
                      </button>
                      {copiedKey === 'pwd' && <span className="text-xs text-[#10A37F]">Copied!</span>}
                    </div>
                    <p className="mt-2 text-xs text-[#6B6B6B]">
                      Login ke{' '}
                      <a
                        href="https://accounts.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        accounts.google.com
                      </a>{' '}
                      pakai creds di atas. Cek freshness, no recovery, dan tidak butuh phone verification.
                      Setelah OK, ganti password lalu klik <span className="font-semibold">Verify</span>.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-[#A6260F]">Gagal load creds.</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 border-t border-[#EBEBEB] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setRejectOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#A6260F] bg-white px-5 py-2.5 text-sm font-medium text-[#A6260F] hover:bg-[#FFE0D6]"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Verify (ganti password)
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Verify dialog */}
      <ConfirmDialog
        open={verifyOpen}
        onCancel={() => {
          if (verifyLoading) return
          setVerifyOpen(false)
          setVerifyError('')
        }}
        onConfirm={submitVerify}
        title="Verify Akun Gmail"
        description={`Set password baru untuk ${selected?.email ?? ''}. Password ini di-encrypt dan akan dikirim ke buyer saat akun terjual.`}
        confirmLabel={verifyLoading ? 'Memproses…' : 'Verify'}
        loading={verifyLoading}
        preview={
          <div className="space-y-2 text-left">
            <label htmlFor="new-pwd" className="text-sm font-medium text-[#141414]">
              Password baru
            </label>
            <input
              id="new-pwd"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              maxLength={64}
              placeholder="Min 8 karakter"
              aria-describedby={verifyError ? 'new-pwd-error' : undefined}
              className="w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-3 font-mono text-sm focus:border-[#141414] focus:outline-none"
            />
            {verifyError && (
              <div id="new-pwd-error" className="text-xs text-[#A6260F]" role="alert">
                {verifyError}
              </div>
            )}
          </div>
        }
      />

      {/* Reject dialog */}
      <ConfirmDialog
        open={rejectOpen}
        onCancel={() => {
          if (rejectLoading) return
          setRejectOpen(false)
          setRejectError('')
        }}
        onConfirm={submitReject}
        title="Reject Akun Gmail"
        description={`Tolak setoran ${selected?.email ?? ''}. User akan dapat strike +1 (3 strike dalam 30 hari = ban 30 hari).`}
        confirmLabel={rejectLoading ? 'Memproses…' : 'Reject'}
        destructive
        loading={rejectLoading}
        preview={
          <div className="space-y-3 text-left">
            <div>
              <label htmlFor="reject-reason" className="text-sm font-medium text-[#141414]">
                Reason
              </label>
              <select
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm focus:border-[#141414] focus:outline-none"
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reject-note" className="text-sm font-medium text-[#141414]">
                Note {rejectReason === 'other' && <span className="text-[#A6260F]">*</span>}
              </label>
              <textarea
                id="reject-note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                maxLength={255}
                placeholder="Detail spesifik (opsional kecuali reason=other)"
                className="mt-1 w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-2 text-sm focus:border-[#141414] focus:outline-none"
              />
            </div>
            {rejectError && (
              <div className="text-xs text-[#A6260F]" role="alert">
                {rejectError}
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}
