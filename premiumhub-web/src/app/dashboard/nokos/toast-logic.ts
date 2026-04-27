export type ToastTone = 'success' | 'error'

export interface ToastState {
  id: number
  tone: ToastTone
  message: string
}

export const TOAST_STACK_LIMIT = 3

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

export function enqueueToast(current: ToastState[], next: ToastState, limit: number = TOAST_STACK_LIMIT): ToastState[] {
  if (limit <= 0) return []
  return [next, ...current].slice(0, limit)
}

export function dismissToastByID(current: ToastState[], toastID: number): ToastState[] {
  return current.filter((item) => item.id !== toastID)
}

export function startToastAutoDismiss(
  toastID: number,
  setToast: (updater: (current: ToastState[]) => ToastState[]) => void,
  timeoutMs: number = 3200
): () => void {
  const timer = globalThis.setTimeout(() => {
    setToast((current) => dismissToastByID(current, toastID))
  }, timeoutMs)

  return () => globalThis.clearTimeout(timer)
}
