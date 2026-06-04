"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { DigiLoading, DigiLoadingCardGrid } from '@/components/shared/DigiLoading'
import ProductCard from '@/components/shared/ProductCard'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { productService } from '@/services/productService'
import { productCategoryService } from '@/services/productCategoryService'
import type { Product } from '@/types/product'
import { Search, SlidersHorizontal, Sparkles, Zap } from 'lucide-react'

type CategoryOption = {
  value: string
  label: string
}

const FALLBACK_CATEGORIES: CategoryOption[] = [
  { value: '', label: 'Semua' },
  { value: 'streaming', label: '🎬 Streaming' },
  { value: 'music', label: '🎵 Musik' },
  { value: 'gaming', label: '🎮 Gaming' },
  { value: 'design', label: '🎨 Desain' },
  { value: 'productivity', label: '⚡ Tools' },
]

const DIGIPRODUCT_EMOJI_BY_CODE: Record<string, string> = {
  streaming: '🎬',
  music: '🎵',
  gaming: '🎮',
  design: '🎨',
  productivity: '⚡',
}

function toDigiProductCategoryOptions(items: Array<{ code: string; label: string }>): CategoryOption[] {
  if (!items.length) return FALLBACK_CATEGORIES
  const mapped: CategoryOption[] = [
    { value: '', label: 'Semua' },
    ...items.map((item) => {
      const emoji = DIGIPRODUCT_EMOJI_BY_CODE[item.code]
      const normalizedLabel = item.label?.trim() || item.code
      return {
        value: item.code,
        label: emoji ? `${emoji} ${normalizedLabel}` : normalizedLabel,
      }
    }),
  ]
  return mapped
}

export default function DigiProductPage() {
  return (
    <Suspense fallback={<><Navbar /><DigiLoading message="Memuat katalog DigiProduct..." /><Footer /></>}>
      <DigiProductContent />
    </Suspense>
  )
}

function DigiProductContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>(FALLBACK_CATEGORIES)
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [loading, setLoading] = useState(true)
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false)
  const categoryFilterRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    productCategoryService
      .list({ scope: 'prem_apps' })
      .then((res) => {
        if (!alive || !res.success) return
        const options = toDigiProductCategoryOptions(
          (res.data || []).map((item) => ({ code: item.code, label: item.label }))
        )
        setCategories(options)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const effectiveCategory = categories.some((item) => item.value === category) ? category : ''
  useEffect(() => {
    if (!isCategoryFilterOpen) return
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!categoryFilterRef.current) return
      if (categoryFilterRef.current.contains(event.target as Node)) return
      setIsCategoryFilterOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCategoryFilterOpen(false)
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('touchstart', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCategoryFilterOpen])

  useEffect(() => {
    productService.list({ category: effectiveCategory || undefined, limit: 50 })
      .then((res) => {
        if (res.success) setProducts(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [effectiveCategory])

  const handleCategoryChange = (nextCategory: string) => {
    if (nextCategory === effectiveCategory) {
      setIsCategoryFilterOpen(false)
      return
    }
    setLoading(true)
    setCategory(nextCategory)
    setIsCategoryFilterOpen(false)
  }

  return (
    <>
      <Navbar />

      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="mb-10 md:mb-12">
            <div className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF3EF] border border-[#FFE2CF] px-4 py-1.5 text-[11px] font-bold text-[#FF5733]">
                <Sparkles className="h-3.5 w-3.5" />
                Produk Digital Siap Pakai
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                DigiProduct
              </h1>
              <p className="text-sm md:text-base text-[#888] max-w-lg">
                Lisensi, akun, voucher, tools — semua produk digital dalam satu tempat. Bayar pakai wallet, langsung aktif.
              </p>
            </div>

            {/* Quick highlight chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {[
                { icon: <Zap className="h-3.5 w-3.5" />, text: 'Pengiriman Instan' },
                { text: '🛡 Garansi Aktif' },
                { text: '💳 QRIS / VA / Wallet' },
              ].map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F7F5] border border-[#EBEBEB] px-3 py-1.5 text-[11px] font-medium text-[#555]"
                >
                  {item.icon}
                  {item.text}
                </span>
              ))}
            </div>
          </div>

          {/* Filter bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div ref={categoryFilterRef} className="relative flex items-center gap-2">
              <button
                type="button"
                aria-label="Buka filter kategori"
                aria-haspopup="true"
                aria-expanded={isCategoryFilterOpen}
                onClick={() => setIsCategoryFilterOpen((prev) => !prev)}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all ${
                  isCategoryFilterOpen
                    ? 'border-[#141414] bg-[#141414] text-white shadow-[0_10px_24px_rgba(20,20,20,0.18)]'
                    : 'border-[#EBEBEB] bg-white text-[#666] hover:bg-[#F7F7F7]'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filter</span>
              </button>

              {categories
                .filter((cat) => cat.value !== '')
                .map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleCategoryChange(effectiveCategory === cat.value ? '' : cat.value)}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all ${
                      effectiveCategory === cat.value
                        ? 'border-[#141414] bg-[#141414] text-white'
                        : 'border-[#EBEBEB] bg-white text-[#666] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Product grid */}
          {loading ? (
            <DigiLoadingCardGrid count={6} />
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-[#EBEBEB] mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-1">Tidak ada produk</h3>
              <p className="text-sm text-[#888]">Belum ada produk di kategori ini. Coba kategori lain.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  )
}
