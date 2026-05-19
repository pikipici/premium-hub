"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'

import { LOADING_COPY } from '@/lib/copy/loading'
import { formatRupiah } from '@/lib/utils'
import { gmailService } from '@/services/gmailService'
import { walletService } from '@/services/walletService'
import type { GmailAvailability, GmailPricingPreview } from '@/types/gmail'

export default function GmailBuyPage() {
  const router = useRouter()
  const [pricing, setPricing] = useState<GmailPricingPreview | null>(null)
  const [availability, setAvailability] = useState<GmailAvailability | null>(null)
  const [walletSpend, setWalletSpend] = useState<number | null>(null)
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [p, a, b] = await Promise.all([
        gmailService.getPricing(),
        gmailService.getAvailability(),
        walletService.getBalanceDetailed().catch(() => null),
      ])
      setPricing(p.data ?? null)
      setAvailability(a.data ?? null)
      // BalanceDetailed response shape: { spend: number, earn: number, ... }
      setWalletSpend((b?.data as any)?.spend ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat info pembelian.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const calc = useMemo(() => {
    if (!pricing) return null
    const gross = qty * pricing.sell_price
    let discountPct = 0
    if (pricing.bulk_discount_enabled && pricing.bulk_discount_tiers) {
      const sorted = [...pricing.bulk_discount_tiers].sort((a, b) => b.min_qty - a.min_qty)
      const hit = sorted.find((t) => qty >= t.min_qty)
      if (hit) discountPct = hit.discount_pct
    }
    const discount = Math.floor((gross * discountPct) / 100)
    const net = gross - discount
    return { gross, discount, net, discountPct }
  }, [qty, pricing])

  const insufficientBalance = walletSpend !== null && calc !== null && walletSpend < calc.net
  const overStock = availability !== null && qty > availability.available
  const overMax = qty > 50
  const blocked = !calc || insufficientBalance || overStock || overMax || qty < 1

  const submit = async () => {
    if (blocked) return
    setSubmitting(true)
    setError('')
    try {
      const res = await gmailService.buy({ quantity: qty })
      const orderID = (res.data as any)?.order?.id
      if (!orderID) throw new Error('Order ID tidak ditemukan di respons')
      router.push(`/dashboard/gmail/buy/orders/${orderID}?fresh=1`)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal proses pembelian.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard/gmail"
          className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5]"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <h1 className="text-xl font-semibold text-[#141414]">Beli Gmail</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {LOADING_COPY.detail}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="rounded-3xl border border-[#EBEBEB] bg-white p-6 lg:col-span-2">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-[#141414] p-3 text-white">
                <Mail className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[#141414]">Order baru</h2>
                <p className="mt-1 text-sm text-[#6B6B6B]">
                  Tentukan jumlah akun. Pembayaran pakai Saldo Utama. Akun bakal di-deliver instant setelah klik beli.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <label htmlFor="qty" className="text-sm font-medium text-[#141414]">
                Jumlah akun
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 rounded-full border border-[#EBEBEB] bg-white text-lg text-[#141414] hover:bg-[#F7F7F5]"
                  disabled={qty <= 1}
                >
                  −
                </button>
                <input
                  id="qty"
                  type="number"
                  min={1}
                  max={50}
                  value={qty}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value || '1', 10)
                    setQty(Number.isNaN(v) ? 1 : Math.max(1, Math.min(50, v)))
                  }}
                  className="h-10 w-24 rounded-full border border-[#EBEBEB] bg-white px-4 text-center text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(50, q + 1))}
                  className="h-10 w-10 rounded-full border border-[#EBEBEB] bg-white text-lg text-[#141414] hover:bg-[#F7F7F5]"
                  disabled={qty >= 50}
                >
                  +
                </button>
                <span className="text-xs text-[#6B6B6B]">max 50 / order</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]">
                {error}
              </div>
            )}

            {overStock && (
              <div className="mt-4 rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]">
                Stok cuma {availability?.available ?? 0} akun. Kurangi quantity.
              </div>
            )}
            {insufficientBalance && (
              <div className="mt-4 rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]">
                Saldo Utama gak cukup. Topup dulu di /dashboard/wallet/topup.
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B6B6B]">Subtotal ({qty} akun)</span>
                <span className="text-[#141414]">{formatRupiah(calc?.gross ?? 0)}</span>
              </div>
              {calc && calc.discount > 0 && (
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-[#6B6B6B]">Diskon ({calc.discountPct}%)</span>
                  <span className="text-[#10A37F]">-{formatRupiah(calc.discount)}</span>
                </div>
              )}
              <div className="mt-3 border-t border-[#EBEBEB] pt-3 flex justify-between text-base font-semibold">
                <span className="text-[#141414]">Total Bayar</span>
                <span className="text-[#141414]">{formatRupiah(calc?.net ?? 0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={blocked || submitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#141414] px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses…
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Beli {qty} Akun
                </>
              )}
            </button>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                Saldo Utama
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#141414]">
                {walletSpend !== null ? formatRupiah(walletSpend) : '—'}
              </div>
              <Link
                href="/dashboard/wallet/topup"
                className="mt-2 inline-block text-xs text-[#FF5733] hover:underline"
              >
                Topup Saldo
              </Link>
            </div>
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#141414]">
                <ShieldCheck className="h-4 w-4 text-[#10A37F]" />
                Garansi 1×24 Jam
              </div>
              <p className="mt-2 text-xs text-[#6B6B6B]">
                Kalo akun banned dalam 24 jam, kita kasih ganti dari pool. Stok kosong? Refund full ke Saldo Utama.
              </p>
            </div>
            <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#141414]">
                <CheckCircle2 className="h-4 w-4 text-[#10A37F]" />
                Verified Manual
              </div>
              <p className="mt-2 text-xs text-[#6B6B6B]">
                Setiap akun di-test login sama admin + password udah di-rotate biar gak bisa di-hackback.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
