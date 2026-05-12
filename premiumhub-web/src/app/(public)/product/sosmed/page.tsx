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
import { DigiLoadingCardGrid } from '@/components/shared/DigiLoading'
import { buildSosmedBundleProductCards, type SosmedBundleProductCard } from '@/lib/sosmedBundlingCards'
import { buildSosmedServiceCards, type SosmedPlatformIconKey } from '@/lib/sosmedProductCards'
import type { SosmedPromotionPrice } from '@/types/sosmedService'
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

function sortPromoAndRecommendedFirst<T extends { isRecommended: boolean; promotion?: SosmedPromotionPrice }>(items: T[]) {
  const score = (item: T) => {
    if (item.promotion && item.isRecommended) return 3
    if (item.promotion) return 2
    if (item.isRecommended) return 1
    return 0
  }

  return [...items].sort((a, b) => score(b) - score(a))
}

function formatPromoRemaining(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (!Number.isFinite(diff) || diff <= 0) return 'Promo berakhir'
  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours >= 24) return `${Math.floor(hours / 24)}h ${hours % 24}j lagi`
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatPromoValue(promotion?: SosmedPromotionPrice) {
  if (!promotion) return null
  if (promotion.discount_type === 'percent') return `${promotion.discount_value}% OFF`
  return `Hemat ${formatCurrency(promotion.discount_amount || promotion.discount_value)}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function PromoRibbon({ promotion }: { promotion?: SosmedPromotionPrice }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!promotion?.ends_at) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [promotion?.ends_at])

  if (!promotion?.ends_at) return null

  const promoValue = formatPromoValue(promotion)

  return (
    <div className="absolute left-0 top-0 z-20 w-full bg-[linear-gradient(110deg,#B4161B_0%,#FF3F1F_48%,#FF9B31_100%)] px-2.5 py-1 text-white shadow-[0_10px_26px_rgba(216,58,29,0.28)] sm:px-5 sm:py-2">
      <div className="flex items-center justify-between gap-1.5 text-[8px] font-black uppercase tracking-[0.08em] sm:gap-2 sm:text-[10px] sm:tracking-[0.16em]">
        <span>{promoValue || 'Promo Aktif'}</span>
        <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 tracking-normal backdrop-blur sm:gap-1 sm:px-2 sm:tracking-wide">
          <Clock3 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          {formatPromoRemaining(promotion.ends_at)}
        </span>
      </div>
    </div>
  )
}

function RecommendedSash() {
  return (
    <div className="pointer-events-none absolute -right-9 top-4 z-20 w-32 rotate-45 bg-[linear-gradient(110deg,#E63B22,#FF5733_55%,#FF8C66)] py-1 text-center text-[8px] font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_18px_rgba(255,87,51,0.26)] sm:-right-10 sm:top-5 sm:w-36 sm:text-[9px]">
      <span className="sm:hidden">Best</span>
      <span className="hidden sm:inline">Best Pick</span>
    </div>
  )
}

function PromoUrgencyBar({ promotion }: { promotion?: SosmedPromotionPrice }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!promotion?.ends_at) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [promotion?.ends_at])

  if (!promotion?.ends_at) return null

  return (
    <div className="mt-2 hidden items-center justify-between gap-2 rounded-2xl border border-[#FFC7B7] bg-[#FFF0EA] px-2.5 py-2 text-[9px] font-black uppercase tracking-wide text-[#B4161B] shadow-inner sm:flex sm:px-3 sm:text-[10px]">
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3.5 w-3.5" />
        Promo berakhir
      </span>
      <span className="rounded-full bg-white px-2 py-0.5 text-[#D83A1D] shadow-sm">{formatPromoRemaining(promotion.ends_at)}</span>
    </div>
  )
}

function PromoPrice({ priceLabel, originalPriceLabel, promotion }: { priceLabel: string; originalPriceLabel?: string; promotion?: SosmedPromotionPrice }) {
  const promoValue = formatPromoValue(promotion)

  return (
    <div className="flex flex-col gap-1">
      {promotion ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#141414] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white sm:text-[9px]">Promo</span>
          {promoValue ? <span className="hidden rounded-full bg-[#FFE0D5] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#B4161B] sm:inline-flex sm:text-[9px]">{promoValue}</span> : null}
        </div>
      ) : null}
      {originalPriceLabel ? <span className="text-[9px] font-bold text-gray-400 line-through sm:text-sm">{originalPriceLabel}</span> : null}
      <span className={`text-[16px] font-black tracking-tight sm:text-3xl ${promotion ? 'text-[#B4161B]' : 'text-[#141414]'}`}>{priceLabel}</span>
    </div>
  )
}

function BundleCard({ bundle }: { bundle: SosmedBundleProductCard }) {
  const checkoutHref = bundle.variantKey
    ? `/product/sosmed/checkout?bundle=${encodeURIComponent(bundle.bundleKey)}&variant=${encodeURIComponent(bundle.variantKey)}`
    : '/product/sosmed'
  const canCheckoutBundle = Boolean(bundle.variantKey)
  const mobileTitleMatch = bundle.buyerTitle.match(/^(.*?)\s*\(([^)]+)\)$/)
  const mobileTitle = mobileTitleMatch?.[1] ?? bundle.buyerTitle
  const mobileLevel = mobileTitleMatch?.[2]
  const hasPromo = Boolean(bundle.promotion)

  return (
    <article
      data-anime="sosmed-card"
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        hasPromo
          ? 'border-[#D83A1D] bg-[radial-gradient(circle_at_top_left,#FFE0D5_0%,#FFF7F1_34%,#FFFFFF_72%)] shadow-[0_18px_44px_rgba(216,58,29,0.18)] ring-2 ring-[#FFB199]/45 sm:ring-4 sm:ring-[#FFB199]/35'
          : bundle.isRecommended
            ? 'border-[#FF9B80] bg-gradient-to-b from-[#FFF8F5] to-white ring-2 ring-[#FFD5C8]/20 sm:ring-4 sm:ring-[#FFD5C8]/25'
            : 'border-[#EAEAEA] bg-white hover:border-[#FF9B80]/50'
      }`}
    >
      <PromoRibbon promotion={bundle.promotion} />

      {!hasPromo && bundle.isRecommended ? <RecommendedSash /> : null}

      <div className={`flex flex-col flex-grow p-3 sm:p-6 ${hasPromo ? 'pt-8 sm:pt-14' : ''}`}>
        <div className="mb-3 flex items-start justify-between gap-2 sm:mb-5 sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 ${bundle.tone}`}>
              <PlatformBrandIcon platformIcon={bundle.platformIcon} className="h-[18px] w-[18px] text-[#141414] sm:h-6 sm:w-6" />
            </div>
            <span className={`mt-0.5 max-w-[88px] truncate rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider sm:mt-1 sm:max-w-[130px] sm:px-3 sm:py-1 sm:text-[9px] ${
              bundle.isRecommended ? 'bg-[#FF5733] text-white shadow-sm' : 'border border-[#EBEBEB] bg-gray-50 text-gray-500'
            }`}>
              {bundle.platform}
            </span>
          </div>
          {!bundle.isRecommended && (
            <span className="max-w-[72px] truncate rounded-full bg-[#FFF3EF] px-1.5 py-0.5 text-[8px] font-bold text-[#FF5733] sm:max-w-none sm:px-2 sm:text-[9px]">
              {bundle.badge}
            </span>
          )}
        </div>

        <div>
          <h2 className="line-clamp-2 text-[13px] font-extrabold leading-tight text-[#141414] transition-colors group-hover:text-[#FF5733] sm:text-[19px]">
            <span className="sm:hidden">{mobileTitle}</span>
            <span className="hidden sm:inline">{bundle.buyerTitle}</span>
          </h2>
          {mobileLevel && (
            <span className="mt-1 inline-flex rounded-full bg-[#FFF3EF] px-2 py-0.5 text-[8px] font-bold text-[#FF5733] sm:hidden">
              {mobileLevel}
            </span>
          )}
          <p className="mt-1 line-clamp-1 text-[10px] leading-snug text-[#666] sm:mt-2.5 sm:line-clamp-2 sm:text-[13px] sm:leading-relaxed">
            {bundle.bestFor}
          </p>
        </div>

        <div className="mb-2 mt-2 sm:mb-7 sm:mt-6">
          <PromoPrice priceLabel={bundle.priceLabel} originalPriceLabel={bundle.originalPriceLabel} promotion={bundle.promotion} />
          <span className="line-clamp-1 text-[9px] font-semibold text-[#888] sm:text-[11px]">{bundle.packageLabel}</span>
          <PromoUrgencyBar promotion={bundle.promotion} />
        </div>

        <div className="hidden flex-grow space-y-3.5 sm:block">
          {bundle.benefits.map((benefit) => (
            <div key={`${bundle.key}-${benefit}`} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E8F8EC]">
                <CheckCircle2 className="h-3 w-3 text-[#22A447]" />
              </div>
              <span className="text-[13px] font-medium text-[#444] leading-snug">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 hidden flex-wrap gap-1 border-t border-dashed border-gray-200 pt-3 sm:mt-6 sm:flex sm:gap-1.5 sm:pt-5">
          {bundle.trustBadges.map((item) => (
            <span
              key={`${bundle.key}-${item}`}
              className="rounded-md bg-[#F8F8F8] px-1.5 py-0.5 text-[8px] font-bold text-[#777] sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[10px]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-[#FAFAFA] sm:grid sm:grid-cols-2 sm:gap-0">
        <Link
          href={checkoutHref}
          aria-disabled={!canCheckoutBundle}
          className={`hidden h-14 items-center justify-center px-1 text-center text-[12px] font-bold leading-tight transition sm:inline-flex ${
            canCheckoutBundle ? 'text-[#666] hover:bg-gray-100 hover:text-[#141414]' : 'pointer-events-none text-[#AAA]'
          }`}
        >
          Detail Paket
        </Link>
        <Link
          href={checkoutHref}
          aria-disabled={!canCheckoutBundle}
          className={`inline-flex h-9 w-full items-center justify-center gap-1 px-1 text-center text-[10px] font-extrabold leading-tight transition sm:h-14 sm:gap-1.5 sm:text-[12px] ${
            !canCheckoutBundle
              ? 'pointer-events-none bg-gray-200 text-gray-500'
              : hasPromo
                ? 'bg-[linear-gradient(110deg,#B4161B,#FF5733_58%,#FF9B31)] text-white hover:brightness-105'
                : bundle.isRecommended
                  ? 'bg-[#FF5733] text-white hover:bg-[#E64A2E]'
                  : 'bg-[#141414] text-white hover:bg-[#333]'
          }`}
        >
          {canCheckoutBundle ? (
            hasPromo ? <><span className="sm:hidden">Ambil</span><span className="hidden sm:inline">Ambil Promo</span></> : 'Pilih Paket'
          ) : 'Segera Hadir'} <ArrowRight className="hidden h-3.5 w-3.5 sm:block" />
        </Link>
      </div>
    </article>
  )
}

export default function ProductSosmedLandingPage() {
  const animationRootRef = useRef<HTMLElement | null>(null)
  const [services, setServices] = useState<SosmedService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
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
      .finally(() => {
        if (alive) setServicesLoading(false)
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

  const cards = useMemo(() => sortPromoAndRecommendedFirst(buildSosmedServiceCards(services)), [services])
  const bundleCards = useMemo(() => sortPromoAndRecommendedFirst(buildSosmedBundleProductCards(bundlePackages)), [bundlePackages])
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
              Naikkan performa akun sosmed kamu dengan paket aman, cepat diproses, dan tanpa perlu password.
            </p>
          </header>

          <div className="mb-5 flex flex-wrap justify-center gap-1.5 rounded-2xl border border-[#FFE2CF]/70 bg-white/70 p-2 text-[10px] shadow-sm sm:mb-6 sm:grid sm:grid-cols-3 sm:gap-2 sm:bg-white sm:p-3 sm:text-xs">
            <span data-anime="sosmed-trust-badge" className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#F2FCEB] px-2.5 py-1.5 font-semibold text-[#2F6B1A] sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2">
              <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Tanpa password</span>
              <span className="hidden sm:inline">Tanpa perlu password</span>
            </span>
            <span data-anime="sosmed-trust-badge" className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#EDF4FF] px-2.5 py-1.5 font-semibold text-[#1E4F9B] sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2">
              <Clock3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Proses cepat</span>
              <span className="hidden sm:inline">Mulai diproses cepat</span>
            </span>
            <span data-anime="sosmed-trust-badge" className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FFF3EA] px-2.5 py-1.5 font-semibold text-[#9A4B16] sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Garansi tersedia</span>
              <span className="hidden sm:inline">Garansi jelas kalau tersedia</span>
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
              {servicesLoading ? (
                <DigiLoadingCardGrid count={6} />
              ) : (
              <div className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-3">
              {paginatedCards.map((service) => {
              const checkoutHref = `/product/sosmed/checkout?service=${encodeURIComponent(service.code)}`
              const ServiceIcon = iconForPlatform(service.platformIcon)
              const isRecommended = service.isRecommended
              const hasPromo = Boolean(service.promotion)

              return (
                <article
                  key={service.key}
                  data-anime="sosmed-card"
                  className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    hasPromo
                      ? 'border-[#D83A1D] bg-[radial-gradient(circle_at_top_left,#FFE0D5_0%,#FFF7F1_34%,#FFFFFF_72%)] shadow-[0_18px_44px_rgba(216,58,29,0.18)] ring-4 ring-[#FFB199]/35'
                      : isRecommended
                        ? 'border-[#FF9B80] bg-gradient-to-b from-[#FFF8F5] to-white ring-4 ring-[#FFD5C8]/25'
                        : 'border-[#EAEAEA] bg-white hover:border-[#FF9B80]/50'
                  }`}
                >
                  <PromoRibbon promotion={service.promotion} />

                  {!hasPromo && isRecommended ? <RecommendedSash /> : null}

                  <div className={`flex flex-col flex-grow p-3 sm:p-6 ${hasPromo ? 'pt-8 sm:pt-14' : ''}`}>
                    <div className="mb-3 flex items-start justify-between gap-2 sm:mb-5 sm:gap-3">
                      <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                        <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 ${service.tone}`}>
                          <ServiceIcon className="h-[18px] w-[18px] text-[#141414] sm:h-6 sm:w-6" />
                        </div>
                        <span className={`mt-0.5 max-w-[88px] truncate rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider sm:mt-1 sm:max-w-[130px] sm:px-3 sm:py-1 sm:text-[9px] ${
                          isRecommended ? 'bg-[#FF5733] text-white shadow-sm' : 'border border-[#EBEBEB] bg-gray-50 text-gray-500'
                        }`}>
                          {service.platform}
                        </span>
                      </div>
                      {!isRecommended && (
                        <span className="max-w-[72px] truncate rounded-full bg-[#FFF3EF] px-1.5 py-0.5 text-[8px] font-bold text-[#FF5733] sm:max-w-none sm:px-2 sm:text-[9px]">
                          {service.badge}
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="line-clamp-2 text-[13px] font-extrabold leading-tight text-[#141414] transition-colors group-hover:text-[#FF5733] sm:text-[19px]">{service.buyerTitle}</h2>
                      <p className="mt-1 line-clamp-1 text-[10px] leading-snug text-[#666] sm:mt-2.5 sm:line-clamp-2 sm:text-[13px] sm:leading-relaxed">
                        {service.bestFor}
                      </p>
                    </div>

                    <div className="mb-2 mt-2 sm:mb-7 sm:mt-6">
                      <PromoPrice priceLabel={service.priceLabel} originalPriceLabel={service.originalPrice ? formatCurrency(service.originalPrice) : undefined} promotion={service.promotion} />
                      <span className="line-clamp-1 text-[9px] font-semibold text-[#888] sm:text-[11px]">{service.packageLabel}</span>
                      <PromoUrgencyBar promotion={service.promotion} />
                    </div>

                    <div className="hidden flex-grow space-y-3.5 sm:block">
                      {service.benefits.map((benefit) => (
                        <div key={`${service.key}-${benefit}`} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E8F8EC]">
                            <CheckCircle2 className="h-3 w-3 text-[#22A447]" />
                          </div>
                          <span className="text-[13px] font-medium text-[#444] leading-snug">{benefit}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 hidden flex-wrap gap-1 border-t border-dashed border-gray-200 pt-3 sm:mt-6 sm:flex sm:gap-1.5 sm:pt-5">
                      {service.trustBadges.map((item) => (
                        <span
                          key={`${service.key}-${item}`}
                          className="rounded-md bg-[#F8F8F8] px-1.5 py-0.5 text-[8px] font-bold text-[#777] sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[10px]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-0 border-t border-gray-100 bg-[#FAFAFA]">
                    <Link
                      href={checkoutHref}
                      className="inline-flex h-9 items-center justify-center px-1 text-center text-[10px] font-bold leading-tight text-[#666] transition hover:bg-gray-100 hover:text-[#141414] sm:h-14 sm:text-[12px]"
                    >
                      Detail Layanan
                    </Link>
                    <Link
                      href={checkoutHref}
                      className={`inline-flex h-9 items-center justify-center gap-1 px-1 text-center text-[10px] font-extrabold leading-tight transition sm:h-14 sm:gap-1.5 sm:text-[12px] ${
                        hasPromo
                          ? 'bg-[linear-gradient(110deg,#B4161B,#FF5733_58%,#FF9B31)] text-white hover:brightness-105'
                          : isRecommended
                            ? 'bg-[#FF5733] text-white hover:bg-[#E64A2E]'
                            : 'bg-[#141414] text-white hover:bg-[#333]'
                      }`}
                    >
                      {hasPromo ? <><span className="sm:hidden">Ambil</span><span className="hidden sm:inline">Ambil Promo</span></> : 'Pilih'} <ArrowRight className="hidden h-3.5 w-3.5 sm:block" />
                    </Link>
                  </div>
                                </article>
              )
            })}
              </div>
              )}

              {totalPages > 1 && !servicesLoading && (
                <div className="mt-4">
                  <div className="flex items-center justify-center gap-2 sm:hidden">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      aria-label="Halaman sebelumnya"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="inline-flex h-9 min-w-24 items-center justify-center rounded-full border border-[#FFD5C8] bg-[#FFF8F5] px-4 text-xs font-extrabold text-[#FF5733] shadow-sm">
                      {currentPage} / {totalPages}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      aria-label="Halaman berikutnya"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="hidden items-center justify-center gap-2 sm:flex">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex flex-wrap items-center gap-1">
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
              <div className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-3">
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
