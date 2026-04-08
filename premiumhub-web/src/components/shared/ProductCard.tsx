"use client"

import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'
import type { Product } from '@/types/product'

export default function ProductCard({ product }: { product: Product }) {
  const minPrice = product.prices?.length
    ? Math.min(...product.prices.map(p => p.price))
    : 0

  return (
    <Link href={`/product/prem-apps/${product.slug}`} className="group block">
      <div
        className="relative rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-transparent hover:border-[#EBEBEB]"
        style={{ backgroundColor: product.color || '#F7F7F5' }}
      >
        {product.is_popular && (
          <div className="absolute top-3 right-3 bg-[#FF5733] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Popular
          </div>
        )}

        <div className="text-4xl mb-4">{product.icon}</div>
        <h3 className="text-lg font-bold text-[#141414] mb-1">{product.name}</h3>
        <p className="text-xs text-[#888] mb-4 capitalize">{product.category}</p>

        <div className="flex items-baseline gap-1">
          <span className="text-sm text-[#888]">Mulai dari</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-[#141414]">{formatRupiah(minPrice)}</span>
          <span className="text-xs text-[#888]">/bulan</span>
        </div>

        <div className="mt-4 flex gap-2">
          {product.prices?.some(p => p.account_type === 'shared') && (
            <span className="text-[10px] font-medium text-[#141414] bg-white/60 px-2 py-1 rounded-full">Shared</span>
          )}
          {product.prices?.some(p => p.account_type === 'private') && (
            <span className="text-[10px] font-medium text-[#141414] bg-white/60 px-2 py-1 rounded-full">Private</span>
          )}
        </div>
      </div>
    </Link>
  )
}
