"use client"

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, RefreshCcw, UploadCloud } from 'lucide-react'

import ConvertTimelineSection from '@/components/convert/ConvertTimelineSection'
import { getConvertStatusSummary, isFinalConvertStatus } from '@/lib/convertTimeline'
import { getHttpErrorMessage } from '@/lib/httpError'
import { convertService } from '@/services/convertService'
import type { ConvertOrderDetail } from '@/types/convert'

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}


export default function DashboardConvertOrderDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const orderID = String(params?.id || '')

  const [detail, setDetail] = useState<ConvertOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [proofURL, setProofURL] = useState('')
  const [proofNote, setProofNote] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  const loadDetail = useCallback(async (silent = false) => {
    if (!orderID) return

    if (silent) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const res = await convertService.getOrderByID(orderID)
      if (!res.success) {
        setError(res.message || 'Gagal memuat detail order convert')
        return
      }
      setDetail(res.data)
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal memuat detail order convert'))
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [orderID])

  useEffect(() => {
    void loadDetail(false)
  }, [loadDetail])

  const status = detail?.order.status || 'pending_transfer'
  const statusBadge = getConvertStatusSummary(status)
  const canUploadProof = detail ? !isFinalConvertStatus(detail.order.status) : false

  const submitUploadProof = async (event: FormEvent<HTMLFormElement>) => {
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

      const res = await convertService.uploadProof(detail.order.id, payload)
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

  const proofSummary = useMemo(() => {
    if (!detail) return 'Belum ada bukti transaksi'
    if (detail.proofs.length === 0) return 'Belum ada bukti transaksi'
    return `${detail.proofs.length} bukti transaksi tercatat`
  }, [detail])

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard/convert/orders')}
            className="inline-flex items-center gap-1 rounded-lg border border-[#EBEBEB] bg-white px-3 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight">Detail Order Convert</h1>
        </div>

        <button
          type="button"
          onClick={() => void loadDetail(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] bg-white px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#FAFAF8] disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <section className="rounded-2xl border border-[#EBEBEB] bg-white p-8 text-center text-sm text-[#888]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat detail order...
          </span>
        </section>
      ) : !detail ? (
        <section className="rounded-2xl border border-[#EBEBEB] bg-white p-6 text-center">
          <p className="text-sm text-[#666]">Order convert tidak ditemukan.</p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[#888]">Order ID</p>
                <h2 className="text-lg font-black text-[#141414]">{detail.order.id}</h2>
                <p className="mt-1 text-xs text-[#888]">Dibuat: {formatDate(detail.order.created_at)}</p>
              </div>

              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusBadge.badgeClassName}`}>
                {statusBadge.label}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
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
              <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                <p className="text-[11px] text-[#888]">Tracking token</p>
                <p className="mt-0.5 truncate font-bold text-[#141414]">{detail.order.tracking_token || '-'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm text-[#555]">
              <p>
                Sumber: <strong>{detail.order.source_channel}</strong> · {detail.order.source_account}
              </p>
              <p className="mt-1">
                Tujuan: <strong>{detail.order.destination_bank}</strong> · {detail.order.destination_account_number} a/n{' '}
                {detail.order.destination_account_name}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#141414]">Upload Bukti Transfer</h3>
              <span className="text-xs text-[#888]">{proofSummary}</span>
            </div>

            {canUploadProof ? (
              <form onSubmit={submitUploadProof} className="space-y-3">
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
              <p className="rounded-lg border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2 text-sm text-[#666]">
                Order sudah final ({statusBadge.label}). Upload bukti sudah ditutup.
              </p>
            )}
          </section>

          <ConvertTimelineSection detail={detail} title="Timeline Status" />

          <section className="flex flex-wrap gap-2">
            <Link
              href="/product/convert"
              className="inline-flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm font-bold text-[#141414] hover:bg-[#FAFAF8]"
            >
              Buat Order Baru
            </Link>
            {detail.order.tracking_token ? (
              <Link
                href={`/product/convert/track/${encodeURIComponent(detail.order.tracking_token)}`}
                className="inline-flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm font-bold text-[#141414] hover:bg-[#FAFAF8]"
              >
                Buka Halaman Tracking Publik
              </Link>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}
