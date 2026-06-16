"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { DigiLoadingCardGrid } from '@/components/shared/DigiLoading'
import ProductCard from '@/components/shared/ProductCard'
import BannerSlider from '@/components/shared/BannerSlider'
import CountdownTimer from '@/components/shared/CountdownTimer'
import FlashSaleCard from '@/components/shared/FlashSaleCard'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { productService } from '@/services/productService'
import { productCategoryService } from '@/services/productCategoryService'
import { heroBgService } from '@/services/heroBgService'
import { flashSaleService } from '@/services/flashSaleService'
import type { Product } from '@/types/product'
import type { SiteFlashSale } from '@/types/flashSale'
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
  const [heroBgColor, setHeroBgColor] = useState('#141414')
  const [heroBgImage, setHeroBgImage] = useState<string | null>(null)
  const [flashSales, setFlashSales] = useState<SiteFlashSale[]>([])

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

  // Fetch hero background customization
  useEffect(() => {
    heroBgService.getPublicHeroBg('digiproduct').then((res) => {
      if (res.success && res.data) {
        setHeroBgColor(res.data.background_color || '#141414')
        setHeroBgImage(res.data.background_image_url || null)
      }
    }).catch(() => {})
  }, [])

  // Fetch active flash sales
  useEffect(() => {
    flashSaleService.getPublicActive().then((res) => {
      if (res.success) setFlashSales(res.data ?? [])
    }).catch(() => {})
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

      {/* Hero + Banner — unified dark section with dynamic background */}
      <section
        style={{
          backgroundColor: heroBgColor,
          ...(heroBgImage ? {
            backgroundImage: `url(${heroBgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : {}),
        }}
      >
        <div className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-[#FF5733] opacity-[0.06] rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 sm:w-72 h-48 sm:h-72 bg-[#FF5733] opacity-[0.04] rounded-full blur-[80px] pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-10 sm:pb-14">
            <div className="max-w-2xl">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Gas Cek katalog DigiProduct
              </h1>
              <p className="mt-2 text-sm sm:text-base text-white/60 max-w-lg">
                Lisensi, akun game, voucher, tools. Pilih, bayar, langsung aktif.
              </p>
            </div>

            {/* Banner slider inline */}
            <div className="mt-8 sm:mt-10">
              <BannerSlider />
            </div>

            {/* Flash Sale section */}
            {flashSales.length > 0 && (
              <div className="mt-8 sm:mt-10">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">
                    ⚡ Flash Sale
                  </h2>
                  <CountdownTimer endsAt={flashSales[0].ends_at} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {flashSales.map((fs) => (
                    <FlashSaleCard key={fs.id} flashSale={fs} />
                  ))}
                </div>
              </div>
            )}

            {/* Trust + action pills */}
            <div className="mt-8 flex gap-2 flex-wrap justify-center sm:justify-start">
              {[
                { icon: <Zap className="h-3.5 w-3.5" />, text: 'Pengiriman Instan' },
                { icon: <ShieldCheck className="h-3.5 w-3.5" />, text: 'Garansi Aktif' },
                { icon: <CreditCard className="h-3.5 w-3.5" />, text: 'QRIS, VA, Wallet' },
              ].map((item, i) => (
                <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white/60">
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

        <div className="h-8 sm:h-12" style={{ background: `linear-gradient(to bottom, ${heroBgColor}, #F4F5F8)` }} />
      </section>

      {/* Category pills + content */}
      <section className="bg-[#F4F5F8] py-6 sm:py-10">
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
                      ? 'bg-[#141414] text-white shadow-md'
                      : 'bg-white text-[#666] ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-gray-900'
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
              <Search className="w-12 h-12 text-[#D5D5D0] mx-auto mb-4" />
              <h3 className="text-lg font-bold text-[#888] mb-1">Tidak ada produk</h3>
              <p className="text-sm text-[#AAA]">Belum ada produk di kategori ini.</p>
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
