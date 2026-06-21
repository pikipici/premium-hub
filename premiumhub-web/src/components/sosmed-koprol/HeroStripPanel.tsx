"use client"

import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'
import { ArrowRight } from 'lucide-react'

import type { SosmedPlatformIconKey } from '@/lib/sosmedProductCards'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type FeaturedMiniItem = {
  key: string
  href: string
  title: string
  priceLabel: string
  Icon: IconComp
}

export type HeroSlideContent = {
  key: string
  title: string
  subtitle: string
  ctaLabel?: string
  ctaHref?: string
  Icon: IconComp
}

export type HeroStripPanelProps = {
  slide: HeroSlideContent
  featured: FeaturedMiniItem[]
  platformIconLookup?: (key: SosmedPlatformIconKey) => IconComp
  bgColor?: string
  bgImage?: string
}

/**
 * Koprol-style hero strip — DARK variant (v2).
 *
 * Background: solid `#141414` with subtle orange accent dot at top-right; gives the
 * orange brand "room to breathe" by anchoring it on dark surface and letting the
 * orange in product cards below pop instead of fighting an orange hero.
 *
 *   grid grid-cols-5 gap-3
 *     col-span-3: dark hero panel (180-220px) with icon chip + title + subtitle + CTA pill
 *     col-span-2: 2 mini featured cards stacked (avatar + name + price + chevron)
 */
export function HeroStripPanel({ slide, featured, bgColor, bgImage }: HeroStripPanelProps) {
  const HeroIcon = slide.Icon
  return (
    <section className="grid grid-cols-5 gap-3 sm:gap-4">
      <article
        className="relative col-span-3 overflow-hidden rounded-3xl shadow-[0_18px_42px_rgba(20,20,20,0.20)] ring-1 ring-black/5"
        style={{
          backgroundColor: bgColor || '#141414',
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: 180,
        }}
      >
        {/* subtle orange glow accents */}
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#FF5733]/30 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-[#FF5733]/15 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute right-5 top-5 h-2.5 w-2.5 rounded-full bg-[#FF5733] shadow-[0_0_18px_rgba(255,87,51,0.85)]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-5 text-white sm:p-7">
          <div>
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 shadow-md backdrop-blur-sm sm:mb-4 sm:h-14 sm:w-14">
              <HeroIcon className="h-6 w-6 text-[#FF5733] sm:h-7 sm:w-7" />
            </div>
            <h2 className="line-clamp-2 max-w-[90%] text-lg font-bold leading-tight tracking-tight drop-shadow-sm sm:text-2xl">
              {slide.title}
            </h2>
            <p className="mt-1 line-clamp-2 max-w-[85%] text-xs text-white/75 sm:text-sm">{slide.subtitle}</p>
          </div>
          {slide.ctaHref && slide.ctaLabel ? (
            <div className="mt-4 sm:mt-5">
              <Link
                href={slide.ctaHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5733] px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-[#FF5733]/30 transition-all duration-200 hover:scale-[1.03] hover:bg-[#E64A2E] active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
              >
                <span>{slide.ctaLabel}</span>
                <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Link>
            </div>
          ) : null}
        </div>
      </article>

      <div className="col-span-2 flex flex-col gap-2 sm:gap-3">
        {featured.slice(0, 2).map((item) => {
          const Icon = item.Icon
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group flex flex-1 min-w-0 items-center gap-2.5 rounded-3xl bg-white p-3 shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-transparent transition-all duration-200 hover:-translate-y-0.5 hover:ring-[#FF5733]/30 active:scale-[0.98] sm:gap-3 sm:p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#141414] ring-1 ring-gray-200 sm:h-12 sm:w-12">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xs font-semibold text-[#141414] sm:text-sm">{item.title}</h3>
                <p className="mt-0.5 truncate text-[11px] font-semibold tracking-wide text-[#FF5733] sm:text-xs">
                  {item.priceLabel}
                </p>
              </div>
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-gray-400 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#FF5733] sm:block" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default HeroStripPanel
