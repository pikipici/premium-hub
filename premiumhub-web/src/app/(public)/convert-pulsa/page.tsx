"use client"

import Link from 'next/link'
import { useMemo, useState } from 'react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { useAuthStore } from '@/store/authStore'

type PanelTab = 'instan' | 'terjadwal' | 'riwayat'

type ProviderKey = 'telkomsel' | 'indosat' | 'xl' | 'tri' | 'smartfren'
type BankKey = 'bca' | 'bni' | 'bri' | 'mandiri' | 'cimb'

const MIN_AMOUNT = 10000
const KURS = 0.85
const ADMIN_FEE = 2500
const PPN_RATE = 0.11
const GUEST_SURCHARGE = 3000
const QUICK_AMOUNTS = [10000, 25000, 50000, 100000]

const PROVIDERS: Array<{ key: ProviderKey; label: string; eta: string }> = [
  { key: 'telkomsel', label: 'Telkomsel', eta: '±5 menit' },
  { key: 'indosat', label: 'Indosat Ooredoo', eta: '±7 menit' },
  { key: 'xl', label: 'XL Axiata', eta: '±6 menit' },
  { key: 'tri', label: 'Tri (3)', eta: '±7 menit' },
  { key: 'smartfren', label: 'Smartfren', eta: '±8 menit' },
]

const BANKS: Array<{ key: BankKey; label: string; transferFee: number }> = [
  { key: 'bca', label: 'BCA', transferFee: 6500 },
  { key: 'bni', label: 'BNI', transferFee: 6500 },
  { key: 'bri', label: 'BRI', transferFee: 6500 },
  { key: 'mandiri', label: 'Bank Mandiri', transferFee: 6500 },
  { key: 'cimb', label: 'CIMB Niaga', transferFee: 6500 },
]

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

export default function ConvertPulsaLandingPage() {
  const { isAuthenticated, hasHydrated, user } = useAuthStore()
  const isMember = hasHydrated && isAuthenticated

  const [activeTab, setActiveTab] = useState<PanelTab>('instan')
  const [amount, setAmount] = useState<number>(0)
  const [provider, setProvider] = useState<ProviderKey>('telkomsel')
  const [bank, setBank] = useState<BankKey>('bca')
  const [showConfirm, setShowConfirm] = useState(false)
  const [agree, setAgree] = useState(false)
  const [formError, setFormError] = useState('')

  const selectedProvider = PROVIDERS.find((item) => item.key === provider) ?? PROVIDERS[0]
  const selectedBank = BANKS.find((item) => item.key === bank) ?? BANKS[0]

  const calculation = useMemo(() => {
    const normalizedAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0
    const converted = normalizedAmount * KURS
    const ppn = Math.round(ADMIN_FEE * PPN_RATE)
    const guestFee = isMember ? 0 : GUEST_SURCHARGE
    const total = Math.max(0, Math.round(converted - ADMIN_FEE - selectedBank.transferFee - ppn - guestFee))

    return {
      normalizedAmount,
      converted,
      ppn,
      guestFee,
      total,
    }
  }, [amount, isMember, selectedBank.transferFee])

  const openConfirmation = () => {
    if (calculation.normalizedAmount < MIN_AMOUNT) {
      setFormError(`Minimal konversi ${formatRupiah(MIN_AMOUNT)}`)
      return
    }

    setFormError('')
    setShowConfirm(true)
  }

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {isMember ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              ✅ Login sebagai <strong>{user?.name ?? 'member'}</strong>. Biaya akses tamu <strong>gratis</strong> untuk transaksi ini.
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

          <div className="overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white md:grid md:grid-cols-[380px_1fr]">
            <aside className="border-b border-[#EBEBEB] p-5 md:border-b-0 md:border-r">
              <div className="mb-5 flex gap-1 rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-1 text-xs font-semibold">
                {([
                  { key: 'instan', label: 'Instan' },
                  { key: 'terjadwal', label: 'Terjadwal' },
                  { key: 'riwayat', label: 'Riwayat' },
                ] as Array<{ key: PanelTab; label: string }>).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 rounded-lg px-3 py-2 transition ${
                      activeTab === tab.key
                        ? 'bg-white text-[#FF5733] shadow-sm'
                        : 'text-[#888] hover:text-[#141414]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-[#888]">Dari</p>
                  <div className="flex items-center justify-between rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414]">
                    <span className="inline-flex items-center gap-2">📱 Pulsa</span>
                    <span className="text-[#888]">IDR</span>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-[#888]">Ke</p>
                  <select
                    value={bank}
                    onChange={(event) => setBank(event.target.value as BankKey)}
                    className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                  >
                    {BANKS.map((item) => (
                      <option key={item.key} value={item.key}>
                        🏦 {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-[#888]">Jumlah Pulsa (Rp)</p>
                  <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 focus-within:border-[#FF5733]">
                    <input
                      type="number"
                      min={MIN_AMOUNT}
                      step={5000}
                      value={amount || ''}
                      onChange={(event) => setAmount(Number(event.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-transparent text-2xl font-extrabold tracking-tight text-[#141414] outline-none placeholder:text-[#C9C9C5]"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map((quickAmount) => (
                      <button
                        key={quickAmount}
                        type="button"
                        onClick={() => setAmount(quickAmount)}
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

                <div>
                  <p className="mb-2 text-xs font-semibold text-[#888]">Operator</p>
                  <select
                    value={provider}
                    onChange={(event) => setProvider(event.target.value as ProviderKey)}
                    className="w-full rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold text-[#141414] outline-none focus:border-[#FF5733]"
                  >
                    {PROVIDERS.map((item) => (
                      <option key={item.key} value={item.key}>
                        📶 {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formError ? <p className="text-sm font-medium text-red-600">{formError}</p> : null}

                <button
                  type="button"
                  onClick={openConfirmation}
                  className="w-full rounded-full bg-[#FF5733] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#e64d2e]"
                >
                  Lihat Rincian & Konversi
                </button>

                {!isMember ? (
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-full border border-[#FF5733] bg-white px-4 py-3 text-sm font-bold text-[#FF5733]"
                  >
                    Login untuk Hapus Biaya Tamu
                  </Link>
                ) : null}
              </div>
            </aside>

            <section className="p-5 md:p-7">
              <div className="mb-5 flex items-center justify-center gap-1.5">
                <span className="h-2 w-5 rounded-full bg-emerald-500" />
                <span className={`h-2 rounded-full ${showConfirm ? 'w-5 bg-emerald-500' : 'w-5 bg-[#FF5733]'}`} />
                <span className={`h-2 w-5 rounded-full ${showConfirm ? 'bg-[#FF5733]' : 'bg-[#EBEBEB]'}`} />
              </div>

              <h1 className="text-xl font-extrabold tracking-tight text-[#141414]">Rincian Konversi</h1>
              <p className="mt-1 text-sm text-[#888]">
                Periksa detail biaya sebelum konversi pulsa ke saldo bank.
              </p>

              <div className="mt-4 rounded-xl border border-[#FFD5C8] bg-[#FFF8F5] px-4 py-3 text-sm text-[#6B5E58]">
                <p className="font-semibold text-[#141414]">📶 {selectedProvider.label} → 🏦 {selectedBank.label}</p>
                <p className="mt-1 text-xs text-[#7A6A63]">Estimasi proses: {selectedProvider.eta}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-[#EBEBEB] bg-white p-5">
                <h2 className="mb-3 text-sm font-bold text-[#141414]">💰 Rincian Biaya</h2>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                    <span className="text-[#888]">Nominal Pulsa</span>
                    <span className="font-semibold text-[#141414]">{formatRupiah(calculation.normalizedAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                    <span className="text-[#888]">Kurs Konversi</span>
                    <span className="font-semibold text-[#FF5733]">1 : {KURS.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                    <span className="text-[#888]">Biaya Admin</span>
                    <span className="font-semibold text-red-500">- {formatRupiah(ADMIN_FEE)}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                    <span className="text-[#888]">PPN 11%</span>
                    <span className="font-semibold text-red-500">- {formatRupiah(calculation.ppn)}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                    <span className="text-[#888]">Biaya Transfer</span>
                    <span className="font-semibold text-red-500">- {formatRupiah(selectedBank.transferFee)}</span>
                  </div>

                  {!isMember ? (
                    <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                      <span className="text-[#888]">Biaya Akses Tamu</span>
                      <span className="font-semibold text-red-500">- {formatRupiah(calculation.guestFee)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border-b border-[#F1F1EE] pb-2">
                      <span className="text-[#888]">Benefit Member</span>
                      <span className="font-semibold text-emerald-600">Biaya tamu gratis</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-dashed border-[#E5E5E2] pt-4">
                  <span className="text-sm font-bold text-[#141414]">Total Diterima</span>
                  <span className="text-2xl font-extrabold tracking-tight text-emerald-600">{formatRupiah(calculation.total)}</span>
                </div>
              </div>

              {showConfirm ? (
                <div className="mt-4 rounded-2xl border border-[#EBEBEB] bg-white p-5">
                  <h3 className="text-sm font-bold text-[#141414]">✅ Konfirmasi Konversi</h3>

                  <div className="my-4 rounded-xl bg-[#FAFAF8] p-4 text-center">
                    <p className="text-xs text-[#888]">Kamu mengirim</p>
                    <p className="mt-1 text-2xl font-extrabold text-[#141414]">{formatRupiah(calculation.normalizedAmount)}</p>
                    <p className="my-1 text-lg text-[#FF5733]">↓</p>
                    <p className="text-2xl font-extrabold text-emerald-600">{formatRupiah(calculation.total)}</p>
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
                      Saya menyetujui syarat layanan konversi pulsa dan memahami transaksi yang sudah diproses tidak dapat dibatalkan.
                    </span>
                  </label>

                  {isMember ? (
                    <button
                      type="button"
                      disabled={!agree}
                      className="w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Konfirmasi Konversi (Member)
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={!agree}
                        className="w-full rounded-full bg-[#141414] px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Lanjut sebagai Tamu (+{formatRupiah(GUEST_SURCHARGE)})
                      </button>
                      <Link
                        href="/login"
                        className="inline-flex w-full items-center justify-center rounded-full border border-[#FF5733] bg-white px-4 py-3 text-sm font-extrabold text-[#FF5733]"
                      >
                        Login Dulu Biar Lebih Hemat
                      </Link>
                    </div>
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
