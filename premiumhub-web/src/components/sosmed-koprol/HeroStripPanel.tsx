'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { ArrowRight } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

import type { SosmedPlatformIconKey } from '@/lib/sosmedProductCards'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type FeaturedMiniItem = {
  key: string
  href: string
  title: string
  platformLabel?: string
  priceLabel: string
  badgeText?: string
  Icon: IconComp
  toneClass?: string
}

export type HeroSlideContent = {
  key: string
  title: string
  subtitle: string
  ctaLabel?: string
  ctaHref?: string
  Icon: IconComp
  bgColor?: string
  bgImage?: string
}

export type HeroStripPanelProps = {
  slides: HeroSlideContent[]
  featured: FeaturedMiniItem[]
  platformIconLookup?: (key: SosmedPlatformIconKey) => IconComp
}

export function HeroStripPanel({ slides, featured }: HeroStripPanelProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: slides.length > 1 }, [
    Autoplay({ delay: 4500, stopOnInteraction: false, playOnInit: slides.length > 1 }),
  ])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
  }, [emblaApi, onSelect])

  const currentSlide = slides[selectedIndex] || slides[0]

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:gap-4">
      <div className="relative col-span-1 overflow-hidden rounded-3xl shadow-[0_18px_42px_rgba(20,20,20,0.20)] ring-1 ring-black/5 sm:col-span-3"
        style={{
          backgroundColor: currentSlide?.bgColor || '#141414',
          backgroundImage: currentSlide?.bgImage ? `url(${currentSlide.bgImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: 180,
        }}
      >
        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full">
            {slides.map((slide) => {
              const SlideIcon = slide.Icon
              return (
                <div key={slide.key} className="relative min-w-0 flex-[0_0_100%]">
                  {/* subtle orange glow accents */}
                  <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#FF5733]/30 blur-3xl" />
                  <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-[#FF5733]/15 blur-3xl" />
                  <span aria-hidden className="pointer-events-none absolute right-5 top-5 h-2.5 w-2.5 rounded-full bg-[#FF5733] shadow-[0_0_18px_rgba(255,87,51,0.85)]" />
                  <div className="relative z-10 flex h-full flex-col justify-between p-5 text-white sm:p-7">
                    <div>
                      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 shadow-md backdrop-blur-sm sm:mb-4 sm:h-14 sm:w-14">
                        <SlideIcon className="h-6 w-6 text-[#FF5733] sm:h-7 sm:w-7" />
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
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => emblaApi?.scrollTo(idx)}
                className={`rounded-full transition-all duration-300 ${
                  idx === selectedIndex
                    ? 'w-5 bg-[#FF5733]'
                    : 'w-1.5 bg-white/40 hover:bg-white/60'
                }`}
                style={{ height: 6 }}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="col-span-1 flex flex-col gap-2 sm:col-span-2 sm:gap-3">
        {featured.slice(0, 2).map((item) => {
          const Icon = item.Icon
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group relative flex flex-1 items-center gap-2.5 rounded-3xl bg-white p-3 shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-transparent transition-all duration-200 hover:-translate-y-0.5 hover:ring-[#FF5733]/30 active:scale-[0.98] sm:gap-3 sm:p-4"
            >
              {item.badgeText ? (
                <span className="absolute -right-2 -top-2 z-10 inline-flex max-w-[80px] items-center truncate rounded-full bg-[#FF5733] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm sm:max-w-[100px] sm:text-[10px]">
                  {item.badgeText}
                </span>
              ) : null}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-gray-100 sm:h-12 sm:w-12 ${item.toneClass ?? 'from-[#F5F5F5] to-[#EBEBEB]'}`}>
                <Icon className="h-5 w-5 text-[#141414] sm:h-5.5 sm:w-5.5" />
              </div>
              <div className="min-w-0 flex-1">
                {item.platformLabel ? (
                  <span className="truncate text-[10px] font-semibold text-[#888] sm:text-[11px]">{item.platformLabel}</span>
                ) : null}
                <h3 className="line-clamp-1 text-[12px] font-semibold leading-snug text-[#141414] sm:text-[13px]">{item.title}</h3>
                <span className="mt-0.5 inline-block text-[11px] font-bold text-[#FF5733] sm:text-[12px]">{item.priceLabel}</span>
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
