'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { ArrowRight } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

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
}

export function HeroStripPanel({ slides }: HeroStripPanelProps) {
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
    <section>
      <div className="relative overflow-hidden rounded-2xl shadow-[0_18px_42px_rgba(20,20,20,0.20)] ring-1 ring-black/5 sm:rounded-3xl"
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
    </section>
  )
}

export default HeroStripPanel
