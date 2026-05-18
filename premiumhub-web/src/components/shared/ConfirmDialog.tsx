"use client"

import { AlertCircle } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  /** Optional preview chip shown above CTA (e.g. masked credential). */
  preview?: ReactNode
}

/**
 * Centralized branded confirmation dialog for destructive / lifecycle actions.
 *
 * Replaces:
 * - `window.confirm()` native dialogs (jarring, anti-brand)
 * - Per-page custom modals (`ConfirmRevokeModal` etc.) — those should reuse this.
 *
 * Features:
 * - ESC to close (when not loading)
 * - Click backdrop to close (when not loading)
 * - Focus trap inside modal
 * - Auto-focus Cancel button (safer default for destructive)
 * - Restore focus to trigger on close
 * - aria-modal + role=dialog + aria-labelledby
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  preview,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null)

  useFocusTrap(dialogRef, cancelBtnRef)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  if (!open) return null

  const confirmClass = destructive
    ? 'bg-rose-600 text-white hover:bg-rose-700'
    : 'bg-[#141414] text-white hover:bg-[#2A2A2A]'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center"
      onClick={() => {
        if (!loading) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              destructive ? 'bg-rose-50 text-rose-600' : 'bg-[#FFF3EF] text-[#FF5733]'
            }`}
          >
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-title" className="text-base font-bold text-[#141414]">
              {title}
            </h3>
            {description ? (
              <div className="mt-1 text-sm leading-relaxed text-[#6B7280]">{description}</div>
            ) : null}
            {preview ? <div className="mt-2">{preview}</div> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#EBEBEB] px-4 text-sm font-bold text-[#6B7280] transition hover:bg-[#F4F4F2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
