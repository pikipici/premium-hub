"use client"

import AutoPlay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Product } from '@/types/product'
import { formatRupiah } from '@/lib/utils'

type Props = {
  products: Product[]
}

function pickBannerImage(product: Product): string | null {
  if (product.cover_images?.length) return product.cover_images[0]
  if (product.icon_image_url) return product.icon_image_url
  return null
}

function startingPrice(products: Product[], product: Product): string {
  const prices = product.prices?.filter((p) => p.is_active && p.price > 0) || []
  if (prices.length === 0) return ''
  const minPrice = Math.min(...prices.map((p) => p.price))
  return formatRupiah(minPrice)
}

function pickTagline(product: Product): string {
  if (product.tagline) return product.tagline
  if (product.description) {
    const short = product.description.slice(0, 80).trim()
    return short.length < product.description.length ? short + '…' : short
  }
  return 'Produk digital siap pakai, langsung aktif setelah bayar.'
}

export default function BannerSlider({ products }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [AutoPlay({ delay: 4500, stopOnInteraction: false })])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const banners = products.slice(0, 5)

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
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl" ref={emblaRef}>
        <div className="flex">
          {banners.map((product, index) => {
            const image = pickBannerImage(product)
            return (
              <Link
                key={product.id}
                href={`/product/digiproduct/${product.slug}`}
                className="flex-[0_0_100%] min-w-0 relative overflow-hidden group"
              >
                {image ? (
                  <>
                    <div className="absolute inset-0 z-0">
                      <img
                        src={image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading={index === 0 ? 'eager' : 'lazy'}
                      />
                    </div>
                    <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#141414]/90 via-[#141414]/60 to-transparent" />
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#141414]/70 via-transparent to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#1C1C1E] to-[#2A2A2D]" />
                )}

                <div className="relative z-20 px-6 sm:px-10 py-8 sm:py-12 lg:py-14 flex flex-col justify-end h-full min-h-[220px] sm:min-h-[280px]">
                  <div className="max-w-lg">
                    {product.badge_popular_text && (
                      <span className="inline-block rounded-full bg-[#FF5733] px-3 py-0.5 text-[10px] font-bold text-white mb-2">
                        {product.badge_popular_text}
                      </span>
                    )}
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight drop-shadow-lg">
                      {product.name}
                    </h3>
                    <p className="mt-1.5 text-sm text-white/70 max-w-md drop-shadow">
                      {pickTagline(product)}
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5733] px-4 py-2 text-xs sm:text-sm font-bold text-white group-hover:bg-[#e64d2e] transition-colors shadow-lg shadow-[#FF5733]/30">
                        Lihat Detail
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-bold text-white drop-shadow">
                        {startingPrice(products, product) ? `Mulai ${startingPrice(products, product)}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {banners.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {banners.map((product) => (
            <button
              key={product.id}
              type="button"
              className={`h-1.5 rounded-full transition-all ${
                banners.indexOf(product) === selectedIndex
                  ? 'w-5 bg-[#FF5733]'
                  : 'w-1.5 bg-white/15 hover:bg-white/25'
              }`}
              onClick={() => emblaApi?.scrollTo(banners.indexOf(product))}
              aria-label={product.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}
