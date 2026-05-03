"use client"

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from 'react'
import { animate, createScope, stagger } from 'animejs'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Users,
  PackageCheck,
} from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { buildSosmedBundleProductCards, type SosmedBundleProductCard } from '@/lib/sosmedBundlingCards'
import { buildSosmedServiceCards, type SosmedPlatformIconKey } from '@/lib/sosmedProductCards'
import { sosmedBundleService as sosmedBundleServiceApi } from '@/services/sosmedBundleService'
import { sosmedService as sosmedServiceApi } from '@/services/sosmedService'
import type { SosmedBundlePackage } from '@/types/sosmedBundle'
import type { SosmedService } from '@/types/sosmedService'

type BrandIconProps = SVGProps<SVGSVGElement>

function InstagramBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TikTokBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M14 4v10.2a4.2 4.2 0 1 1-3.5-4.1" />
      <path d="M14 4c1 3.1 2.8 5 6 5.3" />
    </svg>
  )
}

function YouTubeBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
    </svg>
  )
}

function TwitterXBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 4l14 16" />
      <path d="M19 4L5 20" />
    </svg>
  )
}

function FacebookBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14 8h2.5V4.3A18 18 0 0 0 13 4c-3.4 0-5.6 2-5.6 5.7V13H4v4.1h3.4V24h4.2v-6.9H15l.6-4.1h-4V10c0-1.2.3-2 2.4-2Z" />
    </svg>
  )
}

function TelegramBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M21.8 4.2 18.5 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1L18 6.5c.4-.4-.1-.6-.6-.3L6 13.4l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.4 3c.9-.3 1.7.2 1.4 1.2Z" />
    </svg>
  )
}

function SpotifyBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 9.3c3.2-1 6.4-.8 9.2.7" />
      <path d="M8.4 12.5c2.6-.7 5-.5 7.3.7" />
      <path d="M9.2 15.5c1.9-.5 3.7-.3 5.4.5" />
    </svg>
  )
}

function ShopeeBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
      <path d="M14.5 11.2c-.6-.5-1.5-.8-2.5-.8-1.4 0-2.5.7-2.5 1.7 0 2.4 5 1.3 5 3.8 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.1-.3-2.8-.9" />
    </svg>
  )
}

function WebsiteBrandIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21" />
      <path d="M12 3C9.8 5.5 8.7 8.5 8.7 12S9.8 18.5 12 21" />
    </svg>
  )
}

const PLATFORM_ICON_COMPONENTS: Record<SosmedPlatformIconKey, ComponentType<BrandIconProps>> = {
  instagram: InstagramBrandIcon,
  facebook: FacebookBrandIcon,
  shopee: ShopeeBrandIcon,
  spotify: SpotifyBrandIcon,
  telegram: TelegramBrandIcon,
  tiktok: TikTokBrandIcon,
  'twitter-x': TwitterXBrandIcon,
  youtube: YouTubeBrandIcon,
  website: WebsiteBrandIcon,
  generic: Users,
}

function iconForPlatform(platformIcon: SosmedPlatformIconKey) {
  return PLATFORM_ICON_COMPONENTS[platformIcon] || PLATFORM_ICON_COMPONENTS.generic
}

function PlatformBrandIcon({ platformIcon, className }: { platformIcon: SosmedPlatformIconKey; className?: string }) {
  const props = { className }
  switch (platformIcon) {
    case 'instagram':
      return <InstagramBrandIcon {...props} />
    case 'facebook':
      return <FacebookBrandIcon {...props} />
    case 'shopee':
      return <ShopeeBrandIcon {...props} />
    case 'spotify':
      return <SpotifyBrandIcon {...props} />
    case 'telegram':
      return <TelegramBrandIcon {...props} />
    case 'tiktok':
      return <TikTokBrandIcon {...props} />
    case 'twitter-x':
      return <TwitterXBrandIcon {...props} />
    case 'youtube':
      return <YouTubeBrandIcon {...props} />
    case 'website':
      return <WebsiteBrandIcon {...props} />
    default:
      return <Users {...props} />
  }
}


function BundleCard({ bundle }: { bundle: SosmedBundleProductCard }) {
  const checkoutHref = bundle.variantKey
    ? `/product/sosmed/checkout?bundle=${encodeURIComponent(bundle.bundleKey)}&variant=${encodeURIComponent(bundle.variantKey)}`
    : '/product/sosmed'
  const canCheckoutBundle = Boolean(bundle.variantKey)

  return (
    <article
      data-anime="sosmed-card"
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        bundle.isRecommended
          ? 'border-[#FF5733] bg-gradient-to-b from-[#FFF8F5] to-white ring-4 ring-[#FFD5C8]/30'
          : 'border-[#EAEAEA] bg-white hover:border-[#FF9B80]/50'
      }`}
    >
      {bundle.isRecommended && (
        <div className="absolute top-0 z-10 w-full bg-gradient-to-r from-[#FF5733] to-[#FF8C33] py-1 text-center text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
          Paket Paling Direkomendasikan
        </div>
      )}

      <div className={`flex flex-col flex-grow p-6 ${bundle.isRecommended ? 'pt-8' : ''}`}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 ${bundle.tone}`}>
            <PlatformBrandIcon platformIcon={bundle.platformIcon} className="h-6 w-6 text-[#141414]" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${
              bundle.isRecommended ? 'bg-[#FF5733] text-white shadow-sm' : 'border border-[#EBEBEB] bg-gray-50 text-gray-500'
            }`}>
              {bundle.platform}
            </span>
            {!bundle.isRecommended && (
              <span className="rounded-full bg-[#FFF3EF] px-2 py-0.5 text-[9px] font-bold text-[#FF5733]">
                {bundle.badge}
              </span>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-[19px] font-extrabold leading-tight text-[#141414] group-hover:text-[#FF5733] transition-colors">{bundle.buyerTitle}</h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-[#666] line-clamp-2">
            {bundle.bestFor}
          </p>
        </div>

        <div className="mt-6 mb-7">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-[#141414] tracking-tight">{bundle.priceLabel}</span>
          </div>
          <span className="text-[11px] font-semibold text-[#888]">{bundle.packageLabel}</span>
        </div>

        <div className="space-y-3.5 flex-grow">
          {bundle.benefits.map((benefit) => (
            <div key={`${bundle.key}-${benefit}`} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E8F8EC]">
                <CheckCircle2 className="h-3 w-3 text-[#22A447]" />
              </div>
              <span className="text-[13px] font-medium text-[#444] leading-snug">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5 pt-5 border-t border-dashed border-gray-200">
          {bundle.trustBadges.map((item) => (
            <span
              key={`${bundle.key}-${item}`}
              className="rounded-lg bg-[#F8F8F8] px-2.5 py-1 text-[10px] font-bold text-[#777]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0 border-t border-gray-100 bg-[#FAFAFA]">
        <Link
          href={checkoutHref}
          aria-disabled={!canCheckoutBundle}
          className={`inline-flex h-14 items-center justify-center text-[12px] font-bold transition ${
            canCheckoutBundle ? 'text-[#666] hover:bg-gray-100 hover:text-[#141414]' : 'pointer-events-none text-[#AAA]'
          }`}
        >
          Detail Paket
        </Link>
        <Link
          href={checkoutHref}
          aria-disabled={!canCheckoutBundle}
          className={`inline-flex h-14 items-center justify-center gap-1.5 text-[12px] font-extrabold transition ${
            !canCheckoutBundle
              ? 'pointer-events-none bg-gray-200 text-gray-500'
              : bundle.isRecommended
                ? 'bg-[#FF5733] text-white hover:bg-[#E64A2E]'
                : 'bg-[#141414] text-white hover:bg-[#333]'
          }`}
        >
          {canCheckoutBundle ? 'Pilih Paket' : 'Checkout Segera Hadir'} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  )
}

export default function ProductSosmedLandingPage() {
  const animationRootRef = useRef<HTMLElement | null>(null)
  const [services, setServices] = useState<SosmedService[]>([])
  const [bundlePackages, setBundlePackages] = useState<SosmedBundlePackage[]>([])
  const [bundleCatalogState, setBundleCatalogState] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [activeTab, setActiveTab] = useState<'satuan' | 'bundling'>('satuan')
  const [currentPage, setCurrentPage] = useState(1)
  const [activePlatform, setActivePlatform] = useState('Semua')

  const CARDS_PER_PAGE = 6

  useEffect(() => {
    let alive = true

    sosmedServiceApi
      .list()
      .then((res) => {
        if (!alive || !res.success) return
        setServices(res.data || [])
      })
      .catch(() => {
        // fail-open: fallback cards still shown
      })

    sosmedBundleServiceApi
      .list()
      .then((res) => {
        if (!alive) return
        if (!res.success || !res.data?.length) {
          setBundleCatalogState('fallback')
          return
        }
        setBundlePackages(res.data)
        setBundleCatalogState('ready')
      })
      .catch(() => {
        if (!alive) return
        setBundleCatalogState('fallback')
      })

    return () => {
      alive = false
    }
  }, [])

  const cards = useMemo(() => buildSosmedServiceCards(services), [services])
  const bundleCards = useMemo(() => buildSosmedBundleProductCards(bundlePackages), [bundlePackages])
  const platforms = useMemo(() => {
    const unique = Array.from(new Set(cards.map(c => c.platform)))
    return ['Semua', ...unique.sort()]
  }, [cards])

  const filteredCards = useMemo(() => {
    if (activePlatform === 'Semua') return cards
    return cards.filter(c => c.platform === activePlatform)
  }, [cards, activePlatform])

  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE)
  const paginatedCards = filteredCards.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE)

  useEffect(() => {
    if (!animationRootRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const scope = { current: createScope({ root: animationRootRef }).add(() => {
      animate('[data-anime="sosmed-hero"]', {
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 650,
        ease: 'out(3)',
      })

      animate('[data-anime="sosmed-trust-badge"]', {
        opacity: [0, 1],
        translateY: [10, 0],
        delay: stagger(70),
        duration: 500,
        ease: 'out(3)',
      })

      animate('[data-anime="sosmed-card"]', {
        opacity: [0, 1],
        translateY: [24, 0],
        delay: stagger(85, { start: 120 }),
        duration: 700,
        ease: 'out(3)',
      })
    }) }

    return () => scope.current.revert()
  }, [paginatedCards.length, currentPage, activeTab, activePlatform])

  return (
    <>
      <Navbar />

      <main ref={animationRootRef} className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <header data-anime="sosmed-hero" className="mx-auto mb-6 max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF5733]">Sosmed</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#141414] md:text-4xl">
              Pilih product sosmed yang tersedia
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#666] md:text-base">
              Semua harga ditulis per paket ±1.000. Pilih jumlah paket di checkout, pastikan akun/link public, lalu sistem mulai proses tanpa minta password.
            </p>
          </header>

          <div className="mb-6 grid gap-2 rounded-2xl border border-[#FFE2CF] bg-white p-3 text-xs shadow-sm sm:grid-cols-3">
            <span data-anime="sosmed-trust-badge" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F2FCEB] px-3 py-2 font-semibold text-[#2F6B1A]">
              <ShieldCheck className="h-4 w-4" /> Tanpa perlu password
            </span>
            <span data-anime="sosmed-trust-badge" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EDF4FF] px-3 py-2 font-semibold text-[#1E4F9B]">
              <Clock3 className="h-4 w-4" /> Mulai diproses cepat
            </span>
            <span data-anime="sosmed-trust-badge" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFF3EA] px-3 py-2 font-semibold text-[#9A4B16]">
              <Sparkles className="h-4 w-4" /> Garansi jelas kalau tersedia
            </span>
          </div>

          <div className="mb-8 flex justify-center">
            <div className="inline-flex rounded-full bg-white p-1.5 shadow-sm ring-1 ring-inset ring-gray-200">
              <button
                onClick={() => {
                  setActiveTab('satuan')
                  setCurrentPage(1)
                  setActivePlatform('Semua')
                }}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
                  activeTab === 'satuan'
                    ? 'bg-[#FF5733] text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Users className="h-4 w-4" />
                Layanan Satuan
              </button>
              <button
                onClick={() => {
                  setActiveTab('bundling')
                  setCurrentPage(1)
                }}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
                  activeTab === 'bundling'
                    ? 'bg-[#FF5733] text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <PackageCheck className="h-4 w-4" />
                Paket Spesial
              </button>
            </div>
          </div>

          {activeTab === 'satuan' && (
            <div className="space-y-8">
              <div className="flex w-full overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex gap-2 mx-auto px-4">
                  {platforms.map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        setActivePlatform(p)
                        setCurrentPage(1)
                      }}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all ${
                        activePlatform === p
                          ? 'bg-[#141414] text-white shadow-md'
                          : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 ring-1 ring-inset ring-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {paginatedCards.map((service) => {
              const checkoutHref = `/product/sosmed/checkout?service=${encodeURIComponent(service.code)}`
              const ServiceIcon = iconForPlatform(service.platformIcon)
              const isRecommended = service.isRecommended

              return (
                <article
                  key={service.key}
                  data-anime="sosmed-card"
                  className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    isRecommended 
                      ? 'border-[#FF5733] bg-gradient-to-b from-[#FFF8F5] to-white ring-4 ring-[#FFD5C8]/30' 
                      : 'border-[#EAEAEA] bg-white hover:border-[#FF9B80]/50'
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute top-0 z-10 w-full bg-gradient-to-r from-[#FF5733] to-[#FF8C33] py-1 text-center text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                      Paling Direkomendasikan
                    </div>
                  )}

                  <div className={`flex flex-col flex-grow p-6 ${isRecommended ? 'pt-8' : ''}`}>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 ${service.tone}`}>
                        <ServiceIcon className="h-6 w-6 text-[#141414]" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${
                          isRecommended ? 'bg-[#FF5733] text-white shadow-sm' : 'border border-[#EBEBEB] bg-gray-50 text-gray-500'
                        }`}>
                          {service.platform}
                        </span>
                        {!isRecommended && (
                          <span className="rounded-full bg-[#FFF3EF] px-2 py-0.5 text-[9px] font-bold text-[#FF5733]">
                            {service.badge}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-[19px] font-extrabold leading-tight text-[#141414] group-hover:text-[#FF5733] transition-colors">{service.buyerTitle}</h2>
                      <p className="mt-2.5 text-[13px] leading-relaxed text-[#666] line-clamp-2">
                        {service.bestFor}
                      </p>
                    </div>

                    <div className="mt-6 mb-7">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-[#141414] tracking-tight">{service.priceLabel}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#888]">{service.packageLabel}</span>
                    </div>

                    <div className="space-y-3.5 flex-grow">
                      {service.benefits.map((benefit) => (
                        <div key={`${service.key}-${benefit}`} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E8F8EC]">
                            <CheckCircle2 className="h-3 w-3 text-[#22A447]" />
                          </div>
                          <span className="text-[13px] font-medium text-[#444] leading-snug">{benefit}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-1.5 pt-5 border-t border-dashed border-gray-200">
                      {service.trustBadges.map((item) => (
                        <span
                          key={`${service.key}-${item}`}
                          className="rounded-lg bg-[#F8F8F8] px-2.5 py-1 text-[10px] font-bold text-[#777]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-0 border-t border-gray-100 bg-[#FAFAFA]">
                    <Link
                      href={checkoutHref}
                      className="inline-flex h-14 items-center justify-center text-[12px] font-bold text-[#666] transition hover:bg-gray-100 hover:text-[#141414]"
                    >
                      Detail Layanan
                    </Link>
                    <Link
                      href={checkoutHref}
                      className={`inline-flex h-14 items-center justify-center gap-1.5 text-[12px] font-extrabold transition ${
                        isRecommended 
                          ? 'bg-[#FF5733] text-white hover:bg-[#E64A2E]' 
                          : 'bg-[#141414] text-white hover:bg-[#333]'
                      }`}
                    >
                      Pilih Layanan <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                                </article>
              )
            })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-1 flex-wrap">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all ${
                          currentPage === pageNum
                            ? 'bg-[#FF5733] text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bundling' && (
            <div className="space-y-4">
              {bundleCatalogState === 'loading' && (
                <div className="rounded-2xl border border-[#FFE2CF] bg-white px-4 py-3 text-center text-xs font-semibold text-[#9A4B16] shadow-sm">
                  Lagi ambil katalog Paket Spesial terbaru dari server...
                </div>
              )}
              {bundleCatalogState === 'fallback' && (
                <div className="rounded-2xl border border-[#FFE2CF] bg-[#FFF8F5] px-4 py-3 text-center text-xs font-semibold text-[#9A4B16] shadow-sm">
                  Katalog backend belum tersedia, jadi sementara gue tampilin preview paket dulu. Harga final tetap dicek ulang saat checkout.
                </div>
              )}
              {bundleCatalogState === 'ready' && !bundleCards.length && (
                <div className="rounded-2xl border border-dashed border-[#FFD5C8] bg-white px-4 py-8 text-center text-sm font-semibold text-[#666]">
                  Paket Spesial belum tersedia sekarang. Cek lagi nanti ya.
                </div>
              )}
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {bundleCards.map((bundle) => (
                  <BundleCard key={bundle.key} bundle={bundle} />
                ))}
              </div>
            </div>
          )}

          <section className="mt-8 rounded-2xl border border-[#FFD5C8] bg-[#FFF3EF] p-6 text-center">
            <h2 className="text-xl font-extrabold text-[#141414]">Masih bingung pilih paket?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#666]">
              Pilih paket hemat kalau mau coba dulu. Pilih prioritas kalau akun jualan/campaign butuh proses lebih cepat. Nanti di checkout lu bisa cek total harga sebelum saldo dipotong.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register?next=%2Fproduct%2Fsosmed"
                className="inline-flex items-center gap-1 rounded-full bg-[#FF5733] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e64d2e]"
              >
                Bikin Akun <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login?next=%2Fproduct%2Fsosmed"
                className="inline-flex items-center gap-1 rounded-full border border-[#141414] px-5 py-2.5 text-sm font-semibold text-[#141414] transition hover:bg-[#141414] hover:text-white"
              >
                Masuk
              </Link>
            </div>
          </section>
        </section>
      </main>

      <Footer />
    </>
  )
}
