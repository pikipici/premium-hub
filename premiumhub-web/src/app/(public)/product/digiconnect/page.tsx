"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Cpu,
  KeyRound,
  Loader2,
  Network,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { digiconnectService } from '@/services/digiconnectService'
import { useAuthStore } from '@/store/authStore'
import type { DigiConnectPlan } from '@/types/digiconnect'

const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

const heroStatChips = [
  { icon: ShieldCheck, label: 'Wallet aman' },
  { icon: Zap, label: 'Charge per request' },
  { icon: Network, label: 'API ready' },
]

const howItWorks = [
  {
    icon: Wallet,
    title: 'Pilih paket dari wallet',
    body: 'Bayar pakai saldo DigiMarket. Aktif langsung tanpa langganan rumit.',
  },
  {
    icon: KeyRound,
    title: 'Buat API key',
    body: 'Generate key dari dashboard. Simpan secret-nya, sisanya bisa di-rotate kapan aja.',
  },
  {
    icon: Cpu,
    title: 'Kirim request',
    body: 'Hit gateway DigiConnect. Billing kepotong cuma kalau request billable berhasil.',
  },
]

const trustStrip = [
  { icon: ShieldCheck, title: 'Billing transparan', body: 'Cuma request billable yang dipotong. Gagal? Refund otomatis ke wallet.' },
  { icon: Sparkles, title: 'OpenAI-compatible', body: 'Request shape standar, gampang dipasang ke bot, dashboard, atau workflow lama.' },
  { icon: Network, title: 'Routing tersembunyi', body: 'Detail provider & model di-handle gateway, kamu fokus ke fitur produk.' },
  { icon: Wallet, title: 'Satu wallet semua produk', body: 'Saldo yang sama dipakai DigiSosmed, prem-apps, dan DigiConnect.' },
]

export default function DigiConnectProductPage() {
  const router = useRouter()
  const { isAuthenticated, hasHydrated } = useAuthStore()
  const [plans, setPlans] = useState<DigiConnectPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    digiconnectService
      .publicPlans()
      .then((res) => {
        if (alive) setPlans(res.data?.plans || [])
      })
      .catch(() => {
        if (alive) setMessage('Belum bisa ambil paket DigiConnect. Coba refresh sebentar lagi.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const checkout = async (plan: DigiConnectPlan) => {
    if (plan.available === false) {
      setMessage('Paket ini sedang tidak tersedia. Pilih paket lain dulu.')
      return
    }
    if (!hasHydrated) return
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent('/product/digiconnect')}`)
      return
    }
    setCheckingOut(plan.code)
    setMessage(null)
    try {
      await digiconnectService.checkoutWithWallet({ plan_code: plan.code })
      router.push('/dashboard/digiconnect')
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } }
      setMessage(error.response?.data?.message || 'Checkout gagal. Pastikan saldo wallet cukup.')
    } finally {
      setCheckingOut(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#141414]">
      <Navbar />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFF3CC] blur-2xl sm:h-96 sm:w-96"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-40 h-56 w-56 rounded-full bg-[#FFF8DC] blur-3xl"
          />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:px-8 lg:pb-20 lg:pt-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#F7D45B] bg-[#FFF8DC] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#7A5200]">
                <Network className="h-3.5 w-3.5" />
                DigiConnect
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-[#141414] sm:text-5xl lg:text-[56px]">
                Gateway AI yang langsung kepotong dari wallet kamu.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6B7280] sm:text-lg">
                Beli paket, buat API key, lalu kirim request lewat gateway DigiMarket. Cocok buat bot, dashboard internal, dan workflow otomatis tanpa expose detail routing.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {heroStatChips.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-[11px] font-bold text-[#3A3A3A] shadow-[0_8px_18px_rgba(20,20,20,0.04)] sm:text-xs"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#A36A00]" />
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="#plans"
                  className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#2A2A2A]"
                >
                  Lihat paket
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  href="/dashboard/digiconnect"
                  className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-5 py-3 text-sm font-extrabold text-[#141414] transition hover:border-[#141414]"
                >
                  Buka dashboard
                </Link>
              </div>
            </div>

            {/* HERO CARD: code preview */}
            <div className="relative">
              <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)] sm:p-6">
                <div className="mb-4 flex items-center justify-between border-b border-[#EBEBEB] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                    <span className="ml-2 text-[11px] font-bold text-[#6B7280] sm:text-xs">
                      POST /api/v1/digiconnect/requests
                    </span>
                  </div>
                  <span className="rounded-full border border-[#CDEBD9] bg-[#E9F8EE] px-2.5 py-0.5 text-[10px] font-bold text-[#0F6B3A] sm:text-[11px]">
                    billable safe
                  </span>
                </div>
                <pre className="overflow-x-auto rounded-2xl bg-[#0F0F0F] p-4 text-[12px] leading-relaxed text-slate-100 sm:text-sm">
                  <code>{`{
  "service": "digiconnect-smart",
  "type": "response",
  "input": "Ringkas meeting ini...",
  "metadata": { "team": "ops" }
}`}</code>
                </pre>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-3 text-[12px] leading-snug text-[#3A3A3A]">
                    <CheckCircle2 className="mb-1.5 h-4 w-4 text-[#A36A00]" />
                    Pilih harga per request atau paket durasi 2 hari.
                  </div>
                  <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-3 text-[12px] leading-snug text-[#3A3A3A]">
                    <CheckCircle2 className="mb-1.5 h-4 w-4 text-[#A36A00]" />
                    Wallet dipotong cuma untuk request billable berhasil.
                  </div>
                  <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-3 text-[12px] leading-snug text-[#3A3A3A]">
                    <CheckCircle2 className="mb-1.5 h-4 w-4 text-[#A36A00]" />
                    Dashboard API key, entitlement, dan usage request.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-[#EBEBEB] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A36A00]">Cara kerja</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#141414] sm:text-3xl">
                  Tiga langkah dari wallet ke gateway.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-[#6B7280]">
                Setup ringan, ga perlu integrasi billing terpisah. Semua aktivasi jalan di satu wallet DigiMarket.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {howItWorks.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-3xl border border-[#EBEBEB] bg-[#F7F7F5] p-5 transition hover:border-[#F7D45B] hover:bg-white sm:p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF8DC] text-[#A36A00]">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">
                      Langkah {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold tracking-tight text-[#141414]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PLANS */}
        <section id="plans" className="bg-[#F7F7F5]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A36A00]">Paket wallet</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#141414] sm:text-3xl">
                  Aktifkan akses API dalam satu checkout.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-[#6B7280]">
                Bayar pakai saldo wallet. Setelah aktif, kamu bisa buat API key dari dashboard dan pantau request terbaru.
              </p>
            </div>

            {message ? (
              <div className="mb-6 rounded-2xl border border-[#F7D45B] bg-[#FFFBEA] px-5 py-4 text-sm font-semibold text-[#7A5200]">
                {message}
              </div>
            ) : null}

            {loading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-[420px] animate-pulse rounded-3xl border border-[#EBEBEB] bg-white"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3 lg:gap-5">
                {plans.map((plan, index) => {
                  const isFeatured = index === 1
                  const unavailable = plan.available === false
                  return (
                    <article
                      key={plan.code}
                      className={`relative flex flex-col overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)] transition hover:-translate-y-0.5 sm:p-6 ${
                        isFeatured ? 'border-[#F7D45B] ring-2 ring-[#FFE9A8]/50' : 'border-[#EBEBEB]'
                      }`}
                    >
                      {isFeatured ? (
                        <div className="pointer-events-none absolute -right-10 top-5 w-36 rotate-45 bg-[#141414] py-1 text-center text-[9px] font-black uppercase tracking-[0.16em] text-[#FFE9A8]">
                          Best Pick
                        </div>
                      ) : null}

                      <div className="mb-5 flex items-center justify-between">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF8DC] text-[#A36A00]">
                          <Code2 className="h-5 w-5" />
                        </div>
                        {unavailable ? (
                          <span className="rounded-full border border-[#EBEBEB] bg-[#F7F7F5] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#6B7280]">
                            Stok habis
                          </span>
                        ) : null}
                      </div>

                      <h3 className="text-xl font-extrabold tracking-tight text-[#141414] sm:text-2xl">
                        {plan.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-relaxed text-[#6B7280]">
                        {plan.description}
                      </p>

                      <div className="mt-5">
                        <span className="text-3xl font-black tracking-tight text-[#141414] sm:text-4xl">
                          {plan.price_label || formatRupiah(plan.price)}
                        </span>
                        <p className="mt-1 text-xs font-semibold text-[#6B7280]">
                          {plan.billing_model === 'pay_per_request'
                            ? 'Tanpa biaya langganan'
                            : `Aktif ${plan.duration_days} hari`}
                        </p>
                      </div>

                      <ul className="mt-5 space-y-2 text-sm text-[#3A3A3A]">
                        <li className="flex items-start gap-2">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#A36A00]" />
                          {plan.billing_model === 'pay_per_request'
                            ? 'Charge per request billable berhasil'
                            : 'Fair-use aktif selama paket berjalan'}
                        </li>
                        <li className="flex items-start gap-2">
                          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#A36A00]" />
                          Pakai saldo DigiMarket
                        </li>
                      </ul>

                      {plan.stock_managed ? (
                        <p className="mt-4 rounded-2xl border border-[#F7D45B] bg-[#FFFBEA] px-4 py-2.5 text-xs font-bold text-[#7A5200]">
                          Stok tersisa {plan.stock_remaining ?? 0} dari {plan.stock_total ?? 0} slot
                        </p>
                      ) : null}

                      {plan.model_labels?.length ? (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {plan.model_labels.slice(0, 6).map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-[#EBEBEB] bg-[#F7F7F5] px-2.5 py-0.5 text-[11px] font-bold text-[#3A3A3A]"
                            >
                              {label}
                            </span>
                          ))}
                          {plan.model_labels.length > 6 ? (
                            <span className="rounded-full border border-[#F7D45B] bg-[#FFF8DC] px-2.5 py-0.5 text-[11px] font-bold text-[#7A5200]">
                              +{plan.model_labels.length - 6} model
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-auto pt-6">
                        <button
                          onClick={() => checkout(plan)}
                          disabled={checkingOut === plan.code || unavailable}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#141414] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#2A2A2A] disabled:cursor-not-allowed disabled:bg-[#3A3A3A] disabled:opacity-70"
                        >
                          {checkingOut === plan.code ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {unavailable ? 'Stok habis' : 'Checkout pakai wallet'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="border-t border-[#EBEBEB] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trustStrip.map((item) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-[#EBEBEB] bg-[#F7F7F5] p-5 transition hover:border-[#F7D45B] hover:bg-white"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF8DC] text-[#A36A00]">
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-3 text-sm font-extrabold tracking-tight text-[#141414]">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B7280]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
