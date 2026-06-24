"use client"

import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type ServiceCardCompactProps = {
  href: string
  title: string
  Icon: IconComp
  /** Nama platform, ditampilkan sebagai label kecil di atas title. */
  platformLabel?: string
  /** Label harga, misal "Rp 28.000" */
  priceLabel?: string
  /** Key differentiator line, misal "⚡ Instan • ↺ Refill 30 hari" */
  metaLine?: string
  /** Badge text dari admin badge_text. Kosongin kalo ga mau badge. */
  badgeText?: string
  /** Tailwind tone gradient class for icon disc bg, e.g. "from-[#EEF8FF] to-[#DCEFFF]". */
  toneClass?: string
}

/**
 * Flat compact card for the main catalog section.
 */
export function ServiceCardCompact({ href, title, Icon, platformLabel, priceLabel, metaLine, badgeText, toneClass }: ServiceCardCompactProps) {
  const inner = (
    <div className="relative flex h-full gap-3 rounded-2xl bg-white px-3 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5 transition-all duration-200 hover:shadow-[0_12px_32px_rgba(20,20,20,0.10)] active:scale-[0.97] sm:gap-3.5 sm:px-4 sm:py-3.5">
      {badgeText ? (
        <span className="absolute -right-2 -top-2 z-10 inline-flex max-w-[100px] items-center truncate rounded-full bg-[#FF5733] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm sm:text-[10px]">
          {badgeText}
        </span>
      ) : null}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-gray-100 sm:h-12 sm:w-12 ${toneClass ?? 'from-[#F5F5F5] to-[#EBEBEB]'}`}>
        <Icon className="h-5 w-5 text-[#141414] sm:h-5.5 sm:w-5.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        {platformLabel ? (
          <span className="truncate text-[11px] font-semibold text-[#888] sm:text-xs">{platformLabel}</span>
        ) : null}
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#141414] sm:text-sm">{title}</h3>
        {priceLabel ? (
          <span className="text-[12px] font-bold text-[#FF5733] sm:text-[13px]">{priceLabel}</span>
        ) : null}
        {metaLine ? (
          <span className="mt-0.5 truncate text-[10px] text-gray-400 sm:text-[11px]">{metaLine}</span>
        ) : null}
      </div>
    </div>
  )

  return (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  )
}

export default ServiceCardCompact
