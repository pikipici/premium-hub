"use client"

import type { ReactNode } from 'react'

import { statusToneClasses, type StatusTone } from '@/lib/dashboardStatusPill'

interface StatusPillProps {
  tone: StatusTone
  children: ReactNode
  /** Show a tone-colored leading dot indicator. Default: false. */
  withDot?: boolean
  /** Override classes appended after default tone classes. */
  className?: string
}

/**
 * Tone-aware status pill. Centralized so a "success" badge looks identical
 * across every dashboard route. Pair with helpers in `@/lib/dashboardStatusPill`
 * (e.g. `sosmedOrderTone(order.status)` -> { tone, label }).
 *
 * Example:
 *   const { tone, label } = sosmedOrderTone(order.status)
 *   <StatusPill tone={tone}>{label}</StatusPill>
 */
export function StatusPill({ tone, children, withDot = false, className = '' }: StatusPillProps) {
  const classes = statusToneClasses(tone)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${classes.pill} ${className}`.trim()}
    >
      {withDot ? <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

export default StatusPill
