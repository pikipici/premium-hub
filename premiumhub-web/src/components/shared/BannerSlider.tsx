"use client"

import AutoPlay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Banner = {
  href: string
  gradient: string
  accentColor: string
  title: string
  subtitle: string
  cta: string
}

const DEFAULT_BANNERS: Banner[] = [
  {
    href: '/product/digiproduct?category=streaming',
    gradient: 'from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
    accentColor: '#e94560',
    title: 'Akun Premium Streaming',
    subtitle: 'Netflix, Spotify, Disney+, YouTube Premium — semua akun instant delivery.',
    cta: 'Cek Streaming',
  },
  {
    href: '/product/digiproduct?category=gaming',
    gradient: 'from-[#0d1117] via-[#161b22] to-[#21262d]',
    accentColor: '#FF5733',
    title: 'Akun Game & Top Up',
    subtitle: 'Steam Wallet, Mobile Legends, Genshin, dan ratusan game lainnya.',
    cta: 'Cek Gaming',
  },
  {
    href: '/product/digiproduct?category=productivity',
    gradient: 'from-[#0f0c29] via-[#302b63] to-[#24243e]',
    accentColor: '#7c3aed',
    title: 'Tools & Lisensi',
    subtitle: 'Microsoft 365, Canva Pro, antivirus, Windows license — harga terbaik.',
    cta: 'Cek Tools',
  },
]

type Props = {
  banners?: Banner[]
}

export default function BannerSlider({ banners = DEFAULT_BANNERS }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [AutoPlay({ delay: 4000, stopOnInteraction: false })])
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

  if (!banners.length) return null

  return (
    <section className="bg-[#141414]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-3 sm:pb-4">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl" ref={emblaRef}>
          <div className="flex">
            {banners.map((banner, index) => (
              <Link
                key={index}
                href={banner.href}
                className={`flex-[0_0_100%] min-w-0 bg-gradient-to-r ${banner.gradient} relative overflow-hidden`}
              >
                <div className="px-6 sm:px-10 py-8 sm:py-12 lg:py-14">
                  <div className="max-w-xl">
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight">
                      {banner.title}
                    </h3>
                    <p className="mt-2 text-sm sm:text-base text-white/70 max-w-md">
                      {banner.subtitle}
                    </p>
                    <span
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-bold text-white transition-colors hover:opacity-90"
                      style={{ backgroundColor: banner.accentColor }}
                    >
                      {banner.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>

                <div
                  className="absolute top-0 right-0 w-48 sm:w-72 h-full opacity-[0.12] pointer-events-none rounded-full blur-[60px]"
                  style={{ backgroundColor: banner.accentColor }}
                />
                <div
                  className="absolute bottom-0 right-1/4 w-32 sm:w-48 h-1/2 opacity-[0.08] pointer-events-none rounded-full blur-[50px]"
                  style={{ backgroundColor: banner.accentColor }}
                />
              </Link>
            ))}
          </div>
        </div>

        {banners.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {banners.map((banner, index) => (
              <button
                key={index}
                type="button"
                className={`h-1.5 rounded-full transition-all ${
                  index === selectedIndex
                    ? 'w-5 opacity-90'
                    : 'w-1.5 opacity-30 hover:opacity-50'
                }`}
                style={{ backgroundColor: banner.accentColor }}
                onClick={() => emblaApi?.scrollTo(index)}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
