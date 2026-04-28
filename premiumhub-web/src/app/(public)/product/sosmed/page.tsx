"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
  type LucideIcon,
} from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
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

  const cards = useMemo(() => buildSosmedServiceCards(services), [services])

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="mx-auto mb-6 max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF5733]">Sosmed</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#141414] md:text-4xl">
              Pilih product sosmed yang tersedia
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#666] md:text-base">
              Semua harga ditulis per paket ±1.000. Pilih jumlah paket di checkout, pastikan akun/link public, lalu sistem mulai proses tanpa minta password.
            </p>
          </header>

          <div className="mb-6 grid gap-2 rounded-2xl border border-[#FFE2CF] bg-white p-3 text-xs shadow-sm sm:grid-cols-3">
            <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F2FCEB] px-3 py-2 font-semibold text-[#2F6B1A]">
              <ShieldCheck className="h-4 w-4" /> Tanpa perlu password
            </span>
            <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EDF4FF] px-3 py-2 font-semibold text-[#1E4F9B]">
              <Clock3 className="h-4 w-4" /> Mulai diproses cepat
            </span>
            <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFF3EA] px-3 py-2 font-semibold text-[#9A4B16]">
              <Sparkles className="h-4 w-4" /> Garansi jelas kalau tersedia
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((service) => {
              const checkoutHref = `/product/sosmed/checkout?service=${encodeURIComponent(service.code)}`
              const ServiceIcon = iconForCategory(service.categoryCode)

              return (
                <article
                  key={service.key}
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
