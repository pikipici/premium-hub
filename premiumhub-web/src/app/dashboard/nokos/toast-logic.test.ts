import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createToastState,
  dismissToastByID,
  enqueueToast,
  startToastAutoDismiss,
  TOAST_STACK_LIMIT,
  type ToastState,
} from './toast-logic'

describe('nokos toast logic', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates toast state with normalized message', () => {
    const toast = createToastState('success', '  Kode OTP disalin  ', 12345)

    expect(toast).toEqual({
      id: 12345,
      tone: 'success',
      message: 'Kode OTP disalin',
    })
  })

  it('returns null for blank message', () => {
    expect(createToastState('error', '   ', 12345)).toBeNull()
  })

  it('enqueues newest toast first and keeps max stack limit', () => {
    const base: ToastState[] = [
      { id: 1, tone: 'success', message: 'Satu' },
      { id: 2, tone: 'error', message: 'Dua' },
      { id: 3, tone: 'success', message: 'Tiga' },
    ]

    const next: ToastState = { id: 4, tone: 'error', message: 'Empat' }
    const state = enqueueToast(base, next, TOAST_STACK_LIMIT)

    expect(state).toEqual([
      { id: 4, tone: 'error', message: 'Empat' },
      { id: 1, tone: 'success', message: 'Satu' },
      { id: 2, tone: 'error', message: 'Dua' },
    ])
  })

  it('dismisses only the matching toast id', () => {
    const current: ToastState[] = [
      { id: 100, tone: 'error', message: 'Gagal memuat layanan' },
      { id: 101, tone: 'success', message: 'Aksi berhasil' },
    ]

    expect(dismissToastByID(current, 100)).toEqual([
      { id: 101, tone: 'success', message: 'Aksi berhasil' },
    ])
    expect(dismissToastByID(current, 999)).toEqual(current)
  })

  it('auto-dismiss clears toast after timeout when id still matches', () => {
    vi.useFakeTimers()
    let state: ToastState[] = [{ id: 7, tone: 'success', message: 'Aksi order berhasil' }]

    startToastAutoDismiss(7, (updater) => {
      state = updater(state)
    }, 1000)

    vi.advanceTimersByTime(999)
    expect(state).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(state).toEqual([])
  })

  it('auto-dismiss does not clear when active toast has different id', () => {
    vi.useFakeTimers()
    let state: ToastState[] = [{ id: 11, tone: 'success', message: 'Kode OTP disalin' }]

    startToastAutoDismiss(10, (updater) => {
      state = updater(state)
    }, 1000)

    vi.advanceTimersByTime(1000)
    expect(state).toEqual([{ id: 11, tone: 'success', message: 'Kode OTP disalin' }])
  })

  it('cleanup cancels pending auto-dismiss timer', () => {
    vi.useFakeTimers()
    let state: ToastState[] = [{ id: 20, tone: 'error', message: 'Gagal memproses aksi order' }]

    const cleanup = startToastAutoDismiss(20, (updater) => {
      state = updater(state)
    }, 1000)

    cleanup()
    vi.advanceTimersByTime(1000)

    expect(state).toEqual([{ id: 20, tone: 'error', message: 'Gagal memproses aksi order' }])
  })
})
