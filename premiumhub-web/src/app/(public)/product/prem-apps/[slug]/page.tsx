"use client"

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { Check, Clock, ShieldCheck, Zap } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'
import { formatRupiah } from '@/lib/utils'
import { productService } from '@/services/productService'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import type { Product, ProductFAQItem, ProductPrice, ProductSpecItem, ProductTrustBadge } from '@/types/product'

const DEFAULT_TRUST_BADGES: ProductTrustBadge[] = [
  { icon: '🛡', text: 'Garansi 30 Hari' },
  { icon: '⚡', text: 'Pengiriman Instan' },
  { icon: '💬', text: 'Support 24/7' },
]

const DEFAULT_FEATURE_ITEMS = [
  'Akun dari stok terverifikasi',
  'Proses kirim otomatis setelah pembayaran',
  'Garansi aktif selama masa langganan',
]

const DEFAULT_FAQ_ITEMS: ProductFAQItem[] = [
  {
    question: 'Apakah akun ini aman digunakan?',
    answer:
      'Aman. Produk dikirim dari stok terverifikasi dan ada support CS kalau ada kendala akses.',
  },
  {
    question: 'Berapa lama proses pengiriman akun?',
    answer:
      'Pengiriman biasanya instan setelah pembayaran terkonfirmasi. Di jam sibuk tetap diproses secepat mungkin.',
  },
]

function normalizeTrustBadges(product: Product): ProductTrustBadge[] {
  const fromBadges = (product.trust_badges || [])
    .map((item) => ({
      icon: item.icon?.trim() || '✨',
      text: item.text?.trim() || '',
    }))
    .filter((item) => item.text)
    .slice(0, 6)

  if (fromBadges.length > 0) return fromBadges

  const fromTrustItems = (product.trust_items || [])
    .map((text, index) => ({
      icon: DEFAULT_TRUST_BADGES[index % DEFAULT_TRUST_BADGES.length]?.icon || '✨',
      text: text.trim(),
    }))
    .filter((item) => item.text)
    .slice(0, 6)

  if (fromTrustItems.length > 0) return fromTrustItems

  return DEFAULT_TRUST_BADGES
}

function normalizeFeatureItems(product: Product): string[] {
  const fromProduct = (product.feature_items || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)

  if (fromProduct.length > 0) return fromProduct
  return DEFAULT_FEATURE_ITEMS
}

function normalizeSpecItems(product: Product): ProductSpecItem[] {
  return (product.spec_items || [])
    .map((item) => ({
      label: item.label?.trim() || '',
      value: item.value?.trim() || '',
    }))
    .filter((item) => item.label && item.value)
    .slice(0, 16)
}

function normalizeFaqItems(product: Product): ProductFAQItem[] {
  const fromProduct = (product.faq_items || [])
    .map((item) => ({
      question: item.question?.trim() || '',
      answer: item.answer?.trim() || '',
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, 10)

  if (fromProduct.length > 0) return fromProduct
  return DEFAULT_FAQ_ITEMS
}

function getSelectablePrices(product: Product): ProductPrice[] {
  const active = (product.prices || []).filter((item) => item.is_active)
  if (active.length > 0) return active
  return product.prices || []
}

function normalizeWaNumber(raw?: string) {
  if (!raw) return ''
  return raw.replace(/\D/g, '').slice(0, 20)
}

function buildWaLink(product: Product, selectedPrice: ProductPrice | null) {
  const waNumber = normalizeWaNumber(product.whatsapp_number)
  if (!waNumber) return ''

  const message = selectedPrice
    ? `Halo admin, saya mau tanya ${product.name} (${selectedPrice.account_type} ${selectedPrice.duration} bulan - ${formatRupiah(selectedPrice.price)}).`
    : `Halo admin, saya mau tanya produk ${product.name}.`

  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
}

export default function PremAppsProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { setItem } = useCartStore()

  const [product, setProduct] = useState<Product | null>(null)
  const [accountType, setAccountType] = useState<'shared' | 'private'>('shared')
  const [selectedPrice, setSelectedPrice] = useState<ProductPrice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.slug) return

    productService
      .getBySlug(params.slug as string)
      .then((res) => {
        if (!res.success) return

        setProduct(res.data)

        const selectablePrices = getSelectablePrices(res.data)
        const firstPrice =
          selectablePrices.find((item) => item.account_type === 'shared') || selectablePrices[0]

        if (firstPrice) {
          setAccountType(firstPrice.account_type)
          setSelectedPrice(firstPrice)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.slug])

  const selectablePrices = useMemo(() => {
    if (!product) return []
    return getSelectablePrices(product)
  }, [product])

  const filteredPrices = useMemo(
    () => selectablePrices.filter((item) => item.account_type === accountType),
    [accountType, selectablePrices]
  )

  const trustBadges = useMemo(() => {
    if (!product) return DEFAULT_TRUST_BADGES
    return normalizeTrustBadges(product)
  }, [product])

  const featureItems = useMemo(() => {
    if (!product) return DEFAULT_FEATURE_ITEMS
    return normalizeFeatureItems(product)
  }, [product])

  const specItems = useMemo(() => {
    if (!product) return []
    return normalizeSpecItems(product)
  }, [product])

  const faqItems = useMemo(() => {
    if (!product) return DEFAULT_FAQ_ITEMS
    return normalizeFaqItems(product)
  }, [product])

  const effectiveSelectedPrice = useMemo(() => {
    if (!filteredPrices.length) return null

    if (selectedPrice) {
      const matched = filteredPrices.find((price) => price.id === selectedPrice.id)
      if (matched) return matched
    }

    return filteredPrices[0]
  }, [filteredPrices, selectedPrice])

  const handleBuy = () => {
    if (!effectiveSelectedPrice || !product) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    setItem({
      productId: product.id,
      productName: product.name,
      priceId: effectiveSelectedPrice.id,
      duration: effectiveSelectedPrice.duration,
      accountType: effectiveSelectedPrice.account_type,
      price: effectiveSelectedPrice.price,
    })

    router.push('/product/prem-apps/checkout')
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="h-96 bg-white/50 rounded-2xl animate-pulse" />
        </div>
        <Footer />
      </>
    )
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <div className="text-center py-32">
          <h1 className="text-2xl font-bold">Produk tidak ditemukan</h1>
        </div>
        <Footer />
      </>
    )
  }

  const popularBadge = product.badge_popular_text?.trim() || '🔥 Terlaris'
  const guaranteeBadge = product.badge_guarantee_text?.trim() || '🛡 Garansi 30 Hari'
  const sharedNote = product.shared_note?.trim() || 'Berbagi dengan pengguna lain'
  const privateNote = product.private_note?.trim() || 'Akun pribadi, akses penuh'

  const priceOriginalText = product.price_original_text?.trim() || ''
  const pricePerDayText = product.price_per_day_text?.trim() || ''
  const discountBadgeText = product.discount_badge_text?.trim() || ''

  const showWaButton = product.show_whatsapp_button !== false
  const waLink = buildWaLink(product, effectiveSelectedPrice)

  return (
    <>
      <Navbar />

      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8 bg-cover bg-center"
            style={{
              backgroundColor: product.color || '#F7F7F5',
              backgroundImage: product.hero_bg_url ? `url(${product.hero_bg_url})` : undefined,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/85 to-white/93 pointer-events-none" />
            <div className="relative z-10 flex items-start gap-4">
              {product.icon_image_url ? (
                <div className="w-14 h-14 rounded-2xl bg-white/95 border border-white shadow-sm p-1.5">
                  <Image src={product.icon_image_url} alt={`${product.name} icon`} width={56} height={56} className="w-full h-full rounded-xl object-contain" />
                </div>
              ) : (
                <div className="text-5xl">{product.icon || '📦'}</div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {product.is_popular && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#141414] text-white">
                      {popularBadge}
                    </span>
                  )}
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/80 text-[#1F2937]">
                    {guaranteeBadge}
                  </span>
                </div>

                <h1 className="text-2xl md:text-3xl font-extrabold mb-1">{product.name}</h1>
                <p className="text-sm text-[#888]">
                  {product.tagline?.trim() || `Kategori ${product.category}`}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-[#666] leading-relaxed">{product.description}</p>

            {!!product.sold_text?.trim() && (
              <div className="mt-4 text-xs font-semibold text-[#2F3A4A] bg-white/70 rounded-full inline-flex px-3 py-1.5">
                {product.sold_text}
              </div>
            )}

            <div className="flex gap-3 mt-6 flex-wrap">
              {trustBadges.map((item, index) => {
                const iconNode =
                  index % 3 === 0 ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : index % 3 === 1 ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )

                return (
                  <div
                    key={`${item.text}-${index}`}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#141414] bg-white/60 px-3 py-1.5 rounded-full"
                  >
                    <span>{item.icon}</span>
                    {iconNode}
                    <span>{item.text}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {featureItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-bold mb-3">Fitur Produk</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {featureItems.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="rounded-2xl border border-[#EBEBEB] bg-white p-3 text-sm text-[#3B3B3B] flex items-start gap-2"
                  >
                    <Check className="w-4 h-4 text-[#FF5733] mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-bold mb-3">Tipe Akun</h3>
            <div className="flex gap-3">
              {(['shared', 'private'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setAccountType(type)}
                  className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${
                    accountType === type
                      ? 'border-[#FF5733] bg-[#FFF3EF]'
                      : 'border-[#EBEBEB] bg-white hover:border-[#ccc]'
                  }`}
                >
                  <div className="text-sm font-bold capitalize mb-1">{type} Account</div>
                  <div className="text-xs text-[#888]">{type === 'shared' ? sharedNote : privateNote}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-bold mb-3">Pilih Paket Durasi</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredPrices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D9D9D9] bg-white p-4 text-sm text-[#6B7280] col-span-full">
                  Belum ada paket aktif untuk tipe akun ini.
                </div>
              ) : (
                filteredPrices.map((price) => {
                  const label = price.label?.trim() || `${price.duration} Bulan`
                  const savingsText = price.savings_text?.trim() || ''

                  return (
                    <button
                      key={price.id}
                      onClick={() => setSelectedPrice(price)}
                      className={`p-4 rounded-2xl border-2 transition-all text-center ${
                        effectiveSelectedPrice?.id === price.id
                          ? 'border-[#FF5733] bg-[#FFF3EF]'
                          : 'border-[#EBEBEB] bg-white hover:border-[#ccc]'
                      }`}
                    >
                      {effectiveSelectedPrice?.id === price.id && (
                        <Check className="w-4 h-4 text-[#FF5733] mx-auto mb-1" />
                      )}
                      <div className="text-base font-extrabold">{label}</div>
                      <div className="text-sm font-bold text-[#FF5733] mt-1">
                        {formatRupiah(price.price)}
                      </div>
                      {!!savingsText && (
                        <div className="text-[11px] text-[#0F766E] mt-1 font-semibold">{savingsText}</div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {specItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-bold mb-3">Spesifikasi</h3>
              <div className="rounded-2xl border border-[#EBEBEB] bg-white divide-y divide-[#F1F1F1]">
                {specItems.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
                    <span className="text-[#6B7280] font-medium">{item.label}</span>
                    <span className="text-[#141414] text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {faqItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-bold mb-3">FAQ</h3>
              <div className="space-y-3">
                {faqItems.map((faq, index) => (
                  <article
                    key={`${faq.question}-${index}`}
                    className="rounded-2xl border border-[#EBEBEB] bg-white p-4"
                  >
                    <h4 className="text-sm font-bold text-[#141414] mb-1">{faq.question}</h4>
                    <p className="text-xs text-[#666] leading-relaxed">{faq.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-4 bg-white rounded-2xl shadow-lg border border-[#EBEBEB] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs text-[#888]">Total</div>
              <div className="text-xl font-extrabold">
                {effectiveSelectedPrice ? formatRupiah(effectiveSelectedPrice.price) : '-'}
              </div>
              {!!priceOriginalText && (
                <div className="text-xs text-[#9CA3AF] line-through">{priceOriginalText}</div>
              )}
              {!!pricePerDayText && <div className="text-xs text-[#4B5563] mt-1">{pricePerDayText}</div>}
              {!!discountBadgeText && (
                <div className="text-[11px] font-semibold text-[#0F766E] mt-1">{discountBadgeText}</div>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {showWaButton && waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-3 border border-[#D1D5DB] text-[#111827] font-semibold rounded-full text-sm text-center"
                >
                  {product.whatsapp_button_text?.trim() || 'Tanya via WhatsApp'}
                </a>
              )}

              <button
                onClick={handleBuy}
                disabled={!effectiveSelectedPrice}
                className="px-8 py-3.5 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm w-full sm:w-auto"
              >
                Beli Sekarang
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
