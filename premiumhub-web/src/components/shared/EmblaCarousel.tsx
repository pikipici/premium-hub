"use client"

import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'

type Props = {
  images: string[]
  alt: string
  aspectClass?: string
  showThumbs?: boolean
}

export default function EmblaCarousel({ images, alt, aspectClass = 'aspect-[4/3]', showThumbs }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
  }, [emblaApi, onSelect])

  if (!images.length) return null

  return (
    <div className="relative w-full h-full">
      <div className={`overflow-hidden rounded-xl ${aspectClass} w-full`} ref={emblaRef}>
        <div className="flex h-full">
          {images.map((url, index) => (
            <div key={index} className="flex-[0_0_100%] min-w-0 h-full relative">
              <Image
                src={url}
                alt={`${alt} ${index + 1}`}
                fill
                unoptimized
                className="object-contain p-4"
              />
            </div>
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <>
          {/* Dot indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`w-2 h-2 rounded-full transition-all ${
                  index === selectedIndex
                    ? 'bg-[#FF5733] w-4'
                    : 'bg-white/70 hover:bg-white'
                }`}
                onClick={() => emblaApi?.scrollTo(index)}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Thumbnail strip */}
          {showThumbs && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((url, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === selectedIndex
                      ? 'border-[#FF5733] opacity-100'
                      : 'border-transparent opacity-60 hover:opacity-80'
                  }`}
                >
                  <Image src={url} alt={`Thumb ${index + 1}`} width={64} height={64} unoptimized className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
