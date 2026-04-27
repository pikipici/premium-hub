"use client"

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  CreditCard,
  Globe,
  Headphones,
  Shield,
  Wallet,
} from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { nokosPublicService } from '@/services/nokosPublicService'
import { useAuthStore } from '@/store/authStore'
import type { NokosLandingSummary } from '@/types/nokos'

type OtpCard = {
  app: string
  iconSrc?: string
  iconText?: string
  iconClassName: string
  before: string
  code: string
  after?: string
}

const otpCards: OtpCard[] = [
  {
    app: 'Instagram',
    iconSrc: '/icons/apps/instagram.svg',
    iconClassName: 'bg-gradient-to-br from-orange-400 via-rose-500 to-fuchsia-600 text-white',
    before: 'Use',
    code: '645 829',
    after: 'to verify your Instagram account.',
  },
  {
    app: 'WhatsApp',
    iconSrc: '/icons/apps/whatsapp.svg',
    iconClassName: 'bg-[#25D366] text-white',
    before: 'Your WhatsApp code is',
    code: '392-847',
    after: "Don't share this code.",
  },
  {
    app: 'Netflix',
    iconSrc: '/icons/apps/netflix.png',
    iconClassName: 'bg-[#E50914] text-white',
    before: 'Your Netflix verification code is',
    code: '295206',
  },
  {
    app: 'Telegram',
    iconSrc: '/icons/apps/telegram.svg',
    iconClassName: 'bg-[#229ED9] text-white',
    before: 'Login code:',
    code: '71849',
    after: 'Do not give this code to anyone.',
  },
  {
    app: 'PayPal',
    iconSrc: '/icons/apps/paypal.svg',
    iconClassName: 'bg-[#003087] text-white',
    before: 'Your PayPal security code is',
    code: '481726',
    after: 'It expires in 10 minutes.',
  },
  {
    app: 'Facebook',
    iconSrc: '/icons/apps/facebook.svg',
    iconClassName: 'bg-[#1877F2] text-white',
    before: 'Use',
    code: '96243264',
    after: 'as your Facebook verification code.',
  },
  {
    app: 'Google',
    iconSrc: '/icons/apps/google.svg',
    iconClassName: 'bg-[#4285F4] text-white',
    before: 'G-',
    code: '585019',
    after: 'is your Google verification code.',
  },
  {
    app: 'Gmail',
    iconSrc: '/icons/apps/gmail.svg',
    iconClassName: 'bg-[#EA4335] text-white',
    before: 'Your Gmail verification code is',
    code: '418902',
    after: 'Do not share this code.',
  },
  {
    app: 'YouTube',
    iconSrc: '/icons/apps/youtube.svg',
    iconClassName: 'bg-[#FF0000] text-white',
    before: 'Use',
    code: '772941',
    after: 'to verify your YouTube account.',
  },
  {
    app: 'Taobao',
    iconSrc: '/icons/apps/taobao.svg',
    iconClassName: 'bg-[#FF4400] text-white',
    before: 'Verification code:',
    code: '561318',
    after: 'Valid for 5 minutes.',
  },
  {
    app: 'eBay',
    iconSrc: '/icons/apps/ebay.svg',
    iconClassName: 'bg-[#E53238] text-white',
    before: 'Your one-time eBay PIN is',
    code: '8905',
  },
  {
    app: 'Amazon',
    iconSrc: '/icons/apps/amazon.svg',
    iconClassName: 'bg-[#232F3E] text-white',
    before: 'Your Amazon Web Services (AWS) verification code is:',
    code: '8732',
  },
  {
    app: 'WeChat',
    iconSrc: '/icons/apps/wechat.svg',
    iconClassName: 'bg-[#07C160] text-white',
    before: 'Verification code',
    code: '003835',
    after: 'may only be used once to verify mobile number.',
  },
  {
    app: 'LINE',
    iconSrc: '/icons/apps/line.svg',
    iconClassName: 'bg-[#06C755] text-white',
    before: 'Please enter',
    code: '493425',
    after: 'into LINE within the next 30 mins.',
  },
  {
    app: 'Proton',
    iconSrc: '/icons/apps/proton.svg',
    iconClassName: 'bg-[#6D4AFF] text-white',
    before: 'Your Proton verification code is:',
    code: '287911',
  },
  {
    app: 'AliExpress',
    iconSrc: '/icons/apps/aliexpress.svg',
    iconClassName: 'bg-[#E62E04] text-white',
    before: 'Verification code:',
    code: '561318',
    after: 'Valid for 5 minutes.',
  },
  {
    app: 'Viber',
    iconSrc: '/icons/apps/viber.svg',
    iconClassName: 'bg-[#7360F2] text-white',
    before: 'Your Viber code is',
    code: '108 593',
    after: 'Expires in 5 minutes.',
  },
  {
    app: 'Discord',
    iconSrc: '/icons/apps/discord.svg',
    iconClassName: 'bg-[#5865F2] text-white',
    before: 'Discord authentication code:',
    code: '774922',
    after: 'Never share this code.',
  },
  {
    app: 'TikTok / Douyin',
    iconSrc: '/icons/apps/tiktok.svg',
    iconClassName: 'bg-[#111111] text-white',
    before: 'Your TikTok code is',
    code: '339 551',
    after: 'valid for 10 minutes.',
  },
  {
    app: 'Steam',
    iconSrc: '/icons/apps/steam.svg',
    iconClassName: 'bg-[#0B1C2C] text-white',
    before: 'Steam Guard code:',
    code: '91456',
    after: 'enter this in the Steam app.',
  },
  {
    app: 'Tinder',
    iconSrc: '/icons/apps/tinder.svg',
    iconClassName: 'bg-[#FF4458] text-white',
    before: 'Your code is',
    code: '449940',
    after: "Don't share it with anyone.",
  },
  {
    app: 'OpenAI',
    iconSrc: '/icons/apps/openai.svg',
    iconClassName: 'bg-[#111827] text-white',
    before: 'OpenAI confirmation code:',
    code: '447 908',
    after: 'Complete sign-in to continue.',
  },
  {
    app: 'Uber',
    iconSrc: '/icons/apps/uber.svg',
    iconClassName: 'bg-[#111827] text-white',
    before: 'Code Uber :',
    code: '1597',
  },
]

const monoBadgeIconSrcs = new Set<string>([
  '/icons/apps/openai.svg',
  '/icons/apps/proton.svg',
])

const monoBadgeInvertIconSrcs = new Set<string>([
  '/icons/apps/openai.svg',
])

function OtpPreviewCard({ card }: { card: OtpCard }) {
  const useMonoBadge = card.iconSrc ? monoBadgeIconSrcs.has(card.iconSrc) : false
  const useMonoBadgeInvert = card.iconSrc ? monoBadgeInvertIconSrcs.has(card.iconSrc) : false

  const iconContainerClassName = useMonoBadge
    ? `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconClassName}`
    : 'flex h-10 w-10 shrink-0 items-center justify-center'

  const iconImageClassName = useMonoBadge
    ? `h-[20px] w-[20px] object-contain${useMonoBadgeInvert ? ' brightness-0 invert' : ''}`
    : 'h-[26px] w-[26px] object-contain'

  return (
    <article className="rounded-2xl border border-[#f5f5f5] bg-white p-4 shadow-[0_8px_32px_rgba(20,20,20,0.10)] transition hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div className={iconContainerClassName}>
          {card.iconSrc ? (
            <Image
              src={card.iconSrc}
              alt={`${card.app} logo`}
              width={26}
              height={26}
              className={iconImageClassName}
            />
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClassName}`}>
              <span className="text-[11px] font-extrabold uppercase tracking-wide">{card.iconText ?? card.app.slice(0, 2)}</span>
            </div>
          )}
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
  )
}

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
  const [landingSummary, setLandingSummary] = useState<NokosLandingSummary | null>(null)
  const { isAuthenticated, hasHydrated, isBootstrapped } = useAuthStore()

  useEffect(() => {
    let canceled = false

    nokosPublicService
      .getLandingSummary()
      .then((result) => {
        if (canceled) return
        if (result.success) {
          setLandingSummary(result.data)
        }
      })
      .catch(() => {
        // keep silent fallback
      })

    return () => {
      canceled = true
    }
  }, [])

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
  const trustGridColsClass = trustItems.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'

  const nokosDashboardHref = '/dashboard/nokos'
  const registerNokosHref = `/register?next=${encodeURIComponent(nokosDashboardHref)}`
  const loginNokosHref = `/login?next=${encodeURIComponent(nokosDashboardHref)}`
  const isReady = hasHydrated && isBootstrapped
  const isLoggedIn = isReady && isAuthenticated

  const heroPrimaryCta = isLoggedIn
    ? { href: nokosDashboardHref, label: '🚀 Beli Nomor Sekarang' }
    : { href: registerNokosHref, label: '🚀 Daftar Gratis' }

  const heroSecondaryCta = isLoggedIn
    ? { href: '/dashboard/wallet', label: '💳 Isi Saldo Wallet' }
    : { href: loginNokosHref, label: '🔐 Masuk' }

  const bottomCta = isLoggedIn
    ? { href: nokosDashboardHref, label: 'Buka Dashboard Nokos' }
    : { href: registerNokosHref, label: 'Daftar Gratis' }

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
              Verifikasi akun dengan nomor virtual.{' '}
              {hasLiveSummary ? `Tersedia untuk ${formatNumber(countriesCount)} negara.` : 'Data negara sedang dimuat...'}
            </p>

            <p className="mb-7 text-sm leading-relaxed text-[#888] sm:mb-8">
              WhatsApp, Telegram, Instagram, TikTok, PayPal, Google, Facebook, Uber, Netflix, dan ratusan platform lainnya.
            </p>

            <div className="mb-7 flex flex-col gap-3 sm:mb-8 sm:max-w-md sm:flex-row">
              <Link
                href={heroPrimaryCta.href}
                className="inline-flex items-center justify-center rounded-full bg-[#FF5733] px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(255,87,51,0.28)] transition hover:-translate-y-0.5 hover:bg-[#D94420]"
              >
                {heroPrimaryCta.label}
              </Link>
              <Link
                href={heroSecondaryCta.href}
                className="inline-flex items-center justify-center rounded-full border border-[#EBEBEB] px-7 py-3.5 text-sm font-semibold text-[#141414] transition hover:border-[#141414] hover:bg-[#F7F7F5]"
              >
                {heroSecondaryCta.label}
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
            <div className="relative z-10">
              <div className="grid gap-3 sm:grid-cols-2 md:hidden">
                {otpCards.map((card) => (
                  <OtpPreviewCard key={`mobile-${card.app}`} card={card} />
                ))}
              </div>

              <div className="otp-escalator-mask hidden md:block">
                <div className="otp-escalator-track">
                  {[0, 1].map((loop) => (
                    <div key={`loop-${loop}`} className="grid gap-3 pb-3">
                      {otpCards.map((card) => (
                        <OtpPreviewCard key={`desktop-${loop}-${card.app}`} card={card} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="hidden border-y border-[#EBEBEB] bg-[#F7F7F5] md:block">
          <div className={`mx-auto grid w-full max-w-7xl grid-cols-3 gap-5 px-6 py-4 ${trustGridColsClass} lg:px-10`}>
            {trustItems.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-sm font-semibold text-[#2a2a2a] lg:justify-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EBEBEB] bg-white text-[#FF5733]">
                  {item.icon}
                </span>
                {item.label}
              </div>
            ))}
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
              Tidak perlu langkah ribet. Mulai dalam hitungan menit.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Daftar & Isi Saldo',
                desc: 'Buat akun gratis dan isi saldo wallet via transfer bank, e-wallet, atau QRIS.',
              },
              {
                title: 'Pilih Layanan di Dashboard',
                desc: 'Masuk ke dashboard Nokos, lalu pilih negara, operator, dan layanan OTP yang kamu butuhkan.',
              },
              {
                title: 'Nomor Aktif Otomatis',
                desc: 'Setelah pembelian sukses, nomor langsung aktif dan status order bisa kamu pantau dari dashboard.',
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
              href={bottomCta.href}
              className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-7 py-3.5 text-sm font-extrabold text-white transition hover:bg-black"
            >
              <Wallet className="h-4 w-4" />
              {bottomCta.label}
            </Link>
          </div>
        </section>
      </main>

      <style jsx>{`
        .otp-escalator-mask {
          max-height: 460px;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%);
        }

        .otp-escalator-track {
          will-change: transform;
          animation: otp-escalator 96s linear infinite;
        }

        .otp-escalator-mask:hover .otp-escalator-track {
          animation-play-state: paused;
        }

        @keyframes otp-escalator {
          from {
            transform: translateY(0);
          }

          to {
            transform: translateY(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .otp-escalator-track {
            animation: none;
          }
        }
      `}</style>

      <Footer />
    </>
  )
}
