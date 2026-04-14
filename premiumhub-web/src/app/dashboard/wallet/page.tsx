"use client"

import axios from 'axios'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CircleAlert, Loader2, RefreshCcw, Sparkles } from 'lucide-react'

import { formatDate, formatRupiah } from '@/lib/utils'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import type { WalletLedger, WalletTopup } from '@/types/wallet'

const MIN_TOPUP = 10000
const NETFLIX_PRICE = 25000
const QUICK_AMOUNTS = [25000, 50000, 100000, 200000]

const PAYMENT_METHODS = [
  { key: 'qris', name: 'QRIS', icon: '⬛', fee: 'Sesuai channel' },
  { key: 'bri_va', name: 'BRI VA', icon: '🏦', fee: 'Sesuai channel' },
  { key: 'bni_va', name: 'BNI VA', icon: '🏦', fee: 'Sesuai channel' },
  { key: 'permata_va', name: 'Permata VA', icon: '🏦', fee: 'Sesuai channel' },
] as const

type TxFilter = 'all' | 'topup' | 'purchase' | 'refund'
type LedgerGroup = 'topup' | 'purchase' | 'refund' | 'other'
type MutationGroup = LedgerGroup | 'canceled_refunded'

type WalletMutationRow = {
  id: string
  group: MutationGroup
  amount: number
  balanceAfter: number
  createdAt: string
  description: string
  reference: string
  credit: boolean
  purchaseAmount?: number
  refundAmount?: number
}

function formatCompactAmount(value: number) {
  if (value >= 1000) {
    return `Rp ${Math.round(value / 1000)}rb`
  }
  return formatRupiah(value)
}

function normalizeLedgerGroup(ledger: WalletLedger): LedgerGroup {
  const category = (ledger.category || '').toLowerCase()
  const type = (ledger.type || '').toLowerCase()

  if (category.includes('topup') || type.includes('topup')) return 'topup'
  if (category.includes('refund') || type.includes('refund')) return 'refund'
  if (category.includes('purchase') || type.includes('purchase') || type === 'debit') return 'purchase'

  return 'other'
}

function isCreditLedger(ledger: WalletLedger) {
  const type = (ledger.type || '').toLowerCase()
  const group = normalizeLedgerGroup(ledger)
  return type === 'credit' || group === 'topup' || group === 'refund'
}

function topupStatusClass(status: string) {
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

function txVisual(group: MutationGroup) {
  switch (group) {
    case 'topup':
      return { icon: '⬆️', bg: 'bg-green-100' }
    case 'purchase':
      return { icon: '🛍️', bg: 'bg-amber-100' }
    case 'refund':
      return { icon: '↩️', bg: 'bg-blue-100' }
    case 'canceled_refunded':
      return { icon: '🔄', bg: 'bg-violet-100' }
    default:
      return { icon: '💳', bg: 'bg-slate-100' }
  }
}

function sanitizeWalletText(value: string | undefined): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''

  return trimmed
    .replace(/\bpakasir\b/gi, 'payment gateway')
    .replace(/\bprovider\b/gi, 'sistem pembayaran')
    .replace(/provider[_\s-]*order[_\s-]*id/gi, 'ID order')
    .replace(/\b5sim\b/gi, 'nomor OTP')
}

function parseWalletOrderRef(reference: string | undefined): { orderKey: string; action: 'purchase' | 'refund' | '' } {
  const raw = (reference || '').trim()
  if (!raw) return { orderKey: '', action: '' }

  const internalMatch = raw.match(/^fivesim_order:(\d+):(charge|refund)$/i)
  if (internalMatch) {
    return {
      orderKey: internalMatch[1],
      action: internalMatch[2].toLowerCase() === 'charge' ? 'purchase' : 'refund',
    }
  }

  const publicMatch = raw.match(/^(Pembelian|Refund|Order)\s*#\s*([A-Za-z0-9_-]+)$/i)
  if (!publicMatch) {
    return { orderKey: '', action: '' }
  }

  const label = publicMatch[1].toLowerCase()
  let action: 'purchase' | 'refund' | '' = ''
  if (label === 'pembelian') action = 'purchase'
  if (label === 'refund') action = 'refund'

  return {
    orderKey: publicMatch[2],
    action,
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
  const [submitting, setSubmitting] = useState(false)

  const [amount, setAmount] = useState<number>(QUICK_AMOUNTS[1])
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]['key']>('qris')
  const [txFilter, setTxFilter] = useState<TxFilter>('all')
  const [error, setError] = useState('')

  const selectedAmount = useMemo(() => {
    if (Number.isNaN(amount) || amount <= 0) return 0
    return Math.floor(amount)
  }, [amount])

  const estimatedBalance = useMemo(() => balance + selectedAmount, [balance, selectedAmount])

  const selectedPaymentMethodLabel = useMemo(
    () => PAYMENT_METHODS.find((method) => method.key === paymentMethod)?.name || paymentMethod,
    [paymentMethod]
  )

  const affordabilityCount = useMemo(() => Math.floor(balance / NETFLIX_PRICE), [balance])

  const totalBalanceIn = useMemo(() => {
    return ledgers
      .filter((ledger) => {
        const category = (ledger.category || '').toLowerCase().trim()
        const type = (ledger.type || '').toLowerCase().trim()

        if (category === 'manual_adjustment' && type === 'credit') return true
        return normalizeLedgerGroup(ledger) === 'topup'
      })
      .reduce((sum, ledger) => sum + ledger.amount, 0)
  }, [ledgers])

  const totalSpentGross = useMemo(() => {
    return ledgers
      .filter((ledger) => normalizeLedgerGroup(ledger) === 'purchase')
      .reduce((sum, ledger) => sum + ledger.amount, 0)
  }, [ledgers])

  const totalRefund = useMemo(() => {
    return ledgers
      .filter((ledger) => normalizeLedgerGroup(ledger) === 'refund')
      .reduce((sum, ledger) => sum + ledger.amount, 0)
  }, [ledgers])

  const totalSpentNet = useMemo(() => {
    const value = totalSpentGross - totalRefund
    return value > 0 ? value : 0
  }, [totalSpentGross, totalRefund])

  const purchaseCount = useMemo(
    () => ledgers.filter((ledger) => normalizeLedgerGroup(ledger) === 'purchase').length,
    [ledgers]
  )

  const refundCount = useMemo(
    () => ledgers.filter((ledger) => normalizeLedgerGroup(ledger) === 'refund').length,
    [ledgers]
  )

  const mutationRows = useMemo<WalletMutationRow[]>(() => {
    const purchaseByOrder = new Map<string, WalletLedger>()
    for (const ledger of ledgers) {
      const group = normalizeLedgerGroup(ledger)
      if (group !== 'purchase') continue

      const parsed = parseWalletOrderRef(ledger.reference)
      if (!parsed.orderKey) continue
      purchaseByOrder.set(parsed.orderKey, ledger)
    }

    const mergedOrderKeys = new Set<string>()
    const rows: WalletMutationRow[] = []

    for (const ledger of ledgers) {
      const group = normalizeLedgerGroup(ledger)
      const parsed = parseWalletOrderRef(ledger.reference)

      if (group === 'refund' && parsed.orderKey) {
        const purchaseLedger = purchaseByOrder.get(parsed.orderKey)
        if (purchaseLedger) {
          if (!mergedOrderKeys.has(parsed.orderKey)) {
            mergedOrderKeys.add(parsed.orderKey)
            rows.push({
              id: `canceled-refunded-${parsed.orderKey}`,
              group: 'canceled_refunded',
              amount: 0,
              balanceAfter: ledger.balance_after,
              createdAt: ledger.created_at,
              description: 'Dibatalkan (Refunded)',
              reference: `Order #${parsed.orderKey}`,
              credit: false,
              purchaseAmount: purchaseLedger.amount,
              refundAmount: ledger.amount,
            })
          }
          continue
        }
      }

      if (group === 'purchase' && parsed.orderKey && mergedOrderKeys.has(parsed.orderKey)) {
        continue
      }

      rows.push({
        id: ledger.id,
        group,
        amount: ledger.amount,
        balanceAfter: ledger.balance_after,
        createdAt: ledger.created_at,
        description: sanitizeWalletText(ledger.description) || sanitizeWalletText(ledger.category) || 'Transaksi wallet',
        reference: sanitizeWalletText(ledger.reference) || 'Riwayat transaksi',
        credit: isCreditLedger(ledger),
      })
    }

    return rows
  }, [ledgers])

  const filteredMutationRows = useMemo(() => {
    if (txFilter === 'all') return mutationRows
    if (txFilter === 'topup') return mutationRows.filter((row) => row.group === 'topup')
    if (txFilter === 'purchase') return mutationRows.filter((row) => row.group === 'purchase' || row.group === 'canceled_refunded')
    if (txFilter === 'refund') return mutationRows.filter((row) => row.group === 'refund' || row.group === 'canceled_refunded')
    return mutationRows
  }, [mutationRows, txFilter])

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)

    try {
      const [balanceRes, topupRes, ledgerRes] = await Promise.all([
        walletService.getBalance(),
        walletService.listTopups({ page: 1, limit: 20 }),
        walletService.listLedger({ page: 1, limit: 50 }),
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
    if (selectedAmount < MIN_TOPUP) {
      setError(`Nominal minimal ${formatRupiah(MIN_TOPUP)}`)
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const res = await walletService.createTopup({
        amount: selectedAmount,
        idempotencyKey: createIdempotencyKey(),
        paymentMethod,
      })

      if (!res.success) {
        setError(sanitizeWalletText(res.message) || 'Gagal membuat invoice topup')
        return
      }

      router.push(`/dashboard/wallet/topup?id=${res.data.id}`)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(sanitizeWalletText(message) || 'Gagal membuat invoice topup')
      } else {
        setError('Gagal membuat invoice topup')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Wallet Saya 💰</h1>
          <p className="text-sm text-[#888] mt-1">Kelola saldo dan riwayat transaksi kamu</p>
        </div>
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

      <section className="relative overflow-hidden rounded-2xl bg-[#141414] p-6 md:p-7 text-white">
        <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -right-4 -bottom-14 h-36 w-36 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-white/45 mb-2">Saldo Tersedia</div>
            <div className="text-3xl md:text-4xl font-extrabold tracking-tight">
              {loading ? 'Memuat saldo...' : formatRupiah(balance)}
            </div>
            <div className="text-sm text-white/45 mt-2">
              {affordabilityCount >= 1
                ? `Cukup untuk ${affordabilityCount}× pembelian Netflix`
                : 'Saldo belum cukup untuk pembelian berikutnya'}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Aktif
          </div>
        </div>

        <div className="relative grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <div className="p-3 md:p-4 border-r border-white/10">
            <div className="text-[11px] text-white/45 mb-1">Total Isi Saldo</div>
            <div className="text-sm md:text-base font-bold text-emerald-300">{formatRupiah(totalBalanceIn)}</div>
          </div>
          <div className="p-3 md:p-4 border-r border-white/10">
            <div className="text-[11px] text-white/45 mb-1">Total Dipakai Bersih</div>
            <div className="text-sm md:text-base font-bold text-rose-300">{formatRupiah(totalSpentNet)}</div>
          </div>
          <div className="p-3 md:p-4">
            <div className="text-[11px] text-white/45 mb-1">Total Refund</div>
            <div className="text-sm md:text-base font-bold text-sky-300">{formatRupiah(totalRefund)}</div>
          </div>
        </div>

        <div className="relative mt-2 text-[11px] text-white/45">
          Dipakai bersih = pembelian - refund • Refund {refundCount}/{purchaseCount} transaksi pembelian.
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBEB]">
            <h2 className="text-sm font-bold">Top Up Saldo</h2>
            <span className="text-xs text-[#888]">Min. {formatRupiah(MIN_TOPUP)}</span>
          </header>

          <div className="p-5 space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-2">Pilih Nominal</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((quick) => {
                  const selected = selectedAmount === quick
                  return (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setAmount(quick)}
                      className={`relative rounded-xl border px-2 py-3 text-center transition-colors ${
                        selected
                          ? 'border-[#141414] bg-[#FAFAF8]'
                          : 'border-[#EBEBEB] bg-white hover:bg-[#FAFAF8] hover:border-[#D8D8D5]'
                      }`}
                    >
                      {quick === 50000 ? (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-[#FF5733] text-white px-2 py-0.5 rounded-full">
                          Populer
                        </span>
                      ) : null}
                      <div className="text-sm font-extrabold">{formatCompactAmount(quick)}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-2">Atau Masukkan Nominal</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#888]">Rp</span>
                <input
                  type="number"
                  min={MIN_TOPUP}
                  step={1000}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#EBEBEB] pl-11 pr-3 py-3 text-sm font-semibold focus:outline-none focus:border-[#141414]"
                  placeholder="Contoh: 75000"
                />
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-2">Metode Pembayaran</div>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const selected = paymentMethod === method.key
                  return (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => setPaymentMethod(method.key)}
                      className={`relative rounded-xl border px-1.5 py-2.5 transition-colors ${
                        selected
                          ? 'border-[#141414] bg-[#FAFAF8]'
                          : 'border-[#EBEBEB] bg-white hover:border-[#D8D8D5]'
                      }`}
                    >
                      {selected ? (
                        <span className="absolute right-1 top-1 h-3.5 w-3.5 rounded-full bg-[#141414] text-white text-[8px] leading-[14px] font-black">✓</span>
                      ) : null}
                      <div className="text-lg leading-none mb-1">{method.icon}</div>
                      <div className="text-[10px] font-semibold text-[#141414] leading-tight">{method.name}</div>
                      <div className="text-[9px] text-green-700 font-semibold">{method.fee}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[#EBEBEB] bg-[#F7F7F5] px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Nominal top up</span>
                <span className="font-semibold">{selectedAmount >= MIN_TOPUP ? formatRupiah(selectedAmount) : 'Belum dipilih'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Metode bayar</span>
                <span className="font-semibold">{selectedPaymentMethodLabel}</span>
              </div>
              <div className="pt-2 border-t border-[#EBEBEB] flex items-center justify-between">
                <span className="text-sm font-bold">Saldo setelah top up</span>
                <span className="text-base font-extrabold">{formatRupiah(estimatedBalance)}</span>
              </div>
              <p className="text-[11px] text-[#888]">Total bayar final mengikuti invoice pembayaran (bisa termasuk biaya channel).</p>
            </div>

            {error ? (
              <div className="rounded-xl bg-red-50 text-red-600 px-3 py-2 text-sm inline-flex items-center gap-2">
                <CircleAlert className="w-4 h-4" />
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleCreateTopup}
              disabled={submitting || selectedAmount < MIN_TOPUP}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF5733] px-4 py-3 text-sm font-bold text-white hover:bg-[#e64d2e] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Top Up Sekarang
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl bg-gradient-to-br from-[#141414] to-[#2A2A2A] p-5 text-white flex flex-col md:flex-row md:items-center gap-3">
            <div className="text-3xl">⚡</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold mb-1">Saldo Wallet Siap Dipakai</h3>
              <p className="text-xs text-white/60">Saldo wallet kamu bisa dipakai untuk beli nomor OTP di Dashboard Nokos.</p>
            </div>
            <Link
              href="/dashboard/nokos"
              className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#141414] hover:opacity-90"
            >
              Buka Nokos
            </Link>
          </section>

          <section className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden">
            <header className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBEB]">
              <h2 className="text-sm font-bold">Riwayat Mutasi</h2>
              <button type="button" onClick={() => router.push('/dashboard/riwayat-order')} className="text-xs text-[#888] hover:text-[#141414]">
                Lihat semua →
              </button>
            </header>

            <div className="px-4 py-3 border-b border-[#EBEBEB] flex gap-2 overflow-x-auto">
              {(['all', 'topup', 'purchase', 'refund'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTxFilter(filter)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    txFilter === filter
                      ? 'bg-[#141414] border-[#141414] text-white'
                      : 'bg-white border-[#EBEBEB] text-[#888] hover:border-[#141414] hover:text-[#141414]'
                  }`}
                >
                  {filter === 'all' ? 'Semua' : filter === 'topup' ? 'Top Up' : filter === 'purchase' ? 'Pembelian' : 'Refund'}
                </button>
              ))}
            </div>

            <div className="divide-y divide-[#EBEBEB]">
              {filteredMutationRows.length === 0 ? (
                <div className="p-5 text-sm text-[#888]">Belum ada mutasi untuk filter ini.</div>
              ) : (
                filteredMutationRows.slice(0, 8).map((row) => {
                  const visual = txVisual(row.group)
                  const isCanceledRefunded = row.group === 'canceled_refunded'

                  return (
                    <div key={row.id} className="px-5 py-3 hover:bg-[#FAFAF8] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-xl ${visual.bg} flex items-center justify-center text-lg shrink-0`}>{visual.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{row.description}</div>
                          <div className="text-xs text-[#888] mt-0.5 truncate">{formatDate(row.createdAt)} • {row.reference}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-extrabold ${isCanceledRefunded ? 'text-violet-700' : row.credit ? 'text-green-600' : 'text-[#141414]'}`}>
                            {isCanceledRefunded ? `±${formatRupiah(0)}` : `${row.credit ? '+' : '-'}${formatRupiah(row.amount)}`}
                          </div>
                          <div className="text-[11px] text-[#888] mt-0.5">
                            {isCanceledRefunded
                              ? `Debit ${formatRupiah(row.purchaseAmount || row.refundAmount || 0)} sudah direfund.`
                              : `Saldo: ${formatRupiah(row.balanceAfter)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBEB]">
          <h2 className="text-sm font-bold">Invoice Topup Terakhir</h2>
          <button type="button" onClick={() => fetchAll(true)} className="text-xs text-[#888] hover:text-[#141414] inline-flex items-center gap-1">
            <RefreshCcw className="w-3.5 h-3.5" />
            Muat ulang
          </button>
        </header>

        <div className="divide-y divide-[#EBEBEB]">
          {topups.length === 0 ? (
            <div className="p-5 text-sm text-[#888]">Belum ada invoice topup.</div>
          ) : (
            topups.slice(0, 8).map((topup) => (
              <button
                key={topup.id}
                type="button"
                onClick={() => router.push(`/dashboard/wallet/topup?id=${topup.id}`)}
                className="w-full px-5 py-3 text-left hover:bg-[#FAFAF8] transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">
                      {formatRupiah(topup.payable_amount ?? topup.total_credit ?? topup.amount ?? topup.requested_amount ?? 0)}
                    </div>
                    <div className="text-xs text-[#888] mt-1">
                      {formatDate(topup.created_at)} • {topup.gateway_ref ?? topup.id}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold capitalize ${topupStatusClass(topup.status)}`}>
                      {topup.status}
                    </span>
                    {topup.is_overdue ? (
                      <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-gray-200 text-gray-700">overdue</span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {!loading && topups.length === 0 && ledgers.length === 0 ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#EBEBEB] bg-white px-3 py-2 text-xs text-[#888]">
          <Sparkles className="w-3.5 h-3.5" />
          Wallet masih kosong. Bikin topup pertama biar dashboard ini hidup.
        </div>
      ) : null}
    </div>
  )
}
