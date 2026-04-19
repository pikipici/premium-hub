"use client"

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { formatRupiah } from '@/lib/utils'
import { orderService } from '@/services/orderService'
import type { Order } from '@/types/order'
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  Mail,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

function accountTypeLabel(value?: string) {
  const normalized = (value || '').trim().toLowerCase()
  if (!normalized) return '-'
  if (normalized === 'shared') return 'Shared'
  if (normalized === 'private') return 'Private'

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function OrderSuksesPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <div className="py-28 text-center text-sm text-[#888]">Memuat detail transaksi...</div>
          <Footer />
        </>
      }
    >
      <OrderSuksesContent />
    </Suspense>
  )
}

function OrderSuksesContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('id')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(() => Boolean(orderId))
  const [copied, setCopied] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!orderId) {
      return
    }

    orderService
      .getByID(orderId)
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setOrder(res.data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrder(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [orderId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const orderCode = order?.id ? `#${(order.id.split('-')[0] || order.id).toUpperCase()}` : '-'

  const maskedPassword = '••••••••••••'
  const passwordValue = (order?.stock?.password || '').trim()
  const passwordText = passwordValue
    ? showPassword
      ? passwordValue
      : maskedPassword
    : 'Belum tersedia, hubungi admin'

  const copyToClip = async (value: string | undefined, field: string, message: string) => {
    const text = (value || '').trim()
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(field)
      setToast(message)
      window.setTimeout(() => {
        setCopied((prev) => (prev === field ? '' : prev))
      }, 1800)
    } catch {
      setToast('Gagal copy, coba lagi')
    }
  }

  return (
    <>
      <Navbar />

      <section className="py-10 md:py-16">
        <div className="mx-auto w-full max-w-[540px] px-4">
          {loading ? (
            <div className="overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white p-6 shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
              <div className="h-24 animate-pulse rounded-2xl bg-[#F2F2EF]" />
              <div className="mt-5 h-10 animate-pulse rounded-xl bg-[#F2F2EF]" />
              <div className="mt-3 h-36 animate-pulse rounded-xl bg-[#F2F2EF]" />
            </div>
          ) : !order ? (
            <div className="rounded-3xl border border-[#F5D0D0] bg-[#FFF5F5] p-6 text-center">
              <h2 className="text-lg font-bold text-[#B91C1C]">Transaksi tidak ditemukan</h2>
              <p className="mt-1 text-sm text-[#7B3D3D]">ID transaksi tidak valid atau belum siap ditampilkan.</p>
              <Link
                href="/product/prem-apps"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-bold text-white"
              >
                <ShoppingBag className="h-4 w-4" />
                Balik Belanja
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#16A34A] to-[#15803D] px-7 py-9 text-center text-white">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h1 className="text-[clamp(1.5rem,1.1rem+1.2vw,2.1rem)] font-extrabold leading-tight tracking-tight">
                  Pembayaran Berhasil! 🎉
                </h1>
                <p className="mt-1 text-sm text-white/80">Akun premium kamu sudah aktif dan siap digunakan.</p>
              </div>

              <div className="flex items-center justify-between px-6 pb-1 pt-5">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#888]">ID Transaksi</span>
                <span className="rounded-full border border-[#E3E3DE] bg-[#F7F7F5] px-3 py-1 font-mono text-sm font-semibold text-[#222]">
                  {orderCode}
                </span>
              </div>

              <div className="px-6 py-5">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#888]">Kredensial Akun</div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 rounded-xl border border-[#E8E8E3] bg-[#FAFAF8] px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E2DD] bg-[#F3F3EF] text-[#777]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-[#888]">Email</div>
                      <div className="truncate text-sm font-semibold text-[#141414]">{order.stock?.email || '-'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClip(order.stock?.email, 'email', 'Email disalin!')}
                      disabled={!order.stock?.email}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDDDD8] bg-white text-[#777] hover:bg-[#F4F4F1] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Copy email"
                    >
                      {copied === 'email' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-[#E8E8E3] bg-[#FAFAF8] px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E2DD] bg-[#F3F3EF] text-[#777]">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-[#888]">Password</div>
                      <div className={`truncate text-sm font-semibold ${passwordValue && !showPassword ? 'tracking-[0.16em] text-[#6B6A66]' : 'text-[#141414]'}`}>
                        {passwordText}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={!passwordValue}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDDDD8] bg-white text-[#777] hover:bg-[#F4F4F1] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Show password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClip(passwordValue, 'password', 'Password disalin!')}
                      disabled={!passwordValue}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDDDD8] bg-white text-[#777] hover:bg-[#F4F4F1] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Copy password"
                    >
                      {copied === 'password' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-[#E8E8E3] bg-[#FAFAF8] px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E2DD] bg-[#F3F3EF] text-[#777]">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-[#888]">Profil</div>
                      <div className="text-sm font-semibold text-[#141414]">{order.stock?.profile_name || '-'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClip(order.stock?.profile_name, 'profile', 'Profil disalin!')}
                      disabled={!order.stock?.profile_name}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDDDD8] bg-white text-[#777] hover:bg-[#F4F4F1] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Copy profile"
                    >
                      {copied === 'profile' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mx-6 h-px bg-[#EEEEEA]" />

              <div className="px-6 py-5">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#888]">Ringkasan Pesanan</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#667EEA] to-[#764BA2] text-white">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#141414]">{order.product?.name || 'Premium Account'}</div>
                      <div className="text-xs text-[#888]">
                        {accountTypeLabel(order.price?.account_type)} · {order.price?.duration || '-'} Bulan · {formatDateTime(order.paid_at || order.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] text-[#888]">Total dibayar</div>
                    <div className="text-lg font-extrabold text-[#141414]">{formatRupiah(order.total_price || 0)}</div>
                  </div>
                </div>
              </div>

              <div className="mx-6 h-px bg-[#EEEEEA]" />

              <div className="flex flex-col gap-3 px-6 pb-6 pt-5 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#141414] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#2A2A2A]"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/product/prem-apps"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#D9D9D2] bg-transparent px-4 py-3 text-sm font-bold text-[#141414] transition-colors hover:bg-[#F4F4F1]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Belanja Lagi
                </Link>
              </div>

              <div className="flex items-center justify-center gap-2 px-6 pb-5 text-[11px] text-[#B3B2AD]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Kredensial bersifat rahasia. Jangan bagikan ke siapapun.
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />

      <div
        className={`fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#141414] px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all duration-200 ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 pointer-events-none'
        }`}
      >
        <Check className="h-3.5 w-3.5" />
        {toast || 'Disalin!'}
      </div>
    </>
  )
}
