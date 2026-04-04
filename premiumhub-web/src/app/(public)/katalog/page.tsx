"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ProductCard from '@/components/shared/ProductCard'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { productService } from '@/services/productService'
import type { Product } from '@/types/product'
import { Search, SlidersHorizontal } from 'lucide-react'

const CATEGORIES = [
  { value: '', label: 'Semua' },
  { value: 'streaming', label: '🎬 Streaming' },
  { value: 'music', label: '🎵 Musik' },
  { value: 'gaming', label: '🎮 Gaming' },
  { value: 'design', label: '🎨 Desain' },
  { value: 'productivity', label: '⚡ Produktivitas' },
]

export default function KatalogPage() {
  return (
    <Suspense fallback={<><Navbar /><div className="py-32 text-center animate-pulse text-[#888]">Loading...</div><Footer /></>}>
      <KatalogContent />
    </Suspense>
  )
}

function KatalogContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    productService.list({ category: category || undefined, limit: 50 })
      .then(res => { if (res.success) setProducts(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category])

  return (
    <>
      <Navbar />

      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Katalog Produk</h1>
            <p className="text-[#888] text-sm">Temukan akun premium yang kamu butuhkan</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-8 justify-center">
            <SlidersHorizontal className="w-4 h-4 text-[#888]" />
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  category === cat.value
                    ? 'bg-[#141414] text-white'
                    : 'bg-white text-[#888] hover:bg-[#EBEBEB] border border-[#EBEBEB]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-52 bg-white/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-[#EBEBEB] mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-1">Tidak ada produk</h3>
              <p className="text-sm text-[#888]">Coba kategori lain</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => (
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
