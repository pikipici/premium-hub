"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import {
  ArrowRight,
  Clock3,
  Flame,
  Megaphone,
  Sparkles,
  ShieldCheck,
  Tag,
  Users,
  PackageCheck,
} from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { DigiLoadingCardGrid } from '@/components/shared/DigiLoading'
import HeroStripPanel from '@/components/sosmed-koprol/HeroStripPanel'
import SectionHeader from '@/components/sosmed-koprol/SectionHeader'
import ServiceCardCompact from '@/components/sosmed-koprol/ServiceCardCompact'
import HotPickCard from '@/components/sosmed-koprol/HotPickCard'
import PromoSavingCard from '@/components/sosmed-koprol/PromoSavingCard'
import BundlePromoCard from '@/components/sosmed-koprol/BundlePromoCard'
import { buildSosmedBundleProductCards, type SosmedBundleProductCard } from '@/lib/sosmedBundlingCards'
import { buildSosmedServiceCards, type SosmedPlatformIconKey, type SosmedProductCard } from '@/lib/sosmedProductCards'
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

export default function ProductSosmedLandingPage() {
  const [services, setServices] = useState<SosmedService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [bundlePackages, setBundlePackages] = useState<SosmedBundlePackage[]>([])
  const [bundleCatalogState, setBundleCatalogState] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [activePlatform, setActivePlatform] = useState('Semua')

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

  const heroFeatured = useMemo(() => {
    const top = allCards.slice(0, 2)
    return top.map((card) => {
      const Icon = iconForPlatform(card.platformIcon)
      return {
        key: card.key,
        href: `/product/sosmed/checkout?service=${encodeURIComponent(card.code)}`,
        title: card.buyerTitle,
        priceLabel: card.priceLabel,
        Icon,
      }
    })
  }, [allCards])

  return (
    <>
      <Navbar />

      <main className="bg-[#F4F5F8]">
        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Hero strip — koprol layout: 3+2 columns */}
          <HeroStripPanel
            slide={{
              key: 'sosmed-hero',
              title: 'Sosmed Murah, Aman, Cepat',
              subtitle: 'Followers, Likes, Views, dan engagement asli buat akun lo. Tanpa password, langsung masuk wallet.',
              ctaLabel: 'Mulai Order',
              ctaHref: '#layanan',
              Icon: Sparkles,
            }}
            featured={heroFeatured}
          />

          {/* Trust badges row */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-semibold sm:mt-5 sm:text-[13px]">
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

          {/* Platform filter chip strip */}
          {platforms.length > 1 ? (
            <div className="mt-5 flex w-full overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="mx-auto flex gap-2 px-1">
                {platforms.map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePlatform(p)}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                      activePlatform === p
                        ? 'bg-[#141414] text-white shadow-md'
                        : 'bg-white text-gray-500 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Layanan section (Produk koprol) */}
          <section id="layanan" className="mt-6 sm:mt-8">
            <SectionHeader
              title="Layanan"
              countLabel={layananCards.length > 3 ? `${layananCards.length} produk` : undefined}
              countTone="default"
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
                {layananCards.map((card) => {
                  const Icon = iconForPlatform(card.platformIcon)
                  return (
                    <ServiceCardCompact
                      key={card.key}
                      href={`/product/sosmed/checkout?service=${encodeURIComponent(card.code)}`}
                      title={card.buyerTitle}
                      categoryLabel={card.badge || card.platform}
                      isHighlight={card.isRecommended}
                      Icon={Icon}
                      toneClass={card.tone}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {/* Hot Pilihan section (Hot Produk koprol) */}
          {hotCards.length > 0 ? (
            <section className="mt-7 sm:mt-10">
              <SectionHeader
                icon={<Flame className="h-4 w-4 text-orange-500" />}
                title="Hot Pilihan"
                countLabel={`${hotCards.length} produk`}
                countTone="orange"
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {hotCards.map((card) => {
                  const Icon = iconForPlatform(card.platformIcon)
                  const original = card.originalPrice
                  const final = card.checkoutPrice
                  const discount = discountLabelFor(card.promotion, original, final)
                  return (
                    <HotPickCard
                      key={`hot-${card.key}`}
                      href={`/product/sosmed/checkout?service=${encodeURIComponent(card.code)}`}
                      title={card.buyerTitle}
                      categoryLabel={card.badge || card.platform}
                      originalPriceLabel={original ? formatCurrency(original) : undefined}
                      priceLabel={card.priceLabel}
                      discountLabel={discount}
                      Icon={Icon}
                      toneClass={card.tone}
                    />
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Paket Spesial section (Bundling) */}
          <section className="mt-7 sm:mt-10">
            <SectionHeader
              icon={
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF5733] text-white">
                  <PackageCheck className="h-4 w-4" />
                </span>
              }
              title="Paket Spesial"
              countLabel={bundleCards.length ? `${bundleCards.length} paket` : undefined}
              countTone="orange"
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
                {bundleCards.map((bundle: SosmedBundleProductCard) => {
                  const Icon = iconForPlatform(bundle.platformIcon)
                  const checkoutHref = bundle.variantKey
                    ? `/product/sosmed/checkout?bundle=${encodeURIComponent(bundle.bundleKey)}&variant=${encodeURIComponent(bundle.variantKey)}`
                    : '/product/sosmed'
                  const promoDiscount = bundle.promotion?.discount_type === 'percent' && bundle.promotion.discount_value > 0
                    ? `-${bundle.promotion.discount_value}%`
                    : undefined
                  return (
                    <BundlePromoCard
                      key={bundle.key}
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
                  )
                })}
              </div>
            )}
          </section>

          {/* Promo Diskon section */}
          {promoCards.length > 0 ? (
            <section className="mt-7 sm:mt-10">
              <SectionHeader
                icon={
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white">
                    <Tag className="h-4 w-4" />
                  </span>
                }
                title="Promo Diskon"
                countLabel={`${promoCards.length} produk`}
                countTone="rose"
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {promoCards.map((card) => {
                  const Icon = iconForPlatform(card.platformIcon)
                  const original = card.originalPrice
                  const final = card.checkoutPrice
                  const discount = discountLabelFor(card.promotion, original, final)
                  const saving = savingLabelFor(card.promotion, original, final)
                  return (
                    <PromoSavingCard
                      key={`promo-${card.key}`}
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
