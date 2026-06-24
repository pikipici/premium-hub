'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

export type HeroSlide = {
  key: string
  src: string
  alt: string
  href?: string
}

export type HeroStripPanelProps = {
  slides: HeroSlide[]
}

export function HeroStripPanel({ slides }: HeroStripPanelProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: slides.length > 1 },
    [Autoplay({ delay: 4500, stopOnInteraction: false, playOnInit: slides.length > 1 })],
  )
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

  if (!slides.length) return null

  return (
    <section aria-label="Banner promosi">
      <div className="relative overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/5 sm:rounded-3xl">
        {/* Embla carousel */}
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {slides.map((slide) => (
              <div key={slide.key} className="relative min-w-0 flex-[0_0_100%]">
                {slide.href ? (
                  <a href={slide.href} tabIndex={-1} aria-label={slide.alt}>
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      width={1400}
                      height={500}
                      className="h-auto w-full object-cover"
                      priority
                      draggable={false}
                    />
                  </a>
                ) : (
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    width={1400}
                    height={500}
                    className="h-auto w-full object-cover"
                    priority
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows — desktop only */}
        {slides.length > 1 && (
          <>
            <button
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50 disabled:opacity-0 lg:block"
              aria-label="Slide sebelumnya"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canScrollNext}
              className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50 disabled:opacity-0 lg:block"
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
                    ? 'w-6 bg-white'
                    : 'w-1.5 bg-white/50 hover:bg-white/75'
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
