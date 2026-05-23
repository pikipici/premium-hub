"use client"

import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type BundlePromoCardProps = {
  href: string
  title: string
  /** Subtitle / best-for tagline, line-clamp-2. */
  subtitle?: string
  platformLabel: string
  Icon: IconComp
  toneClass?: string
  priceLabel: string
  originalPriceLabel?: string
  packageLabel?: string
  isRecommended?: boolean
  hasPromo?: boolean
  promoDiscountLabel?: string
  canCheckout?: boolean
}

/**
 * Compact koprol-style bundle card. Larger than `ServiceCardCompact` but
 * smaller than the legacy `BundleCard`, designed for `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.
 * Preserves Premium Hub recommended/promo treatment but flatter.
 */
export function BundlePromoCard({ href, title, subtitle, platformLabel, Icon, toneClass, priceLabel, originalPriceLabel, packageLabel, isRecommended, hasPromo, promoDiscountLabel, canCheckout = true }: BundlePromoCardProps) {
  const containerBase = 'relative flex flex-col rounded-2xl p-3 sm:p-4 shadow-[0_10px_40px_rgba(0,0,0,0.06)] ring-1 transition-all duration-200'
  const containerVariant = !canCheckout
    ? 'opacity-60 cursor-not-allowed bg-white ring-black/5'
    : hasPromo
      ? 'bg-gradient-to-br from-[#FFE0D5] via-white to-white ring-[#FF9B80]/40 hover:shadow-[0_18px_48px_rgba(255,87,51,0.22)] hover:-translate-y-0.5'
      : isRecommended
        ? 'bg-gradient-to-br from-[#FFF8F5] to-white ring-[#FFB199]/40 hover:shadow-[0_16px_42px_rgba(255,87,51,0.16)] hover:-translate-y-0.5'
        : 'bg-white ring-black/5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.10)] hover:ring-[#FFB199]/40 hover:-translate-y-0.5'

  const inner = (
    <div className={`${containerBase} ${containerVariant}`}>
      {hasPromo ? (
        <span className="absolute -right-2 -top-2 z-10 rounded-full bg-gradient-to-r from-[#B4161B] via-[#FF5733] to-[#FF9B31] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
          {promoDiscountLabel ?? 'Promo'}
        </span>
      ) : isRecommended ? (
        <span className="absolute -right-2 -top-2 z-10 inline-flex items-center gap-0.5 rounded-full bg-[#FF5733] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
          <Sparkles className="h-2.5 w-2.5" />
          Best
        </span>
      ) : null}

      <div className="mb-2 flex items-start gap-2 sm:mb-3 sm:gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-black/5 sm:h-11 sm:w-11 ${toneClass ?? 'from-[#FFF3EF] to-[#FFE4DA]'}`}>
          <Icon className="h-4 w-4 text-[#141414] sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[13px] font-extrabold leading-snug text-[#141414] sm:text-sm">{title}</h3>
          <span className="mt-0.5 inline-flex max-w-[120px] items-center truncate rounded-full bg-[#FFF3EF] px-1.5 py-0.5 text-[10px] font-bold text-[#FF5733]">
            {platformLabel}
          </span>
        </div>
      </div>

      {subtitle ? (
        <p className="mb-2.5 line-clamp-2 text-[11px] leading-snug text-[#666] sm:text-[12px]">{subtitle}</p>
      ) : null}

      <div className="mb-2.5 space-y-0.5">
        {originalPriceLabel ? (
          <p className="text-[11px] leading-none text-gray-400 line-through">{originalPriceLabel}</p>
        ) : null}
        <p className={`text-base font-black leading-tight sm:text-lg ${hasPromo ? 'text-[#B4161B]' : 'text-[#141414]'}`}>{priceLabel}</p>
        {packageLabel ? (
          <p className="line-clamp-1 text-[10px] font-semibold text-[#888] sm:text-[11px]">{packageLabel}</p>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold sm:text-[11px] ${hasPromo ? 'bg-[#FFE0D5] text-[#B4161B]' : isRecommended ? 'bg-[#FFF3EF] text-[#FF5733]' : 'bg-gray-100 text-gray-600'}`}>
          {!canCheckout ? 'Segera Hadir' : hasPromo ? 'Ambil Promo' : isRecommended ? 'Best Pick' : 'Pilih Paket'}
        </span>
        {canCheckout ? (
          <ArrowRight className="h-3.5 w-3.5 text-[#FF5733]" />
        ) : null}
      </div>
    </div>
  )

  if (!canCheckout) return inner
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  )
}

export default BundlePromoCard
