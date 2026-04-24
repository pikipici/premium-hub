import { describe, expect, it } from 'vitest'

import {
  buildLoginHref,
  buildPathWithSearch,
  isProtectedPath,
  resolvePostAuthPath,
  sanitizeNextPath,
} from './auth'

describe('auth helpers', () => {
  it('sanitizes next path values', () => {
    expect(sanitizeNextPath('/dashboard/orders?id=123')).toBe('/dashboard/orders?id=123')
    expect(sanitizeNextPath('')).toBeNull()
    expect(sanitizeNextPath('https://evil.example')).toBeNull()
    expect(sanitizeNextPath('//evil.example')).toBeNull()
  })

  it('builds login href with preserved next path', () => {
    expect(buildLoginHref('/dashboard/wallet?tab=history')).toBe('/login?next=%2Fdashboard%2Fwallet%3Ftab%3Dhistory')
    expect(buildLoginHref('https://evil.example')).toBe('/login')
  })

  it('resolves post-auth path safely', () => {
    expect(resolvePostAuthPath('/product/sosmed/checkout?service=abc', 'user')).toBe('/product/sosmed/checkout?service=abc')
    expect(resolvePostAuthPath('//evil.example', 'user')).toBe('/dashboard')
    expect(resolvePostAuthPath(null, 'admin')).toBe('/admin')
  })

  it('joins pathname and search correctly', () => {
    expect(buildPathWithSearch('/dashboard', 'tab=wallet')).toBe('/dashboard?tab=wallet')
    expect(buildPathWithSearch('/dashboard', '?tab=wallet')).toBe('/dashboard?tab=wallet')
    expect(buildPathWithSearch('', '')).toBe('/')
  })

  it('marks protected paths only for guarded surfaces', () => {
    expect(isProtectedPath('/dashboard/orders')).toBe(true)
    expect(isProtectedPath('/admin/users')).toBe(true)
    expect(isProtectedPath('/product/prem-apps/checkout')).toBe(true)
    expect(isProtectedPath('/product/sosmed/checkout')).toBe(true)
    expect(isProtectedPath('/product/nokos')).toBe(false)
    expect(isProtectedPath('/login')).toBe(false)
  })
})
