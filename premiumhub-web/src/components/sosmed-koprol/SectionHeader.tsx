"use client"

import type { ReactNode } from 'react'

export type SectionHeaderProps = {
  icon?: ReactNode
  title: string
  countLabel?: string
  countTone?: 'default' | 'rose' | 'orange'
  action?: ReactNode
}

const COUNT_TONE_CLASS: Record<NonNullable<SectionHeaderProps['countTone']>, string> = {
  default: 'bg-gray-100 text-gray-600',
  rose: 'bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400',
  orange: 'bg-[#FFF3EF] text-[#FF5733]',
}

/**
 * Koprol-style section header. Supports:
 * - icon chip on the left
 * - bold title
 * - optional count chip (right-aligned)
 * - optional custom action node (right-aligned)
 */
export function SectionHeader({ icon, title, countLabel, countTone = 'default', action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="inline-flex shrink-0 items-center">{icon}</span> : null}
        <h2 className="truncate text-sm font-bold text-[#141414] sm:text-base">{title}</h2>
      </div>
      {action ? (
        action
      ) : countLabel ? (
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${COUNT_TONE_CLASS[countTone]}`}
        >
          {countLabel}
        </span>
      ) : null}
    </div>
  )
}

export default SectionHeader
