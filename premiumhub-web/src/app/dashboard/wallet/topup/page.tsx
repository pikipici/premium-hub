"use client"

import axios from 'axios'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CircleAlert, CircleCheckBig, Clock3, Loader2, RefreshCcw } from 'lucide-react'

import { walletService } from '@/services/walletService'
import type { WalletTopup } from '@/types/wallet'
import { formatRupiah } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import GatewayPaymentDisplay from '@/components/payment/GatewayPaymentDisplay'

const FINAL_TOPUP_STATUSES: WalletTopup['status'][] = ['success', 'paid', 'failed', 'expired']

function statusTone(status: WalletTopup['status']) {
  switch (status) {
    case 'success':
    case 'paid':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'failed':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'expired':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    default:
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  }
}

function statusLabel(status: WalletTopup['status']) {
  switch (status) {
    case 'success':
    case 'paid':
      return 'berhasil'
    case 'failed':
      return 'gagal'
    case 'expired':
      return 'kedaluwarsa'
    default:
      return 'menunggu pembayaran'
  }
}

function isPayableTopup(topup: WalletTopup) {
  return topup.status === 'pending'
}

function finalTopupCopy(status: WalletTopup['status']) {
  switch (status) {
    case 'success':
    case 'paid':
      return {
        tone: 'border-green-100 bg-green-50 text-green-700',
        title: 'Top up berhasil.',
        description: 'Saldo wallet sudah masuk otomatis dan siap dipakai.',
        cta: 'Kembali ke Wallet',
      }
    case 'failed':
      return {
        tone: 'border-red-100 bg-red-50 text-red-700',
        title: 'Top up gagal diproses.',
        description: 'Jangan lakukan pembayaran ke invoice ini. Silakan buat top up ulang dengan metode pembayaran baru.',
        cta: 'Top Up Ulang',
      }
    case 'expired':
      return {
        tone: 'border-gray-200 bg-gray-50 text-gray-700',
        title: 'Invoice top up sudah kedaluwarsa.',
        description: 'Jangan lakukan pembayaran ke invoice ini. Buat invoice baru untuk top up ulang.',
        cta: 'Buat Invoice Baru',
      }
    default:
      return null
  }
}

function parseDateMs(value?: string | Date | null) {
  if (!value) return 0

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function sanitizeWalletTopupText(value: string | undefined): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''

  return trimmed
    .replace(/\bpakasir\b/gi, 'payment gateway')
    .replace(/\bprovider\b/gi, 'sistem pembayaran')
    .replace(/provider[_\s-]*order[_\s-]*id/gi, 'ID order')
    .replace(/\b5sim\b/gi, 'nomor OTP')
}

function TopupFinalNotice({ status }: { status: WalletTopup['status'] }) {
  const copy = finalTopupCopy(status)

  if (!copy) return null

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${copy.tone}`}>
      <div className="font-bold">{copy.title}</div>
      <p className="mt-1 text-xs leading-relaxed opacity-85">{copy.description}</p>
      <Link
        href="/dashboard/wallet"
        className="mt-3 inline-flex rounded-lg bg-[#141414] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
      >
        {copy.cta}
      </Link>
    </div>
  )
}

function WalletTopupStatusContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const topupId = searchParams.get('id')
  const { setWalletBalance } = useAuthStore()

  const [topup, setTopup] = useState<WalletTopup | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [pollAttempt, setPollAttempt] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const finalStatus = useMemo(() => {
    if (!topup) return false
    return FINAL_TOPUP_STATUSES.includes(topup.status)
  }, [topup])

  const expiresAt = topup?.expires_at ?? topup?.expired_at
  const expiresAtMs = useMemo(() => parseDateMs(expiresAt), [expiresAt])

  const effectiveStatus = useMemo<WalletTopup['status']>(() => {
    return topup?.status ?? 'pending'
  }, [topup?.status])

  const payableStatus = useMemo(() => {
    return topup ? isPayableTopup(topup) : false
  }, [topup])

  const countdownMs = useMemo(() => {
    if (!payableStatus || expiresAtMs <= 0) return 0
    return Math.max(0, expiresAtMs - nowMs)
  }, [expiresAtMs, nowMs, payableStatus])

  const refreshBalance = useCallback(async () => {
    try {
      const balanceRes = await walletService.getBalance()
      if (balanceRes.success) {
        setWalletBalance(balanceRes.data.balance)
      }
    } catch (err) {
      console.error(err)
    }
  }, [setWalletBalance])

  const loadTopup = useCallback(async () => {
    if (!topupId) return

    setError('')
    try {
      const res = await walletService.getTopupByID(topupId)
      if (!res.success) {
        setError(sanitizeWalletTopupText(res.message) || 'Gagal memuat status topup')
        return
      }

      setTopup(res.data)
      if (res.data.status === 'success' || res.data.status === 'paid') {
        refreshBalance()
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(sanitizeWalletTopupText(message) || 'Gagal memuat status topup')
      } else {
        setError('Gagal memuat status topup')
      }
    } finally {
      setLoading(false)
    }
  }, [refreshBalance, topupId])

  const forceSync = useCallback(async () => {
    if (!topupId) return

    setSyncing(true)
    setError('')
    try {
      const res = await walletService.checkTopup(topupId)
      if (!res.success) {
        setError(sanitizeWalletTopupText(res.message) || 'Gagal sinkron status topup')
        return
      }

      setTopup(res.data)
      setPollAttempt(0)
      if (res.data.status === 'success' || res.data.status === 'paid') {
        refreshBalance()
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(sanitizeWalletTopupText(message) || 'Gagal sinkron status topup')
      } else {
        setError('Gagal sinkron status topup')
      }
    } finally {
      setSyncing(false)
    }
  }, [refreshBalance, topupId])

  useEffect(() => {
    loadTopup()
  }, [loadTopup])

  useEffect(() => {
    setPollAttempt(0)
  }, [topupId])

  useEffect(() => {
    if (!topupId || finalStatus) return

    const delayMs = pollAttempt < 5 ? 3000 : pollAttempt < 12 ? 5000 : 10000
    const timer = setTimeout(() => {
      loadTopup()
      setPollAttempt((prev) => prev + 1)
    }, delayMs)

    return () => clearTimeout(timer)
  }, [finalStatus, loadTopup, pollAttempt, topupId])

  useEffect(() => {
    if (!topup || finalStatus) return

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [finalStatus, topup])

  if (!topupId) {
    return (
      <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6">
        <h1 className="text-xl font-extrabold mb-2">Topup tidak valid</h1>
        <p className="text-sm text-[#888] mb-4">ID topup tidak ditemukan di URL.</p>
        <Link href="/dashboard/wallet" className="inline-flex px-4 py-2 rounded-xl bg-[#141414] text-white text-sm font-semibold">
          Kembali ke Wallet
        </Link>
      </div>
    )
  }

  const transferAmount = topup?.payable_amount ?? topup?.total_credit ?? topup?.amount ?? topup?.requested_amount ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push('/dashboard/wallet')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] bg-white px-3 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight">Status Topup</h1>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-[#141414] p-6 text-white">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />

        {loading ? (
          <div className="inline-flex items-center gap-2 text-sm text-white/70">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat data topup...
          </div>
        ) : topup ? (
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/45 mb-2">Invoice</div>
              <div className="text-sm font-bold break-all">{topup.gateway_ref ?? topup.id}</div>

              <div className="mt-5 text-[11px] uppercase tracking-wide text-white/45">Nominal Transfer</div>
              <div className="text-3xl font-extrabold tracking-tight mt-1">{formatRupiah(transferAmount)}</div>
            </div>

            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${statusTone(effectiveStatus)}`}>
              {effectiveStatus === 'pending' ? (
                <Clock3 className="w-3.5 h-3.5" />
              ) : effectiveStatus === 'success' || effectiveStatus === 'paid' ? (
                <CircleCheckBig className="w-3.5 h-3.5" />
              ) : (
                <CircleAlert className="w-3.5 h-3.5" />
              )}
              {statusLabel(effectiveStatus)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-white/70">Topup tidak ditemukan.</p>
        )}
      </section>

      {topup ? (
        <section className="bg-white rounded-2xl border border-[#EBEBEB] p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[#F7F7F5] p-3">
              <div className="text-xs text-[#888] mb-1">Nominal Topup</div>
              <div className="font-bold">{formatRupiah(topup.requested_amount ?? topup.amount ?? 0)}</div>
            </div>
            <div className="rounded-xl bg-[#F7F7F5] p-3">
              <div className="text-xs text-[#888] mb-1">Nominal Transfer</div>
              <div className="font-bold">{formatRupiah(transferAmount)}</div>
            </div>
            <div className="rounded-xl bg-[#F7F7F5] p-3">
              <div className="text-xs text-[#888] mb-1">Dibuat</div>
              <div className="font-bold">{formatDateTime(topup.created_at)}</div>
            </div>
            <div className="rounded-xl bg-[#F7F7F5] p-3">
              <div className="text-xs text-[#888] mb-1">Batas Pembayaran</div>
              <div className="font-bold">{expiresAt ? formatDateTime(expiresAt) : '-'}</div>
            </div>
          </div>

          {payableStatus && expiresAt ? (
            <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">Bayar sebelum {formatDateTime(expiresAt)}</span>
                <span className="font-extrabold">Sisa {formatCountdown(countdownMs)}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
            <div className="rounded-xl bg-[#F7F7F5] p-3">
              <div className="text-xs text-[#888] mb-1">Status Pembayaran</div>
              <div className="font-bold capitalize">{topup.provider_status || statusLabel(effectiveStatus)}</div>
            </div>
            {payableStatus ? (
              <GatewayPaymentDisplay paymentMethod={topup.payment_method} paymentNumber={topup.payment_number} />
            ) : (
              <TopupFinalNotice status={effectiveStatus} />
            )}
          </div>

          {payableStatus ? (
            <div className="mt-4 rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-xs text-[#666] leading-relaxed">
              Polling adaptif jalan otomatis (3-10 detik). Kalau udah transfer tapi status belum gerak, klik <strong>Cek Status Sekarang</strong>.
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 inline-flex items-center gap-2">
          <CircleAlert className="w-4 h-4" />
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={forceSync}
          disabled={syncing || loading || finalStatus}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#141414] text-white text-sm font-semibold disabled:opacity-60"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Cek Status Sekarang
        </button>

        <button
          type="button"
          onClick={() => router.push('/dashboard/wallet')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#EBEBEB] bg-white text-sm font-semibold hover:bg-[#F7F7F5]"
        >
          Kembali ke Wallet
        </button>
      </div>

    </div>
  )
}

export default function WalletTopupPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[#888]">Memuat topup...</div>}>
      <WalletTopupStatusContent />
    </Suspense>
  )
}
