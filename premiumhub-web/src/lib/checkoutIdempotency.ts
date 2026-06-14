export const CHECKOUT_IDEMPOTENCY_MAX_LENGTH = 80

export type CheckoutIdempotencyFlow = 'sosmed-order' | 'sosmed-bundle' | 'digiproduct-checkout'

type CreateCheckoutIdempotencyKeyOptions = {
  randomUUID?: () => string
  now?: () => number
  random?: () => number
}

type StoredCheckoutIdempotencyKeyOptions = CreateCheckoutIdempotencyKeyOptions & {
  flow: CheckoutIdempotencyFlow
  fingerprint: string
  storage?: Storage | null
}

const STORAGE_PREFIX = 'premiumhub:checkout-idempotency'
const SAFE_KEY_PATTERN = /^[A-Za-z0-9:_-]+$/
const memoryCheckoutIdempotencyKeys = new Map<string, string>()

export function createCheckoutIdempotencyKey(
  flow: CheckoutIdempotencyFlow,
  options: CreateCheckoutIdempotencyKeyOptions = {},
): string {
  const prefix = normalizeCheckoutIdempotencyPart(flow, 'checkout')
  const nonce = normalizeCheckoutIdempotencyPart(resolveNonce(options), 'retry')
  const key = `${prefix}:${nonce}`

  if (key.length <= CHECKOUT_IDEMPOTENCY_MAX_LENGTH) {
    return key
  }
  return key.slice(0, CHECKOUT_IDEMPOTENCY_MAX_LENGTH)
}

export function getOrCreateCheckoutIdempotencyKey(options: StoredCheckoutIdempotencyKeyOptions): string {
  const storage = resolveStorage(options.storage)
  const storageKey = buildCheckoutIdempotencyStorageKey(options.flow, options.fingerprint)

  if (storage) {
    const storedKey = safeStorageGet(storage, storageKey)
    if (isUsableCheckoutIdempotencyKey(storedKey)) {
      return storedKey
    }
  }

  const memoryKey = memoryCheckoutIdempotencyKeys.get(storageKey)
  if (memoryKey && isUsableCheckoutIdempotencyKey(memoryKey)) {
    return memoryKey
  }

  const key = createCheckoutIdempotencyKey(options.flow, options)
  memoryCheckoutIdempotencyKeys.set(storageKey, key)
  if (storage) {
    safeStorageSet(storage, storageKey, key)
  }
  return key
}

export function clearCheckoutIdempotencyKey(options: {
  flow: CheckoutIdempotencyFlow
  fingerprint: string
  storage?: Storage | null
}): void {
  const storageKey = buildCheckoutIdempotencyStorageKey(options.flow, options.fingerprint)
  memoryCheckoutIdempotencyKeys.delete(storageKey)
  const storage = resolveStorage(options.storage)
  if (!storage) {
    return
  }
  safeStorageRemove(storage, storageKey)
}

function buildCheckoutIdempotencyStorageKey(flow: CheckoutIdempotencyFlow, fingerprint: string): string {
  return `${STORAGE_PREFIX}:${flow}:${fingerprint.trim() || 'default'}`
}

function resolveNonce(options: CreateCheckoutIdempotencyKeyOptions): string {
  if (options.randomUUID) {
    return options.randomUUID()
  }

  const randomUUID = globalThis.crypto?.randomUUID
  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto)
  }

  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const randomPart = random()
    .toString(36)
    .replace(/^0\./, '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 24)

  return `${now().toString(36)}-${randomPart || '0'}`
}

function normalizeCheckoutIdempotencyPart(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9:_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-:]+|[-:]+$/g, '')

  return normalized || fallback
}

function isUsableCheckoutIdempotencyKey(value: string | null): value is string {
  if (!value || value.length > CHECKOUT_IDEMPOTENCY_MAX_LENGTH) {
    return false
  }
  return SAFE_KEY_PATTERN.test(value)
}

function resolveStorage(storage: Storage | null | undefined): Storage | null {
  if (storage !== undefined) {
    return storage
  }
  try {
    if (typeof window !== 'undefined') {
      return window.sessionStorage
    }
  } catch {
    return null
  }
  return null
}

function safeStorageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage can be unavailable in privacy mode; checkout can still proceed with the in-memory key.
  }
}

function safeStorageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // Ignore storage failures; they should not block a successful checkout.
  }
}
