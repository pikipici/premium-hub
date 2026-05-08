import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const checkoutPageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')

describe('sosmed checkout page idempotency wiring', () => {
  it('uses the shared checkout idempotency helper instead of ad-hoc browser randomness', () => {
    expect(checkoutPageSource).toContain('getOrCreateCheckoutIdempotencyKey')
    expect(checkoutPageSource).toContain('clearCheckoutIdempotencyKey')
    expect(checkoutPageSource).not.toContain('bundleIdempotencyKeyRef')
    expect(checkoutPageSource).not.toContain('crypto.randomUUID')
  })

  it('sends idempotency_key on both single-service and bundle wallet checkout payloads', () => {
    expect(checkoutPageSource).toMatch(/sosmedBundleServiceApi\.createOrder\(\{[\s\S]*idempotency_key:/)
    expect(checkoutPageSource).toMatch(/sosmedOrderService\.create\(\{[\s\S]*idempotency_key:/)
  })

  it('clears the used key only on successful navigation for both checkout flows', () => {
    expect(checkoutPageSource).toMatch(/clearCheckoutIdempotencyKey\(\{[\s\S]*flow: 'sosmed-bundle'[\s\S]*fingerprint:/)
    expect(checkoutPageSource).toMatch(/clearCheckoutIdempotencyKey\(\{[\s\S]*flow: 'sosmed-order'[\s\S]*fingerprint:/)
  })
})
