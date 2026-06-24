"use client"

import axios from 'axios'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Eye,
  Globe,
  Lock,
  ShieldCheck,
} from 'lucide-react'

import { buildLoginHref, buildPathWithSearch } from '@/lib/auth'
import { clearCheckoutIdempotencyKey, getOrCreateCheckoutIdempotencyKey } from '@/lib/checkoutIdempotency'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { CheckoutSkeleton } from '@/components/sosmed-checkout/CheckoutSkeleton'
import { PaymentMethodSelector, type PaymentMethod } from '@/components/sosmed-checkout/PaymentMethodSelector'
import { QuantityStepper } from '@/components/sosmed-checkout/QuantityStepper'
import { getPlatformBadge } from '@/lib/platformConfig'
import { SOSMED_TARGET_INPUT_COPY } from '@/lib/sosmedCheckoutCopy'
import { buildSosmedCheckoutServiceDisplay } from '@/lib/sosmedCheckoutDisplay'
import { sanitizeProviderServiceTitle } from '@/lib/sosmedBundlingCards'
import { formatRupiah } from '@/lib/utils'
import { sosmedBundleService as sosmedBundleServiceApi } from '@/services/sosmedBundleService'
import { sosmedService as sosmedServiceApi } from '@/services/sosmedService'
import { sosmedOrderService } from '@/services/sosmedOrderService'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import type { SosmedBundlePackage, SosmedBundleVariant } from '@/types/sosmedBundle'
import type { SosmedService } from '@/types/sosmedService'

function defaultCheckoutPrice(service: SosmedService | null) {
  if (!service) return 0
  const promoPrice = service.promotion?.final_price || 0
  if (promoPrice > 0) return promoPrice
  if (service.checkout_price && service.checkout_price > 0) return service.checkout_price
  return 0
}

function originalCheckoutPrice(service: SosmedService | null) {
  if (!service?.promotion) return 0
  const originalPrice = service.promotion.original_price || service.checkout_price || 0
  return originalPrice > defaultCheckoutPrice(service) ? originalPrice : 0
}

const MAX_SOSMED_PACKAGE_QUANTITY = 1000

/** Parse max_order string dari API (e.g. "10000", "50000") ke jumlah paket 1K.
 * Fallback ke MAX_SOSMED_PACKAGE_QUANTITY kalau string kosong / tidak valid.
 */
function parseMaxOrderToPackages(maxOrder: string | undefined): number {
  if (!maxOrder || maxOrder.trim() === '') return MAX_SOSMED_PACKAGE_QUANTITY
  // Normalize: strip titik/koma ribuan, ambil angka pertama
  const normalized = maxOrder.replace(/[.,]/g, '').trim()
  const parsed = parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_SOSMED_PACKAGE_QUANTITY
  // Convert unit ke paket 1K, minimal 1
  return Math.max(1, Math.ceil(parsed / 1000))
}

/** Generate preset pills yang valid untuk maxPackages.
 * Default [1, 5, 10] tapi filter yang > maxPackages, tambah maxPackages kalau belum ada.
 */
function buildQuantityPresets(maxPackages: number): number[] {
  const defaults = [1, 5, 10]
  const filtered = defaults.filter((p) => p <= maxPackages)
  if (filtered.length === 0) return [1]
  if (!filtered.includes(maxPackages) && maxPackages <= 10) {
    filtered.push(maxPackages)
  }
  return filtered
}

function clampSosmedPackageQuantity(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_SOSMED_PACKAGE_QUANTITY, Math.max(1, Math.floor(value)))
}

function buildCheckoutIdempotencyFingerprint(parts: Array<boolean | number | string | null | undefined>) {
  return parts
    .map((part) => String(part ?? '').trim())
    .join('|')
}

export default function SosmedCheckoutPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <CheckoutSkeleton />
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
  const bundleKey = (searchParams.get('bundle') || '').trim().toLowerCase()
  const variantKey = (searchParams.get('variant') || '').trim().toLowerCase()
  const isBundleCheckout = Boolean(bundleKey || variantKey)

  const { isAuthenticated, hasHydrated, isBootstrapped } = useAuthStore()
  const authReady = hasHydrated && isBootstrapped

  const [service, setService] = useState<SosmedService | null>(null)
  const [bundlePackage, setBundlePackage] = useState<SosmedBundlePackage | null>(null)
  const [bundleVariant, setBundleVariant] = useState<SosmedBundleVariant | null>(null)
  const [targetLink, setTargetLink] = useState('')
  const [bundleItemTargets, setBundleItemTargets] = useState<Record<string, string>>({})
  const [packageQuantity, setPackageQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [targetPublicConfirmed, setTargetPublicConfirmed] = useState(false)
  const [loadingService, setLoadingService] = useState(true)
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const confirmationRef = useRef<HTMLLabelElement | null>(null)
  const [confirmationNudge, setConfirmationNudge] = useState(false)

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const isPaymentGateway = selectedPaymentMethod !== null && selectedPaymentMethod.type !== 'wallet'

  const checkoutPrice = useMemo(() => defaultCheckoutPrice(service), [service])
  const checkoutOriginalPrice = useMemo(() => originalCheckoutPrice(service), [service])
  const bundleTotalPrice = bundleVariant?.total_price || 0

  // Derived max packages dari max_order produk, fallback 1000
  const maxPackages = useMemo(() => parseMaxOrderToPackages(service?.max_order), [service])
  const quantityPresets = useMemo(() => buildQuantityPresets(maxPackages), [maxPackages])
  const totalPrice = useMemo(
    () => (isBundleCheckout ? bundleTotalPrice : checkoutPrice * packageQuantity),
    [bundleTotalPrice, checkoutPrice, isBundleCheckout, packageQuantity]
  )
  const serviceDisplay = useMemo(
    () => (service ? buildSosmedCheckoutServiceDisplay(service, packageQuantity) : null),
    [packageQuantity, service]
  )
  const walletBalanceAfter = walletBalance === null ? null : walletBalance - totalPrice
  const walletEnough = walletBalance === null || walletBalanceAfter === null || walletBalanceAfter >= 0

  useEffect(() => {
    if (!authReady) return

    if (!isAuthenticated) {
      router.replace(buildLoginHref(buildPathWithSearch(pathname, searchParams?.toString())))
      return
    }

    if (isBundleCheckout) {
      if (!bundleKey || !variantKey) {
        router.replace('/product/sosmed')
        return
      }

      let alive = true
      setLoadingService(true)
      setError('')
      setService(null)

      sosmedBundleServiceApi
        .getByKey(bundleKey)
        .then((res) => {
          if (!alive) return
          if (!res.success) {
            setError(res.message || 'Paket bundling sosmed tidak ditemukan')
            return
          }

          const matchedVariant = (res.data.variants || []).find((item) => (item.key || '').toLowerCase() === variantKey)
          if (!matchedVariant) {
            setError('Varian paket bundling tidak ditemukan')
            return
          }
          setBundlePackage(res.data)
          setBundleVariant(matchedVariant)
          setBundleItemTargets(
            Object.fromEntries((matchedVariant.items || []).map((item, index) => [item.id || item.service_id || `${item.service_code}-${index}`, '']))
          )
        })
        .catch(() => {
          if (!alive) return
          setError('Gagal memuat paket bundling sosmed')
        })
        .finally(() => {
          if (alive) setLoadingService(false)
        })

      return () => {
        alive = false
      }
    }

    if (!serviceCode) {
      router.replace('/product/sosmed')
      return
    }

    let alive = true
    setLoadingService(true)
    setError('')
    setBundlePackage(null)
    setBundleVariant(null)
    setBundleItemTargets({})

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
  }, [authReady, bundleKey, isAuthenticated, isBundleCheckout, pathname, router, searchParams, serviceCode, variantKey])

  useEffect(() => {
    if (!authReady || !isAuthenticated) return

    let alive = true
    setLoadingWallet(true)

    walletService
      .getBalance()
      .then((res) => {
        if (!alive) return
        if (res.success) {
          setWalletBalance(res.data.balance)
        }
      })
      .catch(() => {
        if (!alive) return
        setWalletBalance(null)
      })
      .finally(() => {
        if (alive) setLoadingWallet(false)
      })

    return () => {
      alive = false
    }
  }, [authReady, isAuthenticated])

  const handleCheckout = async () => {
    if (!isBundleCheckout && !service) return
    if (isBundleCheckout && (!bundlePackage || !bundleVariant)) return

    const normalizedTargetLink = targetLink.trim()
    const normalizedNotes = notes.trim()
    const normalizedBundleItemTargets = (bundleVariant?.items || []).map((item, index) => {
      const key = item.id || item.service_id || `${item.service_code}-${index}`
      return {
        bundle_item_id: item.id,
        sosmed_service_id: item.service_id,
        target_link: (bundleItemTargets[key] || '').trim(),
      }
    })

    if (!isBundleCheckout && !normalizedTargetLink) {
      setError('Target link/username wajib diisi')
      return
    }

    if (isBundleCheckout && normalizedBundleItemTargets.some((item) => !item.target_link)) {
      setError('Isi target link untuk semua item di paket spesial ini')
      return
    }

    if (!isBundleCheckout && checkoutPrice <= 0) {
      setError('Harga checkout layanan belum diatur, hubungi admin')
      return
    }

    if (isBundleCheckout && totalPrice <= 0) {
      setError('Harga checkout paket bundling belum tersedia, hubungi admin')
      return
    }

    if (walletBalance !== null && walletBalance < totalPrice) {
      setError('Saldo wallet lu tidak cukup. Top up dulu sebelum checkout sosmed.')
      return
    }

    if (!targetPublicConfirmed) {
      setError('Cek dulu syarat targetnya, lalu centang konfirmasi sebelum bayar.')
      if (typeof window !== 'undefined' && confirmationRef.current) {
        confirmationRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setConfirmationNudge(true)
        window.setTimeout(() => setConfirmationNudge(false), 1800)
      }
      return
    }

    const normalizedQuantity = clampSosmedPackageQuantity(packageQuantity)
    if (normalizedQuantity !== packageQuantity) {
      setPackageQuantity(normalizedQuantity)
    }

    setSubmitting(true)
    setError('')

    try {
      if (isBundleCheckout && bundlePackage && bundleVariant) {
        const idempotencyFingerprint = buildCheckoutIdempotencyFingerprint([
          'bundle',
          bundlePackage.key,
          bundleVariant.key,
          normalizedBundleItemTargets.map((item) => `${item.bundle_item_id || item.sosmed_service_id || ''}:${item.target_link}`).join(','),
          normalizedNotes,
          'wallet',
          targetPublicConfirmed,
        ])
        const checkoutIdempotencyKey = getOrCreateCheckoutIdempotencyKey({
          flow: 'sosmed-bundle',
          fingerprint: idempotencyFingerprint,
        })
        const orderRes = await sosmedBundleServiceApi.createOrder({
          bundle_key: bundlePackage.key,
          variant_key: bundleVariant.key,
          target_link: normalizedBundleItemTargets[0]?.target_link || '',
          item_targets: normalizedBundleItemTargets,
          notes: normalizedNotes,
          payment_method: 'wallet',
          idempotency_key: checkoutIdempotencyKey,
          target_public_confirmed: targetPublicConfirmed,
        })
        if (!orderRes.success) {
          setError(orderRes.message || 'Gagal membuat order bundle sosmed')
          return
        }

        clearCheckoutIdempotencyKey({
          flow: 'sosmed-bundle',
          fingerprint: idempotencyFingerprint,
        })
        router.push(`/product/sosmed/checkout/success?type=bundle&order=${encodeURIComponent(orderRes.data.order_number)}`)
        return
      }

      if (!service) return

      const idempotencyFingerprint = buildCheckoutIdempotencyFingerprint([
        'order',
        service.id,
        normalizedTargetLink,
        normalizedQuantity,
        normalizedNotes,
        targetPublicConfirmed,
      ])
      const checkoutIdempotencyKey = getOrCreateCheckoutIdempotencyKey({
        flow: 'sosmed-order',
        fingerprint: idempotencyFingerprint,
      })
      const orderRes = await sosmedOrderService.create({
        service_id: service.id,
        target_link: normalizedTargetLink,
        quantity: normalizedQuantity,
        notes: normalizedNotes,
        target_public_confirmed: targetPublicConfirmed,
        idempotency_key: checkoutIdempotencyKey,
      })
      if (!orderRes.success) {
        setError(orderRes.message || 'Gagal membuat order sosmed')
        return
      }

      const order = orderRes.data.order
      clearCheckoutIdempotencyKey({
        flow: 'sosmed-order',
        fingerprint: idempotencyFingerprint,
      })
      router.push(`/product/sosmed/checkout/success?id=${encodeURIComponent(order.id)}`)
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
        <CheckoutSkeleton />
        <Footer />
      </>
    )
  }

  if (!isBundleCheckout && !service) {
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

  if (isBundleCheckout && (!bundlePackage || !bundleVariant)) {
    return (
      <>
        <Navbar />
        <section className="py-16">
          <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <h1 className="text-lg font-extrabold text-red-700">Paket tidak ditemukan</h1>
            <p className="mt-2 text-sm text-red-600">{error || 'Paket bundling sosmed yang lu pilih tidak tersedia.'}</p>
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
        <div className="mx-auto max-w-5xl px-4">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-[#888]">
            <Link href="/product/sosmed" className="hover:text-[#FF5733] transition-colors">Katalog DigiSosmed</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[#141414]">{isBundleCheckout ? (bundlePackage?.title || 'Paket') : (service?.platform_label || 'Checkout')}</span>
          </div>

          <h1 className="text-2xl font-extrabold mb-8">{isBundleCheckout ? 'Checkout Paket Spesial' : 'Checkout DigiSosmed'}</h1>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* LEFT COLUMN: Form + Confirmation */}
            <div className="lg:col-span-3 space-y-6">

              {/* Data Pesanan */}
              <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 space-y-4">
                <h3 className="text-sm font-bold">Data Pesanan</h3>
                {isBundleCheckout ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#666] mb-1">Target per item paket</label>
                      <p className="text-xs text-[#888]">Isi link/username sesuai platform masing-masing item.</p>
                    </div>
                    {(bundleVariant?.items || []).map((item, index) => {
                      const key = item.id || item.service_id || `${item.service_code}-${index}`
                      const platformCfg = getPlatformBadge(item.title || '')
                      return (
                        <div key={key} className={`rounded-xl border bg-[#FAFAF8] p-3 ${platformCfg?.badgeBg || 'border-[#E5E5E5]'}`}>
                          <label className="mb-1 flex items-center gap-2 text-xs font-bold text-[#444]">
                            {platformCfg && (
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${platformCfg.bgClass}`}>
                                <platformCfg.icon className="h-3 w-3 text-white" />
                              </span>
                            )}
                            {sanitizeProviderServiceTitle(item.title)}
                            <span className="ml-auto font-semibold text-[#888]">{item.quantity_units.toLocaleString('id-ID')} unit</span>
                          </label>
                          <input
                            value={bundleItemTargets[key] || ''}
                            onChange={(event) => setBundleItemTargets((prev) => ({ ...prev, [key]: event.target.value }))}
                            placeholder={`Masukkan link/username ${platformCfg?.label || 'target'} untuk item ini`}
                            className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm"
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#666] mb-1">{SOSMED_TARGET_INPUT_COPY.label}</label>
                    <input
                      value={targetLink}
                      onChange={(event) => setTargetLink(event.target.value)}
                      placeholder={SOSMED_TARGET_INPUT_COPY.placeholder}
                      className="w-full rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-sm"
                    />
                    <p className="mt-1 text-xs text-[#888]">{SOSMED_TARGET_INPUT_COPY.helper}</p>
                  </div>
                )}

                {!isBundleCheckout && (
                  <QuantityStepper
                    value={packageQuantity}
                    onChange={setPackageQuantity}
                    min={1}
                    max={maxPackages}
                    presets={quantityPresets}
                    helper={`1 paket = 1.000 unit layanan.${maxPackages < MAX_SOSMED_PACKAGE_QUANTITY ? ` Maks. ${maxPackages.toLocaleString('id-ID')} paket (${(maxPackages * 1000).toLocaleString('id-ID')} unit).` : ' Contoh: 5 paket berarti sekitar 5.000 followers/unit.'}`}
                  />
                )}

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

              {/* Cek Dulu */}
              <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-5">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#FF5733]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold text-[#141414]">Cek dulu sebelum bayar</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#666]">
                      Biar order lancar, pastiin target bisa diakses supplier selama proses jalan.
                    </p>
                    <div className="mt-3 grid gap-2 text-xs font-semibold text-[#7C2D12] grid-cols-1 sm:grid-cols-2">
                      <div className="flex items-center gap-2 rounded-xl border border-[#FDBA74] bg-white/75 px-3 py-2">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span>Akun/link target public</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-[#FDBA74] bg-white/75 px-3 py-2">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span>Username/link tidak diganti</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-[#FDBA74] bg-white/75 px-3 py-2">
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        <span>Target tidak dihapus/private</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-[#FDBA74] bg-white/75 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Hindari order dobel sebelum selesai</span>
                      </div>
                    </div>

                    <label
                      ref={confirmationRef}
                      className={`mt-4 flex cursor-pointer gap-3 rounded-xl border bg-white px-3 py-3 text-sm font-semibold text-[#141414] transition-all duration-500 ${
                        confirmationNudge
                          ? 'border-[#FF5733] ring-2 ring-[#FFD9CF]'
                          : 'border-[#FDBA74]'
                      }`}
                    >
                      <input
                        checked={targetPublicConfirmed}
                        onChange={(event) => setTargetPublicConfirmed(event.target.checked)}
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-[#FF5733]"
                      />
                      <span>
                        Gue pastikan akun/link target sudah public, aktif, dan tidak akan gue ubah sampai order selesai.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm p-3 rounded-xl text-center font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Summary + Payment (sticky) */}
            <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-24 lg:self-start">

              {/* Ringkasan Layanan */}
              <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6">
                <h3 className="text-sm font-bold mb-4">{isBundleCheckout ? 'Ringkasan Paket' : 'Ringkasan Layanan'}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm gap-4">
                    <span className="text-[#888]">{isBundleCheckout ? 'Paket' : 'Layanan'}</span>
                    <span className="font-semibold text-right max-w-[60%] break-words">
                      {(() => {
                        const title = isBundleCheckout ? bundlePackage?.title : serviceDisplay?.productTitle;
                        const platform = isBundleCheckout ? bundlePackage?.platform : (service?.platform_label || '');
                        const badge = platform ? getPlatformBadge(platform) : null;
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            {badge && (
                              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${badge.bgClass}`}>
                                <badge.icon className="h-3 w-3 text-white" />
                              </span>
                            )}
                            {title}
                          </span>
                        );
                      })()}
                    </span>
                  </div>
                  {isBundleCheckout ? (
                    <>
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-[#888]">Varian</span>
                        <span className="font-semibold text-right">{bundleVariant?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-[#888]">Platform</span>
                        <span className="font-semibold text-right">{bundlePackage?.platform || '-'}</span>
                      </div>
                      <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#888]">Isi Paket</p>
                        <div className="space-y-2">
                          {(bundleVariant?.items || []).map((item) => (
                            <div key={`${item.service_code}-${item.quantity_units}`} className="flex justify-between gap-3 text-xs">
                              <span className="font-semibold text-[#444]">{sanitizeProviderServiceTitle(item.title)}</span>
                              <span className="text-right font-bold text-[#141414]">{item.quantity_units.toLocaleString('id-ID')} unit</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-[#888]">Kategori</span>
                        <span className="font-semibold text-right">{service?.category_code || '-'}</span>
                      </div>
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-[#888]">Platform</span>
                        <span className="font-semibold text-right">{service?.platform_label || '-'}</span>
                      </div>
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-[#888]">Harga per paket</span>
                        <span className="text-right">
                          {checkoutOriginalPrice > 0 ? (
                            <span className="mr-2 text-xs font-semibold text-[#999] line-through">{formatRupiah(checkoutOriginalPrice)}</span>
                          ) : null}
                          <span className="font-semibold">{formatRupiah(checkoutPrice)} / 1K</span>
                        </span>
                      </div>
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-[#888]">Jumlah paket</span>
                        <span className="font-semibold text-right">{serviceDisplay?.quantityLabel}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-[#EBEBEB] pt-3 flex justify-between gap-4">
                    <span className="font-bold">Total</span>
                    <span className="text-xl font-extrabold text-[#FF5733] transition-all duration-300">{formatRupiah(totalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Pembayaran */}
              <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6">
                <h3 className="text-sm font-bold mb-3">Pembayaran</h3>
                <PaymentMethodSelector
                  totalPrice={totalPrice}
                  walletBalance={walletBalance}
                  loadingWallet={loadingWallet}
                  onSelectMethod={setSelectedPaymentMethod}
                  selectedMethod={selectedPaymentMethod}
                />
              </div>

              {/* Tombol Bayar */}
              <button
                onClick={handleCheckout}
                disabled={submitting || (isPaymentGateway ? false : !walletEnough)}
                className="w-full py-4 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 text-sm"
              >
                {submitting
                  ? 'Memproses Order...'
                  : isPaymentGateway
                    ? `Bayar ${formatRupiah(totalPrice)}`
                    : `Bayar Pakai Wallet ${formatRupiah(totalPrice)}`}
              </button>

              <p className="text-xs text-center text-[#888]">
                {isPaymentGateway
                  ? 'Invoice akan dibuat setelah checkout. Order diproses setelah pembayaran dikonfirmasi.'
                  : 'Dengan melanjutkan, saldo wallet lu langsung dipotong dan order dikirim otomatis ke supplier.'}
              </p>
            </div>
          </div>
        </div>
</section>

      <Footer />
    </>
  )
}
