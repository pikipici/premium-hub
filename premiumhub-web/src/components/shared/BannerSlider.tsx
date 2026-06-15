"use client"

import AutoPlay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { SiteBanner } from '@/types/banner'
import { bannerService } from '@/services/bannerService'

const FALLBACK_BANNERS = [
  {
    title: 'Selamat Datang di DigiProduct',
    tagline: 'Lisensi software, akun premium, voucher digital. Cek katalog sekarang.',
    cta: 'Lihat Katalog',
    href: '/product/digiproduct',
  },
  {
    title: 'Update Maintenance',
    tagline: 'Beberapa layanan sedang maintenance singkat. Cek status terbaru.',
    cta: 'Info Lebih Lanjut',
    href: '/lacak-pesanan',
  },
  {
    title: 'Garansi 30 Hari',
    tagline: 'Semua produk DigiMarket dilengkapi garansi. Belanja tenang, aman.',
    cta: 'Cara Klaim',
    href: '/dashboard/klaim-garansi',
  },
]

export default function BannerSlider() {
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bannerService.getPublicBanners()
      .then((res) => {
        if (res.success && res.data?.length) {
          setBanners(res.data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [AutoPlay({ delay: 4500, stopOnInteraction: false })])
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

  const hasRealBanners = !loading && banners.length > 0
  const totalSlides = hasRealBanners ? banners.length : FALLBACK_BANNERS.length
  if (loading) return null

  return (
    <div>
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl" ref={emblaRef}>
        <div className="flex">
          {hasRealBanners
            ? banners.map((banner) => (
                <Link
                  key={banner.id}
                  href={banner.link_url || '/product/digiproduct'}
                  className="flex-[0_0_100%] min-w-0 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 z-0">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#141414]/85 via-[#141414]/50 to-transparent" />
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#141414]/60 via-transparent to-transparent" />
                  <div className="relative z-20 px-6 sm:px-10 py-10 sm:py-12 lg:py-14 flex flex-col justify-end h-full min-h-[220px] sm:min-h-[280px]">
                    <div className="max-w-lg">
                      <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight drop-shadow-lg">
                        {banner.title}
                      </h3>
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FF5733] px-4 py-2 text-xs sm:text-sm font-bold text-white group-hover:bg-[#e64d2e] transition-colors">
                        Lihat Detail
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            : FALLBACK_BANNERS.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className="flex-[0_0_100%] min-w-0 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#1C1C1E] to-[#2A2A2D]" />
                  <div className="relative z-20 px-6 sm:px-10 py-10 sm:py-12 lg:py-14 flex flex-col justify-end h-full min-h-[220px] sm:min-h-[280px]">
                    <div className="max-w-lg">
                      <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-white/60 max-w-md">
                        {item.tagline}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#FF5733] px-4 py-2 text-xs sm:text-sm font-bold text-white group-hover:bg-[#e64d2e] transition-colors">
                        {item.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
        </div>
      </div>

      {totalSlides > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              type="button"
              className={`h-1.5 rounded-full transition-all ${
                index === selectedIndex
                  ? 'w-5 bg-[#FF5733]'
                  : 'w-1.5 bg-white/15 hover:bg-white/25'
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
