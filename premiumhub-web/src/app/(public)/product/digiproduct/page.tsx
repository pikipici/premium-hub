"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { DigiLoadingCardGrid } from '@/components/shared/DigiLoading'
import ProductCard from '@/components/shared/ProductCard'
import BannerSlider from '@/components/shared/BannerSlider'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { productService } from '@/services/productService'
import { productCategoryService } from '@/services/productCategoryService'
import type { Product } from '@/types/product'
import { CreditCard, Search, ShieldCheck, Zap } from 'lucide-react'
import Link from 'next/link'

type CategoryOption = {
  value: string
  label: string
  emoji: string
}

const FALLBACK_CATEGORIES: CategoryOption[] = [
  { value: '', label: 'Semua', emoji: '' },
  { value: 'streaming', label: 'Streaming', emoji: '🎬' },
  { value: 'music', label: 'Musik', emoji: '🎵' },
  { value: 'gaming', label: 'Gaming', emoji: '🎮' },
  { value: 'design', label: 'Desain', emoji: '🎨' },
  { value: 'productivity', label: 'Tools', emoji: '⚡' },
]

const CATEGORY_EMOJI_MAP: Record<string, string> = {
  streaming: '🎬',
  music: '🎵',
  gaming: '🎮',
  design: '🎨',
  productivity: '⚡',
}

type SectionGroup = {
  category: string
  label: string
  emoji: string
  products: Product[]
}

export default function DigiProductPage() {
  return (
    <Suspense fallback={<><Navbar /><div className="py-32 text-center text-sm text-[#888]">Memuat katalog...</div><Footer /></>}>
      <DigiProductContent />
    </Suspense>
  )
}

function DigiProductContent() {
  const searchParams = useSearchParams()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>(FALLBACK_CATEGORIES)
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      productService.list({ limit: 50 }),
      productCategoryService.list({ scope: 'prem_apps' }),
    ]).then(([prodRes, catRes]) => {
      if (!alive) return
      if (prodRes.success) setAllProducts(prodRes.data)
      if (catRes.success) {
        const opts: CategoryOption[] = [
          { value: '', label: 'Semua', emoji: '' },
          ...(catRes.data || []).map((item) => ({
            value: item.code,
            label: item.label?.trim() || item.code,
            emoji: CATEGORY_EMOJI_MAP[item.code] || '',
          })),
        ]
        setCategories(opts)
      }
    }).catch(() => {}).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const effectiveCategory = categories.some((item) => item.value === category) ? category : ''

  // Build section groups when "Semua" is selected
  const sections = useMemo((): SectionGroup[] => {
    if (effectiveCategory !== '') {
      const cat = categories.find((c) => c.value === effectiveCategory)
      return [{
        category: effectiveCategory,
        label: cat?.label || effectiveCategory,
        emoji: cat?.emoji || '',
        products: allProducts,
      }]
    }

    // Group by category, preserve order from categories config
    const catOrder = categories.filter((c) => c.value !== '').map((c) => c.value)
    const groups = new Map<string, Product[]>()
    allProducts.forEach((p) => {
      const cat = (p.category || '').trim().toLowerCase()
      if (!cat) return
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(p)
    })

    return catOrder
      .filter((code) => groups.has(code) && groups.get(code)!.length > 0)
      .map((code) => {
        const cat = categories.find((c) => c.value === code)
        return {
          category: code,
          label: cat?.label || code,
          emoji: cat?.emoji || '',
          products: groups.get(code)!,
        }
      })
  }, [allProducts, effectiveCategory, categories])

  const handleCategoryChange = (next: string) => {
    if (next === effectiveCategory) return
    setCategory(next)
  }

  return (
    <>
      <Navbar />

      {/* Hero strip — headline + trust pills */}
      <section className="relative bg-[#141414] overflow-hidden">
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-[#FF5733] opacity-[0.06] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 sm:w-72 h-48 sm:h-72 bg-[#FF5733] opacity-[0.04] rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-8 sm:pb-10">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Gas Cek katalog DigiProduct
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/60 max-w-lg">
              Lisensi, akun game, voucher, tools. Pilih, bayar, langsung aktif.
            </p>

            <div className="flex gap-2 mt-5 flex-wrap">
              {[
                { icon: <Zap className="h-3.5 w-3.5" />, text: 'Pengiriman Instan' },
                { icon: <ShieldCheck className="h-3.5 w-3.5" />, text: 'Garansi Aktif' },
                { icon: <CreditCard className="h-3.5 w-3.5" />, text: 'QRIS, VA, Wallet' },
              ].map((item, i) => (
                <div key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/80">
                  <span className="text-[#FF5733]">{item.icon}</span>
                  {item.text}
                </div>
              ))}
              <Link href="/lacak-pesanan" className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5733] px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#e64d2e] transition-colors">
                <Search className="h-3 w-3" />
                Lacak Pesanan
              </Link>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* Banner slider carousel */}
      <BannerSlider />

      {/* Category pills + content */}
      <section className="py-6 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category pills — scrollable horizontal */}
          <div className="mb-8 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            <div className="flex gap-2 pb-1 min-w-max">
              {categories.map((cat) => (
                <button
                  key={cat.value || 'all'}
                  type="button"
                  onClick={() => handleCategoryChange(cat.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all shrink-0 ${
                    effectiveCategory === cat.value
                      ? 'bg-[#141414] text-white'
                      : 'bg-white text-[#666] border border-[#EBEBEB] hover:bg-[#F7F7F5]'
                  }`}
                >
                  {cat.emoji && <span>{cat.emoji}</span>}
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <DigiLoadingCardGrid count={6} />
          ) : allProducts.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-[#EBEBEB] mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-1">Tidak ada produk</h3>
              <p className="text-sm text-[#888]">Belum ada produk di kategori ini.</p>
            </div>
          ) : effectiveCategory !== '' ? (
            /* Single category — flat grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {allProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            /* All categories — sectioned groups */
            <div className="space-y-10 sm:space-y-14">
              {sections.map((section) => (
                <div key={section.category}>
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-extrabold text-[#141414] flex items-center gap-2">
                      {section.emoji && <span>{section.emoji}</span>}
                      {section.label}
                    </h2>
                    <div className="text-[11px] font-semibold text-[#888]">
                      {section.products.length} produk
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                    {section.products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  )
}
