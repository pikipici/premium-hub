export type ToastTone = 'success' | 'error'

export interface ToastState {
  id: number
  tone: ToastTone
  message: string
}

export function createToastState(
  tone: ToastTone,
  message: string,
  nowTs: number = Date.now()
): ToastState | null {
  const normalized = message.trim()
  if (!normalized) return null

  return {
    id: nowTs,
    tone,
    message: normalized,
  }
}

export function dismissToastByID(current: ToastState | null, toastID: number): ToastState | null {
  if (!current) return null
  if (current.id === toastID) return null
  return current
}

export function startToastAutoDismiss(
  toastID: number,
  setToast: (updater: (current: ToastState | null) => ToastState | null) => void,
  timeoutMs: number = 3200
): () => void {
  const timer = globalThis.setTimeout(() => {
    setToast((current) => dismissToastByID(current, toastID))
  }, timeoutMs)

  return () => globalThis.clearTimeout(timer)
}
