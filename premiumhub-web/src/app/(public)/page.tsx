"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ProductCard from '@/components/shared/ProductCard'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { productService } from '@/services/productService'
import type { Product } from '@/types/product'
import { ShieldCheck, Zap, Clock, Star } from 'lucide-react'

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    productService.list({ limit: 6 }).then(res => {
      if (res.success) setProducts(res.data)
    }).catch(() => {})
  }, [])

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#F7F7F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#FFF3EF] text-[#FF5733] text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" /> Akun Premium Instan
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight">
              Akun Premium{' '}
              <span className="text-[#FF5733]">Terpercaya</span>{' '}
              dengan Harga Terjangkau
            </h1>
            <p className="text-lg text-[#888] mb-10 max-w-xl mx-auto leading-relaxed">
              Netflix, Spotify, Disney+, dan puluhan layanan premium lainnya. Pengiriman otomatis, garansi 30 hari.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/katalog" className="inline-flex items-center justify-center px-8 py-4 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all hover:shadow-lg hover:shadow-[#FF5733]/25 text-sm">
                Jelajahi Katalog
              </Link>
              <Link href="/faq" className="inline-flex items-center justify-center px-8 py-4 bg-[#141414] text-white font-bold rounded-full hover:bg-[#2a2a2a] transition-all text-sm">
                Cara Kerja
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[#EBEBEB] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10K+', label: 'Pelanggan Aktif' },
              { value: '50K+', label: 'Akun Terjual' },
              { value: '30 Hari', label: 'Garansi' },
              { value: '⚡ Instan', label: 'Pengiriman' },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-2xl md:text-3xl font-extrabold text-[#141414]">{s.value}</div>
                <div className="text-xs text-[#888] mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Produk Populer</h2>
            <p className="text-[#888] text-sm">Pilih layanan premium favoritmu</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/katalog" className="inline-flex items-center px-6 py-3 border-2 border-[#141414] text-[#141414] font-bold rounded-full hover:bg-[#141414] hover:text-white transition-all text-sm">
              Lihat Semua Produk →
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white border-y border-[#EBEBEB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Cara Kerja</h2>
            <p className="text-[#888] text-sm">3 langkah mudah untuk mendapat akun premium</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Star className="w-6 h-6" />, title: 'Pilih Produk', desc: 'Pilih layanan premium dan tipe akun yang kamu inginkan.' },
              { icon: <Zap className="w-6 h-6" />, title: 'Bayar', desc: 'Lakukan pembayaran melalui metode yang tersedia.' },
              { icon: <ShieldCheck className="w-6 h-6" />, title: 'Terima Akun', desc: 'Akun langsung terkirim otomatis setelah pembayaran.' },
            ].map((step, i) => (
              <div key={i} className="text-center p-8 rounded-2xl hover:bg-[#F7F7F5] transition-colors">
                <div className="w-14 h-14 bg-[#FFF3EF] text-[#FF5733] rounded-2xl flex items-center justify-center mx-auto mb-5">
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-[#FF5733] mb-2">STEP {i + 1}</div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-[#888] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#141414] rounded-3xl p-10 md:p-16 text-center text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" /> Garansi 30 Hari
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Siap Berlangganan Premium?</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto text-sm leading-relaxed">
              Gabung ribuan pelanggan yang sudah menikmati akun premium dengan harga terjangkau.
            </p>
            <Link href="/register" className="inline-flex items-center px-8 py-4 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all hover:shadow-lg text-sm">
              Daftar Sekarang — Gratis
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
