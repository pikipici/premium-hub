"use client"

import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type PromoSavingCardProps = {
  href: string
  title: string
  categoryLabel: string
  originalPriceLabel?: string
  priceLabel: string
  /** Already-formatted percentage label e.g. "-50%". */
  discountLabel?: string
  /** "Hemat Rp X" string already formatted. */
  savingLabel?: string
  stock?: 'in-stock' | 'out-of-stock'
  Icon: IconComp
  toneClass?: string
}

/**
 * Koprol-style "Promo Diskon" card vertical.
 * Updated v2: neutral category pill, rose price + Hemat chip carry the discount signal.
 * Discount sash dropped if `savingLabel` is shown (one signal at a time, not both).
 */
export function PromoSavingCard({ href, title, categoryLabel, originalPriceLabel, priceLabel, discountLabel, savingLabel, stock = 'in-stock', Icon, toneClass }: PromoSavingCardProps) {
  const inStock = stock === 'in-stock'
  const containerClass = inStock
    ? 'cursor-pointer hover:shadow-[0_14px_36px_rgba(225,29,72,0.22)] active:scale-[0.97]'
    : 'opacity-50 cursor-not-allowed'

  const inner = (
    <div className={`relative flex h-full flex-col rounded-2xl bg-white p-3 shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5 transition-all duration-200 sm:p-4 ${containerClass}`}>
      {discountLabel ? (
        <span className="absolute -right-2 -top-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
          {discountLabel}
        </span>
      ) : null}
      <div className="mb-3 flex items-start gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-black/5 ${toneClass ?? 'from-[#FFF3EF] to-[#FFE4DA]'}`}>
          <Icon className="h-4 w-4 text-[#141414]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 pr-4 text-[12px] font-semibold leading-snug text-[#141414] sm:text-[13px]">{title}</h3>
          <span className="mt-0.5 inline-flex max-w-[120px] items-center truncate rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-600 sm:text-[10px]">
            {categoryLabel}
          </span>
        </div>
      </div>

      <div className="mb-2.5 space-y-0.5">
        {originalPriceLabel ? (
          <p className="text-[11px] leading-none text-gray-400 line-through">{originalPriceLabel}</p>
        ) : null}
        <p className="text-base font-black leading-tight text-rose-600 sm:text-lg">{priceLabel}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
        {savingLabel ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 sm:text-[11px]">
            {savingLabel}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-gray-400 sm:text-[11px]">Promo terbatas</span>
        )}
        {inStock ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Stok tersedia" />
        ) : (
          <span className="shrink-0 text-[10px] font-semibold text-rose-500">Habis</span>
        )}
      </div>
    </div>
  )

  if (!inStock) return inner
  return (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  )
}

export default PromoSavingCard
