"use client"

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Check, ChevronDown, ChevronUp, ShoppingCart, MessageCircle } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import { DigiLoading } from '@/components/shared/DigiLoading'
import Navbar from '@/components/layout/Navbar'
import EmblaCarousel from '@/components/shared/EmblaCarousel'
import { formatRupiah } from '@/lib/utils'
import { fulfillmentTypeLabel, isCredentialFulfillment } from '@/lib/fulfillment'
import { productService } from '@/services/productService'
import { useCartStore } from '@/store/cartStore'
import type { Product, ProductFAQItem, ProductPrice, ProductSpecItem } from '@/types/product'

const DEFAULT_FEATURE_ITEMS = [
  'Produk dari stok terverifikasi',
  'Proses kirim otomatis setelah pembayaran',
  'Garansi aktif selama masa akses',
]

const DEFAULT_FAQ_ITEMS: ProductFAQItem[] = [
  {
    question: 'Apakah produk ini aman digunakan?',
    answer: 'Aman. Produk dikirim dari stok terverifikasi dan ada support CS kalau ada kendala akses.',
  },
  {
    question: 'Berapa lama proses pengiriman produk?',
    answer: 'Pengiriman biasanya instan setelah pembayaran terkonfirmasi. Di jam sibuk tetap diproses secepat mungkin.',
  },
]

function normalizeFeatureItems(product: Product): string[] {
  const fromProduct = (product.feature_items || []).map((item) => item.trim()).filter(Boolean).slice(0, 12)
  if (fromProduct.length > 0) return fromProduct
  return DEFAULT_FEATURE_ITEMS
}

function normalizeSpecItems(product: Product): ProductSpecItem[] {
  return (product.spec_items || [])
    .map((item) => ({ label: item.label?.trim() || '', value: item.value?.trim() || '' }))
    .filter((item) => item.label && item.value)
    .slice(0, 16)
}

function normalizeFaqItems(product: Product): ProductFAQItem[] {
  const fromProduct = (product.faq_items || [])
    .map((item) => ({ question: item.question?.trim() || '', answer: item.answer?.trim() || '' }))
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

function normalizePriceStock(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.floor(value))
}

function normalizeWaNumber(raw?: string) {
  if (!raw) return ''
  return raw.replace(/\D/g, '').slice(0, 20)
}

function buildWaLink(product: Product, priceLabel: string | null) {
  const waNumber = normalizeWaNumber(product.whatsapp_number)
  if (!waNumber) return ''
  const message = priceLabel
    ? `Halo admin, saya mau tanya ${product.name} (${priceLabel} - ${formatRupiah(0)}).`
    : `Halo admin, saya mau tanya produk ${product.name}.`
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
}

function formatPriceLabel(price: ProductPrice) {
  return price.display_label?.trim() || price.label?.trim() || `${formatAccountTypeLabel(price.account_type)} ${price.duration} bln`
}

function formatMetaText(price: ProductPrice) {
  return [price.unit_label, price.billing_period, price.delivery_label]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(' · ')
}

export default function DigiProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { setItem } = useCartStore()

  const [product, setProduct] = useState<Product | null>(null)
  const [accountType, setAccountType] = useState<string>('')
  const [selectedPrice, setSelectedPrice] = useState<ProductPrice | null>(null)
  const [loading, setLoading] = useState(true)
  const [hideFloatingCta, setHideFloatingCta] = useState(false)
  const [faqExpanded, setFaqExpanded] = useState(false)

  const fulfillmentType = (product?.fulfillment_type || '').trim().toLowerCase()
  const showAccountTypeSelector = isCredentialFulfillment(fulfillmentType)
  const fulfillmentLabel = fulfillmentTypeLabel(fulfillmentType)

  useEffect(() => {
    if (!params.slug) return
    productService
      .getBySlug(params.slug as string)
      .then((res) => {
        if (!res.success) return
        setProduct(res.data)
        const selectablePrices = getSelectablePrices(res.data)
        const firstPrice =
          selectablePrices.find(
            (item) => normalizeAccountType(item.account_type) === 'shared' && normalizePriceStock(item.available_stock) > 0
          ) ||
          selectablePrices.find((item) => normalizePriceStock(item.available_stock) > 0) ||
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const footer = document.querySelector('footer')
    if (!footer) return
    const observer = new IntersectionObserver(
      ([entry]) => { setHideFloatingCta(entry.isIntersecting) },
      { threshold: 0.01 }
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  // Fetch related products in same category
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  useEffect(() => {
    if (!product?.category) return
    productService.list({ category: product.category, limit: 5 })
      .then((res) => {
        if (!res.success) return
        setRelatedProducts((res.data || []).filter((p) => p.slug !== product.slug))
      })
      .catch(() => {})
  }, [product?.category, product?.slug])

  const selectablePrices = useMemo(() => {
    if (!product) return []
    return getSelectablePrices(product)
  }, [product])

  const priceStockByID = useMemo(() => {
    const result = new Map<string, number>()
    selectablePrices.forEach((price) => { result.set(price.id, normalizePriceStock(price.available_stock)) })
    return result
  }, [selectablePrices])

  const accountTypeStockByCode = useMemo(() => {
    const result = new Map<string, number>()
    ;(product?.account_type_stocks || []).forEach((item) => {
      const code = normalizeAccountType(item.account_type)
      if (!code) return
      result.set(code, normalizePriceStock(item.available_stock))
    })
    return result
  }, [product])

  const accountTypeOptions = useMemo(() => {
    const fallbackByCode = new Map<string, number>()
    selectablePrices.forEach((price) => {
      const code = normalizeAccountType(price.account_type)
      if (!code) return
      fallbackByCode.set(code, (fallbackByCode.get(code) || 0) + (priceStockByID.get(price.id) || 0))
    })
    const allCodes = new Set<string>([...fallbackByCode.keys(), ...accountTypeStockByCode.keys()])
    return Array.from(allCodes)
      .map((code) => ({
        code,
        stock: accountTypeStockByCode.has(code)
          ? accountTypeStockByCode.get(code) || 0
          : fallbackByCode.get(code) || 0,
      }))
      .sort((left, right) => {
        const leftPriority = left.code === 'shared' ? 0 : left.code === 'private' ? 1 : 99
        const rightPriority = right.code === 'shared' ? 0 : right.code === 'private' ? 1 : 99
        if (leftPriority !== rightPriority) return leftPriority - rightPriority
        return left.code.localeCompare(right.code)
      })
  }, [accountTypeStockByCode, priceStockByID, selectablePrices])

  const activeAccountType = useMemo(() => {
    const normalizedCurrent = normalizeAccountType(accountType)
    const hasAnyInStockAccountType = accountTypeOptions.some((item) => item.stock > 0)
    if (normalizedCurrent) {
      const matched = accountTypeOptions.find((item) => item.code === normalizedCurrent)
      if (matched && (matched.stock > 0 || !hasAnyInStockAccountType)) return normalizedCurrent
    }
    return accountTypeOptions.find((item) => item.stock > 0)?.code || accountTypeOptions[0]?.code || ''
  }, [accountType, accountTypeOptions])

  const filteredPrices = useMemo(() => {
    if (!showAccountTypeSelector) return selectablePrices
    return selectablePrices.filter(
      (item) => normalizeAccountType(item.account_type) === normalizeAccountType(activeAccountType)
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountType, selectablePrices, product?.fulfillment_type])

  const inStockFilteredPrices = useMemo(
    () => filteredPrices.filter((item) => (priceStockByID.get(item.id) || 0) > 0),
    [filteredPrices, priceStockByID]
  )

  const lowestPrice = useMemo(() => {
    if (inStockFilteredPrices.length === 0) return null
    return inStockFilteredPrices.reduce((min, p) => (p.price < min.price ? p : min), inStockFilteredPrices[0])
  }, [inStockFilteredPrices])

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
    if (!inStockFilteredPrices.length) return null
    if (selectedPrice) {
      const matched = inStockFilteredPrices.find((price) => price.id === selectedPrice.id)
      if (matched) return matched
    }
    return inStockFilteredPrices[0]
  }, [inStockFilteredPrices, selectedPrice])

  const selectedPriceLabel = effectiveSelectedPrice ? formatPriceLabel(effectiveSelectedPrice) : null

  const handleBuy = () => {
    if (!effectiveSelectedPrice || !product) return
    setItem({
      productId: product.id,
      productName: product.name,
      priceId: effectiveSelectedPrice.id,
      duration: effectiveSelectedPrice.duration,
      accountType: effectiveSelectedPrice.account_type,
      price: effectiveSelectedPrice.price,
      fulfillmentType: product.fulfillment_type || 'credential',
    })
    router.push('/product/digiproduct/checkout')
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <DigiLoading message="Memuat detail produk..." skeletonCount={2} />
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
  const availableStock = typeof product.available_stock === 'number' ? Math.max(0, product.available_stock) : null
  const hasAnyStock = showAccountTypeSelector
    ? accountTypeOptions.some((item) => item.stock > 0)
    : inStockFilteredPrices.length > 0
  const showWaButton = product.show_whatsapp_button !== false
  const waLink = buildWaLink(product, selectedPriceLabel)
  const deliveryDescription = product.fulfillment_guide?.trim() || `Produk akan dikirim sebagai ${fulfillmentLabel.toLowerCase()} setelah pembayaran dikonfirmasi.`

  const visibleFaqItems = faqExpanded ? faqItems : faqItems.slice(0, 3)
  const hasMoreFaq = faqItems.length > 3
  const coverImages = product.cover_images?.length ? product.cover_images : null
  const mainImage = product.icon_image_url || null

  // Parse original price & discount
  const originalPriceText = product.price_original_text?.trim()
  const parsedOriginalPrice = originalPriceText ? parseInt(originalPriceText.replace(/\D/g, '')) || null : null
  const discountText = product.discount_badge_text?.trim()
  const soldText = product.sold_text?.trim()

  return (
    <>
      <Navbar />

      <section className="py-6 md:py-10">
        <div className="max-w-5xl mx-auto px-4 pb-36 sm:px-6 lg:px-8">

          {/* ─── BREADCRUMB ─── */}
          <nav className="flex items-center gap-1.5 text-xs font-medium text-[#888] mb-6 flex-wrap">
            <Link href="/" className="hover:text-[#FF5733] transition">Beranda</Link>
            <span className="text-[#ccc]">/</span>
            <Link href="/product/digiproduct" className="hover:text-[#FF5733] transition">DigiProduct</Link>
            <span className="text-[#ccc]">/</span>
            <span className="text-[#555] capitalize">{product.category}</span>
            <span className="text-[#ccc]">/</span>
            <span className="text-[#141414] font-semibold truncate max-w-[180px] sm:max-w-[300px]">{product.name}</span>
          </nav>

          {/* ─── HERO: 2-COLUMN GRID ─── */}
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 mb-10">

            {/* LEFT: Visual */}
            <div className="relative">
              {coverImages ? (
                <div className="aspect-square rounded-2xl overflow-hidden bg-[#F7F7F5] border border-[#EBEBEB] shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                  <EmblaCarousel images={coverImages} alt={product.name} aspectClass="aspect-square" showThumbs />
                </div>
              ) : mainImage ? (
                <div className="aspect-square rounded-2xl overflow-hidden bg-[#F7F7F5] border border-[#EBEBEB] shadow-[0_4px_16px_rgba(15,23,42,0.06)] relative flex items-center justify-center">
                  <Image src={mainImage} alt={product.name} fill unoptimized className="object-contain p-8" />
                </div>
              ) : (
                <div className="aspect-square rounded-2xl overflow-hidden bg-[#F7F7F5] border border-[#EBEBEB] shadow-[0_4px_16px_rgba(15,23,42,0.06)] flex items-center justify-center">
                  <span className="text-8xl">{product.icon || '📦'}</span>
                </div>
              )}

              {/* Badge overlay */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {product.is_popular && (
                  <span className="text-[10px] font-extrabold px-3 py-1.5 rounded-full bg-[#141414] text-white shadow">
                    {popularBadge}
                  </span>
                )}
                {!showAccountTypeSelector && (
                  <span className="text-[10px] font-extrabold px-3 py-1.5 rounded-full bg-[#FF5733] text-white shadow">
                    {fulfillmentLabel}
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT: Info + Price + CTA */}
            <div className="flex flex-col">

              {/* Tags row */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#141414] text-white">
                  {product.category}
                </span>
                {availableStock !== null && (
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    availableStock > 0 ? 'bg-[#ECFDF3] text-[#166534]' : 'bg-[#FEF2F2] text-[#B91C1C]'
                  }`}>
                    {availableStock > 0 ? `${availableStock} item` : 'Habis'}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-[#141414] tracking-tight mb-4 leading-tight">
                {product.name}
              </h1>

              {/* Price Box — like Rikka Store */}
              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-5 mb-5 shadow-sm">
                <div className="flex items-baseline gap-3 flex-wrap">
                  {effectiveSelectedPrice ? (
                    <span className="text-3xl lg:text-4xl font-extrabold text-[#141414]">
                      {formatRupiah(effectiveSelectedPrice.price)}
                    </span>
                  ) : lowestPrice ? (
                    <span className="text-3xl lg:text-4xl font-extrabold text-[#141414]">
                      {formatRupiah(lowestPrice.price)}
                    </span>
                  ) : (
                    <span className="text-xl font-bold text-[#888]">Harga tidak tersedia</span>
                  )}
                  {parsedOriginalPrice && effectiveSelectedPrice && parsedOriginalPrice > effectiveSelectedPrice.price && (
                    <>
                      <span className="text-sm text-[#999] line-through">{formatRupiah(parsedOriginalPrice)}</span>
                      {discountText && (
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[#ECFDF3] text-[#0F766E]">
                          {discountText}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {soldText && (
                  <div className="mt-2 text-xs text-[#888]">{soldText}</div>
                )}
              </div>

              {/* Desktop CTA Buttons */}
              <div className="hidden lg:flex items-center gap-3 mb-5">
                <button
                  onClick={handleBuy}
                  disabled={!effectiveSelectedPrice || !hasAnyStock}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#FF5733] px-8 py-3.5 text-sm font-extrabold text-white transition-all hover:bg-[#e64d2e] disabled:cursor-not-allowed disabled:opacity-50 shadow-[0_6px_20px_rgba(255,87,51,0.35)]"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {hasAnyStock ? 'Beli Sekarang' : 'Stok Habis'}
                </button>
                {showWaButton && waLink && (
                  <a href={waLink} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 rounded-full border border-[#D1D5DB] px-6 py-3.5 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB] transition">
                    <MessageCircle className="w-4 h-4" />
                    Tanya CS
                  </a>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                {availableStock !== null && (
                  <div className="rounded-xl bg-[#F8FAFC] border border-[#EBEBEB] p-3 text-center">
                    <div className="text-[10px] font-medium text-[#888] mb-0.5">Stok</div>
                    <div className={`text-sm font-extrabold ${availableStock > 0 ? 'text-[#166534]' : 'text-[#B91C1C]'}`}>
                      {availableStock > 0 ? `${availableStock} item` : 'Habis'}
                    </div>
                  </div>
                )}
                <div className="rounded-xl bg-[#F8FAFC] border border-[#EBEBEB] p-3 text-center">
                  <div className="text-[10px] font-medium text-[#888] mb-0.5">Kirim</div>
                  <div className="text-sm font-extrabold text-[#0369A1]">Instan</div>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] border border-[#EBEBEB] p-3 text-center">
                  <div className="text-[10px] font-medium text-[#888] mb-0.5">Garansi</div>
                  <div className="text-sm font-extrabold text-[#6D28D9]">30 Hari</div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── DESCRIPTION SECTION (full-width) ─── */}
          <div className="mb-8 rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
            <h2 className="text-sm font-black text-[#141414] mb-3 tracking-tight">Deskripsi</h2>
            {product.description && (
              <p className="text-sm text-[#555] leading-relaxed mb-4">{product.description}</p>
            )}
            <div className="rounded-xl bg-[#F9FAFB] border border-[#F1F1F1] p-4">
              <p className="text-xs text-[#666] leading-relaxed">{deliveryDescription}</p>
            </div>
            {/* Type-specific metadata */}
            {product.metadata && Object.keys(product.metadata).length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(product.metadata)
                  .filter(([key]) => key !== 'product_type')
                  .map(([key, value]) => {
                    if (!value) return null
                    return (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="text-[#888] capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-semibold text-[#141414]">{String(value)}</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* ─── FEATURES ─── */}
          {featureItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-[#141414] mb-3 tracking-tight">Fitur Produk</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {featureItems.map((item, index) => (
                  <div key={`${item}-${index}`}
                    className="flex items-start gap-2.5 rounded-xl bg-[#F9FAFB] border border-[#F1F1F1] p-3.5 text-sm text-[#3B3B3B]">
                    <Check className="w-4 h-4 text-[#FF5733] mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── NON-CREDENTIAL DELIVERY NOTE ─── */}
          {!showAccountTypeSelector && (
            <div className="mb-8 rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-4">
              <p className="text-sm text-[#444]">{deliveryDescription}</p>
            </div>
          )}

          {/* ─── ACCOUNT TYPE SELECTOR ─── */}
          {showAccountTypeSelector && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-[#141414] mb-3 tracking-tight">Jenis Akses</h3>
              <div className="flex gap-3 flex-wrap">
                {accountTypeOptions.map((option) => {
                  const active = normalizeAccountType(activeAccountType) === option.code
                  const disabled = option.stock <= 0
                  return (
                    <button
                      key={option.code}
                      onClick={() => { if (disabled) return; setAccountType(option.code) }}
                      disabled={disabled}
                      className={`flex-1 min-w-[140px] p-4 rounded-2xl border-2 transition-all text-left ${
                        disabled
                          ? 'border-[#E5E7EB] bg-[#F9FAFB] opacity-60 cursor-not-allowed'
                          : active
                            ? 'border-[#FF5733] bg-[#FFF3EF] shadow-[0_4px_12px_rgba(255,87,51,0.12)]'
                            : 'border-[#EBEBEB] bg-white hover:border-[#ccc]'
                      }`}
                    >
                      <div className="text-sm font-extrabold mb-1">{formatAccountTypeLabel(option.code)}</div>
                      <div className={`text-[11px] font-semibold ${disabled ? 'text-[#B91C1C]' : 'text-[#166534]'}`}>
                        {disabled ? 'Stok habis' : `${option.stock} item`}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── PRICE GRID ─── */}
          <div className="mb-8">
            <h3 className="text-sm font-black text-[#141414] mb-3 tracking-tight">Pilih Paket</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPrices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D9D9D9] bg-white p-6 text-sm text-[#6B7280] col-span-full text-center">
                  {showAccountTypeSelector
                    ? 'Belum ada paket aktif untuk jenis akses ini.'
                    : 'Belum ada paket tersedia untuk produk ini.'}
                </div>
              ) : (
                filteredPrices.map((price) => {
                  const label = formatPriceLabel(price)
                  const savingsText = price.savings_text?.trim() || ''
                  const metaText = formatMetaText(price)
                  const stockCount = priceStockByID.get(price.id) || 0
                  const disabled = stockCount <= 0
                  const isSelected = effectiveSelectedPrice?.id === price.id && !disabled

                  return (
                    <button
                      key={price.id}
                      onClick={() => { if (disabled) return; setSelectedPrice(price) }}
                      disabled={disabled}
                      className={`relative p-5 rounded-2xl border-2 transition-all text-left ${
                        disabled
                          ? 'border-[#E5E7EB] bg-[#F9FAFB] opacity-60 cursor-not-allowed'
                          : isSelected
                            ? 'border-[#FF5733] bg-[#FFF3EF] shadow-[0_4px_16px_rgba(255,87,51,0.15)]'
                            : 'border-[#EBEBEB] bg-white hover:border-[#FF5733]/40 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#FF5733] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="text-xs font-semibold text-[#888] mb-1">{label}</div>
                      <div className="text-xl font-extrabold text-[#141414] mb-3">
                        {formatRupiah(price.price)}
                        <span className="text-[11px] font-medium text-[#888] ml-0.5">/{label}</span>
                      </div>
                      {metaText && (
                        <div className="mb-2 text-[11px] font-semibold text-[#6B7280]">{metaText}</div>
                      )}
                      {savingsText && !disabled && (
                        <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#ECFDF3] text-[#0F766E] mb-2">
                          {savingsText}
                        </span>
                      )}
                      <div className={`text-[11px] font-semibold mt-1 ${disabled ? 'text-[#B91C1C]' : 'text-[#166534]'}`}>
                        {disabled ? 'Stok habis' : `Stok ${stockCount} item`}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            {filteredPrices.length > 0 && inStockFilteredPrices.length === 0 && (
              <div className="mt-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#B91C1C] text-center">
                Semua paket sedang habis. Tunggu restock atau hubungi admin.
              </div>
            )}
          </div>

          {/* ─── SPECS ─── */}
          {specItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-[#141414] mb-3 tracking-tight">Spesifikasi</h3>
              <div className="rounded-2xl border border-[#EBEBEB] bg-white divide-y divide-[#F1F1F1] overflow-hidden">
                {specItems.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="px-5 py-4 grid grid-cols-2 gap-3 text-sm">
                    <span className="text-[#6B7280] font-medium">{item.label}</span>
                    <span className="text-[#141414] text-right font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── FAQ ─── */}
          {faqItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-[#141414] mb-3 tracking-tight">Pertanyaan Umum</h3>
              <div className="space-y-3">
                {visibleFaqItems.map((faq, index) => (
                  <article key={`${faq.question}-${index}`}
                    className="rounded-2xl border border-[#EBEBEB] bg-white p-5">
                    <h4 className="text-sm font-bold text-[#141414] mb-1.5">{faq.question}</h4>
                    <p className="text-xs text-[#666] leading-relaxed">{faq.answer}</p>
                  </article>
                ))}
              </div>
              {hasMoreFaq && (
                <button
                  type="button"
                  onClick={() => setFaqExpanded((prev) => !prev)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#E2E2E2] py-2.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] transition"
                >
                  {faqExpanded ? (
                    <>Tampilkan Ringkas <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>Lihat Semua FAQ <ChevronDown className="h-3.5 w-3.5" /></>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ─── RELATED PRODUCTS ─── */}
          {relatedProducts.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black text-[#141414] mb-3 tracking-tight">Produk Terkait</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {relatedProducts.slice(0, 4).map((item) => {
                  const minPrice = (item.prices || []).filter((p) => p.is_active).sort((a, b) => a.price - b.price)[0]
                  return (
                    <Link
                      key={item.slug}
                      href={`/product/digiproduct/${item.slug}`}
                      className="rounded-2xl border border-[#EBEBEB] bg-white p-4 hover:border-[#FF5733]/40 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all"
                    >
                      <div className="text-2xl mb-2">{item.icon || '📦'}</div>
                      <div className="text-xs font-semibold text-[#141414] line-clamp-2 mb-1">{item.name}</div>
                      {minPrice && (
                        <div className="text-sm font-extrabold text-[#FF5733]">{formatRupiah(minPrice.price)}</div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── FLOATING CTA (mobile) ─── */}
          <div className={`lg:hidden fixed inset-x-0 bottom-3 z-[60] pointer-events-none transition-all duration-200 ${
            hideFloatingCta ? 'translate-y-[120%] opacity-0' : 'translate-y-0 opacity-100'
          }`}>
            <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 lg:px-8">
              <div className="pointer-events-auto rounded-2xl border border-[#EBEBEB] bg-white p-3 shadow-[0_10px_28px_rgba(20,20,20,0.18)] sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-[#888]">
                      {selectedPriceLabel || 'Pilih paket'}
                    </div>
                    <div className="text-lg font-extrabold text-[#141414]">
                      {effectiveSelectedPrice ? formatRupiah(effectiveSelectedPrice.price) : '-'}
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                    {showWaButton && waLink && (
                      <a href={waLink} target="_blank" rel="noreferrer"
                        className="rounded-full border border-[#D1D5DB] px-4 py-2.5 text-xs font-semibold text-[#111827] sm:px-5 sm:py-3 sm:text-sm">
                        Tanya CS
                      </a>
                    )}
                    <button
                      onClick={handleBuy}
                      disabled={!effectiveSelectedPrice || !hasAnyStock}
                      className="flex-1 rounded-full bg-[#FF5733] px-6 py-2.5 text-sm font-extrabold text-white transition-all hover:bg-[#e64d2e] disabled:cursor-not-allowed disabled:opacity-50 shadow-[0_6px_20px_rgba(255,87,51,0.35)] sm:px-8 sm:py-3.5"
                    >
                      {hasAnyStock ? 'Beli Sekarang' : 'Stok Habis'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <Footer />
    </>
  )
}
