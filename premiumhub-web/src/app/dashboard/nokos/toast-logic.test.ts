import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createToastState,
  dismissToastByID,
  startToastAutoDismiss,
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

  it('dismisses only the matching toast id', () => {
    const current: ToastState = {
      id: 100,
      tone: 'error',
      message: 'Gagal memuat layanan',
    }

    expect(dismissToastByID(current, 100)).toBeNull()
    expect(dismissToastByID(current, 101)).toEqual(current)
  })

  it('auto-dismiss clears toast after timeout when id still matches', () => {
    vi.useFakeTimers()
    let state: ToastState | null = {
      id: 7,
      tone: 'success',
      message: 'Aksi order berhasil',
    }

    startToastAutoDismiss(7, (updater) => {
      state = updater(state)
    }, 1000)

    vi.advanceTimersByTime(999)
    expect(state).not.toBeNull()

    vi.advanceTimersByTime(1)
    expect(state).toBeNull()
  })

  it('auto-dismiss does not clear when active toast has different id', () => {
    vi.useFakeTimers()
    let state: ToastState | null = {
      id: 11,
      tone: 'success',
      message: 'Kode OTP disalin',
    }

    startToastAutoDismiss(10, (updater) => {
      state = updater(state)
    }, 1000)

    vi.advanceTimersByTime(1000)
    expect(state).toEqual({
      id: 11,
      tone: 'success',
      message: 'Kode OTP disalin',
    })
  })

  it('cleanup cancels pending auto-dismiss timer', () => {
    vi.useFakeTimers()
    let state: ToastState | null = {
      id: 20,
      tone: 'error',
      message: 'Gagal memproses aksi order',
    }

    const cleanup = startToastAutoDismiss(20, (updater) => {
      state = updater(state)
    }, 1000)

    cleanup()
    vi.advanceTimersByTime(1000)

    expect(state).toEqual({
      id: 20,
      tone: 'error',
      message: 'Gagal memproses aksi order',
    })
  })
})
