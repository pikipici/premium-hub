"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Copy,
  CreditCard,
  Globe,
  Headphones,
  Shield,
  Wallet,
} from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { nokosPublicService } from '@/services/nokosPublicService'
import type { NokosLandingSummary } from '@/types/nokos'

type PanelTab = 'country' | 'number' | 'sms'

type Country = {
  key: string
  flag: string
  name: string
  dialCode: string
}

type OtpCard = {
  app: string
  icon: string
  iconClassName: string
  before: string
  code: string
  after?: string
}

type SmsItem = {
  sender: string
  senderTag: string
  senderTagClassName: string
  time: string
  before: string
  code: string
  after?: string
}

const otpCards: OtpCard[] = [
  {
    app: 'Instagram',
    icon: 'IG',
    iconClassName: 'bg-gradient-to-br from-orange-400 via-rose-500 to-fuchsia-600 text-white',
    before: 'Use',
    code: '645 829',
    after: 'to verify your Instagram account.',
  },
  {
    app: 'WhatsApp',
    icon: 'WA',
    iconClassName: 'bg-[#25D366] text-white',
    before: 'Your WhatsApp code is',
    code: '392-847',
    after: "Don't share this code.",
  },
  {
    app: 'Netflix',
    icon: 'N',
    iconClassName: 'bg-[#E50914] text-white',
    before: 'Your Netflix verification code is',
    code: '295206',
  },
  {
    app: 'Telegram',
    icon: 'TG',
    iconClassName: 'bg-[#229ED9] text-white',
    before: 'Login code:',
    code: '71849',
    after: 'Do not give this code to anyone.',
  },
  {
    app: 'PayPal',
    icon: 'PP',
    iconClassName: 'bg-[#003087] text-white',
    before: 'Your PayPal security code is',
    code: '481726',
    after: 'It expires in 10 minutes.',
  },
]

const countries: Country[] = [
  { key: 'US', flag: '🇺🇸', name: 'Amerika Serikat', dialCode: '+1' },
  { key: 'GB', flag: '🇬🇧', name: 'Inggris', dialCode: '+44' },
  { key: 'ID', flag: '🇮🇩', name: 'Indonesia', dialCode: '+62' },
  { key: 'IN', flag: '🇮🇳', name: 'India', dialCode: '+91' },
  { key: 'RU', flag: '🇷🇺', name: 'Rusia', dialCode: '+7' },
  { key: 'DE', flag: '🇩🇪', name: 'Jerman', dialCode: '+49' },
  { key: 'FR', flag: '🇫🇷', name: 'Prancis', dialCode: '+33' },
  { key: 'BR', flag: '🇧🇷', name: 'Brasil', dialCode: '+55' },
  { key: 'CA', flag: '🇨🇦', name: 'Kanada', dialCode: '+1' },
  { key: 'AU', flag: '🇦🇺', name: 'Australia', dialCode: '+61' },
  { key: 'JP', flag: '🇯🇵', name: 'Jepang', dialCode: '+81' },
  { key: 'SG', flag: '🇸🇬', name: 'Singapura', dialCode: '+65' },
]

const numbers = [
  '+1 415 823 9047',
  '+1 650 341 7762',
  '+1 213 940 5581',
  '+1 312 674 2209',
  '+1 718 503 8834',
  '+1 646 287 4401',
  '+1 408 119 6653',
  '+1 202 876 3318',
]

const smsItems: SmsItem[] = [
  {
    sender: 'Google',
    senderTag: 'G',
    senderTagClassName: 'bg-[#FFE6DE] text-[#FF5733]',
    time: '2 menit lalu',
    before: 'Your Google verification code is',
    code: '847291',
  },
  {
    sender: 'Uber',
    senderTag: 'U',
    senderTagClassName: 'bg-[#FFF3CD] text-[#D97706]',
    time: '5 menit lalu',
    before: 'Code Uber:',
    code: '1597',
  },
  {
    sender: 'Netflix',
    senderTag: 'N',
    senderTagClassName: 'bg-[#FEE2E2] text-[#DC2626]',
    time: '12 menit lalu',
    before: 'Your Netflix verification code is',
    code: '295206',
  },
  {
    sender: 'Shopee',
    senderTag: 'S',
    senderTagClassName: 'bg-[#D1FAE5] text-[#059669]',
    time: '18 menit lalu',
    before: '[Shopee] Your verification code is',
    code: '304918',
    after: 'Valid for 5 minutes.',
  },
]

const formatCompact = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value)

const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value)

const paymentMethodLabel = (method: string) => {
  const normalized = method.trim().toLowerCase()
  switch (normalized) {
    case 'qris':
      return 'QRIS'
    case 'bri_va':
      return 'BRI VA'
    case 'bni_va':
      return 'BNI VA'
    case 'permata_va':
      return 'Permata VA'
    case 'cimb_niaga_va':
      return 'CIMB VA'
    case 'paypal':
      return 'PayPal'
    default:
      return normalized.replaceAll('_', ' ').toUpperCase()
  }
}

export default function LandingPage() {
  const [tab, setTab] = useState<PanelTab>('country')
  const [countryQuery, setCountryQuery] = useState('')
  const [activeCountry, setActiveCountry] = useState(countries[0].key)
  const [activeNumber, setActiveNumber] = useState(numbers[0])
  const [copied, setCopied] = useState(false)
  const [landingSummary, setLandingSummary] = useState<NokosLandingSummary | null>(null)

  useEffect(() => {
    let canceled = false

    nokosPublicService
      .getLandingSummary()
      .then((res) => {
        if (!canceled && res.success) {
          setLandingSummary(res.data)
        }
      })
      .catch(() => {
        // keep silent fallback to static defaults
      })

    return () => {
      canceled = true
    }
  }, [])

  const filteredCountries = useMemo(() => {
    const query = countryQuery.trim().toLowerCase()
    if (!query) return countries

    return countries.filter((country) => {
      const haystack = `${country.name} ${country.dialCode}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [countryQuery])

  const selectedCountry =
    filteredCountries.find((country) => country.key === activeCountry) ??
    filteredCountries[0] ??
    countries.find((country) => country.key === activeCountry) ??
    countries[0]

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(activeNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const hasLiveSummary = Boolean(landingSummary)
  const countriesCount = landingSummary?.countries_count ?? 0
  const sentTotalAllTime = landingSummary?.sent_total_all_time ?? 0
  const activePaymentMethods = (landingSummary?.payment_methods || []).map(paymentMethodLabel)

  const heroBadgeLabel = hasLiveSummary ? `${formatNumber(sentTotalAllTime)} nomor terkirim` : 'Memuat data penjualan...'
  const statItems = [
    { value: hasLiveSummary ? `${formatCompact(countriesCount)}+` : '—', label: 'Negara tersedia' },
    { value: hasLiveSummary ? `${formatCompact(sentTotalAllTime)}+` : '—', label: 'Nomor terkirim' },
    { value: hasLiveSummary ? `${activePaymentMethods.length}` : '—', label: 'Metode bayar aktif' },
  ]

  const trustItems = [
    {
      key: 'countries',
      icon: <Globe className="h-4 w-4" />,
      label: hasLiveSummary ? `${formatNumber(countriesCount)} Negara` : 'Negara: memuat...',
    },
    { key: 'privacy', icon: <Shield className="h-4 w-4" />, label: '100% Anonim' },
    {
      key: 'payments',
      icon: <CreditCard className="h-4 w-4" />,
      label: activePaymentMethods.join(' / '),
      hidden: activePaymentMethods.length === 0,
    },
    { key: 'support', icon: <Headphones className="h-4 w-4" />, label: 'Support 24/7' },
    {
      key: 'sent',
      icon: <BadgeCheck className="h-4 w-4" />,
      label: hasLiveSummary ? `${formatCompact(sentTotalAllTime)}+ Terkirim` : 'Penjualan: memuat...',
    },
  ].filter((item) => !item.hidden)

  return (
    <>
      <Navbar />

      <main className="overflow-hidden bg-white">
        <section className="mx-auto grid w-full max-w-7xl gap-7 px-4 pb-8 pt-10 sm:gap-10 sm:px-6 md:grid-cols-2 md:items-center md:px-8 md:pt-16 lg:px-10">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#FF573333] bg-[#FFF0ED] px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#FF5733]">
              <span className="h-2 w-2 rounded-full bg-[#22C55E] shadow-[0_0_0_5px_rgba(34,197,94,0.16)]" />
              {heroBadgeLabel}
            </div>

            <h1 className="mb-4 text-[2rem] font-extrabold leading-[1.12] tracking-tight text-[#141414] sm:mb-5 sm:text-5xl sm:leading-tight">
              Terima SMS <span className="text-[#FF5733]">OTP</span> ke nomor virtual dari seluruh dunia
            </h1>

            <p className="mb-2 text-[15px] leading-relaxed text-[#888]">
              Verifikasi akun tanpa nomor HP asli.{' '}
              {hasLiveSummary ? `Tersedia untuk ${formatNumber(countriesCount)} negara.` : 'Data negara sedang dimuat...'}
            </p>

            <p className="mb-7 text-sm leading-relaxed text-[#888] sm:mb-8">
              WhatsApp, Telegram, Instagram, TikTok, PayPal, Google, Facebook, Uber, Netflix, dan ratusan platform lainnya.
            </p>

            <div className="mb-7 flex flex-col gap-3 sm:mb-8 sm:max-w-md sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-[#FF5733] px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(255,87,51,0.28)] transition hover:-translate-y-0.5 hover:bg-[#D94420]"
              >
                🚀 Beli Akses
              </Link>
              <Link
                href="/product/prem-apps"
                className="inline-flex items-center justify-center rounded-full border border-[#EBEBEB] px-7 py-3.5 text-sm font-semibold text-[#141414] transition hover:border-[#141414] hover:bg-[#F7F7F5]"
              >
                ✨ Coba Gratis
              </Link>
            </div>

            <div className="grid max-w-md grid-cols-3 gap-3 sm:gap-4">
              {statItems.map((stat) => (
                <div key={stat.label} className="rounded-xl bg-[#FAFAF9] px-2 py-2.5 text-center sm:bg-transparent sm:px-0 sm:py-0 sm:text-left">
                  <div className="text-xl font-extrabold tracking-tight text-[#141414] sm:text-2xl">{stat.value}</div>
                  <div className="mt-0.5 text-[11px] text-[#888] sm:text-xs">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-16 inset-y-0 hidden rounded-l-[40px] bg-gradient-to-br from-[#FFE8E0] via-[#FFCDB8] to-[#FFE5D5] md:block" />
            <div className="relative z-10 grid gap-3 sm:grid-cols-2 md:flex md:flex-col md:overflow-visible md:pb-0">
              {otpCards.map((card) => (
                <article
                  key={card.app}
                  className="rounded-2xl border border-[#f5f5f5] bg-white p-4 shadow-[0_8px_32px_rgba(20,20,20,0.10)] transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${card.iconClassName}`}>
                      {card.icon}
                    </div>
                    <div>
                      <h3 className="mb-1 text-sm font-extrabold text-[#141414]">{card.app}</h3>
                      <p className="text-xs leading-relaxed text-[#888]">
                        {card.before}{' '}
                        <span className="rounded bg-[#FFF0ED] px-1.5 py-0.5 text-[11px] font-extrabold text-[#FF5733]">
                          {card.code}
                        </span>{' '}
                        {card.after}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="hidden border-y border-[#EBEBEB] bg-[#F7F7F5] md:block">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-3 gap-5 px-6 py-4 lg:grid-cols-5 lg:px-10">
            {trustItems.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-sm font-semibold text-[#2a2a2a]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EBEBEB] bg-white text-[#FF5733]">
                  {item.icon}
                </span>
                {item.label}
              </div>
            ))}
          </div>
        </section>

        <section id="panel" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:px-8 lg:px-10 lg:py-16">
          <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-[#FF573326] bg-[#FFF0ED] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#FF5733]">
                🌐 Live Preview
              </div>
              <h2 className="text-[1.72rem] font-extrabold leading-tight tracking-tight text-[#141414] sm:text-3xl">Pilih negara & lihat nomor tersedia</h2>
              <p className="mt-1 text-sm text-[#888]">
                Pilih negara, salin nomor, dan gunakan untuk verifikasi platform favoritmu.
              </p>
            </div>
            <Link
              href="/product/prem-apps"
              className="inline-flex items-center gap-1 self-start rounded-full border border-[#FF573333] px-4 py-2 text-sm font-semibold text-[#FF5733] transition hover:bg-[#FFF0ED]"
            >
              Lihat semua negara <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mb-3 flex rounded-xl border border-[#EBEBEB] bg-[#F7F7F5] p-1 md:hidden">
            {([
              { key: 'country', label: '🌍 Negara' },
              { key: 'number', label: '📞 Nomor' },
              { key: 'sms', label: '✉️ SMS' },
            ] as { key: PanelTab; label: string }[]).map((tabItem) => (
              <button
                key={tabItem.key}
                type="button"
                onClick={() => setTab(tabItem.key)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  tab === tabItem.key ? 'bg-white text-[#FF5733] shadow-sm' : 'text-[#888]'
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          <div className="grid overflow-hidden rounded-2xl border border-[#EBEBEB] md:grid-cols-[220px_1fr_1fr]">
            <div className={`border-b border-[#EBEBEB] bg-white md:border-b-0 md:border-r ${tab !== 'country' ? 'hidden md:block' : ''}`}>
              <div className="border-b border-[#EBEBEB] p-3">
                <input
                  value={countryQuery}
                  onChange={(event) => setCountryQuery(event.target.value)}
                  placeholder="🔍 Cari negara..."
                  className="w-full rounded-lg border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-2 text-sm text-[#141414] outline-none transition focus:border-[#FF5733]"
                />
              </div>
              <div className="max-h-[340px] overflow-y-auto py-1 md:max-h-[420px]">
                {filteredCountries.map((country) => {
                  const isActive = country.key === selectedCountry.key
                  return (
                    <button
                      key={country.key}
                      type="button"
                      onClick={() => setActiveCountry(country.key)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${
                        isActive
                          ? 'border-r-2 border-r-[#FF5733] bg-[#FFF0ED] font-semibold text-[#141414]'
                          : 'text-[#2a2a2a] hover:bg-[#F7F7F5]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        {country.name}
                      </span>
                      <span className="text-xs text-[#888]">{country.dialCode}</span>
                    </button>
                  )
                })}
                {filteredCountries.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-[#888]">Negara tidak ditemukan.</div>
                )}
              </div>
            </div>

            <div className={`border-b border-[#EBEBEB] bg-white md:border-b-0 md:border-r ${tab !== 'number' ? 'hidden md:block' : ''}`}>
              <div className="sticky top-0 border-b border-[#EBEBEB] bg-[#F7F7F5] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#888]">
                Nomor tersedia
              </div>
              <div className="max-h-[340px] overflow-y-auto md:max-h-[420px]">
                {numbers.map((number) => {
                  const isActive = number === activeNumber
                  return (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setActiveNumber(number)}
                      className={`flex w-full items-center justify-between border-b border-[#F1F5F9] px-4 py-3 text-left text-sm transition ${
                        isActive
                          ? 'border-r-2 border-r-[#FF5733] bg-[#FFF0ED] font-semibold text-[#141414]'
                          : 'text-[#2a2a2a] hover:bg-[#F7F7F5]'
                      }`}
                    >
                      <span>📞 {number}</span>
                      <span className="text-lg font-bold text-[#FF5733]">›</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={`bg-white ${tab !== 'sms' ? 'hidden md:block' : ''}`}>
              <div className="sticky top-0 border-b border-[#EBEBEB] bg-[#F7F7F5] px-4 py-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#141414]">
                    <span className="text-base">{selectedCountry.flag}</span>
                    {activeNumber}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyNumber}
                    className="inline-flex items-center gap-1 rounded-md border border-[#FF573333] bg-[#FFF0ED] px-2.5 py-1 text-xs font-semibold text-[#FF5733] transition hover:bg-[#FF5733] hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Tersalin!' : 'Salin'}
                  </button>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[11px] font-bold text-[#16A34A]">
                  ● Aktif
                </span>
              </div>

              <div className="max-h-[340px] overflow-y-auto md:max-h-[420px]">
                {smsItems.map((item) => (
                  <article key={`${item.sender}-${item.code}`} className="border-b border-[#F1F5F9] px-4 py-4">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#141414]">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] ${item.senderTagClassName}`}>
                          {item.senderTag}
                        </span>
                        {item.sender}
                      </div>
                      <span className="text-xs text-[#888]">{item.time}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-[#2a2a2a]">
                      {item.before}{' '}
                      <span className="rounded-md border border-[#FF573326] bg-[#FFF0ED] px-2 py-0.5 text-xs font-extrabold text-[#FF5733]">
                        {item.code}
                      </span>{' '}
                      {item.after}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:px-8 lg:px-10 lg:py-20">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex rounded-full border border-[#FF573326] bg-[#FFF0ED] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#FF5733]">
              ⚡ Cara Kerja
            </div>
            <h2 className="text-[1.72rem] font-extrabold leading-tight tracking-tight text-[#141414] sm:text-4xl">
              Empat langkah mudah — dari daftar sampai OTP masuk ke dashboard kamu.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#888]">
              Tidak perlu verifikasi ribet. Mulai dalam hitungan menit.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Daftar & Isi Saldo',
                desc: 'Buat akun gratis dan isi saldo wallet via transfer bank, e-wallet, QRIS, atau pulsa.',
              },
              {
                title: 'Pilih Negara & Platform',
                desc: 'Tentukan negara asal nomor dan platform yang ingin diverifikasi, lalu pilih tipe nomor.',
              },
              {
                title: 'Gunakan Nomor',
                desc: 'Nomor aktif langsung muncul di dashboard. Gunakan untuk mendaftar atau verifikasi akunmu.',
              },
              {
                title: 'Terima OTP Instan',
                desc: 'SMS OTP tampil di dashboard dalam hitungan detik. Salin kode dan selesai.',
              },
            ].map((step, index) => (
              <article
                key={step.title}
                className="rounded-3xl border border-[#EBEBEB] bg-[#F7F7F5] p-5 transition hover:-translate-y-1 hover:border-[#FF573333] hover:shadow-[0_12px_32px_rgba(255,87,51,0.10)] sm:p-6"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF5733] text-lg font-extrabold text-white shadow-[0_8px_20px_rgba(255,87,51,0.26)]">
                  {index + 1}
                </div>
                <h3 className="mb-2 text-base font-extrabold text-[#141414]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[#888]">{step.desc}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-7 py-3.5 text-sm font-extrabold text-white transition hover:bg-black"
            >
              <Wallet className="h-4 w-4" />
              Mulai Sekarang
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
