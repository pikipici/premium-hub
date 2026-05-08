import { describe, expect, it, vi } from 'vitest'

import {
  CHECKOUT_IDEMPOTENCY_MAX_LENGTH,
  clearCheckoutIdempotencyKey,
  createCheckoutIdempotencyKey,
  getOrCreateCheckoutIdempotencyKey,
} from './checkoutIdempotency'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
  }
}

describe('checkout idempotency helper', () => {
  it('generates backend-safe keys with flow prefix and randomUUID when available', () => {
    const key = createCheckoutIdempotencyKey('sosmed-order', {
      randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
    })

    expect(key).toBe('sosmed-order:123e4567-e89b-12d3-a456-426614174000')
    expect(key.length).toBeLessThanOrEqual(CHECKOUT_IDEMPOTENCY_MAX_LENGTH)
    expect(key).toMatch(/^[A-Za-z0-9:_-]+$/)
  })

  it('uses a safe fallback when randomUUID is unavailable', () => {
    const key = createCheckoutIdempotencyKey('sosmed-bundle', {
      now: () => 1778259000000,
      random: () => 0.123456789,
    })

    expect(key).toMatch(/^sosmed-bundle:[a-z0-9-]+$/)
    expect(key.length).toBeLessThanOrEqual(CHECKOUT_IDEMPOTENCY_MAX_LENGTH)
  })

  it('reuses one key for the same checkout fingerprint in session storage', () => {
    const storage = createMemoryStorage()
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')

    const first = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-order',
      fingerprint: 'service:jap-6331|target:https://instagram.com/example|qty:2',
      storage,
      randomUUID,
    })
    const retry = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-order',
      fingerprint: 'service:jap-6331|target:https://instagram.com/example|qty:2',
      storage,
      randomUUID,
    })

    expect(retry).toBe(first)
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  it('separates keys by checkout fingerprint and clears a completed attempt', () => {
    const storage = createMemoryStorage()
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333')

    const first = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-bundle',
      fingerprint: 'bundle:umkm-starter|variant:starter|target:a',
      storage,
      randomUUID,
    })
    const otherFingerprint = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-bundle',
      fingerprint: 'bundle:umkm-starter|variant:starter|target:b',
      storage,
      randomUUID,
    })
    clearCheckoutIdempotencyKey({
      flow: 'sosmed-bundle',
      fingerprint: 'bundle:umkm-starter|variant:starter|target:a',
      storage,
    })
    const afterClear = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-bundle',
      fingerprint: 'bundle:umkm-starter|variant:starter|target:a',
      storage,
      randomUUID,
    })

    expect(otherFingerprint).not.toBe(first)
    expect(afterClear).not.toBe(first)
    expect(afterClear).toBe('sosmed-bundle:33333333-3333-4333-8333-333333333333')
  })

  it('replaces invalid stored keys instead of reusing them', () => {
    const storage = createMemoryStorage()
    storage.setItem('premiumhub:checkout-idempotency:sosmed-order:bad-fingerprint', 'not valid because spaces')

    const key = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-order',
      fingerprint: 'bad-fingerprint',
      storage,
      randomUUID: () => '44444444-4444-4444-8444-444444444444',
    })

    expect(key).toBe('sosmed-order:44444444-4444-4444-8444-444444444444')
  })

  it('keeps retry keys stable in memory when session storage cannot persist', () => {
    const storage = createMemoryStorage()
    vi.mocked(storage.getItem).mockImplementation(() => null)
    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new Error('blocked storage')
    })
    vi.mocked(storage.removeItem).mockImplementation(() => {
      throw new Error('blocked storage')
    })
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce('55555555-5555-4555-8555-555555555555')
      .mockReturnValueOnce('66666666-6666-4666-8666-666666666666')

    const first = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-order',
      fingerprint: 'blocked-storage-retry',
      storage,
      randomUUID,
    })
    const retry = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-order',
      fingerprint: 'blocked-storage-retry',
      storage,
      randomUUID,
    })
    clearCheckoutIdempotencyKey({
      flow: 'sosmed-order',
      fingerprint: 'blocked-storage-retry',
      storage,
    })
    const afterClear = getOrCreateCheckoutIdempotencyKey({
      flow: 'sosmed-order',
      fingerprint: 'blocked-storage-retry',
      storage,
      randomUUID,
    })

    expect(retry).toBe(first)
    expect(randomUUID).toHaveBeenCalledTimes(2)
    expect(afterClear).toBe('sosmed-order:66666666-6666-4666-8666-666666666666')
  })
})
