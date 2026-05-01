import { describe, expect, it, vi } from 'vitest'

import { canSubmitAuth, isTurnstileEnabled, turnstileSiteKey } from './turnstile'

describe('turnstile helpers', () => {
  it('resolves site key from env', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '  site-key-123  ')
    expect(turnstileSiteKey()).toBe('site-key-123')
    vi.unstubAllEnvs()
  })

  it('detects whether turnstile is enabled', () => {
    expect(isTurnstileEnabled('')).toBe(false)
    expect(isTurnstileEnabled('   ')).toBe(false)
    expect(isTurnstileEnabled('site-key')).toBe(true)
  })

  it('controls auth submit state', () => {
    expect(canSubmitAuth(true, true, 'token')).toBe(false)
    expect(canSubmitAuth(false, true, '')).toBe(false)
    expect(canSubmitAuth(false, true, 'token')).toBe(true)
    expect(canSubmitAuth(false, false, '')).toBe(true)
  })
})
