"use client"

import axios from 'axios'
import type { ReactNode } from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, Landmark, QrCode, ShieldCheck, Zap } from 'lucide-react'

import { buildLoginHref, buildPathWithSearch } from '@/lib/auth'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { formatRupiah } from '@/lib/utils'
import { sosmedService as sosmedServiceApi } from '@/services/sosmedService'
import { sosmedOrderService } from '@/services/sosmedOrderService'
import { useAuthStore } from '@/store/authStore'
import type { SosmedService } from '@/types/sosmedService'

type PakasirMethod = 'qris' | 'bri_va' | 'bni_va' | 'permata_va'

const PAKASIR_METHOD_OPTIONS: Array<{ key: PakasirMethod; label: string; hint: string; icon: ReactNode }> = [
  { key: 'qris', label: 'QRIS', hint: 'Scan QRIS dari aplikasi e-wallet atau m-banking', icon: <QrCode className="w-4 h-4" /> },
  { key: 'bri_va', label: 'BRI Virtual Account', hint: 'Bayar via transfer VA BRI', icon: <Landmark className="w-4 h-4" /> },
  { key: 'bni_va', label: 'BNI Virtual Account', hint: 'Bayar via transfer VA BNI', icon: <Landmark className="w-4 h-4" /> },
  { key: 'permata_va', label: 'Permata Virtual Account', hint: 'Bayar via transfer VA Permata', icon: <Landmark className="w-4 h-4" /> },
]

function defaultCheckoutPrice(service: SosmedService | null) {
  if (!service) return 0
  if (service.checkout_price && service.checkout_price > 0) return service.checkout_price
  return 0
}

const MAX_SOSMED_PACKAGE_QUANTITY = 1000

function clampSosmedPackageQuantity(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_SOSMED_PACKAGE_QUANTITY, Math.max(1, Math.floor(value)))
}

export default function SosmedCheckoutPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <div className="py-32 text-center text-sm text-[#888]">Memuat checkout sosmed...</div>
          <Footer />
        </>
      }
    >
      <SosmedCheckoutContent />
    </Suspense>
  )
}

function SosmedCheckoutContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const serviceCode = (searchParams.get('service') || '').trim().toLowerCase()

  const { isAuthenticated, hasHydrated, isBootstrapped } = useAuthStore()
  const authReady = hasHydrated && isBootstrapped

  const [service, setService] = useState<SosmedService | null>(null)
  const [targetLink, setTargetLink] = useState('')
  const [packageQuantity, setPackageQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [loadingService, setLoadingService] = useState(true)

  const [pakasirMethod, setPakasirMethod] = useState<PakasirMethod>('qris')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const checkoutPrice = useMemo(() => defaultCheckoutPrice(service), [service])
  const totalPrice = useMemo(() => checkoutPrice * packageQuantity, [checkoutPrice, packageQuantity])
  const estimatedUnits = useMemo(() => packageQuantity * 1000, [packageQuantity])

  useEffect(() => {
    if (!authReady) return

    if (!isAuthenticated) {
      router.replace(buildLoginHref(buildPathWithSearch(pathname, searchParams?.toString())))
      return
    }

    if (!serviceCode) {
      router.replace('/product/sosmed')
      return
    }

    let alive = true
    setLoadingService(true)

    sosmedServiceApi
      .list()
      .then((res) => {
        if (!alive) return
        if (!res.success) {
          setError(res.message || 'Layanan sosmed tidak ditemukan')
          return
        }

        const matched = (res.data || []).find((item) => (item.code || '').toLowerCase() === serviceCode)
        if (!matched) {
          setError('Layanan sosmed tidak ditemukan')
          return
        }
        setService(matched)
      })
      .catch(() => {
        if (!alive) return
        setError('Gagal memuat layanan sosmed')
      })
      .finally(() => {
        if (alive) setLoadingService(false)
      })

    return () => {
      alive = false
    }
  }, [authReady, isAuthenticated, pathname, router, searchParams, serviceCode])

  const handleCheckout = async () => {
    if (!service) return

    if (!targetLink.trim()) {
      setError('Target link/username wajib diisi')
      return
    }

    if (checkoutPrice <= 0) {
      setError('Harga checkout layanan belum diatur, hubungi admin')
      return
    }

    const normalizedQuantity = clampSosmedPackageQuantity(packageQuantity)
    if (normalizedQuantity !== packageQuantity) {
      setPackageQuantity(normalizedQuantity)
    }

    setSubmitting(true)
    setError('')

    try {
      const orderRes = await sosmedOrderService.create({
        service_id: service.id,
        target_link: targetLink.trim(),
        quantity: normalizedQuantity,
        notes: notes.trim(),
      })
      if (!orderRes.success) {
        setError(orderRes.message || 'Gagal membuat order sosmed')
        return
      }

      const order = orderRes.data.order

      const payRes = await sosmedOrderService.createPayment({
        order_id: order.id,
        payment_method: pakasirMethod,
      })
      if (!payRes.success) {
        setError(payRes.message || 'Gagal membuat invoice pembayaran')
        return
      }

      const payment = payRes.data
      const query = new URLSearchParams({
        id: order.id,
        paymentNumber: payment.payment_number || '',
        paymentMethod: payment.payment_method || pakasirMethod,
        gatewayOrderId: payment.gateway_order_id || '',
        amount: String(payment.total_payment || payment.amount || order.total_price),
        expiresAt: payment.expires_at || '',
      })

      router.push(`/product/sosmed/checkout/invoice?${query.toString()}`)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message
        setError(message || 'Checkout sosmed gagal')
      } else {
        setError('Checkout sosmed gagal')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!authReady || loadingService) {
    return (
      <>
        <Navbar />
        <div className="py-32 text-center text-sm text-[#888]">Memuat checkout sosmed...</div>
        <Footer />
      </>
    )
  }

  if (!service) {
    return (
      <>
        <Navbar />
        <section className="py-16">
          <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <h1 className="text-lg font-extrabold text-red-700">Layanan tidak ditemukan</h1>
            <p className="mt-2 text-sm text-red-600">{error || 'Service sosmed yang lu pilih tidak tersedia.'}</p>
          </div>
        </section>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <section className="py-12 md:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-2xl font-extrabold mb-8 text-center">Checkout Sosmed</h1>

          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 mb-6">
            <h3 className="text-sm font-bold mb-4">Ringkasan Layanan</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm gap-4">
                <span className="text-[#888]">Layanan</span>
                <span className="font-semibold text-right">{service.title}</span>
              </div>
              <div className="flex justify-between text-sm gap-4">
                <span className="text-[#888]">Kategori</span>
                <span className="font-semibold text-right">{service.category_code || '-'}</span>
              </div>
              <div className="flex justify-between text-sm gap-4">
                <span className="text-[#888]">Platform</span>
                <span className="font-semibold text-right">{service.platform_label || '-'}</span>
              </div>
              <div className="flex justify-between text-sm gap-4">
                <span className="text-[#888]">Harga per paket</span>
                <span className="font-semibold text-right">{formatRupiah(checkoutPrice)} / 1K</span>
              </div>
              <div className="flex justify-between text-sm gap-4">
                <span className="text-[#888]">Jumlah paket</span>
                <span className="font-semibold text-right">
                  {packageQuantity.toLocaleString('id-ID')} paket ({estimatedUnits.toLocaleString('id-ID')} unit)
                </span>
              </div>
              <div className="border-t border-[#EBEBEB] pt-3 flex justify-between gap-4">
                <span className="font-bold">Total</span>
                <span className="text-xl font-extrabold text-[#FF5733]">{formatRupiah(totalPrice)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 mb-6 space-y-4">
            <h3 className="text-sm font-bold">Data Pesanan</h3>
            <div>
              <label className="block text-xs font-semibold text-[#666] mb-1">Target Link / Username</label>
              <input
                value={targetLink}
                onChange={(event) => setTargetLink(event.target.value)}
                placeholder="contoh: https://instagram.com/username"
                className="w-full rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#666] mb-1">Jumlah Paket 1K</label>
              <div className="flex overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
                <input
                  value={packageQuantity}
                  onChange={(event) => setPackageQuantity(clampSosmedPackageQuantity(Number(event.target.value)))}
                  type="number"
                  min={1}
                  max={MAX_SOSMED_PACKAGE_QUANTITY}
                  className="w-full px-3 py-2.5 text-sm outline-none"
                />
                <div className="flex min-w-20 items-center justify-center border-l border-[#E5E5E5] bg-[#FAFAF8] px-3 text-xs font-bold text-[#666]">
                  x 1K
                </div>
              </div>
              <p className="mt-1 text-xs text-[#888]">
                1 paket = 1.000 unit layanan. Contoh: 5 paket berarti sekitar 5.000 followers/unit.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[1, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPackageQuantity(preset)}
                    className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                      packageQuantity === preset
                        ? 'border-[#141414] bg-[#141414] text-white'
                        : 'border-[#E5E5E5] bg-white text-[#666] hover:border-[#141414]'
                    }`}
                  >
                    {preset.toLocaleString('id-ID')}K
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#666] mb-1">Catatan (opsional)</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="catatan untuk order ini"
                className="w-full rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 mb-6 space-y-3">
            <h3 className="text-sm font-bold mb-1">Metode Pembayaran</h3>

            <div className="w-full rounded-xl border p-4 text-left border-[#FF5733] bg-[#FFF3EF]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F7F7F5] flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#141414]" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Pakasir Gateway</div>
                  <div className="text-xs text-[#888]">QRIS / Virtual Account otomatis via Pakasir</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#EBEBEB] p-3 bg-[#FAFAF8] space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#777]">Pilih channel Pakasir</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAKASIR_METHOD_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPakasirMethod(option.key)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      pakasirMethod === option.key
                        ? 'border-[#141414] bg-white'
                        : 'border-[#E5E5E5] bg-white/70 hover:border-[#CFCFCF]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#141414]">
                      {option.icon}
                      {option.label}
                    </div>
                    <div className="text-[11px] text-[#888] mt-1">{option.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#F7F7F5] rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { icon: <Zap className="w-5 h-5" />, text: 'Pengiriman Instan' },
                { icon: <ShieldCheck className="w-5 h-5" />, text: 'Garansi Layanan' },
                { icon: <CreditCard className="w-5 h-5" />, text: 'Pembayaran Aman' },
              ].map((f, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="text-[#FF5733]">{f.icon}</div>
                  <span className="text-xs font-medium text-[#888]">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-6 text-center font-medium">{error}</div>
          )}

          <button
            onClick={handleCheckout}
            disabled={submitting}
            className="w-full py-4 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 text-sm"
          >
            {submitting ? 'Memproses Pembayaran...' : `Buat Invoice ${formatRupiah(totalPrice)}`}
          </button>

          <p className="text-xs text-center text-[#888] mt-4">
            Dengan melanjutkan, lu menyetujui syarat pembelian layanan sosmed.
          </p>
        </div>
      </section>
      <Footer />
    </>
  )
}
