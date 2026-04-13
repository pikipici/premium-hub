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

function normalizeAccountType(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function formatAccountTypeLabel(value?: string | null) {
  const normalized = normalizeAccountType(value)
  if (!normalized) return '-'

  if (normalized === 'shared') return 'Shared'
  if (normalized === 'private') return 'Private'

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function getAccountTypeDescription(value: string, sharedNote: string, privateNote: string) {
  const normalized = normalizeAccountType(value)
  if (normalized === 'shared') return sharedNote
  if (normalized === 'private') return privateNote
  return 'Tipe akun khusus sesuai paket yang dipilih.'
}

function normalizeWaNumber(raw?: string) {
  if (!raw) return ''
  return raw.replace(/\D/g, '').slice(0, 20)
}

function buildWaLink(product: Product, selectedPrice: ProductPrice | null) {
  const waNumber = normalizeWaNumber(product.whatsapp_number)
  if (!waNumber) return ''

  const message = selectedPrice
    ? `Halo admin, saya mau tanya ${product.name} (${formatAccountTypeLabel(selectedPrice.account_type)} ${selectedPrice.duration} bulan - ${formatRupiah(selectedPrice.price)}).`
    : `Halo admin, saya mau tanya produk ${product.name}.`

  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
}

export default function PremAppsProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { setItem } = useCartStore()

  const [product, setProduct] = useState<Product | null>(null)
  const [accountType, setAccountType] = useState<string>('')
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
          selectablePrices.find((item) => normalizeAccountType(item.account_type) === 'shared') ||
          selectablePrices[0]

        if (firstPrice) {
          setAccountType(normalizeAccountType(firstPrice.account_type))
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

  const accountTypeOptions = useMemo(() => {
    const set = new Set<string>()

    selectablePrices.forEach((price) => {
      const code = normalizeAccountType(price.account_type)
      if (code) set.add(code)
    })

    return Array.from(set).sort((left, right) => {
      const leftPriority = left === 'shared' ? 0 : left === 'private' ? 1 : 99
      const rightPriority = right === 'shared' ? 0 : right === 'private' ? 1 : 99
      if (leftPriority !== rightPriority) return leftPriority - rightPriority
      return left.localeCompare(right)
    })
  }, [selectablePrices])

  const activeAccountType = useMemo(() => {
    const normalizedCurrent = normalizeAccountType(accountType)
    if (normalizedCurrent && accountTypeOptions.includes(normalizedCurrent)) {
      return normalizedCurrent
    }
    return accountTypeOptions[0] || ''
  }, [accountType, accountTypeOptions])

  const filteredPrices = useMemo(
    () =>
      selectablePrices.filter(
        (item) => normalizeAccountType(item.account_type) === normalizeAccountType(activeAccountType)
      ),
    [activeAccountType, selectablePrices]
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
          <div className="rounded-3xl p-8 md:p-10 mb-8 border border-[#EBEBEB] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col items-center text-center">
              {product.icon_image_url ? (
                <div className="w-14 h-14 rounded-2xl bg-white border border-[#E5E7EB] shadow-[0_2px_8px_rgba(15,23,42,0.10)] p-1.5 mb-3">
                  <Image src={product.icon_image_url} alt={`${product.name} icon`} width={56} height={56} unoptimized className="w-full h-full rounded-xl object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white border border-[#E5E7EB] shadow-[0_2px_8px_rgba(15,23,42,0.10)] flex items-center justify-center text-4xl mb-3">
                  {product.icon || '📦'}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap justify-center mb-2">
                {product.is_popular && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#141414] text-white">
                    {popularBadge}
                  </span>
                )}
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F3F4F6] text-[#1F2937]">
                  {guaranteeBadge}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold mb-1">{product.name}</h1>
              <p className="text-sm text-[#888]">
                {product.tagline?.trim() || `Kategori ${product.category}`}
              </p>
            </div>

            <p className="mt-4 text-sm text-[#666] leading-relaxed text-center max-w-2xl mx-auto">{product.description}</p>

            {!!product.sold_text?.trim() && (
              <div className="mt-4 text-xs font-semibold text-[#2F3A4A] bg-[#F8FAFC] border border-[#E5E7EB] rounded-full inline-flex px-3 py-1.5 mx-auto">
                {product.sold_text}
              </div>
            )}

            <div className="flex gap-3 mt-6 flex-wrap justify-center">
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
                    className="flex items-center gap-1.5 text-xs font-medium text-[#141414] bg-[#F8FAFC] border border-[#E5E7EB] px-3 py-1.5 rounded-full"
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
            <div className="flex gap-3 flex-wrap">
              {accountTypeOptions.map((type) => {
                const active = normalizeAccountType(activeAccountType) === type

                return (
                  <button
                    key={type}
                    onClick={() => setAccountType(type)}
                    className={`flex-1 min-w-[180px] p-4 rounded-2xl border-2 transition-all text-left ${
                      active
                        ? 'border-[#FF5733] bg-[#FFF3EF]'
                        : 'border-[#EBEBEB] bg-white hover:border-[#ccc]'
                    }`}
                  >
                    <div className="text-sm font-bold mb-1">{formatAccountTypeLabel(type)} Account</div>
                    <div className="text-xs text-[#888]">{getAccountTypeDescription(type, sharedNote, privateNote)}</div>
                  </button>
                )
              })}
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
