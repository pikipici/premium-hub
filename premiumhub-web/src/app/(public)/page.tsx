"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, BarChart3, CheckCircle2, Rocket } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { nokosPublicService } from '@/services/nokosPublicService'
import { sosmedService } from '@/services/sosmedService'

const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value)

export default function HomePage() {
  const [countriesCount, setCountriesCount] = useState<number | null>(null)
  const [sentTotalAllTime, setSentTotalAllTime] = useState<number | null>(null)
  const [sosmedServicesCount, setSosmedServicesCount] = useState<number | null>(null)

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

  const nokosCoverageLabel = countriesCount !== null
    ? `Cakupan ${formatNumber(countriesCount)}+ negara`
    : 'Cakupan negara sedang dimuat'
  const nokosMiniStatLabel = sentTotalAllTime !== null
    ? `${formatNumber(sentTotalAllTime)}+ nomor terkirim`
    : 'Data penjualan sedang dimuat'

  const smmMiniStatLabel = sosmedServicesCount !== null
    ? `${formatNumber(sosmedServicesCount)}+ layanan aktif`
    : 'Data layanan sedang dimuat'

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-20">
          <h1 className="sr-only">Beli Nomor Virtual OTP dan Layanan SMM (Beli follower, viewer, likes, dan engage) dalam Satu Tempat.</h1>
          <header className="mx-auto mb-8 max-w-3xl text-center lg:mb-12">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#FFD9CF] bg-[#FFF0ED] px-4 py-1.5 text-xs font-bold text-[#FF5733]">
              <Rocket className="h-3.5 w-3.5" />
              Pilih Layanan Sesuai Kebutuhan
            </p>
          </header>

          <div className="grid gap-5 md:grid-cols-2 lg:gap-7">
            <article className="rounded-3xl border border-[#EBEBEB] bg-white p-6 shadow-[0_16px_38px_rgba(20,20,20,0.06)] lg:p-7">
              <p className="inline-flex rounded-full border border-[#FFD9CF] bg-[#FFF0ED] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#FF5733]">
                Nomor Virtual OTP
              </p>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#141414]">
                Verifikasi Cepat Pakai Nomor Virtual
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280] md:text-[15px]">
                Aktivasi akun lebih praktis tanpa pakai nomor pribadi.
              </p>

              <ul className="mt-5 space-y-2.5 text-sm text-[#2E2E2E]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#FF5733]" />
                  {nokosCoverageLabel}
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#FF5733]" />
                  OTP masuk ga pake lama
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#FF5733]" />
                  Auto-cancel + refund kalau OTP gagal
                </li>
              </ul>

              <div className="mt-6 rounded-2xl border border-[#F2E6E2] bg-[#FFF9F7] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#A06654]">Mini Stat</p>
                <p className="mt-1 text-sm font-bold text-[#141414]">{nokosMiniStatLabel}</p>
              </div>

              <Link
                href="/product/nokos"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FF5733] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#E24A26]"
              >
                Beli Nomor
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>

            <article className="rounded-3xl border border-[#EBEBEB] bg-white p-6 shadow-[0_16px_38px_rgba(20,20,20,0.06)] lg:p-7">
              <p className="inline-flex rounded-full border border-[#DCE9FF] bg-[#EEF4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#2853A6]">
                Jasa SMM
              </p>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#141414]">
                Naikin Follower, Viewer, dan Engagement
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280] md:text-[15px]">
                Order SMM praktis dengan progres yang bisa dipantau.
              </p>

              <ul className="mt-5 space-y-2.5 text-sm text-[#2E2E2E]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2853A6]" />
                  Layanan lengkap per platform
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2853A6]" />
                  Proses order otomatis
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2853A6]" />
                  Refill tersedia di layanan tertentu
                </li>
              </ul>

              <div className="mt-6 rounded-2xl border border-[#DEE8FA] bg-[#F5F8FF] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#476AA8]">Mini Stat</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[#141414]">
                  <BarChart3 className="h-4 w-4 text-[#2853A6]" />
                  {smmMiniStatLabel}
                </p>
              </div>

              <Link
                href="/product/sosmed"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2853A6] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#204486]"
              >
                Lihat Layanan SMM
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
