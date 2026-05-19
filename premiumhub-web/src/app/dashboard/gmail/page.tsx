"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Loader2,
  Mail,
  RefreshCcw,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'

import { LOADING_COPY } from '@/lib/copy/loading'
import { formatRupiah } from '@/lib/utils'
import { gmailService } from '@/services/gmailService'
import type { GmailAvailability, GmailPricingPreview } from '@/types/gmail'

// Tab strip pattern follows /dashboard/sosmed/orders post-overhaul.
type Tab = 'beli' | 'jual'

const TAB_META: Record<Tab, { label: string; icon: typeof ShoppingBag }> = {
  beli: { label: 'Beli Gmail', icon: ShoppingBag },
  jual: { label: 'Jual Gmail', icon: TrendingUp },
}

export default function GmailMarketplaceHubPage() {
  const [tab, setTab] = useState<Tab>('beli')
  const [pricing, setPricing] = useState<GmailPricingPreview | null>(null)
  const [availability, setAvailability] = useState<GmailAvailability | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    setError('')
    try {
      const [p, a] = await Promise.all([
        gmailService.getPricing(),
        gmailService.getAvailability(),
      ])
      setPricing(p.data ?? null)
      setAvailability(a.data ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat info gmail.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const tiers = useMemo(() => {
    if (!pricing?.bulk_discount_enabled) return []
    return pricing.bulk_discount_tiers ?? []
  }, [pricing])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#141414]">Gmail Marketplace</h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Beli gmail siap pakai dari pool kita, atau setor gmail buatan lu sendiri buat dapet Saldo Pendapatan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-4 py-2 text-sm font-medium text-[#141414] hover:bg-[#F7F7F5] disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Gmail marketplace"
        className="flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white p-1 w-fit"
      >
        {(Object.keys(TAB_META) as Tab[]).map((key) => {
          const meta = TAB_META[key]
          const active = tab === key
          const Icon = meta.icon
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`gmail-tab-${key}`}
              aria-selected={active}
              aria-controls={`gmail-panel-${key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-[#141414] text-white'
                  : 'text-[#6B6B6B] hover:text-[#141414]'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {meta.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div
          className="rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]"
          role="alert"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => fetchAll()}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#A6260F] bg-white px-3 py-1.5 text-xs font-medium text-[#A6260F] hover:bg-[#FFE0D6]"
          >
            <RefreshCcw className="h-3 w-3" aria-hidden="true" />
            Coba Lagi
          </button>
        </div>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          {LOADING_COPY.detail}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`gmail-panel-${tab}`}
          aria-labelledby={`gmail-tab-${tab}`}
        >
          {tab === 'beli' ? (
            <BeliPanel
              pricing={pricing}
              availability={availability}
              tiers={tiers}
            />
          ) : (
            <JualPanel pricing={pricing} />
          )}
        </div>
      )}
    </div>
  )
}

interface BeliPanelProps {
  pricing: GmailPricingPreview | null
  availability: GmailAvailability | null
  tiers: Array<{ min_qty: number; discount_pct: number }>
}

function BeliPanel({ pricing, availability, tiers }: BeliPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-6 lg:col-span-2">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-[#141414] p-3 text-white">
            <Mail className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#141414]">Akun Gmail Siap Pakai</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Verified manual oleh admin, password udah di-rotate biar gak bisa di-hackback. Garansi 1×24 jam — kalo banned dalam 24 jam, kita kasih ganti atau refund full.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-[#141414]">
              <li>• Instant deliver setelah bayar</li>
              <li>• Bisa beli 1-by-1 atau bulk sampai 50 akun per order</li>
              <li>• Garansi 1×24 jam (auto-replace / auto-refund)</li>
            </ul>
          </div>
        </div>

        {tiers.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
              Diskon bulk
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tiers.map((t) => (
                <div key={t.min_qty} className="rounded-xl bg-white p-3">
                  <div className="text-xs text-[#6B6B6B]">Mulai {t.min_qty} akun</div>
                  <div className="mt-1 text-lg font-semibold text-[#141414]">
                    -{t.discount_pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/gmail/buy"
            className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Beli Sekarang <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/gmail/buy/orders"
            className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-5 py-2.5 text-sm font-medium text-[#141414] hover:bg-[#F7F7F5]"
          >
            Order Saya <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
            Harga
          </div>
          <div className="mt-2 text-3xl font-semibold text-[#141414]">
            {pricing ? formatRupiah(pricing.sell_price) : '—'}
          </div>
          <div className="text-xs text-[#6B6B6B]">per akun</div>
        </div>
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
            Stok Tersedia
          </div>
          <div className="mt-2 text-3xl font-semibold text-[#141414]">
            {availability ? availability.available : '—'}
            <span className="ml-1 text-sm font-normal text-[#6B6B6B]">akun</span>
          </div>
          <div className="text-xs text-[#6B6B6B]">refresh tiap 60 detik</div>
        </div>
      </aside>
    </div>
  )
}

interface JualPanelProps {
  pricing: GmailPricingPreview | null
}

function JualPanel({ pricing: _pricing }: JualPanelProps) {
  // BuyPrice (yang platform bayar ke seller) gak diekspos di public
  // pricing endpoint by-design — informasi internal. Sell hub akan
  // baca dari /gmail/slots response saat user request slot.
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-6 lg:col-span-2">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-[#FF5733] p-3 text-white">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#141414]">Setor Gmail, Dapet Saldo Pendapatan</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Bikin akun gmail pake email + password yang kita kasih. Setelah lu submit dan admin verify, lu langsung dapet komisi ke Saldo Pendapatan.
            </p>
            <ol className="mt-4 space-y-2 text-sm text-[#141414]">
              <li>1. Klik "Request Slot" — kita generate email + password</li>
              <li>2. Buka https://accounts.google.com/signup di tab baru</li>
              <li>3. Bikin akun pake creds yang kita kasih (jangan set recovery)</li>
              <li>4. Klik "Saya Sudah Selesai" di slot detail</li>
              <li>5. Admin verify (max 24 jam) → komisi cair</li>
            </ol>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#FFE0D6] bg-[#FFF8F4] p-4">
          <div className="text-sm font-medium text-[#A6260F]">Aturan main</div>
          <ul className="mt-2 space-y-1 text-sm text-[#141414]">
            <li>• Max 3 slot pending bersamaan</li>
            <li>• Slot expired 6 jam — selesai sebelum itu</li>
            <li>• Wajib pake email + password yang kita kasih</li>
            <li>• Dilarang set recovery email/phone</li>
            <li>• Akun gak valid → strike. 3 strike = ban 30 hari</li>
          </ul>
        </div>

        <div className="mt-6">
          <Link
            href="/dashboard/gmail/sell"
            className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Mulai Setor <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
            Pembayaran
          </div>
          <div className="mt-2 text-base font-medium text-[#141414]">
            Saldo Pendapatan
          </div>
          <p className="mt-1 text-xs text-[#6B6B6B]">
            Cair langsung saat admin verify. Bisa di-transfer ke Saldo Utama atau ditarik ke bank/e-wallet.
          </p>
        </div>
      </aside>
    </div>
  )
}
