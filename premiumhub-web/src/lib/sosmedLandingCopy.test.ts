import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { normalizeNavbarMenuItems } from './navbarMenuCache'
import { DEFAULT_PUBLIC_NAV_ITEMS } from './publicNavItems'

describe('sosmed landing copy', () => {
  it('shows the DigiSosmed navbar brand for sosmed products', () => {
    expect(DEFAULT_PUBLIC_NAV_ITEMS).toContainEqual({ href: '/product/sosmed', label: 'DigiSosmed' })
    expect(DEFAULT_PUBLIC_NAV_ITEMS).not.toContainEqual({ href: '/product/sosmed', label: 'Paket Sosmed' })
  })

  it('normalizes stale sosmed navbar labels from cache or API into the DigiSosmed brand', () => {
    expect(normalizeNavbarMenuItems([{ href: '/product/sosmed', label: 'Sosmed' }])).toEqual([
      { href: '/product/digiconnect', label: 'DigiConnect' },
      { href: '/product/sosmed', label: 'DigiSosmed' },
    ])
  })

  it('uses the DigiSosmed product headline on the sosmed landing page', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/(public)/product/sosmed/page.tsx'), 'utf8')

    expect(source).toContain('Growth sosial praktis lewat DigiSosmed')
    expect(source).not.toContain('Pilih product sosmed yang tersedia')
  })
})
