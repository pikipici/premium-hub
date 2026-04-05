"use client"

import axios from 'axios'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CircleAlert, CircleCheckBig, Clock3, Loader2, RefreshCcw } from 'lucide-react'

import { walletService } from '@/services/walletService'
import type { WalletTopup } from '@/types/wallet'
import { formatDate, formatRupiah } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

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

function WalletTopupStatusContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const topupId = searchParams.get('id')
  const { setWalletBalance } = useAuthStore()

  const [topup, setTopup] = useState<WalletTopup | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const finalStatus = useMemo(() => {
    if (!topup) return false
    return ['success', 'paid', 'failed', 'expired'].includes(topup.status)
  }, [topup])

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
        setError(res.message)
        return
      }

      setTopup(res.data)
      if (res.data.status === 'success' || res.data.status === 'paid') {
        refreshBalance()
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(message || 'Gagal memuat status topup')
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
        setError(res.message)
        return
      }
      setTopup(res.data)
      if (res.data.status === 'success' || res.data.status === 'paid') {
        refreshBalance()
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(message || 'Gagal sinkron status topup')
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
    if (!topupId || finalStatus) return

    const timer = setInterval(() => {
      loadTopup()
    }, 3000)

    return () => clearInterval(timer)
  }, [finalStatus, loadTopup, topupId])

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

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">Status Topup</h1>

      <section className="bg-white rounded-2xl border border-[#EBEBEB] p-5 md:p-6 mb-6">
        {loading ? (
          <div className="inline-flex items-center gap-2 text-sm text-[#888]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat data topup...
          </div>
        ) : topup ? (
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <div className="text-xs font-semibold text-[#888]">Invoice</div>
                <div className="text-sm font-bold">{topup.provider_trx_id ?? topup.midtrans_order_id ?? topup.id}</div>
              </div>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border capitalize ${statusTone(topup.status)}`}>
                {topup.status === 'pending' ? <Clock3 className="w-3.5 h-3.5" /> : <CircleCheckBig className="w-3.5 h-3.5" />}
                {topup.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[#F7F7F5] p-3">
                <div className="text-xs text-[#888] mb-1">Nominal Topup</div>
                <div className="font-bold">{formatRupiah(topup.requested_amount ?? topup.amount ?? 0)}</div>
              </div>
              <div className="rounded-xl bg-[#F7F7F5] p-3">
                <div className="text-xs text-[#888] mb-1">Nominal Transfer</div>
                <div className="font-bold">{formatRupiah(topup.payable_amount ?? topup.total_credit ?? topup.amount ?? 0)}</div>
              </div>
              <div className="rounded-xl bg-[#F7F7F5] p-3">
                <div className="text-xs text-[#888] mb-1">Dibuat</div>
                <div className="font-bold">{formatDate(topup.created_at)}</div>
              </div>
              <div className="rounded-xl bg-[#F7F7F5] p-3">
                <div className="text-xs text-[#888] mb-1">Expired</div>
                <div className="font-bold">{topup.expires_at || topup.expired_at ? formatDate(topup.expires_at ?? topup.expired_at ?? '') : '-'}</div>
              </div>
            </div>

            {topup.unique_code ? (
              <p className="text-xs text-[#888] mt-4">Kode unik: <span className="font-semibold text-[#141414]">{topup.unique_code}</span></p>
            ) : null}
          </>
        ) : (
          <div className="text-sm text-[#888]">Topup tidak ditemukan.</div>
        )}
      </section>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-5 inline-flex items-center gap-2">
          <CircleAlert className="w-4 h-4" />
          {error}
        </div>
      )}

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

      {finalStatus && (topup?.status === 'success' || topup?.status === 'paid') && (
        <p className="text-sm text-green-700 mt-4">Topup sudah sukses. Saldo wallet otomatis ikut update.</p>
      )}
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
