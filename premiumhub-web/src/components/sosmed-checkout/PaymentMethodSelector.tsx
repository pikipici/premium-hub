'use client'

import {
  CreditCard,
  Landmark,
  QrCode,
  Smartphone,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { formatRupiah } from '@/lib/utils'
import {
  paymentMethodSettingService,
  type PaymentMethodSetting,
} from '@/services/paymentMethodSettingService'

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

// Icon dan description statis per method key — tidak berubah dari BE
const GATEWAY_STATIC: Record<string, { icon: typeof Wallet; description: string; type: PaymentMethod['type'] }> = {
  qris:       { icon: QrCode,    description: 'Scan QR via GoPay, DANA, ShopeePay, OVO, LinkAja.', type: 'qris' },
  bca_va:     { icon: Landmark,  description: 'Transfer ke virtual account BCA.',                   type: 'va' },
  bni_va:     { icon: Landmark,  description: 'Transfer ke virtual account BNI.',                   type: 'va' },
  bri_va:     { icon: Landmark,  description: 'Transfer ke virtual account BRI.',                   type: 'va' },
  mandiri_va: { icon: Landmark,  description: 'Transfer ke virtual account Mandiri.',               type: 'va' },
  dana:       { icon: Smartphone, description: 'Bayar pakai saldo DANA.',                           type: 'ewallet' },
  shopeepay:  { icon: Smartphone, description: 'Bayar pakai saldo ShopeePay.',                      type: 'ewallet' },
  ovo:        { icon: Smartphone, description: 'Bayar pakai saldo OVO Cash.',                       type: 'ewallet' },
}

export function PaymentMethodSelector({
  totalPrice,
  walletBalance,
  loadingWallet,
  onSelectMethod,
  selectedMethod,
}: PaymentMethodSelectorProps) {
  const [tab, setTab] = useState<'wallet' | 'gateway'>('wallet')
  const [settings, setSettings] = useState<PaymentMethodSetting[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)

  // Fetch payment method config from BE once
  useEffect(() => {
    paymentMethodSettingService
      .publicList()
      .then((res) => {
        if (res.success && res.data) setSettings(res.data)
      })
      .catch(() => {
        // Silently fallback — all methods will appear disabled
      })
      .finally(() => setLoadingSettings(false))
  }, [])

  // Map BE setting by key for quick lookup
  const settingByKey = useMemo(() => {
    const map: Record<string, PaymentMethodSetting> = {}
    for (const s of settings) map[s.key] = s
    return map
  }, [settings])

  const walletSetting = settingByKey['wallet']
  const walletEnabled = loadingSettings ? true : (walletSetting?.is_enabled ?? true)
  const walletNote = walletSetting?.unavailable_note ?? ''

  const walletEnough = walletBalance !== null && walletBalance >= totalPrice
  const walletBalanceAfter = walletBalance === null ? null : walletBalance - totalPrice

  // Gateway methods: keep static order, override label from BE if needed
  const gatewayMethods = useMemo(() => {
    const keys = ['qris', 'bca_va', 'bni_va', 'bri_va', 'mandiri_va', 'dana', 'shopeepay', 'ovo']
    return keys
      .map((key) => {
        const staticInfo = GATEWAY_STATIC[key]
        if (!staticInfo) return null
        const beSetting = settingByKey[key]
        return {
          id: key,
          label: beSetting?.label ?? key,
          description: staticInfo.description,
          icon: staticInfo.icon,
          type: staticInfo.type,
          is_enabled: loadingSettings ? false : (beSetting?.is_enabled ?? false),
          unavailable_note: beSetting?.unavailable_note ?? '',
        }
      })
      .filter(Boolean) as (PaymentMethod & { is_enabled: boolean; unavailable_note: string })[]
  }, [settingByKey, loadingSettings])

  // If wallet tab is selected but wallet gets disabled, switch to gateway
  useEffect(() => {
    if (!walletEnabled && tab === 'wallet') setTab('gateway')
  }, [walletEnabled, tab])

  return (
    <div className="space-y-3">
      {/* Tab toggle */}
      <div className="flex overflow-hidden rounded-xl border border-[#EBEBEB] bg-[#F7F7F5] p-1">
        <button
          type="button"
          disabled={!walletEnabled}
          onClick={() => {
            setTab('wallet')
            onSelectMethod(WALLET_METHOD)
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
            !walletEnabled
              ? 'cursor-not-allowed text-[#bbb]'
              : tab === 'wallet'
                ? 'bg-white text-[#141414] shadow-sm'
                : 'text-[#888] hover:text-[#141414]'
          }`}
        >
          <Wallet className="h-4 w-4" />
          Wallet
          {!walletEnabled && !loadingSettings && (
            <span className="ml-1 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold text-[#991B1B]">
              Tidak Tersedia
            </span>
          )}
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
          {/* Wallet disabled notice */}
          {!walletEnabled && walletNote && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {walletNote}
            </div>
          )}

          <div
            className={`w-full rounded-xl border p-4 text-left transition ${
              !walletEnabled
                ? 'cursor-not-allowed border-[#EBEBEB] bg-[#F9F9F7] opacity-50'
                : selectedMethod?.id === 'wallet'
                  ? 'cursor-pointer border-[#FF5733] bg-[#FFF3EF]'
                  : 'cursor-pointer border-[#EBEBEB] bg-white hover:border-[#FF5733]/40'
            }`}
            onClick={() => {
              if (walletEnabled) onSelectMethod(WALLET_METHOD)
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  !walletEnabled
                    ? 'bg-[#F0F0F0] text-[#bbb]'
                    : selectedMethod?.id === 'wallet'
                      ? 'bg-[#FF5733] text-white'
                      : 'bg-[#F7F7F5] text-[#141414]'
                }`}
              >
                <WalletCards className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {WALLET_METHOD.label}
                  {selectedMethod?.id === 'wallet' && walletEnabled && (
                    <span className="ml-2 rounded-full bg-[#FF5733]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF5733]">
                      Dipilih
                    </span>
                  )}
                  {!walletEnabled && !loadingSettings && (
                    <span className="ml-2 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold text-[#991B1B]">
                      Tidak Tersedia
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#888]">
                  {WALLET_METHOD.description}
                </div>
              </div>
            </div>
          </div>

          {/* Balance breakdown — only show when wallet available */}
          {walletEnabled && (
            <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#888]">
                    Saldo Sekarang
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-[#141414]">
                    {loadingWallet ? 'Memuat...' : formatRupiah(walletBalance || 0)}
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
                    {formatRupiah(Math.abs(walletBalanceAfter || 0)).replace('Rp', '')}
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
          )}
        </>
      )}

      {/* Gateway tab */}
      {tab === 'gateway' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#666]">
            Pilih metode pembayaran:
          </p>
          {loadingSettings ? (
            <div className="text-xs text-[#999]">Memuat metode pembayaran...</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {gatewayMethods.map((method) => {
                const Icon = method.icon
                const isSelected = selectedMethod?.id === method.id
                const isDisabled = !method.is_enabled

                return (
                  <button
                    key={method.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) onSelectMethod(method)
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isDisabled
                        ? 'cursor-not-allowed border-[#EBEBEB] bg-[#F9F9F7] opacity-50'
                        : isSelected
                          ? 'border-[#FF5733] bg-[#FFF3EF]'
                          : 'border-[#EBEBEB] bg-white hover:border-[#FF5733]/30'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isDisabled
                          ? 'bg-[#F0F0F0] text-[#bbb]'
                          : isSelected
                            ? 'bg-[#FF5733] text-white'
                            : 'bg-[#F7F7F5] text-[#666]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-[#141414]">
                          {method.label}
                        </span>
                        {isDisabled && (
                          <span className="rounded-full bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-bold text-[#991B1B]">
                            Tidak Tersedia
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] leading-tight text-[#888]">
                        {isDisabled && method.unavailable_note
                          ? method.unavailable_note
                          : method.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <p className="pt-1 text-[10px] text-[#999]">
            Invoice berlaku 15 menit. Order otomatis diproses setelah
            pembayaran terkonfirmasi.
          </p>
        </div>
      )}
    </div>
  )
}
