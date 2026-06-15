"use client"

import AutoPlay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Banner = {
  href: string
  accentColor: string
  emoji: string
  title: string
  subtitle: string
  cta: string
}

const DEFAULT_BANNERS: Banner[] = [
  {
    href: '/product/digiproduct?category=streaming',
    accentColor: '#FF5733',
    emoji: '🎬',
    title: 'Akun Premium Streaming',
    subtitle: 'Netflix, Spotify, Disney+, YouTube Premium — instant delivery.',
    cta: 'Cek Streaming',
  },
  {
    href: '/product/digiproduct?category=gaming',
    accentColor: '#FF5733',
    emoji: '🎮',
    title: 'Akun Game & Top Up',
    subtitle: 'Steam Wallet, Mobile Legends, Genshin, dan ratusan game lainnya.',
    cta: 'Cek Gaming',
  },
  {
    href: '/product/digiproduct?category=productivity',
    accentColor: '#FF5733',
    emoji: '⚡',
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
    <div>
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10" ref={emblaRef}>
        <div className="flex">
          {banners.map((banner, index) => (
            <Link
              key={index}
              href={banner.href}
              className="flex-[0_0_100%] min-w-0 bg-white/5 relative overflow-hidden group"
            >
              <div className="px-6 sm:px-10 py-8 sm:py-10 flex items-center gap-5 sm:gap-8">
                <div
                  className="hidden sm:flex shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl items-center justify-center text-2xl sm:text-3xl"
                  style={{ backgroundColor: `${banner.accentColor}15` }}
                >
                  {banner.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-white leading-tight">
                    {banner.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-white/50 max-w-md">
                    {banner.subtitle}
                  </p>
                  <span className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#FF5733] px-4 py-2 text-xs font-bold text-white group-hover:bg-[#e64d2e] transition-colors">
                    {banner.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {banners.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {banners.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`h-1.5 rounded-full transition-all ${
                index === selectedIndex
                  ? 'w-5 bg-[#FF5733]'
                  : 'w-1.5 bg-white/20 hover:bg-white/30'
              }`}
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
