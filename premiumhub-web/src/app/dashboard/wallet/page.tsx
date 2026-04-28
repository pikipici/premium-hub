"use client"

import axios from 'axios'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CircleAlert, Loader2, RefreshCcw, Sparkles } from 'lucide-react'

import { FALLBACK_PAYMENT_METHODS, normalizePaymentMethodOptions, paymentMethodFeeLabel, paymentMethodIcon } from '@/lib/paymentMethods'
import { formatDate, formatRupiah } from '@/lib/utils'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import type { PaymentMethodOption, WalletLedger, WalletTopup } from '@/types/wallet'

const MIN_TOPUP = 10000
const QUICK_AMOUNTS = [25000, 50000, 100000, 200000]
const MUTATION_PAGE_SIZE = 8

type TxFilter = 'all' | 'topup' | 'purchase' | 'refund'
type LedgerGroup = 'topup' | 'purchase' | 'refund' | 'other'

type WalletMutationRow = {
  id: string
  group: LedgerGroup
  amount: number
  balanceAfter: number
  createdAt: string
  description: string
  reference: string
  credit: boolean
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

function txVisual(group: LedgerGroup) {
  switch (group) {
    case 'topup':
      return { icon: '⬆️', bg: 'bg-green-100' }
    case 'purchase':
      return { icon: '🛍️', bg: 'bg-amber-100' }
    case 'refund':
      return { icon: '↩️', bg: 'bg-blue-100' }
    default:
      return { icon: '💳', bg: 'bg-slate-100' }
  }
}

function isUnfinishedTopup(topup: WalletTopup) {
  const status = (topup.status || '').toLowerCase()
  const providerStatus = (topup.provider_status || '').toLowerCase()

  if (status === 'pending' || status === 'failed' || status === 'expired') return true
  if (providerStatus.includes('unpaid') || providerStatus.includes('pending') || providerStatus.includes('waiting')) return true

  return false
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

export default function WalletPage() {
  const router = useRouter()
  const { setWalletBalance } = useAuthStore()

  const [balance, setBalance] = useState(0)
  const [topups, setTopups] = useState<WalletTopup[]>([])
  const [ledgers, setLedgers] = useState<WalletLedger[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(FALLBACK_PAYMENT_METHODS)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [amount, setAmount] = useState<number>(QUICK_AMOUNTS[1])
  const [paymentMethod, setPaymentMethod] = useState(FALLBACK_PAYMENT_METHODS[0].method)
  const [txFilter, setTxFilter] = useState<TxFilter>('all')
  const [txPage, setTxPage] = useState(1)
  const [error, setError] = useState('')

  const selectedAmount = useMemo(() => {
    if (Number.isNaN(amount) || amount <= 0) return 0
    return Math.floor(amount)
  }, [amount])

  const estimatedBalance = useMemo(() => balance + selectedAmount, [balance, selectedAmount])

  const selectedPaymentMethodLabel = useMemo(
    () => paymentMethods.find((method) => method.method === paymentMethod)?.name || paymentMethod,
    [paymentMethod, paymentMethods]
  )

  const walletBalanceHint = useMemo(() => {
    if (balance > 0) {
      return 'Saldo siap dipakai untuk produk yang mendukung pembayaran wallet.'
    }
    return 'Isi saldo dulu untuk mulai transaksi di produk yang mendukung pembayaran wallet.'
  }, [balance])

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
    return ledgers.map((ledger) => {
      const group = normalizeLedgerGroup(ledger)

      return {
        id: ledger.id,
        group,
        amount: ledger.amount,
        balanceAfter: ledger.balance_after,
        createdAt: ledger.created_at,
        description: sanitizeWalletText(ledger.description) || sanitizeWalletText(ledger.category) || 'Transaksi wallet',
        reference: sanitizeWalletText(ledger.reference) || 'Riwayat transaksi',
        credit: isCreditLedger(ledger),
      }
    })
  }, [ledgers])

  const filteredMutationRows = useMemo(() => {
    if (txFilter === 'all') return mutationRows
    if (txFilter === 'topup') return mutationRows.filter((row) => row.group === 'topup')
    if (txFilter === 'purchase') return mutationRows.filter((row) => row.group === 'purchase')
    if (txFilter === 'refund') return mutationRows.filter((row) => row.group === 'refund')
    return mutationRows
  }, [mutationRows, txFilter])

  const unfinishedTopups = useMemo(() => {
    return topups.filter((topup) => isUnfinishedTopup(topup))
  }, [topups])

  const mutationTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredMutationRows.length / MUTATION_PAGE_SIZE))
  }, [filteredMutationRows.length])

  const paginatedMutationRows = useMemo(() => {
    const start = (txPage - 1) * MUTATION_PAGE_SIZE
    return filteredMutationRows.slice(start, start + MUTATION_PAGE_SIZE)
  }, [filteredMutationRows, txPage])

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

      try {
        const methodRes = await walletService.listPaymentMethods(MIN_TOPUP)
        if (methodRes.success) {
          const methods = normalizePaymentMethodOptions(methodRes.data)
          setPaymentMethods(methods)
          setPaymentMethod((current) => (methods.some((method) => method.method === current) ? current : methods[0].method))
        }
      } catch (err) {
        console.error(err)
        setPaymentMethods(FALLBACK_PAYMENT_METHODS)
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

  useEffect(() => {
    setTxPage(1)
  }, [txFilter])

  useEffect(() => {
    setTxPage((current) => Math.min(current, mutationTotalPages))
  }, [mutationTotalPages])

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
            <div className="text-sm text-white/45 mt-2">{walletBalanceHint}</div>
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
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                {paymentMethods.map((method) => {
                  const selected = paymentMethod === method.method
                  const icon = paymentMethodIcon(method.method)
                  return (
                    <button
                      key={method.method}
                      type="button"
                      onClick={() => setPaymentMethod(method.method)}
                      title={method.name}
                      className={`relative min-h-[82px] rounded-xl border px-1.5 py-2.5 text-center transition-colors ${
                        selected
                          ? 'border-[#141414] bg-[#FAFAF8]'
                          : 'border-[#EBEBEB] bg-white hover:border-[#D8D8D5]'
                      }`}
                    >
                      {selected ? (
                        <span className="absolute right-1 top-1 h-3.5 w-3.5 rounded-full bg-[#141414] text-white text-[8px] leading-[14px] font-black">✓</span>
                      ) : null}
                      <div className="mb-1 flex h-6 items-center justify-center">
                        {method.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={method.image} alt={method.name} className="max-h-6 max-w-12 object-contain" />
                        ) : (
                          <span className="text-[10px] leading-none font-black tracking-wide">{icon}</span>
                        )}
                      </div>
                      <div className="truncate text-[10px] font-semibold leading-tight text-[#141414]">{method.name}</div>
                      <div className="truncate text-[9px] font-semibold text-green-700">{paymentMethodFeeLabel(method.fee)}</div>
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
              <p className="text-xs text-white/60">Pakai saldo wallet untuk checkout Nokos dan layanan SMM dalam satu akun.</p>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <Link
                href="/dashboard/nokos"
                className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#141414] hover:opacity-90"
              >
                Buka Nokos
              </Link>
              <Link
                href="/product/sosmed"
                className="inline-flex items-center justify-center rounded-lg border border-white/35 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                Buka SMM
              </Link>
            </div>
          </section>

          <section className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden">
            <header className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBEB]">
              <h2 className="text-sm font-bold">Riwayat Saldo</h2>
              <div className="text-xs text-[#888]">Halaman {txPage}/{mutationTotalPages}</div>
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
                  {filter === 'all' ? 'Semua' : filter === 'topup' ? 'Isi Saldo' : filter === 'purchase' ? 'Pembelian' : 'Refund'}
                </button>
              ))}
            </div>

            <div className="divide-y divide-[#EBEBEB]">
              {filteredMutationRows.length === 0 ? (
                <div className="p-5 text-sm text-[#888]">Belum ada mutasi untuk filter ini.</div>
              ) : (
                paginatedMutationRows.map((row) => {
                  const visual = txVisual(row.group)

                  return (
                    <div key={row.id} className="px-5 py-3 hover:bg-[#FAFAF8] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-xl ${visual.bg} flex items-center justify-center text-lg shrink-0`}>{visual.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{row.description}</div>
                          <div className="text-xs text-[#888] mt-0.5 truncate">{formatDate(row.createdAt)} • {row.reference}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-extrabold ${row.credit ? 'text-green-600' : 'text-[#141414]'}`}>
                            {`${row.credit ? '+' : '-'}${formatRupiah(row.amount)}`}
                          </div>
                          <div className="text-[11px] text-[#888] mt-0.5">Saldo: {formatRupiah(row.balanceAfter)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {filteredMutationRows.length > MUTATION_PAGE_SIZE ? (
              <div className="flex items-center justify-between border-t border-[#EBEBEB] px-5 py-3">
                <button
                  type="button"
                  onClick={() => setTxPage((current) => Math.max(1, current - 1))}
                  disabled={txPage <= 1}
                  className="rounded-lg border border-[#EBEBEB] px-3 py-1.5 text-xs font-semibold text-[#141414] disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <div className="text-xs text-[#888]">{filteredMutationRows.length} transaksi</div>
                <button
                  type="button"
                  onClick={() => setTxPage((current) => Math.min(mutationTotalPages, current + 1))}
                  disabled={txPage >= mutationTotalPages}
                  className="rounded-lg border border-[#EBEBEB] px-3 py-1.5 text-xs font-semibold text-[#141414] disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <section className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBEB]">
          <div>
            <h2 className="text-sm font-bold">Top Up Belum Selesai</h2>
            <p className="mt-1 text-xs text-[#888]">Selesaikan pembayaran agar saldo masuk otomatis.</p>
          </div>
          <button type="button" onClick={() => fetchAll(true)} className="text-xs text-[#888] hover:text-[#141414] inline-flex items-center gap-1">
            <RefreshCcw className="w-3.5 h-3.5" />
            Muat ulang
          </button>
        </header>

        <div className="divide-y divide-[#EBEBEB]">
          {unfinishedTopups.length === 0 ? (
            <div className="p-5 text-sm text-[#888]">Belum ada invoice top up yang perlu diselesaikan.</div>
          ) : (
            unfinishedTopups.slice(0, 8).map((topup) => (
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

                  <div className="flex items-center justify-between gap-3 md:min-w-[200px] md:justify-end">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold capitalize ${topupStatusClass(topup.status)}`}>
                        {topup.status}
                      </span>
                      {topup.is_overdue ? (
                        <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-gray-200 text-gray-700">overdue</span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[#141414]">Lanjut bayar</span>
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
