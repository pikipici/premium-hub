'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { platformIconKeyFor, type SosmedPlatformIconKey } from '@/lib/sosmedProductCards'
import type { ComponentType, SVGProps } from 'react'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

export default function FilterStrip({
  platforms,
  activePlatform,
  setActivePlatform,
  allCardsLength,
  platformCounts,
  iconComponents,
}: {
  platforms: string[]
  activePlatform: string
  setActivePlatform: (p: string) => void
  allCardsLength: number
  platformCounts: Record<string, number>
  iconComponents: Record<string, IconComp>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // double-rAF: tunggu layout selesai baru check overflow
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => checkScroll())
    })
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    const ro = new ResizeObserver(() => requestAnimationFrame(() => checkScroll()))
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf1)
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
      ro.disconnect()
    }
  }, [checkScroll])

  // Re-check tiap kali platforms berubah (data API masuk)
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => checkScroll())
    })
    return () => cancelAnimationFrame(raf1)
  }, [platforms, checkScroll])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
  }

  // Filter out platforms with 0 products (except "Semua")
  const visiblePlatforms = platforms.filter(
    (p) => p === 'Semua' || (platformCounts[p] ?? 0) > 0
  )

  return (
    <div className="mt-4 flex items-center gap-1 sm:mt-5">
      {/* Left arrow — only shown when there's overflow to the left */}
      {canScrollLeft ? (
        <button
          onClick={() => scroll('left')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 transition hover:bg-gray-50 active:scale-95"
          aria-label="Scroll kiri"
        >
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>
      ) : null}

      {/* Scroll container — hide scrollbar cross-browser */}
      <div
        ref={scrollRef}
        className="flex flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-max gap-1.5 py-0.5">
          {visiblePlatforms.map((p) => {
            const count = p === 'Semua' ? allCardsLength : (platformCounts[p] ?? 0)
            const iconKey: SosmedPlatformIconKey | null = p === 'Semua' ? null : platformIconKeyFor(p)
            const Icon: IconComp | null = iconKey ? (iconComponents[iconKey] ?? null) : null
            const isActive = activePlatform === p
            return (
              <button
                key={p}
                onClick={() => setActivePlatform(p)}
                className={
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all duration-150 sm:px-3.5 sm:text-xs' +
                  (isActive
                    ? ' scale-[1.04] bg-[#141414] text-white shadow-md ring-2 ring-[#141414]/20 ring-offset-1'
                    : ' bg-white text-gray-500 ring-1 ring-inset ring-gray-200 hover:scale-[1.02] hover:bg-gray-50 hover:text-gray-900')
                }
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                <span>{p}</span>
                <span
                  className={
                    'ml-0.5 rounded-full px-1.5 py-[1px] text-[9px] font-semibold sm:text-[10px]' +
                    (isActive
                      ? ' bg-white/20 text-white/80'
                      : ' bg-gray-100 text-gray-400')
                  }
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right arrow — only shown when there's overflow to the right */}
      {canScrollRight ? (
        <button
          onClick={() => scroll('right')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 transition hover:bg-gray-50 active:scale-95"
          aria-label="Scroll kanan"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      ) : null}
    </div>
  )
}
