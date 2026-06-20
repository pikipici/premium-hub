"use client"

import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type ServiceCardCompactProps = {
  href: string
  title: string
  /** Category pill text, defaults to neutral gray. If `isHighlight=true`, pill turns brand orange. */
  categoryLabel: string
  isHighlight?: boolean
  /** Status: 'in-stock' shows emerald dot, 'out-of-stock' shows muted with 'Habis' label. */
  stock?: 'in-stock' | 'out-of-stock'
  Icon: IconComp
  /** Tailwind tone gradient class for icon disc bg, e.g. "from-[#EEF8FF] to-[#DCEFFF]". */
  toneClass?: string
}

/**
 * Koprol-style flat compact card.
 * Updated v2: drop rainbow per-platform colors. All pills neutral gray. Only `isHighlight` items
 * (recommended/best pick) get brand-orange pill. This keeps the catalog visually quiet so the
 * Hot/Promo sections above it can carry the urgency signals.
 */
export function ServiceCardCompact({ href, title, categoryLabel, isHighlight = false, stock = 'in-stock', Icon, toneClass }: ServiceCardCompactProps) {
  const inStock = stock === 'in-stock'
  const containerClass = inStock
    ? 'cursor-pointer hover:shadow-[0_12px_32px_rgba(20,20,20,0.10)] active:scale-[0.97]'
    : 'opacity-50 cursor-not-allowed'

  const pillClass = isHighlight
    ? 'bg-[#FF5733] text-white'
    : 'bg-gray-100 text-gray-600'

  const inner = (
    <div className={`flex h-full items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5 transition-all duration-200 sm:gap-3.5 sm:px-4 sm:py-3.5 ${containerClass}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-gray-100 sm:h-12 sm:w-12 ${toneClass ?? 'from-[#F5F5F5] to-[#EBEBEB]'}`}>
        <Icon className="h-5 w-5 text-[#141414] sm:h-5.5 sm:w-5.5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#141414] sm:text-sm">{title}</h3>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`inline-flex max-w-[140px] items-center truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${pillClass}`}>
            {categoryLabel}
          </span>
          {inStock ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Stok tersedia" />
          ) : (
            <span className="shrink-0 text-[10px] font-semibold text-rose-500">Habis</span>
          )}
        </div>
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

export default ServiceCardCompact
