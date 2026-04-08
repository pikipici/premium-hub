"use client"

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { useAuthStore } from '@/store/authStore'

type ConvertAssetType = 'pulsa' | 'paypal' | 'crypto'
type BankKey = 'bca' | 'bni' | 'bri' | 'mandiri' | 'cimb'

type AssetConfig = {
  type: ConvertAssetType
  label: string
  sourceLabel: string
  sourceIcon: string
  description: string
  eta: string
  minAmount: number
  maxAmount: number
  rate: number
  adminFee: number
  riskFee: number
  allowGuest: boolean
  quickAmounts: number[]
  hintTitle: string
  hintText: string
  successRate24h: string
  avgProcessTime: string
  recentProcess: string
}

const PPN_RATE = 0.11
const GUEST_SURCHARGE = 3000

const BANKS: Array<{ key: BankKey; label: string; transferFee: number }> = [
  { key: 'bca', label: 'BCA', transferFee: 6500 },
  { key: 'bni', label: 'BNI', transferFee: 6500 },
  { key: 'bri', label: 'BRI', transferFee: 6500 },
  { key: 'mandiri', label: 'Bank Mandiri', transferFee: 6500 },
  { key: 'cimb', label: 'CIMB Niaga', transferFee: 6500 },
]

const ASSETS: Record<ConvertAssetType, AssetConfig> = {
  pulsa: {
    type: 'pulsa',
    label: 'Pulsa',
    sourceLabel: 'Pulsa Operator',
    sourceIcon: '📱',
    description: 'Konversi saldo pulsa operator ke transfer bank.',
    eta: '±5-10 menit',
    minAmount: 10000,
    maxAmount: 1000000,
    rate: 0.85,
    adminFee: 2500,
    riskFee: 0,
    allowGuest: true,
    quickAmounts: [10000, 25000, 50000, 100000],
    hintTitle: 'Tips Pulsa',
    hintText: 'Operator dengan stabilitas terbaik saat ini: Telkomsel, lalu XL. Hindari jam sibuk malam untuk nominal besar.',
    successRate24h: '98.7%',
    avgProcessTime: '6 menit',
    recentProcess: '2 menit lalu',
  },
  paypal: {
    type: 'paypal',
    label: 'PayPal',
    sourceLabel: 'Saldo PayPal',
    sourceIcon: '💙',
    description: 'Tarik saldo PayPal ke rekening bank lokal.',
    eta: '±15-45 menit',
    minAmount: 50000,
    maxAmount: 50000000,
    rate: 0.9,
    adminFee: 5000,
    riskFee: 3000,
    allowGuest: false,
    quickAmounts: [50000, 100000, 250000, 500000],
    hintTitle: 'Catatan PayPal',
    hintText: 'Transaksi tertentu bisa masuk review tambahan. Pastikan email PayPal aktif dan sesuai data akun.',
    successRate24h: '96.4%',
    avgProcessTime: '28 menit',
    recentProcess: '9 menit lalu',
  },
  crypto: {
    type: 'crypto',
    label: 'Crypto',
    sourceLabel: 'Aset Crypto',
    sourceIcon: '🟡',
    description: 'Jual aset crypto dan terima dana ke rekening bank.',
    eta: '±10-30 menit',
    minAmount: 100000,
    maxAmount: 100000000,
    rate: 0.92,
    adminFee: 6000,
    riskFee: 5000,
    allowGuest: false,
    quickAmounts: [100000, 250000, 500000, 1000000],
    hintTitle: 'Catatan Crypto',
    hintText: 'Pilih network yang tepat untuk menghindari gagal kirim. Fee network mengikuti kondisi chain real-time.',
    successRate24h: '97.2%',
    avgProcessTime: '18 menit',
    recentProcess: '4 menit lalu',
  },
}

const PULSA_PROVIDERS = ['Telkomsel', 'Indosat Ooredoo', 'XL Axiata', 'Tri (3)', 'Smartfren'] as const
const PAYPAL_FLOWS = ['Personal (Friends & Family)', 'Business (Goods & Services)'] as const
const CRYPTO_ASSETS = ['USDT', 'USDC', 'BTC', 'ETH'] as const
const CRYPTO_NETWORKS = ['TRC20', 'ERC20', 'BEP20', 'SOL'] as const

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function normalizeAssetType(rawType: string | null): ConvertAssetType | null {
  if (rawType === 'pulsa' || rawType === 'paypal' || rawType === 'crypto') return rawType
  return null
}

export default function ConvertPage() {
  const { isAuthenticated, hasHydrated, user } = useAuthStore()
  const isMember = hasHydrated && isAuthenticated

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const assetType = normalizeAssetType(searchParams.get('type')) ?? 'pulsa'

  const [amount, setAmount] = useState<number>(0)
  const [bank, setBank] = useState<BankKey>('bca')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')

  const [pulsaProvider, setPulsaProvider] = useState<string>(PULSA_PROVIDERS[0])
  const [pulsaSenderPhone, setPulsaSenderPhone] = useState('')

  const [paypalEmail, setPaypalEmail] = useState('')
  const [paypalFlowType, setPaypalFlowType] = useState<string>(PAYPAL_FLOWS[0])

  const [cryptoAsset, setCryptoAsset] = useState<string>(CRYPTO_ASSETS[0])
  const [cryptoNetwork, setCryptoNetwork] = useState<string>(CRYPTO_NETWORKS[0])
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState('')

  const [showConfirm, setShowConfirm] = useState(false)
  const [agree, setAgree] = useState(false)
  const [attemptedReview, setAttemptedReview] = useState(false)

  const selectedAsset = ASSETS[assetType]
  const selectedBank = BANKS.find((item) => item.key === bank) ?? BANKS[0]

  const guestBlocked = !isMember && !selectedAsset.allowGuest

  const quote = useMemo(() => {
    const normalizedAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0
    const convertedAmount = Math.round(normalizedAmount * selectedAsset.rate)
    const ppnAmount = Math.round(selectedAsset.adminFee * PPN_RATE)
    const guestSurcharge = isMember ? 0 : GUEST_SURCHARGE

    const totalReceived = Math.max(
      0,
      Math.round(
        convertedAmount -
          selectedAsset.adminFee -
          selectedAsset.riskFee -
          selectedBank.transferFee -
          ppnAmount -
          guestSurcharge
      )
    )

    return {
      normalizedAmount,
      convertedAmount,
      ppnAmount,
      guestSurcharge,
      totalReceived,
    }
  }, [amount, isMember, selectedAsset, selectedBank.transferFee])

  const validationError = useMemo(() => {
    if (guestBlocked) return `${selectedAsset.label} cuma tersedia buat user login.`

    if (quote.normalizedAmount < selectedAsset.minAmount) {
      return `Minimal konversi ${formatRupiah(selectedAsset.minAmount)} untuk ${selectedAsset.label}.`
    }

    if (quote.normalizedAmount > selectedAsset.maxAmount) {
      return `Maksimal konversi ${formatRupiah(selectedAsset.maxAmount)} untuk ${selectedAsset.label}.`
    }

    if (!bankAccountNumber.trim() || bankAccountNumber.trim().length < 8) {
      return 'Nomor rekening tujuan belum valid (minimal 8 digit).'
    }

    if (!bankAccountName.trim() || bankAccountName.trim().length < 3) {
      return 'Nama pemilik rekening wajib diisi (minimal 3 karakter).'
    }

    if (assetType === 'pulsa' && pulsaSenderPhone.trim().length < 10) {
      return 'Nomor pengirim pulsa wajib valid (minimal 10 digit).'
    }

    if (assetType === 'paypal') {
      const email = paypalEmail.trim()
      if (!email || !email.includes('@') || !email.includes('.')) {
        return 'Email PayPal wajib valid.'
      }
    }

    if (assetType === 'crypto' && cryptoWalletAddress.trim().length < 10) {
      return 'Alamat wallet pengirim belum valid.'
    }

    return ''
  }, [
    assetType,
    bankAccountName,
    bankAccountNumber,
    cryptoWalletAddress,
    guestBlocked,
    paypalEmail,
    pulsaSenderPhone,
    quote.normalizedAmount,
    selectedAsset.label,
    selectedAsset.maxAmount,
    selectedAsset.minAmount,
  ])

  const timelineState = useMemo(() => {
    const inputDone = !validationError && quote.normalizedAmount >= selectedAsset.minAmount
    const reviewDone = showConfirm

    return {
      inputDone,
      reviewDone,
      confirmActive: showConfirm,
    }
  }, [showConfirm, validationError, quote.normalizedAmount, selectedAsset.minAmount])

  const switchAssetType = (nextType: ConvertAssetType) => {
    setShowConfirm(false)
    setAgree(false)
    setAttemptedReview(false)

    const params = new URLSearchParams(searchParams.toString())
    params.set('type', nextType)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const openReview = () => {
    setAttemptedReview(true)
    if (validationError) return
    setAgree(false)
    setShowConfirm(true)
  }

  const canProceedAsGuest = !guestBlocked

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {isMember ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              ✅ Login sebagai <strong>{user?.name ?? 'member'}</strong>. Biaya akses tamu otomatis gratis.
            </div>
          ) : guestBlocked ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              🔒 {selectedAsset.label} perlu login dulu demi keamanan transaksi.
              <Link href="/login" className="ml-1 font-bold underline underline-offset-2">
                Masuk sekarang
              </Link>
              .
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚡ Mode tamu aktif. Ada biaya tambahan <strong>{formatRupiah(GUEST_SURCHARGE)}</strong>.{' '}
              <Link href="/login" className="font-bold text-[#FF5733] underline underline-offset-2">
                Login biar biaya ini hilang
              </Link>
              .
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white md:grid md:grid-cols-[390px_1fr]">
            <aside className="border-b border-[#EBEBEB] p-5 md:border-b-0 md:border-r">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-[#888]">Mau convert apa?</p>
                  <select
                    value={assetType}
                    onChange={(event) => switchAssetType(event.target.value as ConvertAssetType)}
                    className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                  >
                    <option value="pulsa">📱 Pulsa</option>
                    <option value="paypal">💙 PayPal</option>
                    <option value="crypto">🟡 Crypto</option>
                  </select>
                  <p className="mt-2 text-xs text-[#888]">{selectedAsset.description}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-[#888]">Jumlah {selectedAsset.label} (Rp)</p>
                  <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 focus-within:border-[#FF5733]">
                    <input
                      type="number"
                      min={selectedAsset.minAmount}
                      step={5000}
                      value={amount || ''}
                      onChange={(event) => {
                        setAmount(Number(event.target.value) || 0)
                        if (attemptedReview) setShowConfirm(false)
                      }}
                      placeholder="0"
                      className="w-full bg-transparent text-2xl font-extrabold tracking-tight text-[#141414] outline-none placeholder:text-[#C9C9C5]"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[#888]">
                    Min {formatRupiah(selectedAsset.minAmount)} · Max {formatRupiah(selectedAsset.maxAmount)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedAsset.quickAmounts.map((quickAmount) => (
                      <button
                        key={quickAmount}
                        type="button"
                        onClick={() => {
                          setAmount(quickAmount)
                          if (attemptedReview) setShowConfirm(false)
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          amount === quickAmount
                            ? 'border-[#FF5733] bg-[#FFF0ED] text-[#FF5733]'
                            : 'border-[#EBEBEB] bg-white text-[#666] hover:border-[#FF5733] hover:text-[#FF5733]'
                        }`}
                      >
                        {Math.round(quickAmount / 1000)}K
                      </button>
                    ))}
                  </div>
                </div>

                {assetType === 'pulsa' ? (
                  <>
                    <div>
                      <p className="mb-2 text-xs font-semibold text-[#888]">Operator</p>
                      <select
                        value={pulsaProvider}
                        onChange={(event) => setPulsaProvider(event.target.value)}
                        className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                      >
                        {PULSA_PROVIDERS.map((provider) => (
                          <option key={provider} value={provider}>
                            📶 {provider}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-[#888]">Nomor pengirim pulsa</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pulsaSenderPhone}
                        onChange={(event) => setPulsaSenderPhone(event.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                      />
                    </div>
                  </>
                ) : null}

                {assetType === 'paypal' ? (
                  <>
                    <div>
                      <p className="mb-2 text-xs font-semibold text-[#888]">Jenis transaksi PayPal</p>
                      <select
                        value={paypalFlowType}
                        onChange={(event) => setPaypalFlowType(event.target.value)}
                        className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                      >
                        {PAYPAL_FLOWS.map((flow) => (
                          <option key={flow} value={flow}>
                            {flow}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-[#888]">Email akun PayPal</p>
                      <input
                        type="email"
                        value={paypalEmail}
                        onChange={(event) => setPaypalEmail(event.target.value)}
                        placeholder="email@paypal.com"
                        className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                      />
                    </div>
                  </>
                ) : null}

                {assetType === 'crypto' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-2 text-xs font-semibold text-[#888]">Aset</p>
                        <select
                          value={cryptoAsset}
                          onChange={(event) => setCryptoAsset(event.target.value)}
                          className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                        >
                          {CRYPTO_ASSETS.map((asset) => (
                            <option key={asset} value={asset}>
                              {asset}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold text-[#888]">Network</p>
                        <select
                          value={cryptoNetwork}
                          onChange={(event) => setCryptoNetwork(event.target.value)}
                          className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                        >
                          {CRYPTO_NETWORKS.map((network) => (
                            <option key={network} value={network}>
                              {network}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-[#888]">Alamat wallet pengirim</p>
                      <input
                        type="text"
                        value={cryptoWalletAddress}
                        onChange={(event) => setCryptoWalletAddress(event.target.value)}
                        placeholder="Masukkan wallet address"
                        className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                      />
                    </div>
                  </>
                ) : null}

                <div className="rounded-xl border border-[#EBEBEB] bg-[#FCFCFA] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#888]">Tujuan transfer bank</p>

                  <div className="space-y-2">
                    <select
                      value={bank}
                      onChange={(event) => setBank(event.target.value as BankKey)}
                      className="w-full rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                    >
                      {BANKS.map((item) => (
                        <option key={item.key} value={item.key}>
                          🏦 {item.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={bankAccountNumber}
                      onChange={(event) => setBankAccountNumber(event.target.value)}
                      placeholder="Nomor rekening"
                      className="w-full rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                    />

                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(event) => setBankAccountName(event.target.value)}
                      placeholder="Nama pemilik rekening"
                      className="w-full rounded-lg border border-[#EBEBEB] bg-white px-3 py-2.5 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                    />
                  </div>
                </div>

                {attemptedReview && validationError ? <p className="text-sm font-medium text-red-600">{validationError}</p> : null}

                {canProceedAsGuest ? (
                  <button
                    type="button"
                    onClick={openReview}
                    className="w-full rounded-full bg-[#FF5733] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#e64d2e]"
                  >
                    Review Quote
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#141414] px-4 py-3 text-sm font-extrabold text-white"
                  >
                    Login untuk lanjut {selectedAsset.label}
                  </Link>
                )}
              </div>
            </aside>

            <section className="p-5 md:p-7">
              <div className="mb-4 rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-4">
                <h1 className="text-lg font-extrabold tracking-tight text-[#141414]">Live Quote</h1>
                <p className="mt-1 text-xs text-[#888]">
                  Quote diperbarui otomatis setiap kali lu ubah nominal atau detail transaksi.
                </p>

                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-lg bg-white px-3 py-2.5">
                    <p className="text-[11px] text-[#888]">Aset</p>
                    <p className="mt-0.5 font-bold text-[#141414]">{selectedAsset.sourceIcon} {selectedAsset.sourceLabel}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2.5">
                    <p className="text-[11px] text-[#888]">Estimasi</p>
                    <p className="mt-0.5 font-bold text-[#141414]">{selectedAsset.eta}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2.5">
                    <p className="text-[11px] text-[#888]">Status akses</p>
                    <p className="mt-0.5 font-bold text-[#141414]">
                      {isMember ? 'Member' : selectedAsset.allowGuest ? 'Guest diperbolehkan' : 'Login wajib'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-5">
                <h2 className="mb-3 text-sm font-bold text-[#141414]">💰 Breakdown</h2>

                {quote.normalizedAmount > 0 ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                      <span className="text-[#888]">Nominal masuk</span>
                      <span className="font-semibold text-[#141414]">{formatRupiah(quote.normalizedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                      <span className="text-[#888]">Kurs ({selectedAsset.rate.toFixed(2)})</span>
                      <span className="font-semibold text-[#FF5733]">{formatRupiah(quote.convertedAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                      <span className="text-[#888]">Biaya admin</span>
                      <span className="font-semibold text-red-500">- {formatRupiah(selectedAsset.adminFee)}</span>
                    </div>
                    {selectedAsset.riskFee > 0 ? (
                      <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                        <span className="text-[#888]">Biaya risiko</span>
                        <span className="font-semibold text-red-500">- {formatRupiah(selectedAsset.riskFee)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                      <span className="text-[#888]">Biaya transfer bank</span>
                      <span className="font-semibold text-red-500">- {formatRupiah(selectedBank.transferFee)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                      <span className="text-[#888]">PPN 11%</span>
                      <span className="font-semibold text-red-500">- {formatRupiah(quote.ppnAmount)}</span>
                    </div>
                    {!isMember ? (
                      <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                        <span className="text-[#888]">Biaya akses tamu</span>
                        <span className="font-semibold text-red-500">- {formatRupiah(quote.guestSurcharge)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                        <span className="text-[#888]">Benefit member</span>
                        <span className="font-semibold text-emerald-600">Biaya tamu gratis</span>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#E5E5E2] pt-4">
                      <span className="text-sm font-bold text-[#141414]">Total diterima</span>
                      <span className="text-2xl font-extrabold tracking-tight text-emerald-600">
                        {formatRupiah(quote.totalReceived)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#DCDCD8] bg-[#FAFAF8] p-4 text-sm text-[#777]">
                    Isi nominal di panel kiri buat lihat simulasi quote realtime.
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
                  <h3 className="text-sm font-bold text-[#141414]">💡 {selectedAsset.hintTitle}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#777]">{selectedAsset.hintText}</p>
                </div>

                <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
                  <h3 className="text-sm font-bold text-[#141414]">📊 Trust Monitor</h3>
                  <div className="mt-2 space-y-1 text-xs text-[#666]">
                    <p>Success rate 24h: <strong className="text-[#141414]">{selectedAsset.successRate24h}</strong></p>
                    <p>Rata-rata proses: <strong className="text-[#141414]">{selectedAsset.avgProcessTime}</strong></p>
                    <p>Transaksi terakhir: <strong className="text-[#141414]">{selectedAsset.recentProcess}</strong></p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#EBEBEB] bg-white p-4">
                <h3 className="text-sm font-bold text-[#141414]">🧭 Progress</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className={`rounded-lg border px-3 py-2 text-xs ${timelineState.inputDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#EBEBEB] bg-[#FAFAF8] text-[#888]'}`}>
                    1. Input data
                  </div>
                  <div className={`rounded-lg border px-3 py-2 text-xs ${timelineState.reviewDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : quote.normalizedAmount > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-[#EBEBEB] bg-[#FAFAF8] text-[#888]'}`}>
                    2. Review quote
                  </div>
                  <div className={`rounded-lg border px-3 py-2 text-xs ${timelineState.confirmActive ? 'border-[#FFD1C4] bg-[#FFF1EC] text-[#FF5733]' : 'border-[#EBEBEB] bg-[#FAFAF8] text-[#888]'}`}>
                    3. Konfirmasi
                  </div>
                </div>
              </div>

              {showConfirm ? (
                <div className="mt-4 rounded-2xl border border-[#EBEBEB] bg-white p-5">
                  <h3 className="text-sm font-bold text-[#141414]">✅ Konfirmasi Order</h3>

                  <div className="my-4 rounded-xl bg-[#FAFAF8] p-4 text-center">
                    <p className="text-xs text-[#888]">Kamu kirim</p>
                    <p className="mt-1 text-2xl font-extrabold text-[#141414]">{formatRupiah(quote.normalizedAmount)}</p>
                    <p className="my-1 text-lg text-[#FF5733]">↓</p>
                    <p className="text-2xl font-extrabold text-emerald-600">{formatRupiah(quote.totalReceived)}</p>
                    <p className="mt-1 text-xs text-[#888]">masuk ke rekening {selectedBank.label}</p>
                  </div>

                  <label className="mb-4 flex items-start gap-2 text-xs text-[#777]">
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={(event) => setAgree(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Saya menyetujui syarat layanan convert aset dan memahami transaksi yang diproses tidak bisa dibatalkan.
                    </span>
                  </label>

                  {isMember ? (
                    <button
                      type="button"
                      disabled={!agree}
                      className="w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Konfirmasi & Buat Order
                    </button>
                  ) : canProceedAsGuest ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={!agree}
                        className="w-full rounded-full bg-[#141414] px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Lanjut sebagai tamu (+{formatRupiah(GUEST_SURCHARGE)})
                      </button>
                      <Link
                        href="/login"
                        className="inline-flex w-full items-center justify-center rounded-full border border-[#FF5733] bg-white px-4 py-3 text-sm font-extrabold text-[#FF5733]"
                      >
                        Login dulu biar lebih hemat
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#141414] px-4 py-3 text-sm font-extrabold text-white"
                    >
                      Login untuk lanjut transaksi
                    </Link>
                  )}
                </div>
              ) : null}
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
