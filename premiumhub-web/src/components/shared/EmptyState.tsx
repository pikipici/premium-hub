"use client"

import Link from 'next/link'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  hint?: string
  /** Optional CTA — either internal link via `actionHref` or external handler via `onAction`. */
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
  variant?: 'card' | 'inline'
}

/**
 * Centralized empty-state surface for dashboard routes.
 *
 * Replaces bare `<p>Belum ada {x}</p>` patterns with: icon + title + hint + optional CTA.
 * Two variants:
 * - `card` (default): rounded-3xl border bg-white container with vertical padding
 * - `inline`: minimal centered text (for places where outer surface already exists)
 */
export function EmptyState({
  icon,
  title,
  hint,
  actionLabel,
  actionHref,
  onAction,
  className,
  variant = 'card',
}: EmptyStateProps) {
  const wrapper =
    variant === 'card'
      ? 'rounded-3xl border border-[#EBEBEB] bg-white px-6 py-12 text-center'
      : 'px-4 py-10 text-center'

  return (
    <div className={`${wrapper} ${className ?? ''}`} role="status" aria-live="polite">
      {icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF3EF] text-[#FF5733]">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-extrabold text-[#141414]">{title}</p>
      {hint ? <p className="mt-1 text-xs font-medium text-[#6B7280]">{hint}</p> : null}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#141414] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#2A2A2A]"
        >
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#141414] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#2A2A2A]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
