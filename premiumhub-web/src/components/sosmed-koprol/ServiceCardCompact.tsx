"use client"

import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type ServiceCardCompactProps = {
  href: string
  title: string
  /** Colored category pill text (e.g. "Followers", "Likes", "1 Tahun"). */
  categoryLabel: string
  /** Hex/rgb color for category pill bg. Falls back to brand orange. */
  categoryColor?: string
  /** Status: 'in-stock' shows emerald dot, 'out-of-stock' shows muted with 'Habis' label. */
  stock?: 'in-stock' | 'out-of-stock'
  Icon: IconComp
  /** Tailwind tone gradient class for icon disc bg, e.g. "from-[#EEF8FF] to-[#DCEFFF]". */
  toneClass?: string
}

/**
 * Koprol-style flat compact card:
 *   horizontal: avatar disc 36-44px ring + name (line-clamp-2) + colored category pill + status dot/Habis
 *   no price shown (drives users to detail/checkout). Out-of-stock dims to opacity-50 cursor-not-allowed.
 */
export function ServiceCardCompact({ href, title, categoryLabel, categoryColor, stock = 'in-stock', Icon, toneClass }: ServiceCardCompactProps) {
  const inStock = stock === 'in-stock'
  const containerClass = inStock
    ? 'cursor-pointer hover:shadow-[0_12px_32px_rgba(255,87,51,0.16)] active:scale-[0.97]'
    : 'opacity-50 cursor-not-allowed'

  const inner = (
    <div className={`flex items-center gap-2 rounded-2xl bg-white px-2.5 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-200 sm:gap-3 sm:px-3 sm:py-3 ${containerClass}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-gray-100 sm:h-11 sm:w-11 ${toneClass ?? 'from-[#FFF3EF] to-[#FFE4DA]'}`}>
        <Icon className="h-4 w-4 text-[#141414] sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#141414] sm:text-sm">{title}</h3>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="inline-flex max-w-[120px] items-center truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: categoryColor ?? '#FF5733' }}
          >
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
    <Link href={href} className="block">
      {inner}
    </Link>
  )
}

export default ServiceCardCompact
