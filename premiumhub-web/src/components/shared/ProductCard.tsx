"use client"

import Image from 'next/image'
import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'
import { fulfillmentTypeLabel, isCredentialFulfillment } from '@/lib/fulfillment'
import EmblaCarousel from '@/components/shared/EmblaCarousel'
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

  // Total capacity from prices stock sum
  const maxCapacity = activePrices.length > 0
    ? activePrices.reduce((sum, p) => sum + (typeof p.available_stock === 'number' ? Math.max(0, p.available_stock) : 0), 0)
    : null

  const fulfillmentType = product.fulfillment_type || 'credential'
  const showFulfillmentBadge = !isCredentialFulfillment(fulfillmentType)
  const stockDepleted = totalStock === 0

  return (
    <Link href={`/product/digiproduct/${product.slug}`} className="group block">
      <div className={`relative overflow-hidden rounded-2xl border bg-white p-3 sm:p-4 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-1 hover:border-[#D9D9D2] ${stockDepleted ? 'opacity-75' : ''}`}>
        {/* Discount badge — top left */}
        {hasDiscount && discountPercent > 0 && (
          <div className="absolute top-0 left-0 z-10 flex items-center gap-0.5 rounded-br-xl bg-[#FF5733] px-2.5 py-1 text-[10px] font-extrabold text-white leading-none shadow-sm">
            -{discountPercent}%
          </div>
        )}

        {/* Popular badge — top left if no discount */}
        {product.is_popular && !(hasDiscount && discountPercent > 0) && (
          <div className="absolute top-0 left-0 z-10 rounded-br-lg bg-[#141414] px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
            Popular
          </div>
        )}

        {/* Stock depleted overlay */}
        {stockDepleted && (
          <div className="absolute top-0 left-0 z-10 rounded-br-lg bg-[#B91C1C] px-2 py-0.5 text-[9px] font-bold text-white">
            Habis
          </div>
        )}

        {/* Image / icon */}
        <div className="relative aspect-[4/3] rounded-xl bg-[#F7F7F5] mb-3 overflow-hidden flex items-center justify-center">
          {product.cover_images && product.cover_images.length > 0 ? (
            <EmblaCarousel images={product.cover_images} alt={product.name} />
          ) : product.icon_image_url ? (
            <Image src={product.icon_image_url} alt={product.name} fill unoptimized className="object-contain p-4" />
          ) : (
            <span className="text-5xl sm:text-6xl">{product.icon || '📦'}</span>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {showFulfillmentBadge && (
              <span className="text-[9px] font-semibold text-[#FF5733] bg-[#FFF3EF] px-1.5 py-0.5 rounded shrink-0">
                {fulfillmentTypeLabel(fulfillmentType)}
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-[#141414] leading-snug line-clamp-2 group-hover:text-[#FF5733] transition-colors">
            {product.name}
          </h3>

          <p className="text-[11px] text-[#888] capitalize">{product.category}</p>

          {/* Price */}
          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-base font-extrabold text-[#141414]">{formatRupiah(minPrice)}</span>
            {hasDiscount && (
              <span className="text-[11px] text-[#AAA] line-through">{formatRupiah(maxPrice)}</span>
            )}
          </div>

          {/* Stock bar + counter */}
          {totalStock !== null && totalStock > 0 ? (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-1.5 rounded-full bg-[#E8E8E3] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FF5733] transition-all"
                  style={{ width: `${Math.min(100, maxCapacity && maxCapacity > 0 ? Math.round((totalStock / maxCapacity) * 100) : 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-[#888] shrink-0">
                {maxCapacity !== null && maxCapacity > 0
                  ? `Stok ${totalStock}`
                  : `${totalStock} tersedia`}
              </span>
            </div>
          ) : totalStock === 0 ? (
            <div className="pt-0.5">
              <span className="text-[10px] font-semibold text-[#B91C1C] bg-[#FEF2F2] px-2 py-0.5 rounded-full">
                Stok habis
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
