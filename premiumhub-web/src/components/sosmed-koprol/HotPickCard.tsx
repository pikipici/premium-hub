"use client"

import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type HotPickCardProps = {
  href: string
  title: string
  categoryLabel: string
  originalPriceLabel?: string
  priceLabel: string
  /** Already-formatted percentage label e.g. "-50%". */
  discountLabel?: string
  stock?: 'in-stock' | 'out-of-stock'
  Icon: IconComp
  toneClass?: string
}

/**
 * Koprol-style "Hot Produk" card.
 * Updated v2: pill is neutral gray; the orange-red HOT sash + price color carry the urgency.
 * Avoids stacking 3 colored badges on one card.
 */
export function HotPickCard({ href, title, categoryLabel, originalPriceLabel, priceLabel, discountLabel, stock = 'in-stock', Icon, toneClass }: HotPickCardProps) {
  const inStock = stock === 'in-stock'
  const containerClass = inStock
    ? 'cursor-pointer hover:shadow-[0_14px_36px_rgba(255,87,51,0.22)] active:scale-[0.97]'
    : 'opacity-50 cursor-not-allowed'

  const inner = (
    <div className={`relative flex h-full flex-col rounded-2xl border border-orange-200/60 bg-white px-3 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.05)] transition-all duration-200 sm:px-4 sm:py-3.5 ${containerClass}`}>
      <span className="absolute -right-2 -top-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
        HOT
      </span>
      <div className="mb-2 flex items-start gap-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-black/5 ${toneClass ?? 'from-[#FFF3EF] to-[#FFE4DA]'}`}>
          <Icon className="h-4 w-4 text-[#141414] sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 pr-4 text-[13px] font-semibold leading-snug text-[#141414] sm:text-sm">{title}</h3>
          <span className="mt-0.5 inline-flex max-w-[120px] items-center truncate rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
            {categoryLabel}
          </span>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
        {originalPriceLabel ? (
          <span className="text-[11px] text-gray-400 line-through">{originalPriceLabel}</span>
        ) : null}
        <span className="text-[13px] font-bold text-[#FF5733] sm:text-sm">{priceLabel}</span>
        {discountLabel ? (
          <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{discountLabel}</span>
        ) : null}
      </div>
      {!inStock ? (
        <span className="mt-1.5 inline-flex text-[10px] font-semibold text-rose-500">Habis</span>
      ) : null}
    </div>
  )

  if (!inStock) return inner
  return (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  )
}

export default HotPickCard
