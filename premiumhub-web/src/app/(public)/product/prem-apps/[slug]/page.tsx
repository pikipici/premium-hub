"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { productService } from '@/services/productService'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/utils'
import type { Product, ProductPrice } from '@/types/product'
import { ShieldCheck, Clock, Zap, Check } from 'lucide-react'

const DEFAULT_TRUST_ITEMS = ['Garansi 30 Hari', 'Pengiriman Instan', 'Support 24/7']

const DEFAULT_FAQ_ITEMS = [
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

function normalizeTrustItems(product: Product) {
  const fromProduct = (product.trust_items || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)

  if (fromProduct.length > 0) return fromProduct
  return DEFAULT_TRUST_ITEMS
}

function normalizeFaqItems(product: Product) {
  const fromProduct = (product.faq_items || [])
    .map((item) => ({
      question: item.question?.trim() || '',
      answer: item.answer?.trim() || '',
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, 8)

  if (fromProduct.length > 0) return fromProduct
  return DEFAULT_FAQ_ITEMS
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
    if (params.slug) {
      productService
        .getBySlug(params.slug as string)
        .then((res) => {
          if (res.success) {
            setProduct(res.data)
            const firstPrice =
              res.data.prices?.find((p) => p.account_type === 'shared') || res.data.prices?.[0]
            if (firstPrice) {
              setAccountType(firstPrice.account_type)
              setSelectedPrice(firstPrice)
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [params.slug])

  const filteredPrices = product?.prices?.filter((p) => p.account_type === accountType) || []

  const trustItems = useMemo(() => {
    if (!product) return DEFAULT_TRUST_ITEMS
    return normalizeTrustItems(product)
  }, [product])

  const faqItems = useMemo(() => {
    if (!product) return DEFAULT_FAQ_ITEMS
    return normalizeFaqItems(product)
  }, [product])

  const handleBuy = () => {
    if (!selectedPrice || !product) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    setItem({
      productId: product.id,
      productName: product.name,
      priceId: selectedPrice.id,
      duration: selectedPrice.duration,
      accountType: selectedPrice.account_type as 'shared' | 'private',
      price: selectedPrice.price,
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

  return (
    <>
      <Navbar />

      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl p-8 md:p-10 mb-8" style={{ backgroundColor: product.color || '#F7F7F5' }}>
            <div className="flex items-start gap-4">
              <div className="text-5xl">{product.icon}</div>
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
              {trustItems.map((item, i) => {
                const icon = i % 3 === 0 ? <ShieldCheck className="w-4 h-4" /> : i % 3 === 1 ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />
                return (
                  <div
                    key={`${item}-${i}`}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#141414] bg-white/60 px-3 py-1.5 rounded-full"
                  >
                    {icon} {item}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold mb-3">Tipe Akun</h3>
            <div className="flex gap-3">
              {(['shared', 'private'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setAccountType(type)
                    const first = product.prices?.find((p) => p.account_type === type)
                    if (first) setSelectedPrice(first)
                  }}
                  className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${
                    accountType === type ? 'border-[#FF5733] bg-[#FFF3EF]' : 'border-[#EBEBEB] bg-white hover:border-[#ccc]'
                  }`}
                >
                  <div className="text-sm font-bold capitalize mb-1">{type} Account</div>
                  <div className="text-xs text-[#888]">{type === 'shared' ? sharedNote : privateNote}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-bold mb-3">Pilih Durasi</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {filteredPrices.map((price) => (
                <button
                  key={price.id}
                  onClick={() => setSelectedPrice(price)}
                  className={`p-4 rounded-2xl border-2 transition-all text-center ${
                    selectedPrice?.id === price.id ? 'border-[#FF5733] bg-[#FFF3EF]' : 'border-[#EBEBEB] bg-white hover:border-[#ccc]'
                  }`}
                >
                  {selectedPrice?.id === price.id && <Check className="w-4 h-4 text-[#FF5733] mx-auto mb-1" />}
                  <div className="text-lg font-extrabold">{price.duration}</div>
                  <div className="text-xs text-[#888] mb-2">bulan</div>
                  <div className="text-sm font-bold text-[#FF5733]">{formatRupiah(price.price)}</div>
                </button>
              ))}
            </div>
          </div>

          {faqItems.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-bold mb-3">FAQ</h3>
              <div className="space-y-3">
                {faqItems.map((faq, index) => (
                  <article key={`${faq.question}-${index}`} className="rounded-2xl border border-[#EBEBEB] bg-white p-4">
                    <h4 className="text-sm font-bold text-[#141414] mb-1">{faq.question}</h4>
                    <p className="text-xs text-[#666] leading-relaxed">{faq.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-4 bg-white rounded-2xl shadow-lg border border-[#EBEBEB] p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-[#888]">Total</div>
              <div className="text-xl font-extrabold">{selectedPrice ? formatRupiah(selectedPrice.price) : '-'}</div>
            </div>
            <button
              onClick={handleBuy}
              disabled={!selectedPrice}
              className="px-8 py-3.5 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Beli Sekarang
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
