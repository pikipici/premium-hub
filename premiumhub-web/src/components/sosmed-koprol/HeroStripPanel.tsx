'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export type HeroTrustBadge = {
  icon: IconComp
  label: string
  color: string
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
  trustBadges?: HeroTrustBadge[]
}

// Inline platform SVGs — no external dependency
function IgIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}
function TtIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M14 4v10.2a4.2 4.2 0 1 1-3.5-4.1" />
      <path d="M14 4c1 3.1 2.8 5 6 5.3" />
    </svg>
  )
}
function YtIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
    </svg>
  )
}
function FbIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M14 8h2.5V4.3A18 18 0 0 0 13 4c-3.4 0-5.6 2-5.6 5.7V13H4v4.1h3.4V24h4.2v-6.9H15l.6-4.1h-4V10c0-1.2.3-2 2.4-2Z" />
    </svg>
  )
}
function SpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 9.3c3.2-1 6.4-.8 9.2.7" />
      <path d="M8.4 12.5c2.6-.7 5-.5 7.3.7" />
      <path d="M9.2 15.5c1.9-.5 3.7-.3 5.4.5" />
    </svg>
  )
}

// Floating decoration: platform icons arranged in 2 columns on the right
const FLOATING_ICONS = [
  { Icon: IgIcon,  top: '12%',  right: '22%', size: 28, opacity: 0.18, rotate: '-8deg' },
  { Icon: TtIcon,  top: '10%',  right: '6%',  size: 34, opacity: 0.22, rotate: '6deg'  },
  { Icon: YtIcon,  top: '48%',  right: '18%', size: 26, opacity: 0.15, rotate: '4deg'  },
  { Icon: FbIcon,  top: '52%',  right: '4%',  size: 30, opacity: 0.20, rotate: '-5deg' },
  { Icon: SpIcon,  top: '76%',  right: '14%', size: 22, opacity: 0.13, rotate: '10deg' },
]

export function HeroStripPanel({ slides, trustBadges }: HeroStripPanelProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: slides.length > 1 }, [
    Autoplay({ delay: 4500, stopOnInteraction: false, playOnInit: slides.length > 1 }),
  ])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    onSelect()
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  return (
    <section>
      <div
        className="relative overflow-hidden rounded-2xl shadow-[0_18px_42px_rgba(20,20,20,0.20)] ring-1 ring-black/5 sm:rounded-3xl"
        style={{
          backgroundColor: slides[selectedIndex]?.bgColor || '#141414',
          backgroundImage: slides[selectedIndex]?.bgImage ? `url(${slides[selectedIndex].bgImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: 220,
        }}
      >
        {/* Overlay for bg image readability */}
        {slides[selectedIndex]?.bgImage ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        ) : null}

        {/* Floating platform icons — desktop only decoration */}
        <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden>
          {FLOATING_ICONS.map(({ Icon, top, right, size, opacity, rotate }, i) => (
            <span
              key={i}
              className="absolute text-white"
              style={{ top, right, opacity, transform: `rotate(${rotate})` }}
            >
              <Icon width={size} height={size} />
            </span>
          ))}
        </div>

        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full">
            {slides.map((slide, idx) => {
              const SlideIcon = slide.Icon
              return (
                <div key={slide.key} className="relative min-w-0 flex-[0_0_100%]">
                  {/* Decorative orbs */}
                  <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#FF5733]/20 blur-3xl sm:h-64 sm:w-64" />
                  <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-[#FF5733]/10 blur-3xl sm:h-72 sm:w-72" />
                  <span aria-hidden className="pointer-events-none absolute right-6 top-6 h-2 w-2 rounded-full bg-[#FF5733] shadow-[0_0_20px_rgba(255,87,51,0.9)]" />

                  <div className="relative z-10 flex h-full min-h-[220px] flex-col justify-between px-5 py-6 text-white sm:min-h-[270px] sm:px-8 sm:py-8 lg:min-h-[310px] lg:px-10 lg:py-10">
                    {/* Top section: icon + content */}
                    <div className="flex flex-col gap-3 sm:gap-4">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 shadow-lg backdrop-blur-md sm:h-14 sm:w-14">
                        <SlideIcon className="h-6 w-6 text-[#FF5733] sm:h-7 sm:w-7" />
                      </div>

                      <div className="max-w-[90%] sm:max-w-[75%] lg:max-w-[60%]">
                        <h2 className="line-clamp-2 text-xl font-extrabold leading-tight tracking-tight drop-shadow-sm sm:text-3xl lg:text-4xl">
                          {slide.title}
                        </h2>
                        {slide.subtitle ? (
                          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/70 sm:text-base lg:text-lg">
                            {slide.subtitle}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Bottom section: CTA + trust badges + slide counter */}
                    <div className="flex flex-col gap-3">
                      {/* Trust badges — inside banner */}
                      {trustBadges && trustBadges.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          {trustBadges.map((badge) => {
                            const BadgeIcon = badge.icon
                            return (
                              <span
                                key={badge.label}
                                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80 backdrop-blur-sm sm:text-[11px]"
                                style={{ color: badge.color !== 'white' ? badge.color : undefined }}
                              >
                                <BadgeIcon className="h-3 w-3 shrink-0" />
                                {badge.label}
                              </span>
                            )
                          })}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-4">
                        {slide.ctaHref && slide.ctaLabel ? (
                          <Link
                            href={slide.ctaHref}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5733] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#FF5733]/30 transition-all duration-200 hover:scale-[1.03] hover:bg-[#E64A2E] active:scale-95 sm:px-5 sm:py-2.5 sm:text-sm"
                          >
                            <span>{slide.ctaLabel}</span>
                            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Link>
                        ) : (
                          <div />
                        )}

                        {/* Slide counter */}
                        {slides.length > 1 ? (
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/60 backdrop-blur-sm sm:text-[11px]">
                            {idx + 1}/{slides.length}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation arrows — desktop only */}
        {slides.length > 1 && (
          <>
            <button
              onClick={scrollPrev}
              disabled={!canScrollPrev && slides.length > 1}
              className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-0 lg:block"
              aria-label="Slide sebelumnya"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canScrollNext && slides.length > 1}
              className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-0 lg:block"
              aria-label="Slide selanjutnya"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Navigation dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => emblaApi?.scrollTo(idx)}
                className={`rounded-full transition-all duration-300 ${
                  idx === selectedIndex
                    ? 'w-6 bg-[#FF5733]'
                    : 'w-1.5 bg-white/40 hover:bg-white/60'
                }`}
                style={{ height: 6 }}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default HeroStripPanel
