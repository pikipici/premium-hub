import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { normalizeNavbarMenuItems } from './navbarMenuCache'
import { DEFAULT_PUBLIC_NAV_ITEMS } from './publicNavItems'

describe('sosmed landing copy', () => {
  it('shows the buyer-facing navbar label requested for sosmed products', () => {
    expect(DEFAULT_PUBLIC_NAV_ITEMS).toContainEqual({ href: '/product/sosmed', label: 'Paket Sosmed' })
    expect(DEFAULT_PUBLIC_NAV_ITEMS).not.toContainEqual({ href: '/product/sosmed', label: 'Sosmed' })
  })

  it('normalizes stale sosmed navbar labels from cache or API into the new buyer-facing label', () => {
    expect(normalizeNavbarMenuItems([{ href: '/product/sosmed', label: 'Sosmed' }])).toEqual([
      { href: '/product/sosmed', label: 'Paket Sosmed' },
    ])
  })

  it('uses the requested product availability headline on the sosmed landing page', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/(public)/product/sosmed/page.tsx'), 'utf8')

    expect(source).toContain('Pilih product sosmed yang tersedia')
    expect(source).not.toContain('Pilih paket yang paling gampang dipahami')
  })
})
