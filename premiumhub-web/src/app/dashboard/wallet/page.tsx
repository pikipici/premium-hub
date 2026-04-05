"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CircleAlert, CircleCheck, Loader2, RefreshCcw } from 'lucide-react'

import WalletCard from '@/components/shared/WalletCard'
import { formatDate, formatRupiah } from '@/lib/utils'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import type { WalletLedger, WalletTopup } from '@/types/wallet'

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 200000, 500000]

function topupStatusBadge(status: string) {
  switch (status) {
    case 'success':
    case 'paid':
      return 'bg-green-100 text-green-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    case 'expired':
      return 'bg-gray-200 text-gray-700'
    default:
      return 'bg-yellow-100 text-yellow-700'
  }
}

export default function WalletPage() {
  const router = useRouter()
  const { setWalletBalance } = useAuthStore()

  const [balance, setBalance] = useState(0)
  const [topups, setTopups] = useState<WalletTopup[]>([])
  const [ledgers, setLedgers] = useState<WalletLedger[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [amount, setAmount] = useState<number>(QUICK_AMOUNTS[2])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedAmount = useMemo(() => {
    if (Number.isNaN(amount) || amount <= 0) return 0
    return Math.floor(amount)
  }, [amount])

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)

    try {
      const [balanceRes, topupRes, ledgerRes] = await Promise.all([
        walletService.getBalance(),
        walletService.listTopups({ page: 1, limit: 10 }),
        walletService.listLedger({ page: 1, limit: 10 }),
      ])

      if (balanceRes.success) {
        setBalance(balanceRes.data.balance)
        setWalletBalance(balanceRes.data.balance)
      }
      if (topupRes.success) {
        setTopups(topupRes.data)
      }
      if (ledgerRes.success) {
        setLedgers(ledgerRes.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      if (!silent) setLoading(false)
      if (silent) setRefreshing(false)
    }
  }, [setWalletBalance])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const createIdempotencyKey = () => {
    const suffix = Math.random().toString(36).slice(2, 8)
    return `topup-${Date.now()}-${suffix}`
  }

  const handleCreateTopup = async () => {
    if (!selectedAmount || selectedAmount < 1000) {
      setError('Nominal minimal Rp1.000')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const res = await walletService.createTopup({
        amount: selectedAmount,
        idempotencyKey: createIdempotencyKey(),
      })

      if (!res.success) {
        setError(res.message)
        return
      }

      router.push(`/dashboard/wallet/topup?id=${res.data.id}`)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(message || 'Gagal membuat invoice topup')
      } else {
        setError('Gagal membuat invoice topup')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-extrabold">Wallet</h1>
        <button
          type="button"
          onClick={() => fetchAll(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#EBEBEB] bg-white text-sm font-semibold hover:bg-[#F7F7F5] disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      <WalletCard
        balance={balance}
        totalTopup={0}
        totalSpent={0}
        loading={loading}
        onTopUp={() => {
          const formEl = document.getElementById('wallet-topup-form')
          formEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      <section id="wallet-topup-form" className="bg-white rounded-2xl border border-[#EBEBEB] p-5 md:p-6 mb-6">
        <h2 className="text-lg font-bold mb-1">Buat Topup</h2>
        <p className="text-sm text-[#888] mb-5">Struktur basic dulu. Detail UX bisa kamu poles bebas.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setAmount(quick)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                amount === quick
                  ? 'border-[#FF5733] bg-[#FFF3EF] text-[#FF5733]'
                  : 'border-[#EBEBEB] bg-white text-[#444] hover:bg-[#F7F7F5]'
              }`}
            >
              {formatRupiah(quick)}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-[#888] mb-1.5">Nominal custom</label>
          <input
            type="number"
            min={1000}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733]"
          />
        </div>

        {error && (
          <div className="mb-4 text-sm rounded-xl bg-red-50 text-red-600 px-3 py-2 inline-flex items-center gap-2">
            <CircleAlert className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleCreateTopup}
          disabled={submitting || selectedAmount < 1000}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FF5733] text-white text-sm font-bold hover:bg-[#e64d2e] disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Buat Invoice Topup
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      <section className="bg-white rounded-2xl border border-[#EBEBEB] p-5 md:p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">Riwayat Topup</h2>
        {topups.length === 0 ? (
          <p className="text-sm text-[#888]">Belum ada topup.</p>
        ) : (
          <div className="space-y-3">
            {topups.map((topup) => (
              <button
                type="button"
                key={topup.id}
                onClick={() => router.push(`/dashboard/wallet/topup?id=${topup.id}`)}
                className="w-full text-left rounded-xl border border-[#EBEBEB] p-4 hover:bg-[#F7F7F5] transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{formatRupiah(topup.payable_amount ?? topup.total_credit ?? topup.amount ?? topup.requested_amount ?? 0)}</div>
                    <div className="text-xs text-[#888]">{formatDate(topup.created_at)} • {topup.provider_trx_id ?? topup.midtrans_order_id ?? topup.id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold capitalize ${topupStatusBadge(topup.status)}`}>
                      {topup.status}
                    </span>
                    {(topup.is_overdue || topup.status === 'expired') && (
                      <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-gray-200 text-gray-700">
                        overdue
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-[#EBEBEB] p-5 md:p-6">
        <h2 className="text-lg font-bold mb-4">Ledger Wallet</h2>
        {ledgers.length === 0 ? (
          <p className="text-sm text-[#888]">Belum ada mutasi.</p>
        ) : (
          <div className="space-y-2">
            {ledgers.map((ledger) => {
              const isCredit = ledger.type === 'credit' || ledger.type === 'topup' || ledger.type === 'refund'
              return (
                <div key={ledger.id} className="rounded-xl border border-[#EBEBEB] p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{ledger.description || ledger.category}</div>
                    <div className="text-xs text-[#888]">{formatDate(ledger.created_at)} • {ledger.reference}</div>
                  </div>
                  <div className={`text-sm font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                    {isCredit ? '+' : '-'}{formatRupiah(ledger.amount)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {!loading && topups.length === 0 && ledgers.length === 0 && (
        <div className="mt-5 text-xs text-[#888] inline-flex items-center gap-2">
          <CircleCheck className="w-4 h-4 text-green-600" />
          Struktur wallet sudah kepasang. Tinggal lo poles UI/UX sesuai style final.
        </div>
      )}
    </div>
  )
}
