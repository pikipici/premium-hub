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
  { icon: Zap, label: 'Bayar per request' },
  { icon: Network, label: 'API ready' },
]

const howItWorks = [
  {
    icon: Wallet,
    title: 'Pilih paket',
    body: 'Bayar dari saldo DigiMarket. Aktif tanpa langganan.',
  },
  {
    icon: KeyRound,
    title: 'Buat API key',
    body: 'Generate dari dashboard. Bisa di-rotate kapan saja.',
  },
  {
    icon: Cpu,
    title: 'Kirim request',
    body: 'Billing jalan cuma kalau request berhasil.',
  },
]

const trustStrip = [
  { icon: ShieldCheck, title: 'Billing transparan', body: 'Cuma request berhasil yang dipotong. Sisanya refund.' },
  { icon: Sparkles, title: 'OpenAI-compatible', body: 'Request shape standar. Plug ke bot, dashboard, atau workflow.' },
  { icon: Network, title: 'Routing tersembunyi', body: 'Provider & model di-handle gateway.' },
  { icon: Wallet, title: 'Satu wallet', body: 'Dipakai DigiSosmed, DigiProduct, DigiConnect.' },
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
        if (alive) setMessage('Gagal memuat paket. Coba refresh.')
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
      setMessage('Paket tidak tersedia.')
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
      setMessage(error.response?.data?.message || 'Checkout gagal. Saldo wallet kurang.')
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
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFE0D5] blur-2xl sm:h-96 sm:w-96"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-40 h-56 w-56 rounded-full bg-[#FFF0ED] blur-3xl"
          />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:px-8 lg:pb-20 lg:pt-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#FFD9CF] bg-[#FFF0ED] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#FF5733]">
                <Network className="h-3.5 w-3.5" />
                DigiConnect
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-[#141414] sm:text-5xl lg:text-[56px]">
                Gateway AI dari wallet kamu.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6B7280] sm:text-lg">
                Beli paket, buat API key, kirim request. Untuk bot, dashboard, dan workflow otomatis.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {heroStatChips.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-[11px] font-bold text-[#3A3A3A] shadow-[0_8px_18px_rgba(20,20,20,0.04)] sm:text-xs"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#FF5733]" />
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
                  <span className="rounded-full border border-[#FFD9CF] bg-[#FFF0ED] px-2.5 py-0.5 text-[10px] font-bold text-[#FF5733] sm:text-[11px]">
                    billable
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
                    <CheckCircle2 className="mb-1.5 h-4 w-4 text-[#FF5733]" />
                    Per request atau paket 2 hari.
                  </div>
                  <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-3 text-[12px] leading-snug text-[#3A3A3A]">
                    <CheckCircle2 className="mb-1.5 h-4 w-4 text-[#FF5733]" />
                    Cuma request berhasil yang dipotong.
                  </div>
                  <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-3 text-[12px] leading-snug text-[#3A3A3A]">
                    <CheckCircle2 className="mb-1.5 h-4 w-4 text-[#FF5733]" />
                    API key, entitlement, usage.
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
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF5733]">Cara kerja</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#141414] sm:text-3xl">
                  Tiga langkah aktivasi.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-[#6B7280]">
                Tanpa integrasi billing. Semua dari wallet DigiMarket.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {howItWorks.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-3xl border border-[#EBEBEB] bg-[#F7F7F5] p-5 transition hover:border-[#FFD9CF] hover:bg-white sm:p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF0ED] text-[#FF5733]">
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
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF5733]">Paket</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#141414] sm:text-3xl">
                  Aktifkan dalam satu checkout.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-[#6B7280]">
                Pakai saldo wallet. Setelahnya buat API key dan pantau request di dashboard.
              </p>
            </div>

            {message ? (
              <div className="mb-6 rounded-2xl border border-[#FFD9CF] bg-[#FFF0ED] px-5 py-4 text-sm font-semibold text-[#B4161B]">
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
                        isFeatured
                          ? 'border-[#FF9B80] ring-2 ring-[#FFD5C8]/40'
                          : 'border-[#EBEBEB]'
                      }`}
                    >
                      {isFeatured ? (
                        <div className="pointer-events-none absolute -right-10 top-5 w-36 rotate-45 bg-[linear-gradient(110deg,#E63B22,#FF5733_55%,#FF8C66)] py-1 text-center text-[9px] font-black uppercase tracking-[0.16em] text-white shadow-[0_8px_18px_rgba(255,87,51,0.26)]">
                          Best Pick
                        </div>
                      ) : null}

                      <div className="mb-5 flex items-center justify-between">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0ED] text-[#FF5733]">
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
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5733]" />
                          {plan.billing_model === 'pay_per_request'
                            ? 'Cuma request berhasil yang dipotong'
                            : 'Fair-use selama paket aktif'}
                        </li>
                        <li className="flex items-start gap-2">
                          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5733]" />
                          Pakai saldo DigiMarket
                        </li>
                      </ul>

                      {plan.stock_managed ? (
                        <p className="mt-4 rounded-2xl border border-[#FFD9CF] bg-[#FFF0ED] px-4 py-2.5 text-xs font-bold text-[#B4161B]">
                          Sisa {plan.stock_remaining ?? 0}/{plan.stock_total ?? 0} slot
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
                            <span className="rounded-full border border-[#FFD9CF] bg-[#FFF0ED] px-2.5 py-0.5 text-[11px] font-bold text-[#FF5733]">
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
                          {unavailable ? 'Stok habis' : 'Checkout'}
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
                  className="rounded-3xl border border-[#EBEBEB] bg-[#F7F7F5] p-5 transition hover:border-[#FFD9CF] hover:bg-white"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0ED] text-[#FF5733]">
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
