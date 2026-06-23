"use client"

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Megaphone,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Users,
  Zap,
  PackageCheck,
} from 'lucide-react'

import { sosmedHeroSlideService } from '@/services/sosmedHeroSlideService'
import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { DigiLoadingCardGrid } from '@/components/shared/DigiLoading'
import HeroStripPanel, { type HeroSlideContent } from '@/components/sosmed-koprol/HeroStripPanel'
import SectionHeader from '@/components/sosmed-koprol/SectionHeader'
import ServiceCardCompact from '@/components/sosmed-koprol/ServiceCardCompact'
import HotPickCard from '@/components/sosmed-koprol/HotPickCard'
import PromoSavingCard from '@/components/sosmed-koprol/PromoSavingCard'
import BundlePromoCard from '@/components/sosmed-koprol/BundlePromoCard'
import { buildSosmedBundleProductCards, type SosmedBundleProductCard } from '@/lib/sosmedBundlingCards'
import { buildSosmedServiceCards, platformIconKeyFor, type SosmedPlatformIconKey, type SosmedProductCard } from '@/lib/sosmedProductCards'
import { sosmedBundleService as sosmedBundleServiceApi } from '@/services/sosmedBundleService'
import { sosmedService as sosmedServiceApi } from '@/services/sosmedService'
import type { SosmedBundlePackage } from '@/types/sosmedBundle'
import type { SosmedService, SosmedPromotionPrice } from '@/types/sosmedService'

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

function iconForPlatform(key: SosmedPlatformIconKey) {
  return PLATFORM_ICON_COMPONENTS[key] ?? PLATFORM_ICON_COMPONENTS.generic
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function discountLabelFor(promotion?: SosmedPromotionPrice, original?: number, final?: number) {
  if (promotion?.discount_type === 'percent' && promotion.discount_value > 0) {
    return `-${promotion.discount_value}%`
  }
  if (original && final && original > final && original > 0) {
    const pct = Math.round(((original - final) / original) * 100)
    if (pct > 0) return `-${pct}%`
  }
  return undefined
}

function savingLabelFor(promotion?: SosmedPromotionPrice, original?: number, final?: number) {
  if (promotion) {
    const amount = promotion.discount_amount && promotion.discount_amount > 0
      ? promotion.discount_amount
      : original && final && original > final
        ? original - final
        : 0
    if (amount > 0) return `Hemat ${formatCurrency(amount)}`
  }
  if (original && final && original > final) {
    return `Hemat ${formatCurrency(original - final)}`
  }
  return undefined
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

function isPromoService(card: SosmedProductCard) {
  if (card.promotion) return true
  if (card.originalPrice && card.checkoutPrice && card.originalPrice > card.checkoutPrice) return true
  return false
}

function isHotService(card: SosmedProductCard) {
  // Hot = explicitly recommended (only). Promos go to "Promo Diskon" section.
  // This split avoids showing the same card in both sections.
  return card.isRecommended && !isPromoService(card)
}

/**
 * Cap visible cards per section: mobile 4 (2 rows of 2) / tablet 6 (2 rows of 3) /
 * desktop 4 (1 row of 4). When section is expanded ("Lihat semua" clicked) all
 * cards are visible. Visibility is CSS-only so we keep SSR-friendly markup
 * and don't reflow when toggling. `h-full` keeps the inner card stretching
 * inside the CSS Grid row when the wrapper div sits between grid and card.
 */
function cardVisibilityClass(idx: number, expanded: boolean, sectionFilter?: string | null): string {
  if (expanded || sectionFilter) return 'h-full'
  if (idx < 4) return 'h-full'
  if (idx < 6) return 'hidden h-full sm:block lg:hidden'
  return 'hidden'
}

/** Returns true when section has more cards than the visible cap (4 mobile, 6 tablet, 4 desktop = max 6). */
function shouldOfferSeeAll(total: number, sectionId?: string | null) {
  if (sectionId) return false // section filter active, show all
  return total > 6
}

function FilterStrip({ platforms, activePlatform, setActivePlatform, allCardsLength, platformCounts }: {
  platforms: string[]
  activePlatform: string
  setActivePlatform: (p: string) => void
  allCardsLength: number
  platformCounts: Record<string, number>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
  }

  const slotLeft = canScrollLeft ? (
    <button key="scroll-left" onClick={() => scroll('left')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 transition hover:bg-gray-50" aria-label="Scroll kiri">
      <ChevronLeft className="h-4 w-4 text-gray-500" />
    </button>
  ) : null
  const slotRight = canScrollRight ? (
    <button key="scroll-right" onClick={() => scroll('right')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 transition hover:bg-gray-50" aria-label="Scroll kanan">
      <ChevronRight className="h-4 w-4 text-gray-500" />
    </button>
  ) : null

  const pills = platforms.map((p) => {
    const count = p === 'Semua' ? allCardsLength : (platformCounts[p] || 0)
    const iconKey = p === 'Semua' ? null : platformIconKeyFor(p)
    const IconComp = iconKey ? (PLATFORM_ICON_COMPONENTS[iconKey] ?? null) : null
    return (
      <button key={p} onClick={() => setActivePlatform(p)}
        className={'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all sm:px-3.5 sm:text-xs' + (activePlatform === p ? ' bg-[#141414] text-white shadow-md' : ' bg-white text-gray-500 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-gray-900')}
      >
        {IconComp ? <IconComp className="h-3.5 w-3.5" /> : null}
        <span>{p}</span>
        <span className={'ml-0.5 rounded-full px-1.5 py-[1px] text-[9px] font-semibold sm:text-[10px]' + (activePlatform === p ? ' bg-white/20 text-white/80' : ' bg-gray-100 text-gray-400')}>{count}</span>
      </button>
    )
  })

  return (
    <div className="mt-4 flex items-center gap-1 sm:mt-5">
      {slotLeft}
      <div ref={scrollRef} className="flex flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max justify-center gap-1.5">{pills}</div>
      </div>
      {slotRight}
    </div>
  )
}

export default function ProductSosmedLandingPage() {
  const searchParams = useSearchParams()
  const sectionFilter = searchParams.get('section')

  const [services, setServices] = useState<SosmedService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [bundlePackages, setBundlePackages] = useState<SosmedBundlePackage[]>([])
  const [bundleCatalogState, setBundleCatalogState] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [activePlatform, setActivePlatform] = useState('Semua')
  const expandedSections = useMemo(() => {
    return sectionFilter ? new Set([sectionFilter]) : new Set<string>()
  }, [sectionFilter])

  const isExpanded = (id: string) => expandedSections.has(id)

  // Scroll to section when section filter activates
  useEffect(() => {
    if (!sectionFilter) return
    const id = sectionFilter === 'layanan' ? 'layanan' : sectionFilter
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => clearTimeout(timer)
  }, [sectionFilter])

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

  const allCards = useMemo(() => sortPromoAndRecommendedFirst(buildSosmedServiceCards(services)), [services])
  const bundleCards = useMemo(() => sortPromoAndRecommendedFirst(buildSosmedBundleProductCards(bundlePackages)), [bundlePackages])

  const platforms = useMemo(() => {
    const unique = Array.from(new Set(allCards.map((c) => c.platform)))
    return ['Semua', ...unique.sort()]
  }, [allCards])

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of allCards) {
      counts[c.platform] = (counts[c.platform] || 0) + 1
    }
    return counts
  }, [allCards])

  const filteredCards = useMemo(() => {
    if (activePlatform === 'Semua') return allCards
    return allCards.filter((c) => c.platform === activePlatform)
  }, [allCards, activePlatform])

  const hotCards = useMemo(() => filteredCards.filter(isHotService).slice(0, 9), [filteredCards])
  const promoCards = useMemo(() => filteredCards.filter(isPromoService).slice(0, 12), [filteredCards])

  // Layanan = sisa yang tidak masuk Hot/Promo, biar ngga ke-render dobel.
  const layananCards = useMemo(() => {
    const featuredKeys = new Set<string>([
      ...hotCards.map((c) => c.key),
      ...promoCards.map((c) => c.key),
    ])
    return filteredCards.filter((c) => !featuredKeys.has(c.key))
  }, [filteredCards, hotCards, promoCards])

  const [heroSlideCodes, setHeroSlideCodes] = useState<string[]>([])

  const heroFeatured = useMemo(() => {
    const codes = heroSlideCodes.length > 0
      ? new Set(heroSlideCodes)
      : null
    const featured = codes
      ? allCards.filter((c) => codes.has(c.code))
      : []
    return featured.map((card) => {
      const Icon = iconForPlatform(card.platformIcon)
      return {
        key: card.key,
        href: `/product/sosmed/checkout?service=${encodeURIComponent(card.code)}`,
        title: card.buyerTitle,
        platformLabel: card.platform,
        priceLabel: card.priceLabel,
        badgeText: card.badge,
        toneClass: card.tone,
        Icon,
      }
    })
  }, [allCards, heroSlideCodes])

  const HERO_SLIDE_DEFAULT = useMemo(() => ({
    key: 'sosmed-hero',
    title: 'Sosmed Murah, Aman, Cepat',
    subtitle: 'Followers, Likes, Views, dan engagement asli buat akun lo. Tanpa password, langsung masuk wallet.',
    ctaLabel: 'Mulai Order',
    ctaHref: '#layanan',
    Icon: Sparkles as ComponentType<SVGProps<SVGSVGElement>>,
  }), [])

  const heroIconMap: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = useMemo(() => ({
    Sparkles, Flame, Megaphone, Zap, Star, Rocket, Crown, TrendingUp,
  }), [])

  const [heroSlides, setHeroSlides] = useState<HeroSlideContent[]>([])

  useEffect(() => {
    sosmedHeroSlideService.getPublic().then((res) => {
      if (!res.success || !res.data?.length) return
      const mapped = res.data.map((item) => {
        const IconComp = (heroIconMap[item.icon] || Sparkles) as ComponentType<SVGProps<SVGSVGElement>>
        return {
          key: item.id || item.page_key,
          title: item.title,
          subtitle: item.subtitle || '',
          ctaLabel: item.cta_label || '',
          ctaHref: item.cta_href || '#layanan',
          Icon: IconComp,
          bgColor: item.background_color || '#141414',
          bgImage: item.background_image_url || '',
        }
      })
      setHeroSlides(mapped)
      if (res.data[0]?.featured_service_codes?.length) {
        setHeroSlideCodes(res.data[0].featured_service_codes)
      }
    }).catch(() => {})
  }, [heroIconMap])

  const displaySlides = heroSlides.length > 0 ? heroSlides : [HERO_SLIDE_DEFAULT]

  return (
    <>
      <Navbar />

      <main className="bg-[#F4F5F8]">
        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Hero strip — koprol layout: 3+2 columns */}
          <HeroStripPanel
            slides={displaySlides}
          />

          {/* Trust badges row */}
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl bg-white px-4 py-3 text-[12px] font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/5 sm:text-[13px]">
            <span className="inline-flex items-center gap-1.5 text-[#2F6B1A]">
              <ShieldCheck className="h-3.5 w-3.5" /> Tanpa password
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#1E4F9B]">
              <Clock3 className="h-3.5 w-3.5" /> Proses cepat
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#9A4B16]">
              <Sparkles className="h-3.5 w-3.5" /> Garansi tersedia
            </span>
          </div>

          {/* Featured product cards */}
          {heroFeatured.length > 0 ? (
            <section className="mt-7 sm:mt-10">
              <SectionHeader
                icon={
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF5733] text-white">
                    <Star className="h-4 w-4" />
                  </span>
                }
                title="Produk Unggulan"
              />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 lg:grid-cols-4">
                {heroFeatured.map((item) => {
                  const Icon = item.Icon
                  return (
                    <ServiceCardCompact
                      key={item.key}
                      href={item.href}
                      title={item.title}
                      platformLabel={item.platformLabel}
                      priceLabel={item.priceLabel}
                      badgeText={item.badgeText}
                      Icon={Icon}
                      toneClass={item.toneClass}
                    />
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Section filter banner */}
          {sectionFilter && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#141414] px-4 py-3 text-white">
              <div className="text-sm font-bold capitalize">
                {sectionFilter === 'layanan' ? 'Semua Layanan' :
                 sectionFilter === 'hot' ? 'Hot Pilihan' :
                 sectionFilter === 'promo' ? 'Promo Diskon' :
                 sectionFilter === 'bundle' ? 'Paket Spesial' : 'Semua Produk'}
              </div>
              <Link href="/product/sosmed" className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25 transition">
                <ArrowLeft className="h-3 w-3" /> Kembali
              </Link>
            </div>
          )}

          {/* Platform filter chip strip */}
          {platforms.length > 1 && !sectionFilter ? (
            <FilterStrip platforms={platforms} activePlatform={activePlatform} setActivePlatform={setActivePlatform} allCardsLength={allCards.length} platformCounts={platformCounts} />
          ) : null}

          {/* Layanan section (Produk koprol) */}
          {(!sectionFilter || sectionFilter === 'layanan') ? (
          <section id="layanan" className="mt-7 sm:mt-10">
            <SectionHeader
              icon={
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-800 text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
              }
              title="Layanan"
              action={
                shouldOfferSeeAll(layananCards.length, sectionFilter) ? (
                  <Link
                    href="?section=layanan"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#FF5733] transition hover:bg-[#FFF3EF] sm:text-xs"
                  >
                    Lihat semua
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : undefined
              }
            />
            {servicesLoading ? (
              <DigiLoadingCardGrid count={6} />
            ) : layananCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#FFD5C8] bg-white px-4 py-8 text-center text-sm font-semibold text-[#666]">
                {filteredCards.length === 0
                  ? 'Belum ada layanan untuk platform ini.'
                  : 'Semua layanan sudah ada di Pilihan/Promo di atas.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {layananCards.map((card, idx) => {
                  const Icon = iconForPlatform(card.platformIcon)
                  return (
                    <div key={card.key} className={cardVisibilityClass(idx, isExpanded('layanan'), sectionFilter)}>
                      <ServiceCardCompact
                        href={`/product/sosmed/checkout?service=${encodeURIComponent(card.code)}`}
                        title={card.buyerTitle}
                        platformLabel={card.platform}
                        priceLabel={card.priceLabel}
                        badgeText={card.badge}
                        Icon={Icon}
                        toneClass={card.tone}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
          ) : null}

          {/* Hot Pilihan section (Hot Produk koprol) */}
          {(!sectionFilter || sectionFilter === 'hot') && hotCards.length > 0 ? (
            <section className="mt-7 sm:mt-10">
              <SectionHeader
                icon={<Flame className="h-4 w-4 text-orange-500" />}
                title="Hot Pilihan"
                action={
                  shouldOfferSeeAll(hotCards.length, sectionFilter) ? (
                    <Link
                      href="?section=hot"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#FF5733] transition hover:bg-[#FFF3EF] sm:text-xs"
                    >
                      Lihat semua
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : undefined
                }
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {hotCards.map((card, idx) => {
                  const Icon = iconForPlatform(card.platformIcon)
                  const original = card.originalPrice
                  const final = card.checkoutPrice
                  const discount = discountLabelFor(card.promotion, original, final)
                  return (
                    <div key={`hot-${card.key}`} className={cardVisibilityClass(idx, isExpanded('hot'), sectionFilter)}>
                      <HotPickCard
                        href={`/product/sosmed/checkout?service=${encodeURIComponent(card.code)}`}
                        title={card.buyerTitle}
                        categoryLabel={card.badge || card.platform}
                        originalPriceLabel={original ? formatCurrency(original) : undefined}
                        priceLabel={card.priceLabel}
                        discountLabel={discount}
                        Icon={Icon}
                        toneClass={card.tone}
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Paket Spesial section (Bundling) */}
          {(!sectionFilter || sectionFilter === 'bundle') ? (
          <section className="mt-7 sm:mt-10">
            <SectionHeader
              icon={
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF5733] text-white">
                  <PackageCheck className="h-4 w-4" />
                </span>
              }
              title="Paket Spesial"
              action={
                shouldOfferSeeAll(bundleCards.length, sectionFilter) ? (
                  <Link
                    href="?section=bundle"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#FF5733] transition hover:bg-[#FFF3EF] sm:text-xs"
                  >
                    Lihat semua
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : undefined
              }
            />
            {bundleCatalogState === 'loading' ? (
              <div className="rounded-2xl border border-[#FFE2CF] bg-white px-4 py-3 text-center text-xs font-semibold text-[#9A4B16] shadow-sm">
                Memuat katalog Paket Spesial...
              </div>
            ) : bundleCatalogState === 'fallback' ? (
              <div className="rounded-2xl border border-[#FFE2CF] bg-[#FFF8F5] px-4 py-3 text-center text-xs font-semibold text-[#9A4B16] shadow-sm">
                Katalog belum siap, ini tampilan preview. Cek total harga di checkout.
              </div>
            ) : !bundleCards.length ? (
              <div className="rounded-2xl border border-dashed border-[#FFD5C8] bg-white px-4 py-8 text-center text-sm font-semibold text-[#666]">
                Paket Spesial belum tersedia. Cek lagi nanti.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {bundleCards.map((bundle: SosmedBundleProductCard, idx) => {
                  const Icon = iconForPlatform(bundle.platformIcon)
                  const checkoutHref = bundle.variantKey
                    ? `/product/sosmed/checkout?bundle=${encodeURIComponent(bundle.bundleKey)}&variant=${encodeURIComponent(bundle.variantKey)}`
                    : '/product/sosmed'
                  const promoDiscount = bundle.promotion?.discount_type === 'percent' && bundle.promotion.discount_value > 0
                    ? `-${bundle.promotion.discount_value}%`
                    : undefined
                  return (
                    <div key={bundle.key} className={cardVisibilityClass(idx, isExpanded('bundle'), sectionFilter)}>
                      <BundlePromoCard
                        href={checkoutHref}
                        title={bundle.buyerTitle}
                        subtitle={bundle.bestFor}
                        platformLabel={bundle.platform}
                        Icon={Icon}
                        toneClass={bundle.tone}
                        priceLabel={bundle.priceLabel}
                        originalPriceLabel={bundle.originalPriceLabel}
                        packageLabel={bundle.packageLabel}
                        isRecommended={bundle.isRecommended}
                        hasPromo={Boolean(bundle.promotion)}
                        promoDiscountLabel={promoDiscount}
                        canCheckout={Boolean(bundle.variantKey)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
          ) : null}

          {/* Promo Diskon section */}
          {(!sectionFilter || sectionFilter === 'promo') && promoCards.length > 0 ? (
            <section className="mt-7 sm:mt-10">
              <SectionHeader
                icon={
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white">
                    <Tag className="h-4 w-4" />
                  </span>
                }
                title="Promo Diskon"
                action={
                  shouldOfferSeeAll(promoCards.length, sectionFilter) ? (
                    <Link
                      href="?section=promo"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-rose-500 transition hover:bg-rose-50 sm:text-xs"
                    >
                      Lihat semua
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : undefined
                }
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {promoCards.map((card, idx) => {
                  const Icon = iconForPlatform(card.platformIcon)
                  const original = card.originalPrice
                  const final = card.checkoutPrice
                  const discount = discountLabelFor(card.promotion, original, final)
                  const saving = savingLabelFor(card.promotion, original, final)
                  return (
                    <div key={`promo-${card.key}`} className={cardVisibilityClass(idx, isExpanded('promo'), sectionFilter)}>
                      <PromoSavingCard
                        href={`/product/sosmed/checkout?service=${encodeURIComponent(card.code)}`}
                        title={card.buyerTitle}
                        categoryLabel={card.badge || card.platform}
                        originalPriceLabel={original ? formatCurrency(original) : undefined}
                        priceLabel={card.priceLabel}
                        discountLabel={discount}
                        savingLabel={saving}
                        Icon={Icon}
                        toneClass={card.tone}
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Help / CTA footer block */}
          <section className="mt-8 rounded-3xl border border-[#FFD5C8] bg-[#FFF3EF] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF5733] text-white">
                <Megaphone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-[#141414] sm:text-xl">Bingung pilih paket?</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#666]">
                  Paket hemat untuk coba dulu. Paket prioritas kalau butuh proses lebih cepat. Cek total harga di checkout.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/register?next=%2Fproduct%2Fsosmed"
                className="inline-flex items-center gap-1 rounded-full bg-[#FF5733] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e64d2e]"
              >
                Daftar <ArrowRight className="h-4 w-4" />
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
