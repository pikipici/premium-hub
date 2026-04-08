"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { productService } from '@/services/productService'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/utils'
import type { Product, ProductPrice } from '@/types/product'
import { ShieldCheck, Clock, Zap, Check } from 'lucide-react'

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
            const firstPrice = res.data.prices?.find((p) => p.account_type === 'shared')
            if (firstPrice) setSelectedPrice(firstPrice)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [params.slug])

  const filteredPrices = product?.prices?.filter((p) => p.account_type === accountType) || []

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
    router.push('/checkout')
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

  return (
    <>
      <Navbar />

      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl p-8 md:p-10 mb-8" style={{ backgroundColor: product.color || '#F7F7F5' }}>
            <div className="flex items-start gap-4">
              <div className="text-5xl">{product.icon}</div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold mb-1">{product.name}</h1>
                <p className="text-sm text-[#888] capitalize">{product.category}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[#666] leading-relaxed">{product.description}</p>

            <div className="flex gap-4 mt-6">
              {[
                { icon: <ShieldCheck className="w-4 h-4" />, text: 'Garansi 30 Hari' },
                { icon: <Zap className="w-4 h-4" />, text: 'Pengiriman Instan' },
                { icon: <Clock className="w-4 h-4" />, text: 'Support 24/7' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-[#141414] bg-white/60 px-3 py-1.5 rounded-full">
                  {f.icon} {f.text}
                </div>
              ))}
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
                  <div className="text-xs text-[#888]">
                    {type === 'shared' ? 'Berbagi dengan pengguna lain' : 'Akun pribadi, akses penuh'}
                  </div>
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
