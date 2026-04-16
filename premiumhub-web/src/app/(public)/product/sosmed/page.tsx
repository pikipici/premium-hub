"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Clock3,
  Heart,
  MessageCircle,
  PlayCircle,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { sosmedService as sosmedServiceApi } from '@/services/sosmedService'
import type { SosmedService } from '@/types/sosmedService'

type SosmedServiceCard = {
  key: string
  code: string
  title: string
  icon: LucideIcon
  summary: string
  platform: string
  badge: string
  tone: string
  minOrder: string
  startTime: string
  refill: string
  eta: string
  priceStart: string
  pricePer1k: string
  trustBadges: string[]
}

type SosmedServicePreset = Omit<SosmedServiceCard, 'key'>

const FALLBACK_SERVICES: SosmedServicePreset[] = [
  {
    code: 'ig-followers-id',
    title: 'IG Followers Indonesia Aktif',
    icon: Users,
    summary: 'Followers bertahap untuk ningkatin trust profile dan social proof akun bisnis.',
    platform: 'Instagram',
    badge: 'Best Seller',
    tone: 'from-[#EEF8FF] to-[#DCEFFF]',
    minOrder: '100',
    startTime: '5-15 menit',
    refill: '30 hari',
    eta: '2-12 jam',
    priceStart: 'Rp 28.000',
    pricePer1k: '≈ Rp 28 / 1K',
    trustBadges: ['No Password', 'Gradual Delivery', 'Refill 30 Hari'],
  },
  {
    code: 'ig-likes-premium',
    title: 'IG Likes Premium',
    icon: Heart,
    summary: 'Boost likes untuk naikin engagement rate dan bantu post kelihatan lebih kredibel.',
    platform: 'Instagram',
    badge: 'Fast Start',
    tone: 'from-[#FFF1F3] to-[#FFE1E7]',
    minOrder: '50',
    startTime: 'Instan',
    refill: 'Opsional',
    eta: '< 6 jam',
    priceStart: 'Rp 16.000',
    pricePer1k: '≈ Rp 16 / 1K',
    trustBadges: ['No Password', 'Real Interaction', 'High Retention'],
  },
  {
    code: 'tiktok-reels-views',
    title: 'TikTok/Reels Views',
    icon: PlayCircle,
    summary: 'Paket views untuk dorong momentum konten video baru atau campaign musiman.',
    platform: 'TikTok • Instagram Reels',
    badge: 'Trending Boost',
    tone: 'from-[#FFFBEA] to-[#FFF3C9]',
    minOrder: '1.000',
    startTime: '10-30 menit',
    refill: 'N/A',
    eta: '6-24 jam',
    priceStart: 'Rp 22.000',
    pricePer1k: '≈ Rp 22 / 1K',
    trustBadges: ['No Password', 'Stable Delivery', 'Campaign Friendly'],
  },
  {
    code: 'komentar-aktif-id',
    title: 'Komentar Aktif Indonesia',
    icon: MessageCircle,
    summary: 'Komentar random/custom untuk ngasih sinyal diskusi aktif di post lu.',
    platform: 'Instagram • TikTok',
    badge: 'Custom Text',
    tone: 'from-[#F4F0FF] to-[#E8DEFF]',
    minOrder: '10',
    startTime: '30-90 menit',
    refill: 'Opsional',
    eta: '6-24 jam',
    priceStart: 'Rp 35.000',
    pricePer1k: '≈ Rp 350 / 10',
    trustBadges: ['No Password', 'Natural Pattern', 'Flexible Campaign'],
  },
  {
    code: 'share-save-booster',
    title: 'Share & Save Booster',
    icon: Share2,
    summary: 'Tambahan sinyal distribusi biar algoritma baca konten lu punya potensi sebar tinggi.',
    platform: 'Instagram • TikTok',
    badge: 'Discovery Push',
    tone: 'from-[#ECFFFA] to-[#D6FFF2]',
    minOrder: '25',
    startTime: '15-45 menit',
    refill: 'N/A',
    eta: '< 12 jam',
    priceStart: 'Rp 19.000',
    pricePer1k: '≈ Rp 19 / 1K',
    trustBadges: ['No Password', 'Gradual Delivery', 'Algorithm Friendly'],
  },
]

const ICON_BY_CATEGORY_CODE: Record<string, LucideIcon> = {
  followers: Users,
  likes: Heart,
  views: PlayCircle,
  comments: MessageCircle,
  shares: Share2,
}

const THEME_TO_TONE: Record<string, string> = {
  blue: 'from-[#EEF8FF] to-[#DCEFFF]',
  pink: 'from-[#FFF1F3] to-[#FFE1E7]',
  yellow: 'from-[#FFFBEA] to-[#FFF3C9]',
  purple: 'from-[#F4F0FF] to-[#E8DEFF]',
  mint: 'from-[#ECFFFA] to-[#D6FFF2]',
  orange: 'from-[#FFF4EC] to-[#FFE8D8]',
  gray: 'from-[#F4F4F2] to-[#ECECEA]',
}

function cleanValue(value: string | null | undefined, fallback: string) {
  const trimmed = (value || '').trim()
  return trimmed || fallback
}

function normalizeTrustBadges(items: string[] | null | undefined, fallback: string[]) {
  const cleaned = (items || []).map((item) => item.trim()).filter(Boolean)
  if (cleaned.length > 0) return cleaned.slice(0, 8)
  return fallback
}

function mapSosmedServicesToCards(items: SosmedService[]): SosmedServiceCard[] {
  if (!items.length) {
    return FALLBACK_SERVICES.map((service, index) => ({
      key: `${service.code}-${index}`,
      ...service,
    }))
  }

  const sorted = [...items].sort((left, right) => {
    const leftSort = left.sort_order ?? 100
    const rightSort = right.sort_order ?? 100
    if (leftSort !== rightSort) return leftSort - rightSort
    return (left.code || '').localeCompare(right.code || '')
  })

  return sorted.map((item, index) => {
    const fallback = FALLBACK_SERVICES[index % FALLBACK_SERVICES.length]
    const icon = ICON_BY_CATEGORY_CODE[item.category_code || ''] || fallback.icon
    const tone = THEME_TO_TONE[(item.theme || '').toLowerCase()] || fallback.tone

    return {
      key: item.id || item.code || `${fallback.code}-${index}`,
      code: cleanValue(item.code, fallback.code),
      title: cleanValue(item.title, fallback.title),
      icon,
      summary: cleanValue(item.summary, fallback.summary),
      platform: cleanValue(item.platform_label, fallback.platform),
      badge: cleanValue(item.badge_text, fallback.badge),
      tone,
      minOrder: cleanValue(item.min_order, fallback.minOrder),
      startTime: cleanValue(item.start_time, fallback.startTime),
      refill: cleanValue(item.refill, fallback.refill),
      eta: cleanValue(item.eta, fallback.eta),
      priceStart: cleanValue(item.price_start, fallback.priceStart),
      pricePer1k: cleanValue(item.price_per_1k, fallback.pricePer1k),
      trustBadges: normalizeTrustBadges(item.trust_badges, fallback.trustBadges),
    }
  })
}

export default function ProductSosmedLandingPage() {
  const [services, setServices] = useState<SosmedService[]>([])

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

    return () => {
      alive = false
    }
  }, [])

  const cards = useMemo(() => mapSosmedServicesToCards(services), [services])

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#141414] md:text-4xl">Sosmed SMM</h1>
            <p className="mt-2 text-sm text-[#888]">
              Pilih layanan SMM siap beli: harga jelas, SLA jelas, dan CTA langsung checkout.
            </p>
          </header>

          <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#DDEBD4] bg-[#F2FCEB] px-3 py-1 font-semibold text-[#2F6B1A]">
              <ShieldCheck className="h-3.5 w-3.5" /> No Password
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D7E7FF] bg-[#EDF4FF] px-3 py-1 font-semibold text-[#1E4F9B]">
              <Clock3 className="h-3.5 w-3.5" /> Fast Start
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#FFE2CF] bg-[#FFF3EA] px-3 py-1 font-semibold text-[#9A4B16]">
              <Sparkles className="h-3.5 w-3.5" /> Refill Available
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((service) => {
              const nextTarget = encodeURIComponent(`/product/sosmed?service=${service.code}`)

              return (
                <article
                  key={service.key}
                  className="group flex h-full flex-col rounded-2xl border border-[#EBEBEB] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${service.tone}`}>
                      <service.icon className="h-5 w-5 text-[#141414]" />
                    </div>

                    <span className="rounded-full border border-[#FFD5C8] bg-[#FFF3EF] px-2.5 py-1 text-[11px] font-bold text-[#FF5733]">
                      {service.badge}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#666]">{service.platform}</p>
                    <h2 className="mt-1 text-lg font-extrabold text-[#141414]">{service.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#666]">{service.summary}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-[#EFEFEB] bg-[#FAFAF8] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#888]">Min Order</p>
                      <p className="mt-0.5 text-xs font-bold text-[#141414]">{service.minOrder}</p>
                    </div>
                    <div className="rounded-lg border border-[#EFEFEB] bg-[#FAFAF8] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#888]">Start</p>
                      <p className="mt-0.5 text-xs font-bold text-[#141414]">{service.startTime}</p>
                    </div>
                    <div className="rounded-lg border border-[#EFEFEB] bg-[#FAFAF8] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#888]">Refill</p>
                      <p className="mt-0.5 text-xs font-bold text-[#141414]">{service.refill}</p>
                    </div>
                    <div className="rounded-lg border border-[#EFEFEB] bg-[#FAFAF8] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#888]">Estimasi</p>
                      <p className="mt-0.5 text-xs font-bold text-[#141414]">{service.eta}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#FFD5C8] bg-[#FFF6F2] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-[#A2572E]">Harga mulai</p>
                    <p className="text-lg font-extrabold text-[#141414]">{service.priceStart}</p>
                    <p className="text-xs text-[#666]">{service.pricePer1k}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {service.trustBadges.map((item) => (
                      <span
                        key={`${service.key}-${item}`}
                        className="rounded-full border border-[#EBEBEB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#666]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Link
                      href={`/register?next=${nextTarget}`}
                      className="inline-flex items-center justify-center gap-1 rounded-full bg-[#FF5733] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#e64d2e]"
                    >
                      Beli Sekarang <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/login?next=${nextTarget}`}
                      className="inline-flex items-center justify-center rounded-full border border-[#141414] px-3 py-2.5 text-xs font-semibold text-[#141414] transition hover:bg-[#141414] hover:text-white"
                    >
                      Detail Paket
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>

          <section className="mt-8 rounded-2xl border border-[#FFD5C8] bg-[#FFF3EF] p-6 text-center">
            <h2 className="text-xl font-extrabold text-[#141414]">Ready jualan kebutuhan SMM</h2>
            <p className="mt-2 text-sm text-[#666]">
              Masuk atau bikin akun dulu, lalu langsung scale campaign client dari dashboard lu.
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
