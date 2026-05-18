"use client"

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Trap focus within a container while a modal/drawer is open.
 *
 * - Auto-focus the initialFocusRef (or first focusable) on mount
 * - Trap Tab / Shift+Tab inside the container
 * - Restore focus to the previously-active element on unmount
 *
 * Pair with `aria-modal="true"` and `role="dialog"` on the container.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  initialFocusRef?: React.RefObject<HTMLElement | null>,
) {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Defer to next tick to ensure dialog has mounted before we focus inside
    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
        return
      }
      const focusable = getFocusable(containerRef.current)
      focusable[0]?.focus()
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable(containerRef.current)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      // Return focus only if the previously-focused element is still in DOM
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus()
      }
    }
  }, [containerRef, initialFocusRef])
}

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  const selectors =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(
    (el) => !el.hasAttribute('aria-hidden'),
  )
}

export interface FocusTrapMountProps {
  children: ReactNode
}
