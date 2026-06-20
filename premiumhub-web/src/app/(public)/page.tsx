"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, BarChart3, CheckCircle2, Code2, PackageCheck, Rocket, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'

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
import { maintenanceService } from '@/services/maintenanceService'
import { sosmedService } from '@/services/sosmedService'

const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value)

export default function HomePage() {
  const [sosmedServicesCount, setSosmedServicesCount] = useState<number | null>(null)
  const [maintenancePaths, setMaintenancePaths] = useState<Set<string>>(new Set())
  const [visibleProductCards, setVisibleProductCards] = useState<HomeProductCardHref[]>(
    () => fallbackHomeProductCardsFromDefaultMenu()
  )

  useEffect(() => {
    let canceled = false

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

  // Check maintenance status for product pages
  useEffect(() => {
    const checkMaintenance = async () => {
      const paths = ['/product/sosmed', '/product/digiproduct']
      const activePaths = new Set<string>()
      await Promise.allSettled(
        paths.map(async (path) => {
          const res = await maintenanceService.evaluate(path)
          if (res.success && res.data?.active) activePaths.add(path)
        })
      )
      setMaintenancePaths(activePaths)
    }
    checkMaintenance()
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

  const smmMiniStatLabel = sosmedServicesCount !== null
    ? `${formatNumber(sosmedServicesCount)}+ layanan`
    : 'Memuat layanan'
  const showDigiConnectCard = visibleProductCards.includes('/product/digiconnect')
  const showSosmedCard = visibleProductCards.includes('/product/sosmed')
  const showDigiProductCard = visibleProductCards.includes('/product/digiproduct')
  const visibleCardsCount = Number(showDigiConnectCard) + Number(showSosmedCard) + Number(showDigiProductCard)
  const isSingleVisibleCard = visibleCardsCount === 1
  const isTwoVisibleCards = visibleCardsCount === 2
  const hasVisibleCards = showDigiConnectCard || showSosmedCard || showDigiProductCard
  const desktopCardsGridClass = isSingleVisibleCard
    ? 'hidden gap-3 sm:grid md:grid-cols-1 md:justify-items-center lg:gap-7'
    : isTwoVisibleCards
      ? 'hidden gap-3 sm:grid md:grid-cols-2 md:gap-5 lg:mx-auto lg:max-w-5xl lg:grid-cols-2 lg:gap-7'
    : 'hidden gap-3 sm:grid md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:gap-7'
  const productCardClass = isSingleVisibleCard
    ? 'relative w-full overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white p-4 shadow-[0_12px_28px_rgba(20,20,20,0.05)] md:max-w-[640px] sm:rounded-3xl sm:p-6 sm:shadow-[0_16px_38px_rgba(20,20,20,0.06)] lg:p-7'
    : isTwoVisibleCards
      ? 'relative overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white p-4 shadow-[0_12px_28px_rgba(20,20,20,0.05)] sm:rounded-3xl sm:p-6 sm:shadow-[0_16px_38px_rgba(20,20,20,0.06)] lg:p-8'
    : 'relative overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white p-4 shadow-[0_12px_28px_rgba(20,20,20,0.05)] sm:rounded-3xl sm:p-6 sm:shadow-[0_16px_38px_rgba(20,20,20,0.06)] lg:p-7'

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8 lg:pb-20 lg:pt-12">
          <header className="mx-auto mb-4 max-w-3xl text-center sm:mb-6 lg:mb-10">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#FFD9CF] bg-[#FFF0ED] px-4 py-1.5 text-xs font-bold text-[#FF5733]">
              <Rocket className="h-3.5 w-3.5" />
              DigiMarket
            </p>
            <h1 className="mt-3 text-3xl font-black leading-[0.96] tracking-[-0.04em] text-[#141414] sm:mt-4 sm:text-5xl sm:leading-tight">
Semua kebutuhan ada disini
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-[#6B7280] sm:mt-3 sm:text-base">
              Pilih layanan, bayar pakai wallet, langsung jalan.
            </p>
            <div className="mx-auto mt-4 flex max-w-full gap-2 overflow-x-auto pb-1 text-[11px] font-bold text-[#3A3A3A] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:max-w-xl sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:text-xs">
              <span className="inline-flex items-center justify-center gap-1 rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 shadow-[0_8px_18px_rgba(20,20,20,0.04)]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#FF5733]" />
                Aman
              </span>
              <span className="inline-flex items-center justify-center gap-1 rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 shadow-[0_8px_18px_rgba(20,20,20,0.04)]">
                <WalletCards className="h-3.5 w-3.5 text-[#FF5733]" />
                Refund
              </span>
              <span className="inline-flex items-center justify-center gap-1 rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 shadow-[0_8px_18px_rgba(20,20,20,0.04)]">
                <Sparkles className="h-3.5 w-3.5 text-[#FF5733]" />
                Instant
              </span>
            </div>
          </header>

          {/* ─── MOBILE CARDS ─── */}
          <div className="sm:hidden">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="text-left">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF5733]">Pilih kebutuhan</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-[#141414]">Mau pakai apa hari ini?</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#6B7280] shadow-[0_8px_18px_rgba(20,20,20,0.04)]">
                {visibleCardsCount} opsi
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {showSosmedCard ? (
                maintenancePaths.has('/product/sosmed') ? (
                  <div className="relative overflow-hidden rounded-3xl bg-[#2853A6]/70 p-4 text-white/70 shadow-none">
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/8" />
                    <BarChart3 className="relative h-6 w-6" />
                    <p className="relative mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">DigiSosmed</p>
                    <h3 className="relative mt-1 text-lg font-black leading-tight tracking-tight">Naikin sosial</h3>
                    <p className="relative mt-2 min-h-[32px] text-xs font-semibold leading-snug text-white/60">{smmMiniStatLabel}</p>
                    <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-white/60">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse mr-1" />
                      Sedang Maintenance
                    </span>
                  </div>
                ) : (
                  <Link
                    href="/product/sosmed"
                    className="group relative overflow-hidden rounded-3xl bg-[#2853A6] p-4 text-white shadow-[0_16px_30px_rgba(40,83,166,0.22)]"
                  >
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/12" />
                    <BarChart3 className="relative h-6 w-6" />
                    <p className="relative mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">DigiSosmed</p>
                    <h3 className="relative mt-1 text-lg font-black leading-tight tracking-tight">Naikin sosial</h3>
                    <p className="relative mt-2 min-h-[32px] text-xs font-semibold leading-snug text-white/78">{smmMiniStatLabel}</p>
                    <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-extrabold">
                      Buka <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                )
              ) : null}

              {showDigiProductCard ? (
                maintenancePaths.has('/product/digiproduct') ? (
                  <div className="relative overflow-hidden rounded-3xl bg-[#237A44]/70 p-4 text-white/70 shadow-none">
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/8" />
                    <PackageCheck className="relative h-6 w-6" />
                    <p className="relative mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">DigiProduct</p>
                    <h3 className="relative mt-1 text-lg font-black leading-tight tracking-tight">Produk digital</h3>
                    <p className="relative mt-2 min-h-[32px] text-xs font-semibold leading-snug text-white/60">Lisensi, tools, akses</p>
                    <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-white/60">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse mr-1" />
                      Sedang Maintenance
                    </span>
                  </div>
                ) : (
                  <Link
                    href="/product/digiproduct"
                    className="group relative overflow-hidden rounded-3xl bg-[#237A44] p-4 text-white shadow-[0_16px_30px_rgba(35,122,68,0.18)]"
                  >
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/12" />
                    <PackageCheck className="relative h-6 w-6" />
                    <p className="relative mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">DigiProduct</p>
                    <h3 className="relative mt-1 text-lg font-black leading-tight tracking-tight">Produk digital</h3>
                    <p className="relative mt-2 min-h-[32px] text-xs font-semibold leading-snug text-white/78">Lisensi, tools, akses</p>
                    <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-extrabold">
                      Buka <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                )
              ) : null}

              {showDigiConnectCard ? (
                <Link
                  href="/product/digiconnect"
                  className="group relative col-span-2 overflow-hidden rounded-3xl border border-[#2A2A2A] bg-[#141414] p-4 text-white shadow-[0_16px_34px_rgba(20,20,20,0.2)]"
                >
                  <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[#F7D45B]/20" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <Code2 className="h-6 w-6 text-[#F7D45B]" />
                      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">DigiConnect</p>
                      <h3 className="mt-1 text-xl font-black leading-tight tracking-tight">Gateway AI dari wallet</h3>
                      <p className="mt-2 text-xs font-semibold text-white/68">API key, entitlement, usage billing.</p>
                    </div>
                    <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#141414]">
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ) : null}

              {!hasVisibleCards ? (
                <article className="col-span-2 rounded-3xl border border-[#EBEBEB] bg-white p-5 text-center shadow-[0_12px_28px_rgba(20,20,20,0.05)]">
                  <h2 className="text-lg font-extrabold tracking-tight text-[#141414]">Produk belum tersedia</h2>
                  <p className="mt-2 text-sm text-[#6B7280]">Coba lagi nanti atau hubungi admin.</p>
                </article>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-bold text-[#3A3A3A]">
              <span className="rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 text-center">Aman</span>
              <span className="rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 text-center">Refund</span>
              <span className="rounded-2xl border border-[#FFE0D7] bg-white px-2 py-2 text-center">Instan</span>
            </div>
          </div>

          {/* ─── DESKTOP / TABLET CARDS ─── */}
          <div className={desktopCardsGridClass}>
            {showDigiConnectCard ? (
              <article className={productCardClass}>
                <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#FFF3CC] sm:h-28 sm:w-28" />
                <p className="relative inline-flex rounded-full border border-[#F7D45B] bg-[#FFF8DC] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A5200]">
                  DigiConnect
                </p>
                <h2 className="relative mt-2 text-lg font-extrabold leading-tight tracking-tight text-[#141414] sm:mt-3 sm:text-2xl">
                  Gateway AI dari wallet
                </h2>
                <p className="relative mt-1.5 text-sm leading-relaxed text-[#6B7280] sm:mt-2 md:text-[15px]">
                  Beli paket, buat API key, kirim request.
                </p>

                <ul className="relative mt-4 hidden space-y-2 text-sm text-[#2E2E2E] sm:block">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#A36A00]" />
                    OpenAI-compatible. Untuk bot dan workflow.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#A36A00]" />
                    API key, entitlement, usage
                  </li>
                </ul>

                <div className="relative mt-3 inline-flex rounded-full border border-[#F4DE8D] bg-[#FFFBEA] px-3 py-1.5 sm:mt-5 sm:block sm:rounded-2xl sm:px-4 sm:py-3">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#141414] sm:mt-1 sm:text-sm">
                    <Code2 className="h-4 w-4 text-[#A36A00]" />
                    Wallet billing aktif
                  </p>
                </div>

                <Link
                  href="/product/digiconnect"
                  className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-[#141414] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#2A2A2A] sm:mt-5 sm:px-5 sm:py-3"
                >
                  Lihat detail
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ) : null}

            {showSosmedCard ? (
              <article className={productCardClass}>
                <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#EEF4FF] sm:h-24 sm:w-24" />
                <p className="relative inline-flex rounded-full border border-[#DCE9FF] bg-[#EEF4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#2853A6]">
                  DigiSosmed
                </p>
                <h2 className="relative mt-2 text-lg font-extrabold leading-tight tracking-tight text-[#141414] sm:mt-3 sm:text-2xl">
                  Naikin follower, view, engagement
                </h2>
                <p className="relative mt-1.5 text-sm leading-relaxed text-[#6B7280] sm:mt-2 md:text-[15px]">
                  Order langsung jalan.
                </p>

                <ul className="relative mt-4 hidden space-y-2 text-sm text-[#2E2E2E] sm:block">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2853A6]" />
                    Instagram, TikTok, YouTube, Telegram, dan lainnya
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2853A6]" />
                    Otomatis + refill 30 hari
                  </li>
                </ul>

                <div className="relative mt-3 inline-flex rounded-full border border-[#DEE8FA] bg-[#F5F8FF] px-3 py-1.5 sm:mt-5 sm:block sm:rounded-2xl sm:px-4 sm:py-3">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#141414] sm:mt-1 sm:text-sm">
                    <BarChart3 className="h-4 w-4 text-[#2853A6]" />
                    {smmMiniStatLabel}
                  </p>
                </div>

                {maintenancePaths.has('/product/sosmed') ? (
                  <span className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2.5 text-sm font-extrabold text-amber-700 sm:mt-5 sm:px-5 sm:py-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Sedang Maintenance
                  </span>
                ) : (
                  <Link
                    href="/product/sosmed"
                    className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-[#2853A6] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#204486] sm:mt-5 sm:px-5 sm:py-3"
                  >
                    Lihat detail
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </article>
            ) : null}

            {showDigiProductCard ? (
              <article className={productCardClass}>
                <div className="absolute -right-9 -top-9 h-20 w-20 rounded-full bg-[#EAF8EF] sm:h-24 sm:w-24" />
                <p className="relative inline-flex rounded-full border border-[#CFEFDB] bg-[#EAF8EF] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#237A44]">
                  DigiProduct
                </p>
                <h2 className="relative mt-2 text-lg font-extrabold leading-tight tracking-tight text-[#141414] sm:mt-3 sm:text-2xl">
                  Produk digital siap pakai
                </h2>
                <p className="relative mt-1.5 text-sm leading-relaxed text-[#6B7280] sm:mt-2 md:text-[15px]">
                    Produk digital, lisensi, tools, dan akses siap pakai.
                </p>

                <ul className="relative mt-4 hidden space-y-2 text-sm text-[#2E2E2E] sm:block">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#237A44]" />
                    Streaming, musik, gaming, desain, produktivitas
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#237A44]" />
                    Checkout cepat dari satu wallet
                  </li>
                </ul>

                <div className="relative mt-3 inline-flex rounded-full border border-[#D9F1E2] bg-[#F3FBF6] px-3 py-1.5 sm:mt-5 sm:block sm:rounded-2xl sm:px-4 sm:py-3">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#141414] sm:mt-1 sm:text-sm">
                    <PackageCheck className="h-4 w-4 text-[#237A44]" />
                    Katalog produk digital
                  </p>
                </div>

                {maintenancePaths.has('/product/digiproduct') ? (
                  <span className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2.5 text-sm font-extrabold text-amber-700 sm:mt-5 sm:px-5 sm:py-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Sedang Maintenance
                  </span>
                ) : (
                  <Link
                    href="/product/digiproduct"
                    className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-[#237A44] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#1D6638] sm:mt-5 sm:px-5 sm:py-3"
                  >
                    Lihat detail
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </article>
            ) : null}

            {!hasVisibleCards ? (
              <article className="rounded-3xl border border-[#EBEBEB] bg-white p-6 text-center shadow-[0_16px_38px_rgba(20,20,20,0.06)] lg:col-span-2 lg:p-7">
                <h2 className="text-xl font-extrabold tracking-tight text-[#141414]">
                  Produk belum tersedia
                </h2>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Coba lagi nanti atau hubungi admin.
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
