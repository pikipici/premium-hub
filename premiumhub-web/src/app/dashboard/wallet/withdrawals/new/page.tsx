"use client"

import axios from 'axios'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  CircleAlert,
  Loader2,
  Wallet as WalletIcon,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LOADING_COPY } from '@/lib/copy/loading'
import { formatRupiah } from '@/lib/utils'
import { walletService } from '@/services/walletService'
import { walletWithdrawalService } from '@/services/walletWithdrawalService'
import type {
  CreateWithdrawalPayload,
  WithdrawalDestination,
  WithdrawalDestinationType,
  WithdrawalPolicy,
} from '@/types/walletWithdrawal'

const QUICK_AMOUNTS = [50_000, 100_000, 200_000, 500_000]

function sanitizeDigits(s: string) {
  return s.replace(/\D+/g, '')
}

export default function NewWithdrawalPage() {
  const router = useRouter()

  const [earnBalance, setEarnBalance] = useState<number>(0)
  const [policy, setPolicy] = useState<WithdrawalPolicy | null>(null)
  const [destinations, setDestinations] = useState<WithdrawalDestination[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [destType, setDestType] = useState<WithdrawalDestinationType>('bank')
  const [destCode, setDestCode] = useState<string>('')
  const [destAccount, setDestAccount] = useState<string>('')
  const [destName, setDestName] = useState<string>('')
  const [amount, setAmount] = useState<number>(0)

  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')

  // Bootstrap — fetch destinations + policy + current earn balance
  // in parallel. Destinations are static so could be cached, but
  // policy values can shift (admin tunable) so always re-fetch.
  const fetchMeta = useCallback(async () => {
    setLoadingMeta(true)
    setError('')
    try {
      const [destRes, balanceRes] = await Promise.all([
        walletWithdrawalService.getDestinations(),
        walletService.getBalanceDetailed(),
      ])
      if (destRes.success) {
        setDestinations(destRes.data.destinations || [])
        setPolicy(destRes.data.policy)
      }
      if (balanceRes.success) {
        setEarnBalance(balanceRes.data.earn)
      }
    } catch (err) {
      console.error(err)
      setError('Gagal memuat data tujuan penarikan. Coba refresh halaman.')
    } finally {
      setLoadingMeta(false)
    }
  }, [])

  useEffect(() => {
    fetchMeta()
  }, [fetchMeta])

  // Default first available destination of selected type once meta loads.
  useEffect(() => {
    if (!destinations.length) return
    const matching = destinations.filter((d) => d.type === destType)
    if (!destCode || !matching.some((d) => d.code === destCode)) {
      setDestCode(matching[0]?.code || '')
    }
  }, [destinations, destType, destCode])

  const filteredDestinations = useMemo(
    () => destinations.filter((d) => d.type === destType),
    [destinations, destType],
  )

  const fee = policy?.flat_fee ?? 2500
  const minAmount = policy?.min_amount ?? 50_000
  const maxAmount = policy?.max_amount ?? 500_000
  const netAmount = useMemo(() => Math.max(0, amount - fee), [amount, fee])
  const autoApproveThreshold = policy?.auto_approve_threshold ?? 100_000

  const validation = useMemo(() => {
    if (amount <= 0) return { ok: false, msg: '' }
    if (amount < minAmount) return { ok: false, msg: `Nominal minimal ${formatRupiah(minAmount)}` }
    if (amount > maxAmount) return { ok: false, msg: `Nominal maksimal ${formatRupiah(maxAmount)} per request` }
    if (amount > earnBalance) return { ok: false, msg: 'Nominal melebihi Saldo Pendapatan kamu' }
    if (!destCode) return { ok: false, msg: 'Pilih tujuan penarikan dulu' }
    if (destAccount.length < 6) return { ok: false, msg: 'Nomor rekening/akun minimal 6 digit' }
    if (!destName.trim()) return { ok: false, msg: 'Nama pemilik rekening wajib diisi' }
    return { ok: true, msg: '' }
  }, [amount, minAmount, maxAmount, earnBalance, destCode, destAccount, destName])

  const selectedDestLabel = useMemo(
    () => filteredDestinations.find((d) => d.code === destCode)?.label ?? destCode.toUpperCase(),
    [filteredDestinations, destCode],
  )

  const handleSubmit = async () => {
    if (!validation.ok) {
      setError(validation.msg)
      return
    }
    setError('')
    setSubmitting(true)

    const payload: CreateWithdrawalPayload = {
      amount,
      destination_type: destType,
      destination_code: destCode,
      destination_account: destAccount,
      destination_name: destName.trim(),
    }

    try {
      const res = await walletWithdrawalService.create(payload)
      if (!res.success) {
        setError(res.message || 'Gagal membuat permintaan penarikan')
        return
      }
      router.push(`/dashboard/wallet/withdrawals/${res.data.id}`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message
        setError(msg || 'Gagal membuat permintaan penarikan')
      } else {
        setError('Gagal membuat permintaan penarikan')
      }
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  if (loadingMeta) {
    return (
      <div className="rounded-3xl border border-[#EBEBEB] bg-white p-12 text-center text-sm text-[#6B7280]">
        {LOADING_COPY.generic}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/wallet/withdrawals"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EBEBEB] bg-white hover:bg-[#F7F7F5] transition-colors"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Tarik Saldo Pendapatan</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Saldo Pendapatan kamu: <span className="font-bold text-emerald-700">{formatRupiah(earnBalance)}</span>
          </p>
        </div>
      </div>

      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-5 md:p-6 space-y-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-2">Tujuan Penarikan</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'bank' as const, label: 'Bank', icon: <Building2 className="w-4 h-4" /> },
              { value: 'ewallet' as const, label: 'E-Wallet', icon: <WalletIcon className="w-4 h-4" /> },
            ].map((opt) => {
              const active = destType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDestType(opt.value)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? 'border-[#141414] bg-[#FAFAF8] text-[#141414]'
                      : 'border-[#EBEBEB] bg-white text-[#6B7280] hover:bg-[#FAFAF8]'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-2">
            Pilih {destType === 'bank' ? 'Bank' : 'E-Wallet'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredDestinations.map((dest) => {
              const active = destCode === dest.code
              return (
                <button
                  key={dest.code}
                  type="button"
                  onClick={() => setDestCode(dest.code)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? 'border-[#141414] bg-[#FAFAF8] text-[#141414]'
                      : 'border-[#EBEBEB] bg-white text-[#3A3A3A] hover:bg-[#FAFAF8]'
                  }`}
                >
                  {dest.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="dest-account" className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-1.5 block">
              Nomor {destType === 'bank' ? 'Rekening' : 'Akun / HP'}
            </label>
            <input
              id="dest-account"
              type="text"
              inputMode="numeric"
              value={destAccount}
              onChange={(e) => setDestAccount(sanitizeDigits(e.target.value))}
              maxLength={20}
              className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#141414]"
              placeholder={destType === 'bank' ? 'Contoh: 1234567890' : 'Contoh: 081234567890'}
            />
          </div>
          <div>
            <label htmlFor="dest-name" className="text-[11px] font-bold uppercase tracking-wide text-[#888] mb-1.5 block">
              Nama Pemilik
            </label>
            <input
              id="dest-name"
              type="text"
              value={destName}
              onChange={(e) => setDestName(e.target.value)}
              maxLength={100}
              className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#141414]"
              placeholder="Sesuai rekening / akun"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#888]">Nominal Penarikan</span>
            <span className="text-[10px] text-[#A6A6A1]">
              {formatRupiah(minAmount)} - {formatRupiah(maxAmount)} / request
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            {QUICK_AMOUNTS.map((quick) => {
              const selected = amount === quick
              const overEarn = quick > earnBalance
              return (
                <button
                  key={quick}
                  type="button"
                  disabled={overEarn}
                  onClick={() => setAmount(quick)}
                  className={`rounded-xl border px-2 py-3 text-center text-sm font-extrabold transition-colors ${
                    selected
                      ? 'border-[#141414] bg-[#FAFAF8]'
                      : overEarn
                      ? 'border-[#EBEBEB] bg-[#F7F7F5] text-[#A6A6A1] cursor-not-allowed'
                      : 'border-[#EBEBEB] bg-white hover:bg-[#FAFAF8] hover:border-[#D8D8D5]'
                  }`}
                >
                  {formatRupiah(quick)}
                </button>
              )
            })}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#888]">Rp</span>
            <input
              type="number"
              min={minAmount}
              max={maxAmount}
              step={1000}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-xl border border-[#EBEBEB] pl-11 pr-3 py-3 text-sm font-semibold focus:outline-none focus:border-[#141414]"
              placeholder={`Min ${minAmount.toLocaleString('id-ID')}`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#6B7280]">Nominal request</span>
            <span className="font-bold text-[#141414]">{formatRupiah(amount || 0)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#6B7280]">Biaya admin</span>
            <span className="font-bold text-rose-600">- {formatRupiah(fee)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-[#EBEBEB]">
            <span className="font-bold text-[#141414]">Diterima</span>
            <span className="font-extrabold text-emerald-700">{formatRupiah(netAmount)}</span>
          </div>
          {amount > 0 && amount >= minAmount && amount <= maxAmount ? (
            <div className="text-[11px] text-[#6B7280] pt-1">
              {amount < autoApproveThreshold
                ? `Nominal di bawah ${formatRupiah(autoApproveThreshold)} → otomatis disetujui, masuk antrian payout langsung.`
                : `Nominal di atas ${formatRupiah(autoApproveThreshold)} → menunggu review admin sebelum diproses.`}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (!validation.ok) {
              setError(validation.msg)
              return
            }
            setError('')
            setConfirmOpen(true)
          }}
          disabled={!validation.ok || submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#141414] text-white text-sm font-extrabold hover:bg-[#2A2A2A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Lanjut Tarik {amount > 0 ? formatRupiah(amount) : ''}
        </button>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Konfirmasi Penarikan"
        description={
          <div className="space-y-1">
            <div>
              Tarik <strong>{formatRupiah(amount)}</strong> ke{' '}
              <strong>
                {selectedDestLabel} {destAccount}
              </strong>{' '}
              a/n <strong>{destName}</strong>?
            </div>
            <div className="text-xs">
              Kamu menerima <strong className="text-emerald-700">{formatRupiah(netAmount)}</strong> setelah biaya admin.
            </div>
          </div>
        }
        confirmLabel="Ya, Tarik"
        cancelLabel="Periksa Lagi"
        loading={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
