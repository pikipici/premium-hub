"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ProductCard from '@/components/shared/ProductCard'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { productService } from '@/services/productService'
import { productCategoryService } from '@/services/productCategoryService'
import type { Product } from '@/types/product'
import { Search, SlidersHorizontal } from 'lucide-react'

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
  { value: 'productivity', label: '⚡ Produktivitas' },
]

const PREM_APPS_EMOJI_BY_CODE: Record<string, string> = {
  streaming: '🎬',
  music: '🎵',
  gaming: '🎮',
  design: '🎨',
  productivity: '⚡',
}

function toPremAppsCategoryOptions(items: Array<{ code: string; label: string }>): CategoryOption[] {
  if (!items.length) return FALLBACK_CATEGORIES

  const mapped: CategoryOption[] = [
    { value: '', label: 'Semua' },
    ...items.map((item) => {
      const emoji = PREM_APPS_EMOJI_BY_CODE[item.code]
      const normalizedLabel = item.label?.trim() || item.code
      return {
        value: item.code,
        label: emoji ? `${emoji} ${normalizedLabel}` : normalizedLabel,
      }
    }),
  ]

  return mapped
}

export default function PremAppsPage() {
  return (
    <Suspense fallback={<><Navbar /><div className="py-32 text-center animate-pulse text-[#888]">Loading...</div><Footer /></>}>
      <PremAppsContent />
    </Suspense>
  )
}

function PremAppsContent() {
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

        const options = toPremAppsCategoryOptions(
          (res.data || []).map((item) => ({ code: item.code, label: item.label }))
        )
        setCategories(options)
      })
      .catch(() => {
        // keep fallback categories
      })

    return () => {
      alive = false
    }
  }, [])

  const effectiveCategory = categories.some((item) => item.value === category) ? category : ''
  const activeCategoryLabel = categories.find((item) => item.value === effectiveCategory)?.label || 'Semua'

  useEffect(() => {
    if (!isCategoryFilterOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!categoryFilterRef.current) return
      if (categoryFilterRef.current.contains(event.target as Node)) return
      setIsCategoryFilterOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCategoryFilterOpen(false)
      }
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
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Apps Premium</h1>
            <p className="text-[#888] text-sm">Pilih aplikasi premium sesuai kebutuhan lu</p>
          </div>

          <div className="mb-8 flex justify-center">
            <div ref={categoryFilterRef} className="relative inline-flex items-center gap-2">
              <button
                type="button"
                aria-label="Buka filter kategori"
                aria-haspopup="true"
                aria-expanded={isCategoryFilterOpen}
                onClick={() => setIsCategoryFilterOpen((prev) => !prev)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                  isCategoryFilterOpen
                    ? 'border-[#141414] bg-[#141414] text-white'
                    : 'border-[#EBEBEB] bg-white text-[#888] hover:bg-[#F7F7F7]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {effectiveCategory ? (
                <button
                  type="button"
                  onClick={() => handleCategoryChange('')}
                  className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-3 py-2 text-xs font-medium text-[#666] hover:bg-[#F7F7F7] transition-colors"
                >
                  {activeCategoryLabel}
                  <span aria-hidden>✕</span>
                </button>
              ) : null}

              {isCategoryFilterOpen ? (
                <div className="absolute left-1/2 top-full z-20 mt-3 w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl border border-[#EBEBEB] bg-white p-3 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.value || 'all'}
                        type="button"
                        onClick={() => handleCategoryChange(cat.value)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          effectiveCategory === cat.value
                            ? 'bg-[#141414] text-white'
                            : 'bg-white text-[#888] hover:bg-[#EBEBEB] border border-[#EBEBEB]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-44 sm:h-52 bg-white/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-[#EBEBEB] mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-1">Tidak ada produk</h3>
              <p className="text-sm text-[#888]">Coba kategori lain</p>
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
