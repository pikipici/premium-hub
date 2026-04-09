"use client"

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw, UploadCloud } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { getHttpErrorMessage } from '@/lib/httpError'
import { convertService } from '@/services/convertService'
import type { ConvertOrderDetail, ConvertOrderStatus } from '@/types/convert'

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function statusMeta(status: ConvertOrderStatus | string) {
  switch (status) {
    case 'pending_transfer':
      return { label: 'Menunggu Transfer', className: 'bg-amber-100 text-amber-700 border-amber-200' }
    case 'waiting_review':
      return { label: 'Menunggu Review', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
    case 'approved':
      return { label: 'Approved', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    case 'processing':
      return { label: 'Diproses', className: 'bg-sky-100 text-sky-700 border-sky-200' }
    case 'success':
      return { label: 'Sukses', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    case 'failed':
      return { label: 'Gagal', className: 'bg-red-100 text-red-700 border-red-200' }
    case 'expired':
      return { label: 'Expired', className: 'bg-gray-100 text-gray-700 border-gray-200' }
    case 'canceled':
      return { label: 'Dibatalkan', className: 'bg-gray-100 text-gray-700 border-gray-200' }
    default:
      return { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
}

function isFinalStatus(status: string) {
  return ['success', 'failed', 'expired', 'canceled'].includes(status)
}

export default function GuestConvertTrackPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')

  const [detail, setDetail] = useState<ConvertOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [proofURL, setProofURL] = useState('')
  const [proofNote, setProofNote] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  const loadTracking = useCallback(async (silent = false) => {
    if (!token) return

    if (silent) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const res = await convertService.trackOrderByToken(token)
      if (!res.success) {
        setError(res.message || 'Gagal memuat tracking order convert')
        return
      }
      setDetail(res.data)
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal memuat tracking order convert'))
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadTracking(false)
  }, [loadTracking])

  const submitProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail || uploadingProof) return

    if (!proofFile && !proofURL.trim()) {
      setError('Isi URL bukti atau upload file bukti terlebih dahulu.')
      return
    }

    setUploadingProof(true)
    setError('')

    try {
      const payload = proofFile
        ? (() => {
            const formData = new FormData()
            formData.append('file', proofFile)
            if (proofNote.trim()) formData.append('note', proofNote.trim())
            return formData
          })()
        : {
            file_url: proofURL.trim(),
            note: proofNote.trim() || undefined,
          }

      const res = await convertService.uploadProofByToken(token, payload)
      if (!res.success) {
        setError(res.message || 'Gagal upload bukti transaksi')
        return
      }

      setDetail(res.data)
      setProofURL('')
      setProofFile(null)
      setProofNote('')
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal upload bukti transaksi'))
    } finally {
      setUploadingProof(false)
    }
  }

  const statusBadge = useMemo(() => statusMeta(detail?.order.status || 'pending_transfer'), [detail?.order.status])
  const canUploadProof = detail ? !isFinalStatus(detail.order.status) : false

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Simpan token tracking ini buat pantau progress order: <strong>{token}</strong>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void loadTracking(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] bg-white px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#FAFAF8] disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          {loading ? (
            <section className="rounded-2xl border border-[#EBEBEB] bg-white p-8 text-center text-sm text-[#888]">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat tracking convert...
              </span>
            </section>
          ) : !detail ? (
            <section className="rounded-2xl border border-[#EBEBEB] bg-white p-6 text-center">
              <p className="text-sm text-[#666]">Order tidak ditemukan untuk token ini.</p>
            </section>
          ) : (
            <>
              <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-[#141414]">Tracking Order Convert</h1>
                    <p className="mt-2 text-sm text-[#888]">
                      Order ID: <span className="font-bold text-[#141414]">{detail.order.id}</span>
                    </p>
                    <p className="text-sm text-[#888]">Dibuat: {formatDate(detail.order.created_at)}</p>
                  </div>

                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
                <h2 className="text-sm font-bold text-[#141414]">Ringkasan</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                    <p className="text-[11px] text-[#888]">Aset</p>
                    <p className="mt-0.5 font-bold text-[#141414]">{detail.order.asset_type}</p>
                  </div>
                  <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                    <p className="text-[11px] text-[#888]">Nominal masuk</p>
                    <p className="mt-0.5 font-bold text-[#141414]">{formatRupiah(detail.order.source_amount)}</p>
                  </div>
                  <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                    <p className="text-[11px] text-[#888]">Total fee</p>
                    <p className="mt-0.5 font-bold text-red-600">{formatRupiah(detail.order.total_fee)}</p>
                  </div>
                  <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                    <p className="text-[11px] text-[#888]">Total diterima</p>
                    <p className="mt-0.5 font-bold text-emerald-600">{formatRupiah(detail.order.receive_amount)}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#555]">
                  <p>
                    Tujuan transfer: <strong>{detail.order.destination_bank}</strong> · {detail.order.destination_account_number} a/n{' '}
                    {detail.order.destination_account_name}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#141414]">Bukti Transaksi</h2>
                  <span className="text-xs text-[#888]">{detail.proofs.length} bukti tercatat</span>
                </div>

                {canUploadProof ? (
                  <form onSubmit={submitProof} className="mb-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#888]">URL bukti (opsional)</label>
                      <input
                        type="url"
                        value={proofURL}
                        onChange={(event) => setProofURL(event.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#141414]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#888]">Atau upload file bukti</label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#D7D7D3] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#555]">
                        <UploadCloud className="h-4 w-4" />
                        <span className="truncate">{proofFile ? proofFile.name : 'Pilih file (jpg/png/webp/pdf, max 10MB)'}</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          onChange={(event: ChangeEvent<HTMLInputElement>) => setProofFile(event.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#888]">Catatan (opsional)</label>
                      <textarea
                        value={proofNote}
                        onChange={(event) => setProofNote(event.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#141414]"
                        placeholder="Contoh: transfer via m-banking jam 21:00"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={uploadingProof}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FF5733] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64d2e] disabled:opacity-60"
                    >
                      {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      Upload Bukti
                    </button>
                  </form>
                ) : (
                  <p className="mb-3 rounded-lg border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2 text-sm text-[#666]">
                    Order sudah final ({statusBadge.label}). Upload bukti ditutup.
                  </p>
                )}

                {detail.proofs.length === 0 ? (
                  <p className="text-sm text-[#888]">Belum ada bukti transaksi yang diunggah.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.proofs.map((proof) => (
                      <div key={proof.id} className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <a
                            href={proof.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#141414] underline underline-offset-2"
                          >
                            {proof.file_name || proof.file_url}
                          </a>
                          <span className="text-xs text-[#888]">{formatDate(proof.created_at)}</span>
                        </div>
                        {proof.note ? <p className="mt-1 text-xs text-[#666]">{proof.note}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
                <h2 className="text-sm font-bold text-[#141414]">Timeline</h2>
                {detail.events.length === 0 ? (
                  <p className="mt-2 text-sm text-[#888]">Belum ada update timeline.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {detail.events.map((event) => (
                      <div key={event.id} className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[#141414]">
                            {event.from_status ? `${event.from_status} → ` : ''}
                            {event.to_status}
                          </p>
                          <p className="text-xs text-[#888]">{formatDate(event.created_at)}</p>
                        </div>
                        {event.reason ? <p className="mt-1 text-xs text-[#666]">Reason: {event.reason}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-wrap gap-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-[#141414] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2a2a2a]"
                >
                  Login untuk akses dashboard
                </Link>
                <Link
                  href="/product/convert"
                  className="inline-flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm font-bold text-[#141414] hover:bg-[#FAFAF8]"
                >
                  Buat order baru
                </Link>
              </section>
            </>
          )}
        </section>
      </main>

      <Footer />
    </>
  )
}
