"use client"

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, createScope, stagger } from 'animejs'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Heart,
  MessageCircle,
  PlayCircle,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  PackageCheck,
  type LucideIcon,
} from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { BUNDLING_PACKAGES, type SosmedBundleCard } from '@/lib/sosmedBundlingCards'
import { buildSosmedServiceCards } from '@/lib/sosmedProductCards'
import { sosmedService as sosmedServiceApi } from '@/services/sosmedService'
import type { SosmedService } from '@/types/sosmedService'

const ICON_BY_CATEGORY_CODE: Record<string, LucideIcon> = {
  followers: Users,
  likes: Heart,
  views: PlayCircle,
  comments: MessageCircle,
  shares: Share2,
}

function iconForCategory(categoryCode: string) {
  return ICON_BY_CATEGORY_CODE[categoryCode] || Users
}


function BundleCard({ bundle }: { bundle: SosmedBundleCard }) {
  // Default to mid-tier package if available, else first
  const [selectedPkgIndex, setSelectedPkgIndex] = useState(bundle.packages.length > 1 ? 1 : 0)
  const BundleIcon = bundle.targetPlatform.toLowerCase().includes('tiktok') ? PlayCircle : Users
  const isSpecial = bundle.key === 'toko-online-pro'
  
  const bgClass = isSpecial ? 'bg-gradient-to-b from-[#1E293B] to-[#0F172A] text-white border-transparent' : 'bg-white border-[#FFE2CF]'
  const titleClass = isSpecial ? 'text-white' : 'text-[#141414]'
  const textClass = isSpecial ? 'text-gray-300' : 'text-[#555]'
  const chipBg = isSpecial ? 'bg-[#334155] border-transparent text-white' : 'bg-white border-[#EBEBEB] text-[#555]'
  
  return (
    <article
      data-anime="sosmed-card"
      className={`group relative flex h-full flex-col rounded-3xl border p-6 transition hover:-translate-y-0.5 hover:shadow-xl ${bgClass}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${bundle.tone}`}>
          <BundleIcon className="h-6 w-6 text-[#141414]" />
        </div>
        <span className="rounded-full border border-[#FFD5C8] bg-[#FFF3EF] px-3 py-1 text-[11px] font-bold text-[#FF5733]">
          {bundle.badge}
        </span>
      </div>

      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${isSpecial ? 'text-gray-400' : 'text-[#777]'}`}>{bundle.targetPlatform}</p>
        <h2 className={`mt-1 text-2xl font-extrabold leading-tight ${titleClass}`}>{bundle.title}</h2>
        <p className={`mt-2 text-sm leading-relaxed ${textClass}`}>{bundle.summary}</p>
        <p className={`mt-3 rounded-2xl px-4 py-3 text-sm leading-relaxed border ${isSpecial ? 'bg-[#1E293B] border-gray-700 text-gray-200' : 'bg-[#FAFAF8] border-[#F0F0F0] text-[#444]'}`}>
          <span className="font-bold text-[#FF5733]">Cocok Untuk:</span> {bundle.targetAudience}
        </p>
      </div>

      <div className="mt-5">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${isSpecial ? 'text-orange-400' : 'text-[#8A431D]'}`}>Layanan Termasuk:</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {bundle.features.map((feat, i) => (
            <span key={i} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide ${chipBg}`}>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#22A447]" />
              {feat}
            </span>
          ))}
        </div>
      </div>

      <div className={`mt-6 rounded-2xl border p-4 ${isSpecial ? 'bg-[#0F172A] border-gray-700' : 'bg-[#FFF6F2] border-[#FFD5C8]'}`}>
        <p className={`mb-3 text-[11px] font-bold uppercase tracking-wide ${isSpecial ? 'text-gray-400' : 'text-[#A2572E]'}`}>Pilih Varian Paket</p>
        <div className="flex flex-col gap-3">
          {bundle.packages.map((pkg, i) => {
            const isSelected = selectedPkgIndex === i
            return (
              <div 
                key={i} 
                onClick={() => setSelectedPkgIndex(i)}
                className={`relative cursor-pointer flex items-center justify-between rounded-xl px-4 py-3 transition-all ${
                  isSelected 
                    ? 'border-2 border-[#FF5733] bg-[#FFF3EF] shadow-sm' 
                    : isSpecial ? 'border border-gray-700 bg-[#1E293B] hover:border-gray-500' : 'border border-[#EBEBEB] bg-white hover:border-[#FFD5C8]'
                }`}
              >
                {isSelected && (
                  <div className="absolute -left-1.5 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-[#FF5733]" />
                )}
                <div>
                  <p className={`text-xs font-bold ${isSelected ? 'text-[#141414]' : isSpecial ? 'text-gray-200' : 'text-[#141414]'}`}>
                    {pkg.name}
                  </p>
                  <p className={`mt-0.5 text-[10px] ${isSelected ? 'text-[#666]' : isSpecial ? 'text-gray-400' : 'text-[#666]'}`}>
                    {pkg.items.join(' + ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[#FF5733]">{pkg.priceLabel}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button
          onClick={() => alert('Fitur Checkout Bundling Segera Hadir!')}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-bold transition ${
            isSpecial 
              ? 'bg-[#FF5733] text-white hover:bg-[#e64d2e]' 
              : 'bg-[#141414] text-white hover:bg-[#333]'
          }`}
        >
          Pesan Paket {bundle.packages[selectedPkgIndex].name} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}

export default function ProductSosmedLandingPage() {
  const animationRootRef = useRef<HTMLElement | null>(null)
  const [services, setServices] = useState<SosmedService[]>([])
  const [activeTab, setActiveTab] = useState<'satuan' | 'bundling'>('satuan')

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

  const cards = useMemo(() => buildSosmedServiceCards(services), [services])

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
  }, [cards.length])

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
                onClick={() => setActiveTab('satuan')}
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
                onClick={() => setActiveTab('bundling')}
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
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((service) => {
              const checkoutHref = `/product/sosmed/checkout?service=${encodeURIComponent(service.code)}`
              const ServiceIcon = iconForCategory(service.categoryCode)

              return (
                <article
                  key={service.key}
                  data-anime="sosmed-card"
                  className={`group relative flex h-full flex-col rounded-3xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-xl ${
                    service.isRecommended ? 'border-[#FF9B80] ring-2 ring-[#FFE2D8]' : 'border-[#EBEBEB]'
                  }`}
                >
                  {service.isRecommended ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FF5733] px-4 py-1 text-[11px] font-extrabold text-white shadow-sm">
                      Rekomendasi
                    </div>
                  ) : null}

                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${service.tone}`}>
                      <ServiceIcon className="h-5 w-5 text-[#141414]" />
                    </div>

                    <span className="rounded-full border border-[#FFD5C8] bg-[#FFF3EF] px-3 py-1 text-[11px] font-bold text-[#FF5733]">
                      {service.badge}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#777]">{service.platform}</p>
                    <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#141414]">{service.buyerTitle}</h2>
                    <p className="mt-2 rounded-2xl bg-[#FAFAF8] px-3 py-2 text-sm leading-relaxed text-[#555]">
                      {service.bestFor}
                    </p>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-[#343434]">
                    {service.benefits.map((benefit) => (
                      <li key={`${service.key}-${benefit}`} className="flex gap-2 leading-relaxed">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22A447]" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 rounded-2xl border border-[#FFD5C8] bg-[#FFF6F2] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#A2572E]">Harga per paket</p>
                    <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1">
                      <p className="text-2xl font-black text-[#141414]">{service.priceLabel}</p>
                      <p className="pb-0.5 text-sm font-semibold text-[#666]">{service.packageLabel}</p>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs font-semibold text-[#8A431D]">
                      {service.packageExamples.map((example) => (
                        <span key={`${service.key}-${example}`} className="rounded-xl bg-white/70 px-3 py-2">
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {service.trustBadges.map((item) => (
                      <span
                        key={`${service.key}-${item}`}
                        className="rounded-full border border-[#EBEBEB] bg-white px-3 py-1 text-[11px] font-semibold text-[#555]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                    <Link
                      href={checkoutHref}
                      className="inline-flex items-center justify-center gap-1 rounded-full bg-[#FF5733] px-3 py-3 text-xs font-bold text-white transition hover:bg-[#e64d2e]"
                    >
                      Pilih Paket <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={checkoutHref}
                      className="inline-flex items-center justify-center rounded-full border border-[#141414] px-3 py-3 text-xs font-bold text-[#141414] transition hover:bg-[#141414] hover:text-white"
                    >
                      Detail & Syarat
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
          )}

          {activeTab === 'bundling' && (
            <div className="grid gap-6 md:grid-cols-2">
              {BUNDLING_PACKAGES.map((bundle) => (
                <BundleCard key={bundle.key} bundle={bundle} />
              ))}
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
