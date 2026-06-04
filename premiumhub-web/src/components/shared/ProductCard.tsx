"use client"

import Image from 'next/image'
import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'
import { fulfillmentTypeLabel, isCredentialFulfillment } from '@/lib/fulfillment'
import type { Product } from '@/types/product'

export default function ProductCard({ product }: { product: Product }) {
  const prices = product.prices || []
  const activePrices = prices.filter((p) => p.is_active)
  const minPrice = activePrices.length
    ? Math.min(...activePrices.map((p) => p.price))
    : 0
  const maxPrice = activePrices.length > 1
    ? Math.max(...activePrices.map((p) => p.price))
    : minPrice
  const hasDiscount = maxPrice > minPrice && activePrices.length > 1
  const discountPercent = hasDiscount
    ? Math.round(((maxPrice - minPrice) / maxPrice) * 100)
    : 0

  const totalStock = typeof product.available_stock === 'number'
    ? Math.max(0, product.available_stock)
    : null

  // Calculate total capacity from prices stock
  const maxCapacity = activePrices.length > 0
    ? activePrices.reduce((sum, p) => sum + (typeof p.available_stock === 'number' ? Math.max(0, p.available_stock) : 0), 0)
    : null

  const usedCount = maxCapacity !== null && totalStock !== null
    ? Math.max(0, maxCapacity - totalStock)
    : null

  const fulfillmentType = product.fulfillment_type || 'credential'
  const showFulfillmentBadge = !isCredentialFulfillment(fulfillmentType)

  return (
    <Link href={`/product/digiproduct/${product.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white p-3 sm:p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-[#D9D9D2]">
        {/* Discount badge */}
        {hasDiscount && discountPercent > 0 && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 bg-[#FF5733] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded">
            -{discountPercent}%
          </div>
        )}

        {/* Popular badge */}
        {product.is_popular && !hasDiscount && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 bg-[#141414] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded">
            Popular
          </div>
        )}

        {/* Icon */}
        <div className="mb-2 sm:mb-3 flex items-center gap-3">
          {product.icon_image_url ? (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#F7F7F5] border border-[#E5E7EB] p-1 shrink-0">
              <Image src={product.icon_image_url} alt={product.name} width={48} height={48} unoptimized className="w-full h-full rounded-lg object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#F7F7F5] border border-[#E5E7EB] flex items-center justify-center text-2xl sm:text-3xl shrink-0">
              {product.icon || '📦'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-[#141414] leading-tight truncate">{product.name}</h3>
              {showFulfillmentBadge && (
                <span className="text-[9px] font-semibold text-[#FF5733] bg-[#FFF3EF] px-1.5 py-0.5 rounded shrink-0">
                  {fulfillmentTypeLabel(fulfillmentType)}
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-[#888] mt-0.5 capitalize">{product.category}</p>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-base sm:text-lg font-extrabold text-[#141414]">{formatRupiah(minPrice)}</span>
          {hasDiscount && (
            <span className="text-[11px] sm:text-xs text-[#AAA] line-through">{formatRupiah(maxPrice)}</span>
          )}
        </div>

        {/* Stock counter or availability */}
        <div className="mt-2 sm:mt-3 flex items-center gap-2 flex-wrap">
          {totalStock !== null && totalStock > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="w-full max-w-[80px] sm:max-w-[100px] h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                {maxCapacity !== null && maxCapacity > 0 && (
                  <div
                    className="h-full rounded-full bg-[#FF5733]"
                    style={{ width: `${Math.min(100, Math.round((totalStock / maxCapacity) * 100))}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium text-[#666] shrink-0">
                {usedCount !== null ? `${totalStock} tersedia` : `Stok ${totalStock}`}
              </span>
            </div>
          ) : totalStock === 0 ? (
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#B91C1C] bg-[#FEF2F2] px-2 py-0.5 rounded-full">
              Stok habis
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
