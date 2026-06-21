'use client'

import {
  CreditCard,
  Landmark,
  QrCode,
  Smartphone,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { formatRupiah } from '@/lib/utils'

export interface PaymentMethod {
  id: string
  label: string
  description: string
  icon: typeof Wallet
  type: 'wallet' | 'qris' | 'va' | 'ewallet' | 'redirect'
}

interface PaymentMethodSelectorProps {
  totalPrice: number
  walletBalance: number | null
  loadingWallet: boolean
  onSelectMethod: (method: PaymentMethod) => void
  selectedMethod: PaymentMethod | null
}

const WALLET_METHOD: PaymentMethod = {
  id: 'wallet',
  label: 'Wallet DigiMarket',
  description: 'Saldo dipotong langsung, order otomatis dikirim.',
  icon: WalletCards,
  type: 'wallet',
}

const GATEWAY_METHODS: PaymentMethod[] = [
  {
    id: 'qris',
    label: 'QRIS',
    description: 'Scan QR via GoPay, DANA, ShopeePay, OVO, LinkAja.',
    icon: QrCode,
    type: 'qris',
  },
  {
    id: 'bca_va',
    label: 'BCA Virtual Account',
    description: 'Transfer ke virtual account BCA.',
    icon: Landmark,
    type: 'va',
  },
  {
    id: 'bni_va',
    label: 'BNI Virtual Account',
    description: 'Transfer ke virtual account BNI.',
    icon: Landmark,
    type: 'va',
  },
  {
    id: 'bri_va',
    label: 'BRI Virtual Account',
    description: 'Transfer ke virtual account BRI.',
    icon: Landmark,
    type: 'va',
  },
  {
    id: 'mandiri_va',
    label: 'Mandiri Virtual Account',
    description: 'Transfer ke virtual account Mandiri.',
    icon: Landmark,
    type: 'va',
  },
  {
    id: 'dana',
    label: 'DANA',
    description: 'Bayar pakai saldo DANA.',
    icon: Smartphone,
    type: 'ewallet',
  },
  {
    id: 'shopeepay',
    label: 'ShopeePay',
    description: 'Bayar pakai saldo ShopeePay.',
    icon: Smartphone,
    type: 'ewallet',
  },
  {
    id: 'ovo',
    label: 'OVO',
    description: 'Bayar pakai saldo OVO Cash.',
    icon: Smartphone,
    type: 'ewallet',
  },
]

export function PaymentMethodSelector({
  totalPrice,
  walletBalance,
  loadingWallet,
  onSelectMethod,
  selectedMethod,
}: PaymentMethodSelectorProps) {
  const [tab, setTab] = useState<'wallet' | 'gateway'>('wallet')
  const walletEnough = walletBalance !== null && walletBalance >= totalPrice
  const walletBalanceAfter =
    walletBalance === null ? null : walletBalance - totalPrice

  const displayedGatewayMethods = useMemo(() => {
    return GATEWAY_METHODS
  }, [])

  return (
    <div className="space-y-3">
      {/* Tab toggle */}
      <div className="flex overflow-hidden rounded-xl border border-[#EBEBEB] bg-[#F7F7F5] p-1">
        <button
          type="button"
          onClick={() => {
            setTab('wallet')
            onSelectMethod(WALLET_METHOD)
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
            tab === 'wallet'
              ? 'bg-white text-[#141414] shadow-sm'
              : 'text-[#888] hover:text-[#141414]'
          }`}
        >
          <Wallet className="h-4 w-4" />
          Wallet
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('gateway')
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
            tab === 'gateway'
              ? 'bg-white text-[#141414] shadow-sm'
              : 'text-[#888] hover:text-[#141414]'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Transfer / QRIS
        </button>
      </div>

      {/* Wallet tab */}
      {tab === 'wallet' && (
        <>
          <div
            className={`w-full cursor-pointer rounded-xl border p-4 text-left transition ${
              selectedMethod?.id === 'wallet'
                ? 'border-[#FF5733] bg-[#FFF3EF]'
                : 'border-[#EBEBEB] bg-white hover:border-[#FF5733]/40'
            }`}
            onClick={() => onSelectMethod(WALLET_METHOD)}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  selectedMethod?.id === 'wallet' ? 'bg-[#FF5733] text-white' : 'bg-[#F7F7F5] text-[#141414]'
                }`}
              >
                <WalletCards className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {WALLET_METHOD.label}
                  {selectedMethod?.id === 'wallet' && (
                    <span className="ml-2 rounded-full bg-[#FF5733]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF5733]">
                      Dipilih
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#888]">
                  {WALLET_METHOD.description}
                </div>
              </div>
            </div>
          </div>

          {/* Balance breakdown */}
          <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#888]">
                  Saldo Sekarang
                </p>
                <p className="mt-1 text-sm font-extrabold text-[#141414]">
                  {loadingWallet
                    ? 'Memuat...'
                    : formatRupiah(walletBalance || 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#888]">
                  Total Order
                </p>
                <p className="mt-1 text-sm font-extrabold text-[#FF5733]">
                  {formatRupiah(totalPrice)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#888]">
                  Sisa Saldo
                </p>
                <p
                  className={`mt-1 text-sm font-extrabold ${
                    walletEnough ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {loadingWallet || walletBalanceAfter === null
                    ? '-'
                    : formatRupiah(Math.max(0, walletBalanceAfter))}
                </p>
              </div>
            </div>

            {!walletEnough && !loadingWallet && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-red-700">
                  Saldo wallet kurang Rp
                  {formatRupiah(
                    Math.abs(walletBalanceAfter || 0),
                  ).replace('Rp', '')}
                </p>
                <a
                  href="/dashboard/wallet"
                  className="rounded-full bg-[#FF5733] px-4 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#e64d2e]"
                >
                  Top Up
                </a>
              </div>
            )}
          </div>
        </>
      )}

      {/* Gateway tab */}
      {tab === 'gateway' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#666]">
            Pilih metode pembayaran:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {displayedGatewayMethods.map((method) => {
              const Icon = method.icon
              const isSelected = selectedMethod?.id === method.id
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => onSelectMethod(method)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-[#FF5733] bg-[#FFF3EF]'
                      : 'border-[#EBEBEB] bg-white hover:border-[#FF5733]/30'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isSelected
                        ? 'bg-[#FF5733] text-white'
                        : 'bg-[#F7F7F5] text-[#666]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#141414]">
                      {method.label}
                    </div>
                    <div className="text-[10px] leading-tight text-[#888]">
                      {method.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="pt-1 text-[10px] text-[#999]">
            Invoice berlaku 15 menit. Order otomatis diproses setelah
            pembayaran terkonfirmasi.
          </p>
        </div>
      )}
    </div>
  )
}
