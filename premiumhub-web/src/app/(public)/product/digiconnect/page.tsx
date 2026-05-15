"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Code2, Loader2, Network, ShieldCheck, Wallet } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { digiconnectService } from '@/services/digiconnectService'
import { useAuthStore } from '@/store/authStore'
import type { DigiConnectPlan } from '@/types/digiconnect'

const formatRupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

const highlights = [
  'Pilih harga per request Rp150/Rp200 atau aktifkan paket durasi 2 hari',
  'Billing aman: wallet dipotong hanya untuk request billable yang berhasil',
  'Dashboard API key, entitlement, dan usage request buat tim kamu',
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
    digiconnectService.publicPlans()
      .then((res) => {
        if (alive) setPlans(res.data || [])
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
    <div className="min-h-screen bg-[#f7f3ea] text-slate-950">
      <Navbar />
      <main className="overflow-hidden">
        <section className="relative border-b border-slate-200 bg-[radial-gradient(circle_at_20%_20%,#f9c846_0,transparent_28%),linear-gradient(135deg,#102a43_0%,#17324d_45%,#f7f3ea_45%,#f7f3ea_100%)] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm backdrop-blur">
                <Network className="mr-2 h-4 w-4 text-amber-300" /> Managed Routing Layer untuk aplikasi kamu
              </div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
                DigiConnect API, akses AI yang bisa langsung kamu tagihkan dari wallet.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-slate-100">
                Beli paket, buat API key, lalu kirim request lewat gateway Premium Hub. Cocok buat bot, dashboard internal, dan workflow otomatis tanpa expose detail routing internal.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#plans" className="inline-flex items-center rounded-full bg-amber-300 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-amber-900/20 transition hover:-translate-y-0.5">
                  Lihat paket <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <Link href="/dashboard/digiconnect" className="inline-flex items-center rounded-full border border-white/30 px-6 py-3 font-bold text-white transition hover:bg-white/10">
                  Buka dashboard
                </Link>
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/20 bg-slate-950/50 p-6 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-sm text-slate-300">/api/v1/digiconnect/requests</span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">billable safe</span>
              </div>
              <pre className="overflow-x-auto rounded-2xl bg-black/40 p-5 text-sm text-slate-100"><code>{`{
  "service": "digiconnect-smart",
  "type": "response",
  "input": "Ringkas meeting ini...",
  "metadata": { "team": "ops" }
}`}</code></pre>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div key={item} className="rounded-2xl bg-white/10 p-4 text-sm text-slate-100">
                    <CheckCircle2 className="mb-3 h-5 w-5 text-amber-300" />{item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="plans" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-700">Paket wallet</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">Aktifkan akses API dalam 1 checkout.</h2>
            </div>
            <p className="max-w-xl text-slate-600">Pembelian memakai saldo wallet. Setelah aktif, kamu bisa buat API key dari dashboard dan pantau request terbaru.</p>
          </div>

          {message && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">{message}</div>}

          {loading ? (
            <div className="grid gap-5 md:grid-cols-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-[2rem] bg-white/80" />)}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {plans.map((plan, index) => (
                <article key={plan.code} className={`rounded-[2rem] border bg-white p-6 shadow-sm ${index === 1 ? 'border-slate-900 ring-4 ring-amber-200' : 'border-slate-200'}`}>
                  <div className="mb-5 flex items-center justify-between">
                    <div className="rounded-2xl bg-slate-950 p-3 text-amber-300"><Code2 className="h-6 w-6" /></div>
                    {plan.available === false ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">STOK HABIS</span> : index === 1 ? <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-slate-950">REKOMENDASI</span> : null}
                  </div>
                  <h3 className="text-2xl font-black">{plan.name}</h3>
                  <p className="mt-2 min-h-12 text-sm text-slate-600">{plan.description}</p>
                  <div className="mt-6 text-4xl font-black">{plan.price_label || formatRupiah(plan.price)}</div>
                  <p className="mt-1 text-sm text-slate-500">
                    {plan.billing_model === 'pay_per_request' ? 'Tanpa biaya langganan' : `Aktif ${plan.duration_days} hari`}
                  </p>
                  <div className="mt-6 space-y-3 text-sm text-slate-700">
                    <p className="flex items-center"><ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" /> {plan.billing_model === 'pay_per_request' ? 'Charge per request billable berhasil' : 'Fair-use aktif selama paket berjalan'}</p>
                    <p className="flex items-center"><Wallet className="mr-2 h-4 w-4 text-emerald-600" /> Pakai saldo DigiMarket</p>
                  </div>
                  {plan.stock_managed ? (
                    <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                      Stok tersisa {plan.stock_remaining ?? 0} dari {plan.stock_total ?? 0} slot
                    </p>
                  ) : null}
                  {plan.model_labels?.length ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {plan.model_labels.slice(0, 6).map((label) => (
                        <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{label}</span>
                      ))}
                      {plan.model_labels.length > 6 && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">+{plan.model_labels.length - 6} model</span>}
                    </div>
                  ) : null}
                  <button onClick={() => checkout(plan)} disabled={checkingOut === plan.code || plan.available === false} className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
                    {checkingOut === plan.code ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {plan.available === false ? 'Stok habis' : 'Checkout pakai wallet'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
