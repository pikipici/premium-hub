"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, BarChart3, CheckCircle2, Rocket, ShieldCheck, WalletCards } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import {
  fallbackHomeProductCardsFromDefaultMenu,
  selectVisibleHomeProductCards,
  type HomeProductCardHref,
} from '@/lib/homeProductCards'
import {
  NAVBAR_MENU_CACHE_EVENT,
  normalizeNavbarMenuItems,
  readNavbarMenuCache,
  writeNavbarMenuCache,
} from '@/lib/navbarMenuCache'
import { navbarMenuSettingService } from '@/services/navbarMenuSettingService'
import { nokosPublicService } from '@/services/nokosPublicService'
import { sosmedService } from '@/services/sosmedService'

const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value)

export default function HomePage() {
  const [countriesCount, setCountriesCount] = useState<number | null>(null)
  const [sentTotalAllTime, setSentTotalAllTime] = useState<number | null>(null)
  const [sosmedServicesCount, setSosmedServicesCount] = useState<number | null>(null)
  const [visibleProductCards, setVisibleProductCards] = useState<HomeProductCardHref[]>(
    () => fallbackHomeProductCardsFromDefaultMenu()
  )

  useEffect(() => {
    let canceled = false

    nokosPublicService
      .getLandingSummary()
      .then((res) => {
        if (canceled || !res.success) return
        setCountriesCount(res.data.countries_count ?? 0)
        setSentTotalAllTime(res.data.sent_total_all_time ?? 0)
      })
      .catch(() => {
        // fail-open: keep fallback copy
      })

    sosmedService
      .list()
      .then((res) => {
        if (canceled || !res.success) return
        setSosmedServicesCount((res.data || []).length)
      })
      .catch(() => {
        // fail-open: keep fallback copy
      })

    return () => {
      canceled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadVisibleProductCards = async () => {
      const cachedItems = readNavbarMenuCache()
      if (cachedItems !== null) {
        setVisibleProductCards(selectVisibleHomeProductCards(cachedItems))
      }

      try {
        const res = await navbarMenuSettingService.publicList()
        if (cancelled) return
        if (!res.success) {
          if (readNavbarMenuCache() === null) {
            setVisibleProductCards(fallbackHomeProductCardsFromDefaultMenu())
          }
          return
        }

        const visibleItems = normalizeNavbarMenuItems(res.data || [])
        writeNavbarMenuCache(visibleItems)
        setVisibleProductCards(selectVisibleHomeProductCards(visibleItems))
      } catch {
        if (!cancelled && readNavbarMenuCache() === null) {
          setVisibleProductCards(fallbackHomeProductCardsFromDefaultMenu())
        }
      }
    }

    void loadVisibleProductCards()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleNavbarMenuCacheUpdate = () => {
      const cachedItems = readNavbarMenuCache()
      if (cachedItems !== null) {
        setVisibleProductCards(selectVisibleHomeProductCards(cachedItems))
      }
    }

    window.addEventListener(NAVBAR_MENU_CACHE_EVENT, handleNavbarMenuCacheUpdate)
    return () => {
      window.removeEventListener(NAVBAR_MENU_CACHE_EVENT, handleNavbarMenuCacheUpdate)
    }
  }, [])

  const nokosCoverageLabel = countriesCount !== null
    ? `Cakupan ${formatNumber(countriesCount)}+ negara`
    : 'Cakupan negara sedang dimuat'
  const nokosMiniStatLabel = sentTotalAllTime !== null
    ? `${formatNumber(sentTotalAllTime)}+ nomor terkirim`
    : 'Data penjualan sedang dimuat'

  const smmMiniStatLabel = sosmedServicesCount !== null
    ? `${formatNumber(sosmedServicesCount)}+ layanan aktif`
    : 'Data layanan sedang dimuat'
  const showNokosCard = visibleProductCards.includes('/product/nokos')
  const showSosmedCard = visibleProductCards.includes('/product/sosmed')
  const visibleCardsCount = Number(showNokosCard) + Number(showSosmedCard)
  const isSingleVisibleCard = visibleCardsCount === 1
  const hasVisibleCards = showNokosCard || showSosmedCard
  const cardsGridClass = isSingleVisibleCard
    ? 'grid gap-5 md:grid-cols-1 md:justify-items-center lg:gap-7'
    : 'grid gap-5 md:grid-cols-2 lg:gap-7'
  const productCardClass = isSingleVisibleCard
    ? 'relative w-full overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)] md:max-w-[640px] sm:p-6 lg:p-7'
    : 'relative overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)] sm:p-6 lg:p-7'

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-20 lg:pt-12">
          <header className="mx-auto mb-6 max-w-3xl text-center lg:mb-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#FFD9CF] bg-[#FFF0ED] px-4 py-1.5 text-xs font-bold text-[#FF5733]">
              <Rocket className="h-3.5 w-3.5" />
              Pilih Layanan Sesuai Kebutuhan
            </p>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] text-[#141414] sm:text-5xl">
              Semua kebutuhan digital, satu tempat.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#6B7280] sm:text-base">
              Beli nomor virtual OTP dan layanan SMM dengan proses cepat, pembayaran aman, plus refund otomatis kalau order gagal.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] font-bold text-[#3A3A3A] sm:mx-auto sm:max-w-xl sm:text-xs">
              <span className="inline-flex items-center justify-center gap-1 rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 shadow-[0_8px_18px_rgba(20,20,20,0.04)]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#FF5733]" />
                Aman
              </span>
              <span className="inline-flex items-center justify-center gap-1 rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 shadow-[0_8px_18px_rgba(20,20,20,0.04)]">
                <WalletCards className="h-3.5 w-3.5 text-[#FF5733]" />
                Refund
              </span>
              <span className="inline-flex items-center justify-center gap-1 rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 shadow-[0_8px_18px_rgba(20,20,20,0.04)]">
                <Rocket className="h-3.5 w-3.5 text-[#FF5733]" />
                Cepat
              </span>
            </div>
          </header>

          <div className={cardsGridClass}>
            {showNokosCard ? (
              <article className={productCardClass}>
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#FFF0ED]" />
                <p className="relative inline-flex rounded-full border border-[#FFD9CF] bg-[#FFF0ED] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#FF5733]">
                  Nomor Virtual OTP
                </p>
                <h2 className="relative mt-3 text-2xl font-extrabold tracking-tight text-[#141414]">
                  Verifikasi Cepat Pakai Nomor Virtual
                </h2>
                <p className="relative mt-2 text-sm leading-relaxed text-[#6B7280] md:text-[15px]">
                  Aktivasi akun lebih praktis tanpa pakai nomor pribadi.
                </p>

                <ul className="relative mt-4 space-y-2 text-sm text-[#2E2E2E]">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#FF5733]" />
                    {nokosCoverageLabel}
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#FF5733]" />
                    Auto-cancel + refund kalau OTP gagal
                  </li>
                </ul>

                <div className="relative mt-5 rounded-2xl border border-[#F2E6E2] bg-[#FFF9F7] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A06654]">Terpakai user</p>
                  <p className="mt-1 text-sm font-bold text-[#141414]">{nokosMiniStatLabel}</p>
                </div>

                <Link
                  href="/product/nokos"
                  className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-[#FF5733] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#E24A26]"
                >
                  Mulai Beli Nomor OTP
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ) : null}

            {showSosmedCard ? (
              <article className={productCardClass}>
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EEF4FF]" />
                <p className="relative inline-flex rounded-full border border-[#DCE9FF] bg-[#EEF4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#2853A6]">
                  Jasa SMM
                </p>
                <h2 className="relative mt-3 text-2xl font-extrabold tracking-tight text-[#141414]">
                  Naikin Follower, Viewer, dan Engagement
                </h2>
                <p className="relative mt-2 text-sm leading-relaxed text-[#6B7280] md:text-[15px]">
                  Order praktis dengan progres instant.
                </p>

                <ul className="relative mt-4 space-y-2 text-sm text-[#2E2E2E]">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2853A6]" />
                    Instagram, TikTok, YouTube, Telegram, Traffic, dan lainnya
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2853A6]" />
                    Proses otomatis + garansi refill 30 hari
                  </li>
                </ul>

                <div className="relative mt-5 rounded-2xl border border-[#DEE8FA] bg-[#F5F8FF] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#476AA8]">Layanan aktif</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[#141414]">
                    <BarChart3 className="h-4 w-4 text-[#2853A6]" />
                    {smmMiniStatLabel}
                  </p>
                </div>

                <Link
                  href="/product/sosmed"
                  className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-[#2853A6] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#204486]"
                >
                  Lihat Paket SMM
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ) : null}

            {!hasVisibleCards ? (
              <article className="rounded-3xl border border-[#EBEBEB] bg-white p-6 text-center shadow-[0_16px_38px_rgba(20,20,20,0.06)] lg:col-span-2 lg:p-7">
                <h2 className="text-xl font-extrabold tracking-tight text-[#141414]">
                  Produk sementara disembunyikan
                </h2>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Coba lagi sebentar atau hubungi admin untuk info produk yang sedang aktif.
                </p>
              </article>
            ) : null}
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
